import { createClient } from "@sanity/client";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const projectRoot = path.resolve(import.meta.dirname, "..");
const execFileAsync = promisify(execFile);

const siteUrl = (process.env.VITE_SITE_URL || process.env.SITE_URL || "https://www.queenstown.top").replace(/\/$/, "");
const vercelProject = process.env.VERCEL_PROJECT_NAME || "gallery-site";
const vercelScope = process.env.VERCEL_SCOPE || "zjk159357s-projects";
const expectedMinimums = {
  categories: 1,
  photos: 1,
  photosWithImagesMatchesPhotos: true,
  siteSettings: 1,
  homepageLayouts: 1,
  photobalconyLayouts: 1,
  pageLayouts: 2,
  siteCopy: 1,
  sitemapUrls: 10,
};

const requiredUrls = [
  "/",
  "/studio/",
  "/photobalcony",
  "/journal",
  "/about",
  "/sitemap.xml",
  "/robots.txt",
];

async function loadEnvFile(filename) {
  const filePath = path.join(projectRoot, filename);

  try {
    const content = await readFile(filePath, "utf8");

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
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function loadEnv() {
  await loadEnvFile(".env.local");
  await loadEnvFile(".env");
}

function getSanityConfig() {
  const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.VITE_SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.VITE_SANITY_DATASET ?? "production";
  const token = process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_AUTH_TOKEN;

  return { projectId, dataset, token };
}

function isMissingProjectId(projectId) {
  return !projectId || projectId === "your_sanity_project_id" || projectId === "yourprojectid";
}

function ok(label, detail = "") {
  console.log(`OK   ${label}${detail ? ` - ${detail}` : ""}`);
}

function fail(label, detail = "") {
  console.log(`FAIL ${label}${detail ? ` - ${detail}` : ""}`);
}

function warn(label, detail = "") {
  console.log(`WARN ${label}${detail ? ` - ${detail}` : ""}`);
}

async function checkSanity() {
  const { projectId, dataset, token } = getSanityConfig();

  if (isMissingProjectId(projectId)) {
    return {
      passed: false,
      label: "Sanity",
      issues: ["Missing SANITY_STUDIO_PROJECT_ID or VITE_SANITY_PROJECT_ID."],
    };
  }

  const query = `{
    "categories": count(*[_type == "category"]),
    "photos": count(*[_type == "photo"]),
    "visiblePhotos": count(*[_type == "photo" && isHidden != true]),
    "photosWithImages": count(*[_type == "photo" && defined(image.asset)]),
    "stories": count(*[_type == "story"]),
    "visibleStories": count(*[
      _type == "story" &&
      isHidden != true &&
      (!defined(publishedAt) || dateTime(publishedAt) <= dateTime(now()))
    ]),
    "siteSettings": count(*[_type == "siteSettings"]),
    "homepageLayouts": count(*[_type == "homepageLayout"]),
    "photobalconyLayouts": count(*[_type == "photobalconyLayout"]),
    "pageLayouts": count(*[_type == "pageLayout"]),
    "siteCopy": count(*[_type == "siteCopy"]),
    "photoIds": *[_type == "photo"]._id,
    "heroFlags": count(*[_type == "photo" && isHero == true]),
    "hiddenHomepagePhotos": count(*[
      _type == "photo" &&
      isHidden == true &&
      count(*[_type in ["homepageLayout", "pageLayout"] && references(^._id)]) > 0
    ]),
    "hiddenPhotobalconyPhotos": count(*[
      _type == "photo" &&
      isHidden == true &&
      count(*[_type in ["photobalconyLayout", "pageLayout"] && references(^._id)]) > 0
    ])
  }`;

  const client = createClient({
    projectId,
    dataset,
    apiVersion: "2025-02-19",
    token,
    useCdn: true,
  });

  let counts;
  try {
    counts = await client.fetch(query);
  } catch (error) {
    if (process.platform !== "win32") {
      throw error;
    }

    warn("Sanity", "Node fetch failed; retrying with Windows web request");
    counts = await fetchSanityWithPowerShell({ projectId, dataset, token, query });
  }

  const issues = [];

  if (counts.categories < expectedMinimums.categories) issues.push("No categories found.");
  if (counts.photos < expectedMinimums.photos) issues.push("No photos found.");
  if (counts.photosWithImages !== counts.photos) {
    issues.push(`Image upload incomplete: ${counts.photosWithImages}/${counts.photos} photos have image assets.`);
  }
  const dottedPhotoIds = counts.photoIds.filter((id) => id.startsWith("photo."));
  if (dottedPhotoIds.length > 0) {
    issues.push(`${dottedPhotoIds.length} photo documents use private dotted IDs: ${dottedPhotoIds.slice(0, 5).join(", ")}.`);
  }
  if (counts.siteSettings < expectedMinimums.siteSettings) issues.push("No siteSettings document found.");
  if (counts.homepageLayouts < expectedMinimums.homepageLayouts) issues.push("No homepageLayout document found.");
  if (counts.photobalconyLayouts < expectedMinimums.photobalconyLayouts) {
    issues.push("No photobalconyLayout document found.");
  }
  if (counts.pageLayouts < expectedMinimums.pageLayouts) issues.push("Homepage/Photobalcony pageLayout documents are incomplete.");
  if (counts.siteCopy < expectedMinimums.siteCopy) issues.push("No siteCopy document found.");
  if (counts.heroFlags !== 1) issues.push(`Expected exactly 1 hero flag photo, got ${counts.heroFlags}.`);
  if (counts.hiddenHomepagePhotos > 0) issues.push(`${counts.hiddenHomepagePhotos} hidden photos are still used on Homepage.`);
  if (counts.hiddenPhotobalconyPhotos > 0) {
    issues.push(`${counts.hiddenPhotobalconyPhotos} hidden photos are still used on Photobalcony.`);
  }

  return { passed: issues.length === 0, label: "Sanity", counts, issues };
}

async function fetchSanityWithPowerShell({ projectId, dataset, token, query }) {
  const url = new URL(`https://${projectId}.api.sanity.io/v2025-02-19/data/query/${dataset}`);
  url.searchParams.set("query", query);

  const command = [
    "$headers = @{}",
    "if ($env:SANITY_STATUS_TOKEN) { $headers.Authorization = \"Bearer $env:SANITY_STATUS_TOKEN\" }",
    "$response = Invoke-WebRequest -UseBasicParsing -Uri $env:SANITY_STATUS_URL -Headers $headers -TimeoutSec 25",
    "$response.Content",
  ].join("; ");

  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
    env: {
      ...process.env,
      SANITY_STATUS_URL: url.toString(),
      SANITY_STATUS_TOKEN: token ?? "",
    },
    timeout: 30000,
  });
  const payload = JSON.parse(stdout);
  return payload.result;
}

async function checkUrl(urlPath) {
  const url = `${siteUrl}${urlPath}`;
  const response = await fetch(url, {
    method: "HEAD",
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });

  if (response.status >= 200 && response.status < 400) {
    return { passed: true, url, status: response.status };
  }

  return { passed: false, url, status: response.status };
}

async function checkPublicUrls() {
  const results = await Promise.all(requiredUrls.map(checkUrl));
  return {
    passed: results.every((result) => result.passed),
    label: "Public URLs",
    results,
    issues: results.filter((result) => !result.passed).map((result) => `${result.url} returned ${result.status}`),
  };
}

async function checkSitemapAndRobots() {
  const [sitemapResponse, robotsResponse] = await Promise.all([
    fetch(`${siteUrl}/sitemap.xml`, { signal: AbortSignal.timeout(15000) }),
    fetch(`${siteUrl}/robots.txt`, { signal: AbortSignal.timeout(15000) }),
  ]);

  const issues = [];
  const sitemapText = await sitemapResponse.text();
  const robotsText = await robotsResponse.text();
  const sitemapUrlCount = (sitemapText.match(/<url>/g) ?? []).length;

  if (!sitemapResponse.ok) issues.push(`sitemap.xml returned ${sitemapResponse.status}.`);
  if (sitemapUrlCount < expectedMinimums.sitemapUrls) {
    issues.push(`sitemap.xml only contains ${sitemapUrlCount} URLs.`);
  }
  if (!sitemapText.includes(`${siteUrl}/photobalcony`)) issues.push("sitemap.xml is missing /photobalcony.");
  if (!robotsResponse.ok) issues.push(`robots.txt returned ${robotsResponse.status}.`);
  if (!robotsText.includes("Disallow: /studio/")) issues.push("robots.txt does not disallow /studio/.");
  if (!robotsText.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) issues.push("robots.txt sitemap URL is missing or wrong.");

  return {
    passed: issues.length === 0,
    label: "Sitemap and robots",
    sitemapUrlCount,
    issues,
  };
}

function parseVercelList(stdout) {
  const lines = stdout.split(/\r?\n/);
  return lines.find((line) => line.includes(`/${vercelProject}`) && line.includes("Production"));
}

async function checkVercel() {
  try {
    const command = process.platform === "win32" ? "cmd.exe" : "npx";
    const args =
      process.platform === "win32"
        ? ["/d", "/s", "/c", "npx", "--yes", "vercel", "ls", vercelProject, "--scope", vercelScope]
        : ["--yes", "vercel", "ls", vercelProject, "--scope", vercelScope];
    const { stdout, stderr } = await execFileAsync(command, args, { cwd: projectRoot, timeout: 120000 });
    const latestProductionLine = parseVercelList(`${stdout}\n${stderr}`);

    if (!latestProductionLine) {
      return {
        passed: false,
        label: "Vercel",
        issues: ["Could not find a production deployment in vercel ls output."],
      };
    }

    const isReady = latestProductionLine.includes("Ready");
    return {
      passed: isReady,
      label: "Vercel",
      latestProductionLine: latestProductionLine.trim().replace(/\s+/g, " "),
      issues: isReady ? [] : [`Latest production deployment is not Ready: ${latestProductionLine.trim()}`],
    };
  } catch (error) {
    return {
      passed: false,
      label: "Vercel",
      issues: [error instanceof Error ? error.message : "Failed to run vercel ls."],
    };
  }
}

function printCheckResult(result) {
  if (result.passed) {
    if (result.label === "Sanity") {
      ok(result.label, `${result.counts.photos} photos, ${result.counts.visibleStories} visible stories`);
    } else if (result.label === "Public URLs") {
      ok(result.label, `${result.results.length} URLs responded`);
    } else if (result.label === "Sitemap and robots") {
      ok(result.label, `${result.sitemapUrlCount} sitemap URLs`);
    } else if (result.label === "Vercel") {
      ok(result.label, result.latestProductionLine);
    } else {
      ok(result.label);
    }
    return;
  }

  fail(result.label);
  for (const issue of result.issues) {
    console.log(`     - ${issue}`);
  }
}

async function runCheck(label, check) {
  try {
    return await check();
  } catch (error) {
    return {
      passed: false,
      label,
      issues: [error instanceof Error ? error.message : String(error)],
    };
  }
}

async function main() {
  await loadEnv();

  console.log("Production verification");
  console.log(`Site: ${siteUrl}`);
  console.log(`Vercel: ${vercelScope}/${vercelProject}`);
  console.log("");

  const results = [];
  results.push(await runCheck("Sanity", checkSanity));
  results.push(await runCheck("Vercel", checkVercel));
  results.push(await runCheck("Public URLs", checkPublicUrls));
  results.push(await runCheck("Sitemap and robots", checkSitemapAndRobots));

  for (const result of results) {
    printCheckResult(result);
  }

  const passed = results.every((result) => result.passed);

  if (!passed) {
    console.log("");
    fail("Production verification failed");
    process.exitCode = 1;
    return;
  }

  console.log("");
  ok("Production verification passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
