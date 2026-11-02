import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@sanity/client";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const projectRoot = path.resolve(import.meta.dirname, "..");
const apiVersion = "2025-02-19";
const defaultModel = "gpt-4o-mini";

const subjectOptions = [
  ["landscape", "风景"],
  ["mountain", "山体"],
  ["flower", "花朵"],
  ["plant", "植物"],
  ["forest", "森林"],
  ["architecture", "建筑"],
  ["city", "城市"],
  ["river", "河流"],
  ["ocean", "海洋"],
  ["sky", "天空"],
  ["road", "道路"],
  ["person", "人物"],
  ["object", "物件"],
  ["abstract", "抽象"],
];

const conditionOptions = [
  ["sunrise", "日出"],
  ["sunset", "日落"],
  ["day", "白天"],
  ["night", "夜晚"],
  ["fog", "雾"],
  ["rain", "雨"],
  ["snow", "雪"],
  ["overcast", "阴天"],
];

function parseArgs(argv) {
  const args = { dryRun: false, force: false, limit: undefined, ids: undefined, concurrency: 2 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--limit") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) throw new Error("--limit must be a positive integer");
      args.limit = value;
      index += 1;
    } else if (arg === "--ids") {
      args.ids = String(argv[index + 1] ?? "").split(",").map((value) => value.trim()).filter(Boolean);
      index += 1;
    } else if (arg === "--concurrency") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1 || value > 4) throw new Error("--concurrency must be an integer from 1 to 4");
      args.concurrency = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

async function loadEnv() {
  for (const filename of [".env.local", ".env"]) {
    try {
      const content = await readFile(path.join(projectRoot, filename), "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const separator = line.indexOf("=");
        if (separator < 0) continue;
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
        if (process.env[key] === undefined) process.env[key] = value;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function optionsText(options) {
  return options.map(([value, title]) => `${value}（${title}）`).join(", ");
}

function buildPrompt(photo) {
  return `你是摄影档案的分类助理。请只根据图片本身做保守判断，不要猜测精确拍摄地点、人物身份或图片背后的故事。

给这张照片选择 0 到 5 个主体标签，以及 0 到 4 个时间 / 天气标签。只有画面明显包含的元素才选择；不确定时宁可不选。主体可以有多个，例如花朵前景和山体背景应同时选择 flower 和 mountain。

主体标签（只能使用 value）：${optionsText(subjectOptions)}
时间 / 天气标签（只能使用 value）：${optionsText(conditionOptions)}

照片标题：${photo.title ?? "未命名"}
拍摄日期（如果有）：${photo.date ?? "未知"}
已有地点信息（仅供文字生成参考，不要据此推断图片中的地点）：${photo.location ?? "未知"}

替代文本应客观、简短、适合无障碍阅读，不要使用诗意夸张表达。caption 可以为空。`;
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    subjects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { value: { type: "string" }, confidence: { type: "number" } },
        required: ["value", "confidence"],
      },
    },
    conditions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { value: { type: "string" }, confidence: { type: "number" } },
        required: ["value", "confidence"],
      },
    },
    primarySubject: { type: ["string", "null"] },
    altText: { type: "string" },
    caption: { type: ["string", "null"] },
  },
  required: ["subjects", "conditions", "primarySubject", "altText", "caption"],
};

function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const parts = response.output?.flatMap((item) => item.content ?? []) ?? [];
  return parts.find((part) => part.type === "output_text")?.text ?? "";
}

function cleanJson(value) {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function normalizePredictions(prediction) {
  const subjectValues = new Set(subjectOptions.map(([value]) => value));
  const conditionValues = new Set(conditionOptions.map(([value]) => value));
  const normalizeItems = (items, allowed, limit) => {
    const seen = new Set();
    return (Array.isArray(items) ? items : [])
      .map((item) => ({ value: typeof item?.value === "string" ? item.value : "", confidence: Number(item?.confidence) }))
      .filter((item) => allowed.has(item.value) && !seen.has(item.value))
      .map((item) => ({ ...item, confidence: Number.isFinite(item.confidence) ? Math.max(0, Math.min(1, item.confidence)) : 0 }))
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, limit)
      .filter((item) => {
        seen.add(item.value);
        return true;
      });
  };
  const subjects = normalizeItems(prediction?.subjects, subjectValues, 5);
  const conditions = normalizeItems(prediction?.conditions, conditionValues, 4);
  const primarySubject = subjectValues.has(prediction?.primarySubject) && subjects.some((item) => item.value === prediction.primarySubject) ? prediction.primarySubject : null;
  const altText = typeof prediction?.altText === "string" ? prediction.altText.trim().slice(0, 160) : "";
  const caption = typeof prediction?.caption === "string" ? prediction.caption.trim().slice(0, 600) : null;
  return { subjects, conditions, primarySubject, altText, caption };
}

async function callVisionModel(photo, model) {
  const configuredEndpoint = process.env.OPENAI_API_ENDPOINT?.trim();
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/$/, "");
  const endpoint = configuredEndpoint
    ? configuredEndpoint.endsWith("/responses")
      ? configuredEndpoint
      : `${configuredEndpoint.replace(/\/$/, "")}${configuredEndpoint.endsWith("/v1") ? "" : "/v1"}/responses`
    : `${baseUrl}/v1/responses`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildPrompt(photo) },
            { type: "input_image", image_url: photo.imageUrl, detail: "low" },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "photo_classification", strict: true, schema: responseSchema } },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`OpenAI request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const payload = await response.json();
  const text = outputText(payload);
  if (!text) throw new Error("OpenAI returned no structured output");
  return normalizePredictions(JSON.parse(cleanJson(text)));
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  }));
}

await loadEnv();
const args = parseArgs(process.argv.slice(2));
const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.VITE_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.VITE_SANITY_DATASET ?? "production";
const token = process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_AUTH_TOKEN;
const model = process.env.OPENAI_VISION_MODEL ?? defaultModel;
if (!projectId || !token) throw new Error("Missing SANITY_STUDIO_PROJECT_ID and SANITY_WRITE_TOKEN");
if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

const proxyUrl = process.env.OPENAI_HTTPS_PROXY ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? "http://127.0.0.1:7897";
setGlobalDispatcher(new ProxyAgent({ uri: proxyUrl, requestTls: { rejectUnauthorized: true } }));

const client = createClient({ projectId, dataset, token, apiVersion, useCdn: false });
const baseFilter = args.force ? "true" : "(!defined(aiClassification.status) || aiClassification.status == \"error\")";
const idFilter = args.ids?.length ? " && _id in $ids" : "";
const query = `*[_type == "photo" && defined(image.asset->url) && (${baseFilter})${idFilter}] | order(_createdAt asc) {
  _id, title, date, location, "imageUrl": image.asset->url
}`;
const photos = await client.fetch(query, args.ids?.length ? { ids: args.ids } : {});
const selected = args.limit ? photos.slice(0, args.limit) : photos;
console.log(`AI classification: ${selected.length} photo(s), model=${model}, dryRun=${args.dryRun}`);

const report = [];
await runPool(selected, args.concurrency, async (photo, index) => {
  const prefix = `[${index + 1}/${selected.length}] ${photo._id}`;
  try {
    if (!args.dryRun) await client.patch(photo._id).set({ aiClassification: { status: "processing", model } }).commit();
    const result = await callVisionModel(photo, model);
    if (!args.dryRun) {
      await client.patch(photo._id).set({
        aiClassification: {
          status: "suggested",
          model,
          subjects: result.subjects,
          conditions: result.conditions,
          primarySubject: result.primarySubject,
          altText: result.altText,
          caption: result.caption,
          processedAt: new Date().toISOString(),
        },
      }).commit();
    }
    report.push({ id: photo._id, status: "suggested", ...result });
    console.log(`${prefix} ok -> ${result.subjects.map((item) => item.value).join(", ") || "no subject"}`);
  } catch (error) {
    const message = error instanceof Error ? `${error.message}${error.cause?.message ? ` (${error.cause.message})` : ""}` : String(error);
    if (!args.dryRun) await client.patch(photo._id).set({ aiClassification: { status: "error", model, error: message.slice(0, 1000), processedAt: new Date().toISOString() } }).commit();
    report.push({ id: photo._id, status: "error", error: message });
    console.error(`${prefix} failed -> ${message}`);
  }
});

const reportDir = path.join(projectRoot, "sanity", "seed", "generated");
await mkdir(reportDir, { recursive: true });
const reportPath = path.join(reportDir, `ai-classification-${Date.now()}.json`);
await writeFile(reportPath, JSON.stringify({ processedAt: new Date().toISOString(), model, dryRun: args.dryRun, report }, null, 2), "utf8");
console.log(`Report: ${reportPath}`);
