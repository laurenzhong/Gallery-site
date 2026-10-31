import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const projectRoot = path.resolve(import.meta.dirname, "..");
const requirePages = process.argv.includes("--require");
const execFileAsync = promisify(execFile);

async function loadEnvFile(filename) {
  try {
    const content = await readFile(path.join(projectRoot, filename), "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function fail(message) {
  throw new Error(`Page content contract failed: ${message}`);
}

function isInternalPath(value) {
  return !value || (value.startsWith("/") && !value.startsWith("//"));
}

function assertPhoto(id, photos, context) {
  if (!id) fail(`${context} 缺少照片引用`);
  const photo = photos.get(id);
  if (!photo) fail(`${context} 引用了不存在的照片 ${id}`);
  if (!photo.hasImage) fail(`${context} 引用了没有图片资源的照片 ${id}`);
  if (photo.isHidden) fail(`${context} 引用了已隐藏的照片 ${id}`);
}

function assertPhotoList(ids, photos, context, { required = false } = {}) {
  if (!Array.isArray(ids) || ids.length === 0) {
    if (required) fail(`${context} 至少需要一张照片`);
    return;
  }
  ids.forEach((id, index) => assertPhoto(id, photos, `${context}[${index}]`));
}

async function fetchPayload(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) fail(`Sanity query failed: ${response.status} ${await response.text()}`);
    return response.json();
  } catch (error) {
    if (process.platform !== "win32") throw error;
    const command = [
      "$headers = @{}",
      "if ($env:PAGE_CONTENT_TOKEN) { $headers.Authorization = \"Bearer $env:PAGE_CONTENT_TOKEN\" }",
      "$response = Invoke-WebRequest -UseBasicParsing -Uri $env:PAGE_CONTENT_URL -Headers $headers -TimeoutSec 20",
      "$response.Content",
    ].join("; ");
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
      env: {
        ...process.env,
        PAGE_CONTENT_URL: url.toString(),
        PAGE_CONTENT_TOKEN: process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_AUTH_TOKEN ?? "",
      },
      timeout: 25000,
    });
    return JSON.parse(stdout);
  }
}

function validateHome(page, photos, categories) {
  const seenSlots = new Set();
  for (const [index, section] of (page.sections ?? []).entries()) {
    if (section.isVisible === false) continue;
    const context = `${page._id}/${section._type || "section"}#${index + 1}`;

    if (section._type === "featureCardsSlot") {
      if (!section.cards?.length || section.cards.length > 3) fail(`${context} 卡片数量必须是 1 到 3 张`);
      for (const [cardIndex, card] of section.cards.entries()) {
        if (!card.title) fail(`${context}.cards[${cardIndex}] 缺少标题`);
        assertPhoto(card.photo, photos, `${context}.cards[${cardIndex}]`);
        if (!isInternalPath(card.linkTarget)) fail(`${context}.cards[${cardIndex}] 只能使用站内链接`);
      }
      continue;
    }

    if (section._type === "gallerySlot") {
      const allowedSlots = new Set(["landscape", "quiet", "city", "harborCarousel"]);
      if (!allowedSlots.has(section.slotKey)) fail(`${context} 的 slotKey 无效`);
      if (seenSlots.has(section.slotKey)) fail(`${context} 重复配置了槽位 ${section.slotKey}`);
      seenSlots.add(section.slotKey);
      if (!["landscapeCarousel", "squareRail"].includes(section.presentation)) fail(`${context} 的 presentation 无效`);
      if (section.sourceMode === "category") {
        if (!section.categoryId || !categories.has(section.categoryId)) fail(`${context} 的分类来源无效`);
        if (!Number.isInteger(section.limit) || section.limit < 1 || section.limit > 48) fail(`${context} 的 limit 无效`);
      } else {
        assertPhotoList(section.photoIds, photos, context, { required: true });
      }
      continue;
    }

    if (section._type === "bannerSlot") {
      assertPhoto(section.photo, photos, context);
      if (!isInternalPath(section.linkTarget)) fail(`${context} 只能使用站内链接`);
      continue;
    }

    if (section._type === "harborSlot") {
      assertPhoto(section.heroPhoto, photos, `${context}.heroPhoto`);
      assertPhotoList(section.carouselPhotoIds, photos, `${context}.carouselPhotos`, { required: true });
      assertPhotoList(section.stackPhotoIds, photos, `${context}.stackPhotos`, { required: true });
      assertPhotoList(section.squarePhotoIds, photos, `${context}.squarePhotos`, { required: true });
      if (section.featurePhoto) assertPhoto(section.featurePhoto, photos, `${context}.featurePhoto`);
      continue;
    }

    if (section._type === "heroSlot") {
      assertPhoto(section.photo, photos, context);
      if (!isInternalPath(section.linkTarget)) fail(`${context} 只能使用站内链接`);
      continue;
    }

    fail(`${context} 使用了首页不支持的模块类型 ${section._type}`);
  }
}

function validatePhotobalcony(page, photos) {
  const allowedPeriods = new Set(["may", "marchPortraits", "marchWide", "february", "january", "winter", "summer"]);
  const seenPeriods = new Set();

  for (const [index, section] of (page.sections ?? []).entries()) {
    if (section.isVisible === false) continue;
    const context = `${page._id}/${section._type || "section"}#${index + 1}`;
    if (section._type === "heroSlot") {
      assertPhoto(section.photo, photos, context);
      continue;
    }
    if (section._type !== "balconyPeriodSlot") fail(`${context} 使用了 Photobalcony 不支持的模块类型 ${section._type}`);
    if (!allowedPeriods.has(section.periodKey)) fail(`${context} 的 periodKey 无效`);
    if (seenPeriods.has(section.periodKey)) fail(`${context} 重复配置了时间段 ${section.periodKey}`);
    seenPeriods.add(section.periodKey);
    if (!section.title) fail(`${context} 缺少标题`);
    assertPhotoList(section.photoIds, photos, context, { required: true });
  }
}

await loadEnvFile(".env.local");
await loadEnvFile(".env");

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.VITE_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.VITE_SANITY_DATASET ?? "production";
if (!projectId || projectId === "your_sanity_project_id" || projectId === "yourprojectid") {
  fail("Sanity project is not configured");
}

const query = `{
  "pages": *[_type == "pageContent" && pageKey in ["home", "photobalcony"]] {
    _id,
    pageKey,
    title,
    sections[] {
      _type,
      _key,
      title,
      isVisible,
      slotKey,
      presentation,
      sourceMode,
      limit,
      periodKey,
      linkTarget,
      "photo": photo._ref,
      "photoIds": photos[]._ref,
      "heroPhoto": heroPhoto._ref,
      "carouselPhotoIds": carouselPhotos[]._ref,
      "featurePhoto": featurePhoto._ref,
      "stackPhotoIds": stackPhotos[]._ref,
      "squarePhotoIds": squarePhotos[]._ref,
      "categoryId": category._ref,
      cards[]{title, linkTarget, "photo": photo._ref}
    }
  },
  "photos": *[_type == "photo"]{_id, "hasImage": defined(image.asset), isHidden},
  "categories": *[_type == "category"]{_id}
}`;

const url = new URL(`https://${projectId}.api.sanity.io/v2025-02-19/data/query/${dataset}`);
url.searchParams.set("query", query);
const payload = await fetchPayload(url);
const result = payload.result ?? {};
const pages = result.pages ?? [];

if (pages.length === 0) {
  if (requirePages) fail("没有找到 pageContent 文档");
  console.log("Page content contract: no pageContent documents found; migration has not started.");
} else {
  const photos = new Map((result.photos ?? []).map((photo) => [photo._id, photo]));
  const categories = new Set((result.categories ?? []).map((category) => category._id));
  const pagesByKey = new Map();
  for (const page of pages) {
    if (pagesByKey.has(page.pageKey)) fail(`pageKey 重复：${page.pageKey}`);
    pagesByKey.set(page.pageKey, page);
    if (!page.title) fail(`${page._id} 缺少标题`);
    if (page.pageKey === "home") validateHome(page, photos, categories);
    else if (page.pageKey === "photobalcony") validatePhotobalcony(page, photos);
    else fail(`${page._id} 使用了不支持的 pageKey ${page.pageKey}`);
  }

  if (requirePages) {
    for (const pageKey of ["home", "photobalcony"]) {
      if (!pagesByKey.has(pageKey)) fail(`缺少 pageContent-${pageKey}`);
    }
  }

  console.log(`Page content contract passed: ${pages.length} pageContent document(s), ${photos.size} photos checked.`);
}
