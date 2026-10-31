import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";

const projectRoot = path.resolve(import.meta.dirname, "..");

async function importTsModule(filePath) {
  const source = await readFile(filePath, "utf8");
  const result = await transform(source, { loader: "ts", format: "esm", target: "es2022", sourcemap: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.code).toString("base64")}`);
}

function fail(message) {
  throw new Error(`Content verification failed: ${message}`);
}

const [{ photos, initialHeroPhoto }, { photoStories }] = await Promise.all([
  importTsModule(path.join(projectRoot, "src", "data", "photos.ts")),
  importTsModule(path.join(projectRoot, "src", "data", "stories.ts")),
]);

if (!Array.isArray(photos) || photos.length === 0) fail("no static photos found");
if (!initialHeroPhoto?.src && !photos.some((photo) => photo.isHero || photo.filename === "DSC_0638.JPG")) {
  fail("no static hero fallback found");
}

const filenames = new Set();
const slugs = new Set();
for (const photo of photos) {
  if (!photo.filename || filenames.has(photo.filename)) fail(`duplicate filename: ${photo.filename}`);
  if (photo.slug && slugs.has(photo.slug)) fail(`duplicate slug: ${photo.slug}`);
  filenames.add(photo.filename);
  if (photo.slug) slugs.add(photo.slug);
  if (!Number.isFinite(photo.width) || !Number.isFinite(photo.height) || photo.width < 1 || photo.height < 1) {
    fail(`invalid dimensions: ${photo.filename}`);
  }
}

for (const [filename, stories] of Object.entries(photoStories ?? {})) {
  if (!filenames.has(filename)) fail(`story references missing photo: ${filename}`);
  if (!Array.isArray(stories)) fail(`story list is not an array: ${filename}`);
  for (const story of stories) {
    if (!story.title || !story.body?.length) fail(`story is missing title/body for ${filename}`);
  }
}

const sitemapPath = path.join(projectRoot, "public", "sitemap.xml");
await access(sitemapPath).catch(() => fail("public/sitemap.xml is missing"));
const sitemap = await readFile(sitemapPath, "utf8");
for (const route of ["https://www.queenstown.top/", "/journal", "/about", "/photobalcony"]) {
  if (!sitemap.includes(route)) fail(`sitemap is missing ${route}`);
}

console.log(`Content verification passed: ${photos.length} photos, ${Object.keys(photoStories ?? {}).length} story photo groups.`);
