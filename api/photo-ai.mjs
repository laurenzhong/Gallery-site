const apiVersion = "2025-02-19";
const defaultModel = "gpt-4o-mini";

const subjects = [
  ["landscape", "风景"], ["mountain", "山体"], ["flower", "花朵"], ["plant", "植物"],
  ["forest", "森林"], ["architecture", "建筑"], ["city", "城市"], ["river", "河流"],
  ["ocean", "海洋"], ["sky", "天空"], ["road", "道路"], ["person", "人物"],
  ["object", "物件"], ["abstract", "抽象"],
];

const conditions = [
  ["sunrise", "日出"], ["sunset", "日落"], ["day", "白天"], ["night", "夜晚"],
  ["fog", "雾"], ["rain", "雨"], ["snow", "雪"], ["overcast", "阴天"],
];

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    subjects: { type: "array", items: { type: "object", additionalProperties: false, properties: { value: { type: "string" }, confidence: { type: "number" } }, required: ["value", "confidence"] } },
    conditions: { type: "array", items: { type: "object", additionalProperties: false, properties: { value: { type: "string" }, confidence: { type: "number" } }, required: ["value", "confidence"] } },
    primarySubject: { type: ["string", "null"] },
    title: { type: "string" },
    altText: { type: "string" },
    caption: { type: ["string", "null"] },
    story: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        excerpt: { type: "string" },
        body: { type: "array", items: { type: "string" } },
      },
      required: ["title", "excerpt", "body"],
    },
  },
  required: ["subjects", "conditions", "primarySubject", "title", "altText", "caption", "story"],
};

function env(name, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}

function cleanJson(value) {
  return String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const parts = response.output?.flatMap((item) => item.content || []) || [];
  return parts.find((part) => part.type === "output_text")?.text || "";
}

function normalize(result) {
  const subjectValues = new Set(subjects.map(([value]) => value));
  const conditionValues = new Set(conditions.map(([value]) => value));
  const normalizeList = (items, allowed, limit) => {
    const seen = new Set();
    return (Array.isArray(items) ? items : [])
      .map((item) => ({ value: typeof item?.value === "string" ? item.value : "", confidence: Number(item?.confidence) }))
      .filter((item) => allowed.has(item.value) && !seen.has(item.value))
      .map((item) => ({ ...item, confidence: Number.isFinite(item.confidence) ? Math.max(0, Math.min(1, item.confidence)) : 0 }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  };
  const normalizedSubjects = normalizeList(result?.subjects, subjectValues, 5);
  const normalizedConditions = normalizeList(result?.conditions, conditionValues, 4);
  const primarySubject = subjectValues.has(result?.primarySubject) && normalizedSubjects.some((item) => item.value === result.primarySubject) ? result.primarySubject : null;
  const story = result?.story && typeof result.story === "object"
    ? {
        title: String(result.story.title || result.title || "照片手记").trim().slice(0, 160),
        excerpt: String(result.story.excerpt || "").trim().slice(0, 500),
        body: (Array.isArray(result.story.body) ? result.story.body : []).map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12),
      }
    : null;
  return {
    subjects: normalizedSubjects,
    conditions: normalizedConditions,
    primarySubject,
    title: String(result?.title || "").trim().slice(0, 160),
    altText: String(result?.altText || "").trim().slice(0, 160),
    caption: typeof result?.caption === "string" ? result.caption.trim().slice(0, 800) : null,
    story: story?.body.length ? story : null,
  };
}

function safePart(value) {
  return String(value || "photo").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "photo";
}

function slugify(value, fallback) {
  const slug = String(value || "").normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 88);
  return slug || fallback;
}

function blocksFromStory(body, prefix) {
  return body.map((text, index) => ({
    _type: "block",
    _key: `${prefix}-${index}`,
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: `${prefix}-${index}-span`, marks: [], text }],
  }));
}

async function sanityRequest(pathname, init = {}) {
  const projectId = env("SANITY_STUDIO_PROJECT_ID", env("VITE_SANITY_PROJECT_ID"));
  const token = env("SANITY_WRITE_TOKEN", env("SANITY_AUTH_TOKEN"));
  if (!projectId || !token) throw new Error("Sanity server credentials are not configured");
  const response = await fetch(`https://${projectId}.api.sanity.io/v${apiVersion}${pathname.replace(/^\/v?\d{4}-\d{2}-\d{2}/, "")}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`Sanity request failed (${response.status})`), { status: response.status });
  return payload;
}

async function sanityQuery(query, params = {}) {
  const projectId = env("SANITY_STUDIO_PROJECT_ID", env("VITE_SANITY_PROJECT_ID"));
  const dataset = env("SANITY_STUDIO_DATASET", env("VITE_SANITY_DATASET", "production"));
  const token = env("SANITY_WRITE_TOKEN", env("SANITY_AUTH_TOKEN"));
  if (!projectId || !token) throw new Error("Sanity server credentials are not configured");
  const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);
  url.searchParams.set("query", query);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(`$${key}`, JSON.stringify(value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Sanity query failed (${response.status})`);
  return payload.result;
}

function modelImageUrl(source) {
  if (!source) throw new Error("缺少图片资源，请在照片库检查图片后重试 AI。");
  const url = new URL(source);
  if (url.hostname === "cdn.sanity.io") {
    url.searchParams.set("w", "1400");
    url.searchParams.set("h", "1400");
    url.searchParams.set("fit", "max");
    url.searchParams.set("fm", "jpg");
  }
  return url.href;
}

const upstreamBusy = [502, 503, 504];

function modelError(status) {
  if (upstreamBusy.includes(status)) return `AI 服务暂时不可用（${status}），请稍后重试 AI。`;
  if (status === 429) return "AI 服务达到使用限额（429），请稍后重试 AI。";
  if (status === 401 || status === 403) return `AI 服务拒绝访问（${status}），请检查服务端配置。`;
  return `AI 服务未能处理图片（${status}），可以在照片库重试。`;
}

async function requestModel(endpoint, request) {
  const key = env("OPENAI_API_KEY");
  if (!key) throw new Error("AI 服务尚未配置，照片已保存。");
  const compatibleFallback = new URL(endpoint).hostname === "speedance.pro" && request.model === "gpt-6.1-sol" ? "gpt-5.6-sol" : request.model;
  const retryModel = env("OPENAI_VISION_FALLBACK_MODEL", compatibleFallback);

  for (let attempt = 0; ; attempt += 1) {
    const model = attempt === 0 ? request.model : retryModel;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, model }),
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    }).catch(() => undefined);

    if (attempt === 0 && (!response || upstreamBusy.includes(response.status))) {
      await response?.body?.cancel().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 750));
      continue;
    }
    if (!response) throw new Error("连接 AI 服务失败，请稍后重试 AI。");
    if (!response.ok) throw new Error(modelError(response.status));
    return { payload: await response.json(), model };
  }
}

async function callModel(photo, prompt, styleExamples, model) {
  const endpoint = env("OPENAI_API_ENDPOINT") || `${env("OPENAI_BASE_URL", "https://api.openai.com").replace(/\/$/, "")}/v1/responses`;
  const locationText = [photo.place, photo.spot].filter(Boolean).join(" / ") || "未知";
  const styleText = styleExamples.map((story) => `标题：${story.title}\n摘要：${story.excerpt || ""}\n正文：${(story.body || []).map((block) => block.children?.map((child) => child.text || "").join("") || "").join("\n")}`).join("\n\n");
  const instruction = `你是摄影档案的写作者和分类助手。请直接观察图片，并结合 EXIF 和地点信息，以摄影者第一人称写作。${prompt ? `\n用户补充提示词：${prompt}` : ""}\n\n地点标签用于归档：${locationText}。不要把宽泛地点和具体拍摄点混淆。\n\n主体标签只能使用：${subjects.map(([value, title]) => `${value}（${title}）`).join(", ")}\n时间 / 天气标签只能使用：${conditions.map(([value, title]) => `${value}（${title}）`).join(", ")}\n\n照片文件名：${photo.sourceFilename || "未知"}\n原始标题：${photo.title || "未命名"}\n拍摄日期：${photo.date || "未知"}\nEXIF 地点：${photo.location || "未知"}\n相机：${photo.camera || "未知"}\n镜头：${photo.lens || "未知"}\n光圈：${photo.aperture || "未知"}\n快门：${photo.shutter || "未知"}\nISO：${photo.iso || "未知"}\n焦距：${photo.focalLength || "未知"}\n\n现有手记风格参考：\n${styleText || "使用具体、克制、第一人称的摄影现场记录。"}`;
  const { payload, model: usedModel } = await requestModel(endpoint, {
    model,
    input: [{ role: "user", content: [{ type: "input_text", text: instruction }, { type: "input_image", image_url: modelImageUrl(photo.imageUrl), detail: "low" }] }],
    text: { format: { type: "json_schema", name: "photo_ai_result", strict: true, schema: responseSchema } },
  });
  try {
    const result = normalize(JSON.parse(cleanJson(outputText(payload))));
    if (result.title && result.altText) return { ...result, model: usedModel };
  } catch {
    // Malformed model replies are retriable without affecting the imported photo.
  }
  throw new Error("AI 返回的照片信息不完整，请稍后重试 AI。");
}

async function processPhoto(photo, options) {
  const model = env("OPENAI_VISION_MODEL", defaultModel);
  const mutationPath = `/data/mutate/${options.dataset}`;
  const task = { model, generateStory: options.generateStory, prompt: options.prompt || "" };
  try {
    await sanityRequest(mutationPath, { method: "POST", body: JSON.stringify({ mutations: [{ patch: { id: photo._id, ifRevisionID: photo._rev, set: { aiClassification: { ...task, status: "processing" } } } }] }) });
  } catch (error) {
    if ([404, 409].includes(error.status)) return { id: photo._id, status: "skipped" };
    throw error;
  }
  try {
    const result = await callModel(photo, options.prompt, options.styleExamples, model);
    const existingSubjects = Array.isArray(photo.subjects) ? photo.subjects : [];
    const existingConditions = Array.isArray(photo.conditions) ? photo.conditions : [];
    const nextSubjects = [...new Set([...existingSubjects, ...result.subjects.map((item) => item.value)])].slice(0, 5);
    const nextConditions = [...new Set([...existingConditions, ...result.conditions.map((item) => item.value)])].slice(0, 4);
    const sourceBase = String(photo.sourceFilename || "").replace(/\.[^.]+$/, "");
    const set = {
      subjects: nextSubjects,
      conditions: nextConditions,
      ...(result.primarySubject ? { primarySubject: result.primarySubject } : {}),
      ...(result.title && (!photo.title || photo.title === sourceBase) ? { title: result.title } : {}),
      ...(result.altText && !photo.altText ? { altText: result.altText } : {}),
      ...(result.caption ? { caption: result.caption } : {}),
      aiClassification: { ...task, model: result.model, status: "approved", subjects: result.subjects, conditions: result.conditions, primarySubject: result.primarySubject, title: result.title, altText: result.altText, caption: result.caption, processedAt: new Date().toISOString() },
    };
    const mutations = [{ patch: { id: photo._id, set } }];
    if (options.generateStory && result.story) {
      const storyId = `story-ai-${safePart(photo._id)}`;
      const storyTitle = result.story.title || result.title || photo.title || "照片手记";
      mutations.push({ createIfNotExists: { _id: storyId, _type: "story", title: storyTitle, slug: { _type: "slug", current: `${slugify(storyTitle, safePart(photo._id))}-${safePart(photo._id).slice(-8)}` }, publishedAt: new Date().toISOString(), isHidden: false, isPinned: false, excerpt: result.story.excerpt, coverPhoto: { _type: "reference", _ref: photo._id }, relatedPhotos: [{ _type: "reference", _ref: photo._id }], body: blocksFromStory(result.story.body, safePart(storyId)), aiGenerated: true, aiModel: result.model, aiPrompt: options.prompt || "", sourcePhoto: { _type: "reference", _ref: photo._id } } });
      set.aiClassification.storyId = storyId;
    }
    await sanityRequest(mutationPath, { method: "POST", body: JSON.stringify({ mutations }) });
    return { id: photo._id, status: "approved" };
  } catch (error) {
    const message = error instanceof SyntaxError ? "AI 返回的内容无法读取，请重试 AI。"
      : error instanceof Error ? error.message : "AI 处理失败，请稍后重试 AI。";
    await sanityRequest(mutationPath, { method: "POST", body: JSON.stringify({ mutations: [{ patch: { id: photo._id, set: { aiClassification: { ...task, status: "error", error: message, processedAt: new Date().toISOString() } } } }] }) });
    return { id: photo._id, status: "error", error: message };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const expectedSecret = env("AI_WEBHOOK_SECRET");
  if (!expectedSecret) return json(res, 500, { error: "AI_WEBHOOK_SECRET is not configured" });
  if (req.headers["x-ai-webhook-secret"] !== expectedSecret) return json(res, 401, { error: "Unauthorized" });
  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const dataset = env("SANITY_STUDIO_DATASET", env("VITE_SANITY_DATASET", "production"));
    const photoId = payload.photoId || payload._id || payload.documentId;
    const filter = `_type == "photo" && aiClassification.status == "queued" && !(_id in path("drafts.**"))`;
    const pick = photoId ? `*[${filter} && _id == $id][0]` : `*[${filter}] | order(_createdAt asc)[0]`;
    const query = `${pick}{_id,_rev,title,sourceFilename,subjects,conditions,altText,date,location,camera,lens,aperture,shutter,iso,focalLength,"imageUrl": image.asset->url,"place": place->title,spot,aiClassification}`;
    const photo = await sanityQuery(query, photoId ? { id: photoId } : {});
    if (!photo) return json(res, 200, { status: "empty" });
    const styleExamples = await sanityQuery(`*[_type == "story" && defined(body)] | order(publishedAt desc)[0...3]{title,excerpt,body}`) || [];
    const result = await processPhoto(photo, { dataset, prompt: photo.aiClassification?.prompt || "", generateStory: photo.aiClassification?.generateStory === true, styleExamples });
    return json(res, 200, result);
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}
