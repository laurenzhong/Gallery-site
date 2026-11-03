import { createClient } from "@sanity/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";

const projectRoot = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(projectRoot, "public");
const siteUrl = (process.env.VITE_SITE_URL || process.env.SITE_URL || "https://www.queenstown.top").replace(/\/$/, "");

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function filenameSlug(filename) {
  const baseName = filename.replace(/\.[^.]+$/, "");
  return slugify(baseName) || encodeURIComponent(baseName.toLowerCase());
}

function xmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function importTsModule(filePath) {
  const source = await readFile(filePath, "utf8");
  const result = await transform(source, {
    loader: "ts",
    format: "esm",
    target: "es2022",
    sourcemap: false,
  });
  const encoded = Buffer.from(result.code).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

async function loadEnvFile(filename) {
  try {
    const content = await readFile(path.join(projectRoot, filename), "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function fetchWithRetry(label, fetcher, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetcher();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delayMs = attempt * 1500;
      console.warn(`Sitemap: ${label} query failed, retrying in ${delayMs}ms (${attempt}/${attempts})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

async function fetchCmsEntries() {
  await loadEnvFile(".env.local");
  await loadEnvFile(".env");

  const projectId = process.env.VITE_SANITY_PROJECT_ID ?? process.env.SANITY_STUDIO_PROJECT_ID;
  const dataset = process.env.VITE_SANITY_DATASET ?? process.env.SANITY_STUDIO_DATASET ?? "production";
  if (!projectId || projectId === "yourprojectid" || projectId === "your_sanity_project_id") {
    return null;
  }

  const client = createClient({ projectId, dataset, apiVersion: "2025-02-19", useCdn: false });
  const photosQuery = `*[_type == "photo" && isHidden != true && category->isVisible != false]{
      "slug": slug.current,
      "filename": sourceFilename,
      title,
      "hasImage": defined(image.asset),
      legacyPublicPath,
      "updatedAt": _updatedAt,
      date
    }`;
  const storiesQuery = `*[
      _type == "story" &&
      isHidden != true &&
      (!defined(publishedAt) || dateTime(publishedAt) <= dateTime(now())) &&
      defined(coverPhoto._ref) &&
      coverPhoto->isHidden != true &&
      count(*[
        (_type == "pageContent" || _type == "homepageLayout" || _type == "photobalconyLayout" || _type == "siteSettings") &&
        references(^.coverPhoto._ref)
      ]) > 0
    ]{
      title,
      "slug": slug.current,
      "updatedAt": _updatedAt,
      publishedAt,
      "coverFilename": coverPhoto->sourceFilename
    }`;

  let photos;
  try {
    photos = await fetchWithRetry("Sanity photo", () => client.fetch(photosQuery));
  } catch (error) {
    throw new Error(
      `Sitemap: Sanity photo query failed (${error instanceof Error ? error.message : "unknown error"}). ` +
        `Refusing to fall back to static data so the build surfaces the problem instead of producing a misleading sitemap.`,
    );
  }

  let stories;
  try {
    stories = await fetchWithRetry("Sanity story", () => client.fetch(storiesQuery));
  } catch (error) {
    throw new Error(
      `Sitemap: Sanity story query failed (${error instanceof Error ? error.message : "unknown error"}). ` +
        `Refusing to fall back to static data so the build surfaces the problem instead of producing a misleading sitemap.`,
    );
  }

  const publishablePhotos = photos.filter(
    (photo) =>
      photo?.filename &&
      photo.title &&
      (photo.hasImage || photo.legacyPublicPath),
  );
  const publishableFilenames = new Set(publishablePhotos.map((photo) => photo.filename));
  const publishableStories = stories.filter((story) => {
    const filenames = [story.coverFilename].filter(Boolean);
    return story.title && filenames.some((filename) => publishableFilenames.has(filename));
  });

  return { photos: publishablePhotos, stories: publishableStories };
}

async function loadStaticEntries() {
  const [{ photos }, { photoStories }] = await Promise.all([
    importTsModule(path.join(projectRoot, "src", "data", "photos.ts")),
    importTsModule(path.join(projectRoot, "src", "data", "stories.ts")),
  ]);

  const stories = Object.entries(photoStories).flatMap(([filename, storyList]) =>
    storyList.map((story) => ({
      title: story.title,
      slug: story.slug || slugify(story.title) || filenameSlug(filename),
    })),
  );

  return { photos, stories };
}

function route(urlPath, lastmod, priority) {
  return {
    loc: `${siteUrl}${urlPath}`,
    lastmod: lastmod ? new Date(lastmod).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    priority,
  };
}

let entries;
try {
  entries = await fetchCmsEntries();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (process.env.SANITY_BUILD_STRICT === "1") {
    throw new Error(`Sitemap: Sanity query failed in strict mode (${message})`);
  }

  console.warn(`Sitemap: Sanity unavailable (${message}); falling back to local static data.`);
  entries = await loadStaticEntries();
}

if (!entries) {
  console.warn("Sitemap: Sanity credentials not configured, falling back to src/data/*.ts");
  entries = await loadStaticEntries();
}
const routes = [
  route("/", undefined, "1.0"),
  route("/journal", undefined, "0.7"),
  route("/about", undefined, "0.6"),
  route("/photobalcony", undefined, "0.6"),
  ...entries.photos.map((photo) => route(`/photos/${filenameSlug(photo.filename)}`, photo.updatedAt || photo.date, "0.8")),
  ...entries.stories.map((story) => route(`/stories/${story.slug || slugify(story.title)}`, story.updatedAt || story.publishedAt, "0.7")),
];

const uniqueRoutes = [...new Map(routes.map((item) => [item.loc, item])).values()];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueRoutes
  .map(
    (item) => `  <url>
    <loc>${xmlEscape(item.loc)}</loc>
    <lastmod>${item.lastmod}</lastmod>
    <priority>${item.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /
Disallow: /studio/

Sitemap: ${siteUrl}/sitemap.xml
`;

await mkdir(publicDir, { recursive: true });
await writeFile(path.join(publicDir, "sitemap.xml"), sitemap, "utf8");
await writeFile(path.join(publicDir, "robots.txt"), robots, "utf8");

console.log(`Generated sitemap.xml with ${uniqueRoutes.length} URLs`);
