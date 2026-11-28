import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/photo-ai.mjs";

async function runWorker(t, { modelReplies = [], claimStatus = 200, generateStory = true } = {}) {
  const config = {
    AI_WEBHOOK_SECRET: "fixture-webhook",
    SANITY_STUDIO_PROJECT_ID: "fixture-gallery",
    SANITY_STUDIO_DATASET: "fixture",
    SANITY_WRITE_TOKEN: "fixture-sanity-token",
    OPENAI_API_KEY: "fixture-model-token",
    OPENAI_API_ENDPOINT: "https://speedance.pro/v1/responses",
    OPENAI_VISION_MODEL: "gpt-6.1-sol",
    OPENAI_VISION_FALLBACK_MODEL: "",
  };
  const original = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
  Object.assign(process.env, config);
  t.after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const mutations = [];
  const requests = [];
  const queries = [];
  const failures = [];
  t.mock.method(console, "warn", (...args) => failures.push(args));
  t.mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input);
    if (url.hostname === "speedance.pro") {
      requests.push(JSON.parse(options.body));
      const { status, payload, bodyTimeout, requestId } = modelReplies[requests.length - 1];
      if (bodyTimeout) {
        return new Response(new ReadableStream({
          start(controller) { controller.error(new DOMException("fixture body read timed out", "TimeoutError")); },
        }));
      }
      return Response.json(payload, { status, ...(requestId && { headers: { "x-request-id": requestId } }) });
    }
    assert.equal(url.hostname, "fixture-gallery.api.sanity.io");
    if (url.pathname.includes("/data/query/")) {
      const query = url.searchParams.get("query");
      queries.push(query);
      if (query.includes('_type == "story"')) return Response.json({ result: [] });
      assert.match(query, /_rev/);
      return Response.json({ result: {
        _id: "test-photo", _rev: "queued-revision", title: "fixture", sourceFilename: "fixture.jpg",
        imageUrl: "https://cdn.sanity.io/images/fixture.gif", aiClassification: { generateStory },
      } });
    }
    assert.match(url.pathname, /\/data\/mutate\//);
    mutations.push(...JSON.parse(options.body).mutations);
    return Response.json({}, { status: mutations.length === 1 ? claimStatus : 200 });
  });

  const response = {
    status(code) { this.code = code; return this; },
    setHeader() { return this; },
    send(body) { this.body = JSON.parse(body); },
  };
  await handler({ method: "POST", headers: { "x-ai-webhook-secret": config.AI_WEBHOOK_SECRET }, body: { photoId: "test-photo" } }, response);
  return { response, mutations, requests, queries, failures };
}

const unavailable = { status: 502, payload: { error: { message: "Untrusted provider response" } } };

test("a model failure records the error without deleting the uploaded photo", async (t) => {
  const { response, mutations, requests } = await runWorker(t, { modelReplies: [unavailable, unavailable] });
  assert.equal(response.code, 200);
  assert.equal(response.body.status, "error");
  assert.equal(requests.length, 2);
  assert.equal(mutations[0].patch.ifRevisionID, "queued-revision");
  assert.equal(mutations.length, 2);
  assert.equal(mutations[1].patch.set.aiClassification.status, "error");
  assert.equal(mutations[1].patch.set.aiClassification.model, "gpt-5.6-sol");
  assert.match(mutations[1].patch.set.aiClassification.error, /502/);
  assert.doesNotMatch(JSON.stringify(mutations), /Untrusted provider response|"delete"/);
});

test("a temporary outage uses the compatible model and records which model succeeded", async (t) => {
  const output = {
    title: "Fixture image", altText: "A test image", subjects: [{ value: "object", confidence: 0.9 }], conditions: [],
    story: { title: "Fixture story", body: ["An example."], excerpt: "Example" },
  };
  const { response, mutations, requests } = await runWorker(t, {
    modelReplies: [unavailable, { status: 200, payload: { output_text: JSON.stringify(output) } }],
  });
  assert.equal(response.body.status, "approved");
  assert.deepEqual(requests.map(({ model }) => model), ["gpt-6.1-sol", "gpt-5.6-sol"]);
  assert.match(requests[1].input[0].content[1].image_url, /fm=jpg/);
  assert.equal(mutations[1].patch.set.aiClassification.model, "gpt-5.6-sol");
  assert.equal(mutations[1].patch.set.isHidden, undefined);
  assert.equal(mutations[2].createIfNotExists.aiModel, "gpt-5.6-sol");
});

test("a competing worker claim does not call the model again", async (t) => {
  const { response, mutations, requests } = await runWorker(t, { claimStatus: 409 });
  assert.equal(response.body.status, "skipped");
  assert.equal(mutations.length, 1);
  assert.equal(requests.length, 0);
});

test("a response body timeout falls back without requesting story examples for a photo-only import", async (t) => {
  const output = JSON.stringify({ title: "Fixture image", altText: "A test image" });
  const { response, requests, queries, failures } = await runWorker(t, {
    generateStory: false,
    modelReplies: [{ bodyTimeout: true }, { status: 200, payload: {
      output_text: "",
      output: [{ content: [{ type: "output_text", text: output.slice(0, 20) }, { type: "output_text", text: output.slice(20) }] }],
    } }],
  });
  assert.equal(response.body.status, "approved");
  assert.equal(failures[0][1].reason, "timeout");
  assert.deepEqual(requests.map(({ model }) => model), ["gpt-6.1-sol", "gpt-5.6-sol"]);
  assert.ok(queries.every((query) => !query.includes('_type == "story"')));
  assert.match(requests[0].input[0].content[0].text, /story 必须为 null/);
});

test("an incomplete model reply falls back and reports the provider request ID", async (t) => {
  const requestId = "bcfdc0fe-73a5-4b83-8524-7354a6a46105";
  const { response, failures } = await runWorker(t, { modelReplies: [
    { status: 200, payload: { status: "incomplete", output_text: '{"title":' }, requestId },
    { status: 200, payload: { output_text: '{"title":"Fixture","altText":"Sample"}' } },
  ] });
  assert.equal(response.body.status, "approved");
  assert.equal(failures[0][1].reason, "incomplete-response");
  assert.equal(failures[0][1].requestId, requestId);
  assert.doesNotMatch(JSON.stringify(failures), /fixture-model-token|output_text/);
});

test("an invalid structured reply falls back without overwriting photo fields", async (t) => {
  const { response, failures, mutations } = await runWorker(t, { modelReplies: [
    { status: 200, payload: { output_text: '{"title":"Invalid"' } },
    { status: 200, payload: { output_text: '{"title":"Fixture","altText":"Sample"}' } },
  ] });
  assert.equal(response.body.status, "approved");
  assert.equal(failures[0][1].reason, "invalid-json");
  assert.equal(mutations[1].patch.set.title, "Fixture");
});

test("a model refusal is saved without attempting another model", async (t) => {
  const { response, requests, failures } = await runWorker(t, { modelReplies: [
    { status: 200, payload: { output: [{ content: [{ type: "refusal", refusal: "Fixture refusal" }] }] } },
  ] });
  assert.equal(response.body.status, "error");
  assert.equal(requests.length, 1);
  assert.equal(failures[0][1].reason, "refusal");
  assert.doesNotMatch(JSON.stringify(failures), /Fixture refusal/);
});
