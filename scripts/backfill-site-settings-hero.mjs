import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@sanity/client";

const projectRoot = path.resolve(import.meta.dirname, "..");
const apply = process.argv.includes("--apply");

async function loadEnvFile(filename) {
  try {
    const contents = await readFile(path.join(projectRoot, filename), "utf8");
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index < 0) continue;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadEnvFile(".env.local");
await loadEnvFile(".env");

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.VITE_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.VITE_SANITY_DATASET ?? "production";
const token = process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_AUTH_TOKEN;
if (!projectId || !token) throw new Error("SANITY project ID and write token are required.");

const client = createClient({ projectId, dataset, apiVersion: "2025-02-19", token, useCdn: false });
let settings;
let hero;
try {
  [settings, hero] = await Promise.all([
    client.fetch(`*[_type == "siteSettings"][0]{_id, heroPhoto}`),
    client.fetch(`*[_type == "photo" && isHero == true && isHidden != true][0]{_id, title, sourceFilename}`),
  ]);
} catch {
  throw new Error("Sanity API unavailable while reading the hero configuration.");
}

if (!settings?._id) throw new Error("siteSettings-main does not exist.");
if (!hero?._id) throw new Error("No visible photo has isHero == true.");

console.log(`Site Settings hero: ${settings.heroPhoto?._ref ?? "missing"}`);
console.log(`Candidate hero: ${hero._id} (${hero.sourceFilename ?? hero.title ?? "untitled"})`);
if (settings.heroPhoto?._ref === hero._id) {
  console.log("No patch needed.");
  process.exit(0);
}

if (!apply) {
  console.log("Dry run only. Re-run with --apply to set siteSettings-main.heroPhoto.");
  process.exit(0);
}

let result;
try {
  result = await client
    .patch(settings._id)
    .set({ heroPhoto: { _type: "reference", _ref: hero._id } })
    .commit();
} catch {
  throw new Error("Sanity API unavailable while updating the hero configuration.");
}
console.log(`Patched ${result._id}.`);
