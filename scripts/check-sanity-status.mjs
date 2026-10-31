import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const projectRoot = path.resolve(import.meta.dirname, "..");
const execFileAsync = promisify(execFile);

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

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
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

function getConfig() {
  const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.VITE_SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.VITE_SANITY_DATASET ?? "production";
  const token = process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_AUTH_TOKEN;

  return { projectId, dataset, token };
}

function isMissingProjectId(projectId) {
  return !projectId || projectId === "your_sanity_project_id" || projectId === "yourprojectid";
}

async function fetchStatusCounts({ projectId, dataset, token }) {
  const query = `{
    "categories": count(*[_type == "category"]),
    "photos": count(*[_type == "photo"]),
    "photosWithImages": count(*[_type == "photo" && defined(image.asset)]),
    "stories": count(*[_type == "story"]),
    "siteSettings": count(*[_type == "siteSettings"]),
    "pageLayouts": count(*[_type == "pageLayout"]),
    "siteCopy": count(*[_type == "siteCopy"]),
    "siteHeroCount": count(*[_type == "siteSettings" && defined(heroPhoto._ref)]),
    "heroPhotos": count(*[_type == "photo" && isHero == true])
  }`;
  const url = new URL(`https://${projectId}.api.sanity.io/v2025-02-19/data/query/${dataset}`);
  url.searchParams.set("query", query);

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Sanity status query failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return payload.result;
}

async function fetchStatusCountsWithPowerShell({ projectId, dataset, token }) {
  const query = `{
    "categories": count(*[_type == "category"]),
    "photos": count(*[_type == "photo"]),
    "photosWithImages": count(*[_type == "photo" && defined(image.asset)]),
    "stories": count(*[_type == "story"]),
    "siteSettings": count(*[_type == "siteSettings"]),
    "pageLayouts": count(*[_type == "pageLayout"]),
    "siteCopy": count(*[_type == "siteCopy"]),
    "siteHeroCount": count(*[_type == "siteSettings" && defined(heroPhoto._ref)]),
    "heroPhotos": count(*[_type == "photo" && isHero == true])
  }`;
  const url = new URL(`https://${projectId}.api.sanity.io/v2025-02-19/data/query/${dataset}`);
  url.searchParams.set("query", query);

  const command = [
    "$headers = @{}",
    "if ($env:SANITY_STATUS_TOKEN) { $headers.Authorization = \"Bearer $env:SANITY_STATUS_TOKEN\" }",
    "$response = Invoke-WebRequest -UseBasicParsing -Uri $env:SANITY_STATUS_URL -Headers $headers -TimeoutSec 20",
    "$response.Content",
  ].join("; ");

  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
    env: {
      ...process.env,
      SANITY_STATUS_URL: url.toString(),
      SANITY_STATUS_TOKEN: token ?? "",
    },
    timeout: 25000,
  });
  const payload = JSON.parse(stdout);
  return payload.result;
}

async function getStatusCounts(config) {
  try {
    return await fetchStatusCounts(config);
  } catch (error) {
    if (process.platform !== "win32") {
      throw new Error(`Sanity status unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log("Node fetch failed; retrying with Windows web request...");
    try {
      return await fetchStatusCountsWithPowerShell(config);
    } catch (fallbackError) {
      throw new Error(
        `Sanity status unavailable after both HTTP clients: ${
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        }`,
      );
    }
  }
}

async function main() {
  await loadEnv();

  const { projectId, dataset, token } = getConfig();

  console.log("Sanity CMS status");
  console.log(`Dataset: ${dataset}`);
  console.log(`Project ID: ${isMissingProjectId(projectId) ? "not configured" : projectId}`);
  console.log(`Write token: ${token ? "configured" : "not configured"}`);

  if (isMissingProjectId(projectId)) {
    console.log("Status: not configured");
    console.log("Add SANITY_STUDIO_PROJECT_ID and VITE_SANITY_PROJECT_ID to .env.local before remote checks.");
    return;
  }

  const result = await getStatusCounts({ projectId, dataset, token });

  console.log("Remote counts:");
  console.log(JSON.stringify(result, null, 2));

  const issues = [];

  if (result.categories < 1) {
    issues.push("No categories found.");
  }

  if (result.photos < 1) {
    issues.push("No photos found.");
  }

  if (result.photosWithImages < result.photos) {
    issues.push(`Image upload is incomplete: ${result.photosWithImages}/${result.photos} photos have images.`);
  }

  if (result.siteSettings < 1) {
    issues.push("No site settings document found.");
  }

  if (result.pageLayouts < 2) {
    issues.push(`Expected homepage and Photobalcony page layouts, found ${result.pageLayouts}.`);
  }

  if (result.siteCopy < 1) {
    issues.push("No site copy document found.");
  }

  if (result.heroPhotos !== 1) {
    issues.push(`Expected exactly 1 homepage hero photo, got ${result.heroPhotos}.`);
  }

  if (result.siteHeroCount !== 1) {
    issues.push(`Expected exactly 1 Site Settings hero reference, got ${result.siteHeroCount}.`);
  }

  if (issues.length > 0) {
    console.log("Status: connected, but content needs attention.");
    for (const issue of issues) {
      console.log(`- ${issue}`);
    }
    return;
  }

  console.log("Status: ready");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
