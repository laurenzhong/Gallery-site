import { createClient } from "@sanity/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");

async function loadEnv() {
  for (const filename of [".env.local", ".env"]) {
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
}

function fail(message) {
  throw new Error(`Page content verification failed: ${message}`);
}

await loadEnv();
const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.VITE_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.VITE_SANITY_DATASET ?? "production";
const token = process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_AUTH_TOKEN;

if (!projectId || projectId === "your_sanity_project_id" || projectId === "yourprojectid") {
  fail("Sanity project is not configured");
}

const client = createClient({ projectId, dataset, apiVersion: "2025-02-19", token, useCdn: false });
const result = await client.fetch(`{
  "layouts": *[_type == "pageLayout" && pageKey in ["home", "photobalcony"]] {
    _id,
    pageKey,
    title,
    "sections": sections[] {
      _key,
      title,
      style,
      isVisible,
      "photoIds": photos[]._ref,
      "coverId": coverPhoto._ref,
      "categoryId": category._ref
    }
  },
  "copy": *[_type == "siteCopy"][0]{_id, navigation, pages, sections, controls, metadata, footer},
  "categories": *[_type == "category"]{_id},
  "photos": *[_type == "photo"]{_id, "hasImage": defined(image.asset)}
}`);

const layoutsByPage = new Map((result.layouts ?? []).map((layout) => [layout.pageKey, layout]));
for (const pageKey of ["home", "photobalcony"]) {
  const layout = layoutsByPage.get(pageKey);
  if (!layout) fail(`missing pageLayout for ${pageKey}`);
  if (!layout.title) fail(`${pageKey} has no title`);
  if (!layout.sections?.length) fail(`${pageKey} has no sections`);
}

const styles = new Set(["hero", "featureCards", "landscapeCarousel", "banner", "grid", "stack", "split", "carousel"]);
const photosById = new Map((result.photos ?? []).map((photo) => [photo._id, photo]));
const categoriesById = new Set((result.categories ?? []).map((category) => category._id));
for (const layout of layoutsByPage.values()) {
  for (const section of layout.sections ?? []) {
    if (!styles.has(section.style)) fail(`${layout.pageKey}/${section.title || section._key} uses unsupported style ${section.style}`);
    if (section.isVisible === false) continue;
    const refs = [...(section.photoIds ?? []), section.coverId].filter(Boolean);
    if (!refs.length && !section.categoryId) fail(`${layout.pageKey}/${section.title || section._key} has no photo source`);
    if (section.categoryId && !categoriesById.has(section.categoryId)) fail(`${layout.pageKey}/${section.title || section._key} references a missing category`);
    for (const photoId of refs) {
      const photo = photosById.get(photoId);
      if (!photo) fail(`${layout.pageKey}/${section.title || section._key} references missing photo ${photoId}`);
      if (!photo.hasImage) fail(`${layout.pageKey}/${section.title || section._key} references photo without an image asset`);
    }
  }
}

if (!result.copy?._id) fail("missing siteCopy singleton");
for (const field of ["navigation", "pages", "sections", "controls", "metadata", "footer"]) {
  if (!result.copy[field]) fail(`siteCopy is missing ${field}`);
}

console.log(`Page content verification passed: ${layoutsByPage.size} layouts, ${result.copy._id}, ${result.photos.length} photos checked.`);
