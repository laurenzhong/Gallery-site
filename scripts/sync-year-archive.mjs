import { readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { captureTime, normalizeCaptureTime } from "./capture-time.mjs";

const output = new URL("../src/data/yearArchive.json", import.meta.url);
const previous = JSON.parse(await readFile(output, "utf8").catch((error) => {
  if (error.code === "ENOENT") return "[]";
  throw error;
}));
const project = process.env.VITE_SANITY_PROJECT_ID ?? process.env.SANITY_STUDIO_PROJECT_ID;
const dataset = process.env.VITE_SANITY_DATASET ?? process.env.SANITY_STUDIO_DATASET ?? "production";
if (!project) {
  console.log(`Using the saved archive of ${previous.length} originals (CMS not configured).`);
  process.exit(0);
}

// The image CDN strips EXIF from display renditions. dlRaw returns the original
// uploaded bytes. The credential is used only here, at sync time.
async function readCaptureTime(src) {
  const url = new URL(src);
  if (url.origin !== "https://cdn.sanity.io" || !url.pathname.startsWith(`/images/${project}/${dataset}/`)) {
    throw new Error("Unexpected Sanity asset URL");
  }
  if (!process.env.SANITY_WRITE_TOKEN && !process.env.SANITY_READ_TOKEN) return undefined;
  url.searchParams.set("dlRaw", "true");
  const headers = { Authorization: `Bearer ${process.env.SANITY_READ_TOKEN || process.env.SANITY_WRITE_TOKEN}` };
  // JPEG EXIF normally precedes the pixel data. If the prefix has no date,
  // inspect the complete original before recording that its EXIF is absent.
  const options = { headers, redirect: "error", signal: AbortSignal.timeout(60000) };
  const prefix = await fetch(url, { ...options, headers: { ...headers, Range: "bytes=0-131071" } });
  if (!prefix.ok) throw new Error(`Original returned HTTP ${prefix.status}`);
  const bytes = Buffer.from(await prefix.arrayBuffer());
  const total = Number(prefix.headers.get("content-range")?.split("/")[1]);
  if (prefix.status === 200 || total === bytes.length) return captureTime(bytes);
  const date = await captureTime(bytes).catch(() => null);
  if (date) return date;
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Original returned HTTP ${response.status}`);
  return captureTime(Buffer.from(await response.arrayBuffer()));
}

const query = `*[_type == "photo" && isHidden != true && category->isVisible != false && defined(image.asset)] | order(_id) {
  "id": _id, title, "filename": coalesce(sourceFilename, image.asset->originalFilename),
  "category": category->title, "src": image.asset->url, "hash": image.asset->sha1hash,
  "width": image.asset->metadata.dimensions.width, "height": image.asset->metadata.dimensions.height,
  "assetDate": image.asset->metadata.exif.DateTimeOriginal
}`;
const endpoint = new URL(`https://${project}.api.sanity.io/v2025-02-19/data/query/${dataset}`);
endpoint.searchParams.set("query", query);
let records;
try {
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`CMS returned HTTP ${response.status}`);
  records = (await response.json()).result;
} catch (error) {
  if (!previous.length) throw error;
  console.warn(`Keeping the saved archive because the CMS is unavailable: ${error.message}`);
  process.exit(0);
}
const byHash = new Map();
for (const record of records) {
  if (!record.hash || !record.src || byHash.has(record.hash)) continue;
  byHash.set(record.hash, record);
}
const cache = new Map(previous.map((photo) => [photo.hash, photo]));
const photos = [];
const pending = byHash.values();
let unread = 0;
async function worker() {
  for (const { assetDate, ...photo } of pending) {
    const cached = cache.get(photo.hash);
    let capturedAt = cached?.capturedAt;
    if (capturedAt === undefined) {
      capturedAt = normalizeCaptureTime(assetDate) ?? undefined;
      if (!capturedAt) {
        try {
          const date = await readCaptureTime(photo.src);
          if (date !== undefined) capturedAt = date;
        } catch (error) {
          console.warn(`Could not read ${photo.filename}: ${error.message}`);
        }
      }
    }
    if (capturedAt === undefined) unread++;
    photos.push({ ...photo, title: photo.title || photo.filename, category: photo.category || "", capturedAt });
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
photos.sort((a, b) => a.hash.localeCompare(b.hash));
const temp = new URL(`yearArchive.${randomUUID()}.tmp`, output);
await writeFile(temp, JSON.stringify(photos, null, 2) + "\n");
await rename(temp, output);
console.log(`Indexed ${records.length} published records, ${photos.length} originals, ${photos.filter((p) => p.capturedAt).length} EXIF dates, ${unread} originals awaiting inspection.`);
