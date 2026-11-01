import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const projectRoot = path.resolve(import.meta.dirname, "..");
const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");
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

function getConfig() {
  const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.VITE_SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.VITE_SANITY_DATASET ?? "production";
  const token = process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_AUTH_TOKEN;
  if (!projectId || projectId === "your_sanity_project_id" || projectId === "yourprojectid") {
    throw new Error("Missing Sanity project configuration");
  }
  return { projectId, dataset, token };
}

async function querySanity({ projectId, dataset, token }, query) {
  const url = new URL(`https://${projectId}.api.sanity.io/v2025-02-19/data/query/${dataset}`);
  url.searchParams.set("query", query);

  try {
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()).result;
  } catch (error) {
    if (process.platform !== "win32") {
      throw new Error(`Sanity query unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    const command = [
      "$headers = @{}",
      "if ($env:PAGE_CONTENT_TOKEN) { $headers.Authorization = \"Bearer $env:PAGE_CONTENT_TOKEN\" }",
      "$response = Invoke-WebRequest -UseBasicParsing -Uri $env:PAGE_CONTENT_URL -Headers $headers -TimeoutSec 20",
      "$response.Content",
    ].join("; ");
    try {
      const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
        env: {
          ...process.env,
          PAGE_CONTENT_URL: url.toString(),
          PAGE_CONTENT_TOKEN: token ?? "",
        },
        timeout: 25000,
      });
      return JSON.parse(stdout).result;
    } catch (fallbackError) {
      throw new Error(
        `Sanity query unavailable after both HTTP clients: ${fallbackError instanceof Error ? fallbackError.message : "unknown error"}`,
      );
    }
  }
}

async function mutateSanity({ projectId, dataset, token }, documents, replace) {
  const url = `https://${projectId}.api.sanity.io/v2025-02-19/data/mutate/${dataset}`;
  const mutations = documents.map((document) => (replace ? { createOrReplace: document } : { createIfNotExists: document }));
  const body = JSON.stringify({ mutations });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    if (process.platform !== "win32") {
      throw new Error(`Sanity mutation unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
    }
    const command = [
      "$headers = @{ Authorization = \"Bearer $env:PAGE_CONTENT_TOKEN\"; \"Content-Type\" = \"application/json\" }",
      "$response = Invoke-RestMethod -Method Post -Uri $env:PAGE_CONTENT_MUTATE_URL -Headers $headers -Body $env:PAGE_CONTENT_MUTATE_BODY -TimeoutSec 30",
      "$response | ConvertTo-Json -Depth 20 -Compress",
    ].join("; ");
    try {
      const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
        env: {
          ...process.env,
          PAGE_CONTENT_MUTATE_URL: url,
          PAGE_CONTENT_TOKEN: token,
          PAGE_CONTENT_MUTATE_BODY: body,
        },
        timeout: 35000,
      });
      return JSON.parse(stdout);
    } catch (fallbackError) {
      throw new Error(
        `Sanity mutation unavailable after both HTTP clients: ${fallbackError instanceof Error ? fallbackError.message : "unknown error"}`,
      );
    }
  }
}

function reference(id, key) {
  return id ? { _key: key, _type: "reference", _ref: id } : undefined;
}

function referenceList(ids, keyPrefix) {
  return ids.filter(Boolean).map((id, index) => reference(id, `${keyPrefix}-${index}`));
}

function gallerySlot({ key, slotKey, photos, title, presentation }) {
  if (!photos) return undefined;
  const ids = photos.map((photo) => photo?._ref).filter(Boolean);
  const slot = {
    _key: key,
    _type: "gallerySlot",
    title,
    isVisible: true,
    slotKey,
    presentation,
    limit: ids.length || 1,
    sourceMode: "manual",
    photos: referenceList(ids, `${slotKey}-photo`),
  };
  return slot;
}

function buildHomeDocument(layout, siteSettings) {
  const featureCards = (layout.featureCards ?? []).slice(0, 3).map((card, index) => ({
    _key: `card-${index}`,
    _type: "featureCard",
    title: card.title ?? `Featured ${index + 1}`,
    photo: reference(card.photo?._ref, `card-photo-${index}`),
    linkLabel: undefined,
    linkTarget: card.href,
  }));

  const sections = [
    {
      _key: "content-home-featured",
      _type: "featureCardsSlot",
      title: "Featured photography groups",
      isVisible: true,
      cards: featureCards,
    },
    gallerySlot({
      key: "content-home-landscape",
      slotKey: "landscape",
      title: "Landscape",
      photos: layout.landscapePhotos,
      presentation: "landscapeCarousel",
    }),
    gallerySlot({
      key: "content-home-quiet",
      slotKey: "quiet",
      title: "Quiet moments",
      photos: layout.quietPhotos,
      presentation: "squareRail",
    }),
    layout.bannerOnePhoto
      ? {
          _key: "content-home-banner",
          _type: "bannerSlot",
          slotKey: "bannerOne",
          isVisible: true,
          photo: reference(layout.bannerOnePhoto?._ref, "banner-photo"),
        }
      : undefined,
    gallerySlot({
      key: "content-home-city",
      slotKey: "city",
      title: "City",
      photos: layout.cityPhotos,
      presentation: "landscapeCarousel",
    }),
    layout.plantsHeroPhoto
      ? {
          _key: "content-home-harbor",
          _type: "bannerSlot",
          slotKey: "harbor",
          title: "Harbor",
          isVisible: true,
          photo: reference(layout.plantsHeroPhoto?._ref, "harbor-hero"),
        }
      : undefined,
    layout.plantsCarouselPhotos
      ? gallerySlot({
          key: "content-home-harbor-carousel",
          slotKey: "harborCarousel",
          title: "Harbor carousel",
          photos: layout.plantsCarouselPhotos,
          presentation: "landscapeCarousel",
        })
      : undefined,
    layout.plantsStackPhotos
      ? gallerySlot({
          key: "content-home-harbor-stack",
          slotKey: "harborStack",
          title: "Harbor stack",
          photos: layout.plantsStackPhotos,
          presentation: "stack",
        })
      : undefined,
    layout.plantsSquarePhotos
      ? gallerySlot({
          key: "content-home-harbor-square",
          slotKey: "harborSquare",
          title: "Harbor squares",
          photos: layout.plantsSquarePhotos,
          presentation: "squareGrid",
        })
      : undefined,
  ].filter(Boolean);

  return {
    _id: "pageContent-home",
    _type: "pageContent",
    pageKey: "home",
    title: "Photography",
    subtitle: undefined,
    heroPhoto: reference(siteSettings?.heroPhoto?._ref, "page-hero"),
    sections,
  };
}

function buildBalconyDocument(layout) {
  const periodByKey = [
    ["may", "mayTitle", "mayPhotos"],
    ["marchPortraits", "marchTitle", "marchPortraitPhotos"],
    ["marchWide", "marchTitle", "marchWidePhotos"],
    ["february", "februaryTitle", "februaryPhotos"],
    ["january", "januaryTitle", "januaryPhotos"],
    ["winter", "winterTitle", "winterPhotos"],
    ["summer", "summerTitle", "summerPhotos"],
  ];
  const sections = periodByKey.flatMap(([periodKey, titleKey, photosKey]) => {
    const photos = layout[photosKey];
    if (!photos) return [];
    return [
      {
        _key: `content-balcony-${periodKey}`,
        _type: "balconyPeriodSlot",
        periodKey,
        title: layout[titleKey] ?? periodKey,
        isVisible: true,
        photos: photos,
      },
    ];
  });

  return {
    _id: "pageContent-photobalcony",
    _type: "pageContent",
    pageKey: "photobalcony",
    title: "Balcony View",
    subtitle: undefined,
    heroPhoto: reference(layout.heroPhoto?._ref, "page-hero"),
    sections,
  };
}

await loadEnvFile(".env.local");
await loadEnvFile(".env");
const config = getConfig();
const [homeLayout, balconyLayout, siteSettings] = await Promise.all([
  querySanity(config, '*[_type == "homepageLayout"][0]'),
  querySanity(config, '*[_type == "photobalconyLayout"][0]'),
  querySanity(config, '*[_type == "siteSettings"][0]{heroPhoto}'),
]);

if (!homeLayout || !balconyLayout) throw new Error("Current homepageLayout and photobalconyLayout documents are required for the baseline migration");

const documents = [buildHomeDocument(homeLayout, siteSettings), buildBalconyDocument(balconyLayout)];

console.log(`Prepared ${documents.length} pageContent baseline documents for ${config.dataset}.`);
for (const document of documents) {
  console.log(`- ${document._id}: ${document.sections.length} controlled sections`);
}

if (!apply) {
  console.log("Dry run only. Add --apply to create missing documents, or --apply --force to replace them.");
} else {
  if (!config.token) throw new Error("Missing SANITY_WRITE_TOKEN or SANITY_AUTH_TOKEN for --apply");
  const result = await mutateSanity(config, documents, force);
  console.log(`${force ? "Created or replaced" : "Created if missing"} pageContent baseline documents.`);
  console.log(`Transaction: ${result.transactionId ?? "completed"}`);
}
