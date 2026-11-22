import { readFile } from "node:fs/promises";
import path from "node:path";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const projectRoot = path.resolve(import.meta.dirname, "..");

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
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

await loadEnvFile(".env.local");
await loadEnvFile(".env");

const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? "http://127.0.0.1:7897";
setGlobalDispatcher(new ProxyAgent({ uri: proxyUrl, requestTls: { rejectUnauthorized: true } }));

const projectId = process.env.SANITY_STUDIO_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET ?? "production";
const token = process.env.SANITY_WRITE_TOKEN;
const apiVersion = "2025-02-19";
const baseUrl = `https://${projectId}.api.sanity.io/v${apiVersion}/data`;
const dryRun = process.argv.includes("--dry-run");

if (!projectId || !token) throw new Error("SANITY_STUDIO_PROJECT_ID and SANITY_WRITE_TOKEN are required");

async function request(method, pathname, body) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${(await response.text()).slice(0, 5000)}`);
      return await response.json();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
    }
  }
}

const source = await readFile(path.join(projectRoot, "src/data/photos.ts"), "utf8");
const start = source.indexOf("export const photos: Photo[] = ") + "export const photos: Photo[] = ".length;
const end = source.indexOf("\n];\n\nexport const initialHeroPhoto", start) + 2;
if (start < 0 || end < 2) throw new Error("Could not read generated photo data");
const staticPhotos = JSON.parse(source.slice(start, end));
const coordinatesByFilename = new Map(
  staticPhotos
    .filter((photo) => Number.isFinite(photo.latitude) && Number.isFinite(photo.longitude))
    .map((photo) => [photo.filename, { latitude: photo.latitude, longitude: photo.longitude, text: `${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}` }]),
);

function parseCoordinateText(value) {
  const match = typeof value === "string" ? value.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)$/) : null;
  if (!match) return undefined;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return { latitude: first, longitude: second };
  if (Math.abs(second) <= 90 && Math.abs(first) <= 180) return { latitude: second, longitude: first };
  return undefined;
}

const query = encodeURIComponent(
  `*[_type == "photo" && defined(image.asset) && isHidden != true]{ _id, sourceFilename, location, geo }`,
);
const result = await request("GET", `/query/${dataset}?query=${query}`);
const patches = result.result
  .flatMap((photo) => {
    if (photo.geo) return [];
    const staticCoordinate = coordinatesByFilename.get(photo.sourceFilename);
    const coordinate = staticCoordinate ?? parseCoordinateText(photo.location);
    if (!coordinate) return [];
    return [{
      patch: { id: photo._id, set: { ...(staticCoordinate ? { location: staticCoordinate.text } : {}), geo: { latitude: coordinate.latitude, longitude: coordinate.longitude, source: staticCoordinate ? "exif" : "manual", visibility: "exact" } } },
      sourceFilename: photo.sourceFilename,
      location: staticCoordinate?.text ?? `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`,
    }];
  });

console.log(`Found ${patches.length} visible CMS photos with EXIF coordinates missing from location.`);
for (const patch of patches) console.log(`  ${patch.sourceFilename} -> ${patch.location}`);
if (dryRun || patches.length === 0) {
  console.log(dryRun ? "Dry run only; no CMS documents changed." : "Nothing to update.");
  process.exit(0);
}

const mutations = patches.map(({ patch }) => ({ patch }));
const batchSize = 20;
let successful = 0;
for (let index = 0; index < mutations.length; index += batchSize) {
  const batch = mutations.slice(index, index + batchSize);
  const response = await request("POST", `/mutate/${dataset}`, { mutations: batch });
  successful += response.results?.filter((item) => !item.error).length ?? batch.length;
  console.log(`Updated batch ${Math.floor(index / batchSize) + 1}/${Math.ceil(mutations.length / batchSize)}.`);
}
console.log(`Updated ${successful}/${mutations.length} CMS photo locations.`);
