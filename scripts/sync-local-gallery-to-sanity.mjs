import { execFile } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const projectRoot = path.resolve(import.meta.dirname, "..");
const execFileAsync = promisify(execFile);

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

function ref(id, key) {
  return { _key: key, _type: "reference", _ref: id };
}

function references(photos, filenames, keyPrefix) {
  return filenames.flatMap((filename, index) => {
    const photo = photos.find((item) => item.sourceFilename === filename);
    return photo ? [ref(photo._id, `${keyPrefix}-${index}`)] : [];
  });
}

function byCategory(photos, title, limit) {
  return photos.filter((photo) => photo.categoryTitle === title).slice(0, limit).map((photo) => photo.sourceFilename);
}

async function readGenerated(filename) {
  const content = await readFile(path.join(projectRoot, "sanity", "seed", "generated", filename), "utf8");
  return content.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

async function requestJson(url, { method = "GET", token, body } = {}) {
  if (process.platform !== "win32") {
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`Sanity request failed with ${response.status}`);
    return response.json();
  }

  const bodyFile = body ? path.join(projectRoot, ".sanity-sync-request.json") : "";
  if (bodyFile) await writeFile(bodyFile, JSON.stringify(body), "utf8");
  const command = [
    "$headers = @{ Authorization = \"Bearer $env:SANITY_SYNC_TOKEN\"; 'Content-Type' = 'application/json' }",
    "$params = @{ UseBasicParsing = $true; Uri = $env:SANITY_SYNC_URL; Method = $env:SANITY_SYNC_METHOD; Headers = $headers; TimeoutSec = 60 }",
    "if ($env:SANITY_SYNC_BODY_FILE) { $params.InFile = $env:SANITY_SYNC_BODY_FILE }",
    "$response = Invoke-WebRequest @params",
    "$response.Content",
  ].join("; ");
  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
      env: {
        ...process.env,
        SANITY_SYNC_TOKEN: token,
        SANITY_SYNC_URL: url,
        SANITY_SYNC_METHOD: method,
        SANITY_SYNC_BODY_FILE: bodyFile,
      },
      timeout: 90000,
    });
    return stdout ? JSON.parse(stdout) : {};
  } finally {
    if (bodyFile) await rm(bodyFile, { force: true });
  }
}

await loadEnv();
const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.VITE_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.VITE_SANITY_DATASET ?? "production";
const token = process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_AUTH_TOKEN;
if (!projectId || !token) throw new Error("Sanity project and SANITY_WRITE_TOKEN are required.");

const localPhotos = await readGenerated("photos.ndjson");
const localCategories = await readGenerated("categories.ndjson");
const [remotePhotos, categories] = await Promise.all([
  requestJson(`https://${projectId}.api.sanity.io/v2025-02-19/data/query/${dataset}?query=${encodeURIComponent('*[_type == "photo"]{_id, sourceFilename, legacyPublicPath, category}')}`, { token }).then((payload) => payload.result ?? []),
  requestJson(`https://${projectId}.api.sanity.io/v2025-02-19/data/query/${dataset}?query=${encodeURIComponent('*[_type == "category"]{_id, title}')}`, { token }).then((payload) => payload.result ?? []),
]);

const categoryByTitle = new Map(categories.map((category) => [category.title, category]));
const localCategoryTitle = (photo) => localCategories.find((category) => category._id === photo.category?._ref)?.title;
function findRemotePhoto(photo) {
  const candidates = remotePhotos.filter((remotePhoto) => remotePhoto.sourceFilename === photo.sourceFilename);
  return candidates.find((remotePhoto) => remotePhoto.legacyPublicPath === photo.legacyPublicPath) ?? candidates[0];
}
const missingPhotos = localPhotos.filter((photo) => !findRemotePhoto(photo));
if (missingPhotos.length) throw new Error(`Missing Sanity photo documents: ${missingPhotos.map((photo) => photo.sourceFilename).join(", ")}`);

const photos = localPhotos.map((photo) => ({
  ...photo,
  _id: findRemotePhoto(photo)._id,
  categoryTitle: localCategoryTitle(photo),
}));
const missingCategories = [...new Set(photos.map((photo) => photo.categoryTitle))].filter((title) => !categoryByTitle.has(title));
if (missingCategories.length) throw new Error(`Missing Sanity categories: ${missingCategories.join(", ")}`);

// Patch photo metadata so existing image.asset references are preserved.
// Replacing the whole document would silently detach uploaded Sanity assets.
const photoMutations = photos.map((photo) => ({
  patch: {
    id: photo._id,
    set: {
      title: photo.title,
      slug: { _type: "slug", current: photo.slug?.current ?? photo.slug },
      sourceFilename: photo.sourceFilename,
      legacyPublicPath: photo.legacyPublicPath,
      dimensions: {
        width: photo.dimensions?.width,
        height: photo.dimensions?.height,
      },
      category: { _type: "reference", _ref: categoryByTitle.get(photo.categoryTitle)._id },
      isHero: Boolean(photo.isHero),
      isHidden: false,
      sortOrder: photo.sortOrder,
    },
  },
}));

const localByCategory = (title, limit) => byCategory(photos, title, limit);
const heroFilename = photos.find((photo) => photo.isHero)?.sourceFilename ?? photos[0]?.sourceFilename;
const remoteByFilename = new Map(photos.map((photo) => [photo.sourceFilename, photo]));
const home = {
  _id: "pageLayout-home",
  _type: "pageLayout",
  pageKey: "home",
  title: "Photography",
  subtitle: "A quiet photography archive shaped by landscape, harbor light, and small travel fragments.",
  heroPhoto: ref(remoteByFilename.get(heroFilename)._id, "home-hero"),
  sections: [
    { _key: "home-featured", _type: "pageSection", title: "Featured photography groups", style: "featureCards", isVisible: true, showTitle: false, photos: references(photos, ["DSC_0243.JPG", "DSC_0257.JPG", "DSC_4840.JPG"], "featured") },
    { _key: "home-landscape", _type: "pageSection", title: "Landscape", style: "landscapeCarousel", isVisible: true, showTitle: true, photos: references(photos, localByCategory("山野", 24), "landscape") },
    { _key: "home-quiet", _type: "pageSection", title: "Quiet moments", style: "grid", isVisible: true, showTitle: true, columns: 4, photos: references(photos, photos.slice(0, 8).map((photo) => photo.sourceFilename), "quiet") },
    { _key: "home-city", _type: "pageSection", title: "City", style: "landscapeCarousel", isVisible: true, showTitle: true, photos: references(photos, localByCategory("石塘度假区", 22), "city") },
    { _key: "home-harbor-banner", _type: "pageSection", title: "Harbor", style: "banner", isVisible: true, showTitle: true, coverPhoto: ref(remoteByFilename.get("DSC_5026.JPG")._id, "harbor-banner") },
    { _key: "home-harbor-carousel", _type: "pageSection", title: "Harbor", style: "landscapeCarousel", isVisible: true, showTitle: false, photos: references(photos, localByCategory("harbor", 18), "harbor") },
    { _key: "home-harbor-stack", _type: "pageSection", title: "Harbor details", style: "stack", isVisible: true, showTitle: true, photos: references(photos, localByCategory("森林", 5), "harbor-stack") },
  ],
};

const balconyGroups = [
  ["2026", "carousel", ["DSC_0257.JPG", "DSC_0518.JPG", "DSC_0521.JPG", "DSC_0522.JPG"], "may"],
  ["Jul 2026", "grid", ["DSC_0264.JPG", "DSC_0335.JPG", "DSC_0396.JPG", "DSC_0470.JPG"], "march-portrait"],
  ["Jul 2026 — wide", "landscapeCarousel", ["DSC_0534.JPG", "DSC_0555.JPG", "DSC_0566.JPG"], "march-wide"],
  ["May - Jun 2026", "carousel", ["DSC_0580.JPG", "DSC_0613.JPG", "DSC_0626.JPG", "DSC_0632.JPG"], "february"],
  ["Apr 2026", "grid", ["DSC_0513.JPG", "DSC_0514.JPG", "DSC_0520.JPG", "DSC_0538.JPG"], "january"],
  ["Mar 2026", "grid", ["DSC_0546.JPG", "DSC_0551.JPG", "DSC_0552.JPG", "DSC_0571.JPG"], "winter"],
  ["Jan - Feb 2026", "stack", ["DSC_0638.JPG", "DSC_0648.JPG", "DSC_0917.JPG", "DSC_2196.JPG"], "summer"],
];
const photobalcony = {
  _id: "pageLayout-photobalcony",
  _type: "pageLayout",
  pageKey: "photobalcony",
  title: "Balcony View",
  subtitle: "A seasonal balcony of recent photographs.",
  heroPhoto: ref(remoteByFilename.get("DSC_0243.JPG")._id, "balcony-hero"),
  sections: balconyGroups.map(([title, style, filenames, key]) => ({
    _key: `balcony-${key}`,
    _type: "pageSection",
    title,
    style,
    isVisible: true,
    showTitle: true,
    columns: style === "grid" ? 4 : undefined,
    photos: references(photos, filenames, key),
  })),
};

const mutations = [...photoMutations, { createOrReplace: home }, { createOrReplace: photobalcony }];
const result = await requestJson(`https://${projectId}.api.sanity.io/v2025-02-19/data/mutate/${dataset}`, {
  method: "POST",
  token,
  body: { mutations },
});
console.log(`Synchronized ${photos.length} local photos and 2 page layouts to Sanity.`);
console.log(`Dataset: ${dataset}`);
console.log(`Transaction: ${result.transactionId ?? result.results?.[0]?.transactionId ?? "committed"}`);
