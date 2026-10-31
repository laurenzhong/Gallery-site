import { createClient } from "@sanity/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const referenceTypes = ["category", "homepageLayout", "pageLayout", "photobalconyLayout", "siteSettings", "story"];

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
    if (error.code !== "ENOENT") throw error;
  }
}

async function loadEnv() {
  await loadEnvFile(".env.local");
  await loadEnvFile(".env");
}

function publicPhotoId(id) {
  return id.replace(/^photo\./, "photo-").replace(/\./g, "-");
}

function stripSystemFields(document) {
  const next = structuredClone(document);
  delete next._createdAt;
  delete next._updatedAt;
  delete next._rev;
  return next;
}

function replaceReferences(value, idMap) {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = replaceReferences(item, idMap);
      changed ||= result.changed;
      return result.value;
    });
    return { value: next, changed };
  }

  if (!value || typeof value !== "object") {
    return { value, changed: false };
  }

  let changed = false;
  const next = {};

  for (const [key, item] of Object.entries(value)) {
    if (key === "_ref" && typeof item === "string" && idMap.has(item)) {
      next[key] = idMap.get(item);
      changed = true;
      continue;
    }

    const result = replaceReferences(item, idMap);
    next[key] = result.value;
    changed ||= result.changed;
  }

  return { value: next, changed };
}

function assertNoConflictingPublicDocs(dottedPhotos, existingPublicDocs, idMap) {
  const existingById = new Map(existingPublicDocs.map((document) => [document._id, document]));
  const conflicts = [];

  for (const photo of dottedPhotos) {
    const publicId = idMap.get(photo._id);
    const existing = existingById.get(publicId);
    if (!existing) continue;

    if (existing.sourceFilename !== photo.sourceFilename || existing._type !== photo._type) {
      conflicts.push(`${photo._id} -> ${publicId}`);
    }
  }

  if (conflicts.length > 0) {
    throw new Error(`Public ID conflicts found: ${conflicts.join(", ")}`);
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  await loadEnv();

  const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.VITE_SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.VITE_SANITY_DATASET ?? "production";
  const token = process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_AUTH_TOKEN;

  if (!projectId || projectId === "your_sanity_project_id" || projectId === "yourprojectid") {
    throw new Error("Missing SANITY_STUDIO_PROJECT_ID or VITE_SANITY_PROJECT_ID.");
  }

  if (!token) {
    throw new Error("Missing SANITY_WRITE_TOKEN or SANITY_AUTH_TOKEN.");
  }

  const client = createClient({ projectId, dataset, apiVersion: "2025-02-19", token, useCdn: false });
  const allPhotos = await client.fetch('*[_type == "photo"]');
  const dottedPhotos = allPhotos.filter((photo) => photo._id.startsWith("photo."));

  if (dottedPhotos.length === 0) {
    console.log("No dotted photo IDs found.");
    return;
  }

  const idMap = new Map(dottedPhotos.map((photo) => [photo._id, publicPhotoId(photo._id)]));
  const publicIds = [...idMap.values()];
  const existingPublicDocs = await client.fetch("*[_id in $ids]{_id,_type,sourceFilename}", { ids: publicIds });
  assertNoConflictingPublicDocs(dottedPhotos, existingPublicDocs, idMap);

  const referenceDocs = await client.fetch("*[_type in $types]", { types: referenceTypes });
  const changedReferenceDocs = [];

  for (const document of referenceDocs) {
    const result = replaceReferences(document, idMap);
    if (result.changed) {
      changedReferenceDocs.push(stripSystemFields(result.value));
    }
  }

  console.log(`Dotted photos: ${dottedPhotos.length}`);
  console.log(`Reference documents to update: ${changedReferenceDocs.length}`);
  for (const photo of dottedPhotos) {
    console.log(`  ${photo._id} -> ${idMap.get(photo._id)} (${photo.sourceFilename ?? photo.title ?? "untitled"})`);
  }

  if (!apply) {
    console.log("");
    console.log("Dry run only. Re-run with --apply to migrate.");
    return;
  }

  let transaction = client.transaction();

  for (const photo of dottedPhotos) {
    transaction = transaction.createIfNotExists({ ...stripSystemFields(photo), _id: idMap.get(photo._id) });
  }

  for (const document of changedReferenceDocs) {
    transaction = transaction.createOrReplace(document);
  }

  for (const photo of dottedPhotos) {
    transaction = transaction.delete(photo._id);
  }

  const result = await transaction.commit({ autoGenerateArrayKeys: true });
  console.log("");
  console.log(`Migration committed: ${result.transactionId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
