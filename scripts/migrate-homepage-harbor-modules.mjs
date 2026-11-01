import { createClient } from "@sanity/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");

async function loadEnvFile(filename) {
  try {
    const source = await readFile(path.join(projectRoot, filename), "utf8");
    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 0) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
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

if (!projectId || !token) throw new Error("Sanity project ID and write token are required.");

const client = createClient({ projectId, dataset, apiVersion: "2025-02-19", token, useCdn: false });
const document = await client.fetch(
  `*[_type == "pageContent" && pageKey == "home"][0]{_id,sections[]{...,"photoRef":photo._ref,"heroPhotoRef":heroPhoto._ref,"carouselRefs":carouselPhotos[]._ref,"stackRefs":stackPhotos[]._ref,"squareRefs":squarePhotos[]._ref}}`,
);

if (!document?._id) throw new Error("pageContent-home was not found.");

const referenceList = (ids, prefix) =>
  (ids ?? []).filter(Boolean).map((id, index) => ({ _key: `${prefix}-${index}`, _type: "reference", _ref: id }));

const gallery = ({ key, slotKey, title, presentation, photos }) => ({
  _key: key,
  _type: "gallerySlot",
  title,
  isVisible: true,
  slotKey,
  presentation,
  sourceMode: "manual",
  photos: referenceList(photos, `${key}-photo`),
});

const migratedSections = [];
for (const section of document.sections ?? []) {
  if (section._type === "harborSlot") {
    if (section.heroPhotoRef) {
      migratedSections.push({
        _key: "content-home-harbor",
        _type: "bannerSlot",
        title: "Harbor",
        isVisible: section.isVisible !== false,
        slotKey: "harbor",
        photo: { _type: "reference", _ref: section.heroPhotoRef },
      });
    }
    if (section.carouselRefs?.length) {
      migratedSections.push(
        gallery({
          key: "content-home-harbor-carousel",
          slotKey: "harborCarousel",
          title: "Harbor carousel",
          presentation: "landscapeCarousel",
          photos: section.carouselRefs,
        }),
      );
    }
    if (section.stackRefs?.length) {
      migratedSections.push(
        gallery({
          key: "content-home-harbor-stack",
          slotKey: "harborStack",
          title: "Harbor stack",
          presentation: "stack",
          photos: section.stackRefs,
        }),
      );
    }
    if (section.squareRefs?.length) {
      migratedSections.push(
        gallery({
          key: "content-home-harbor-square",
          slotKey: "harborSquare",
          title: "Harbor squares",
          presentation: "squareGrid",
          photos: section.squareRefs,
        }),
      );
    }
    continue;
  }

  if (section._type === "bannerSlot" && !section.slotKey) {
    const banner = { ...section, slotKey: "bannerOne" };
    if (banner.title === "Harbor") delete banner.title;
    migratedSections.push(banner);
    continue;
  }

  migratedSections.push(section);
}

const harborKeys = migratedSections.filter((section) => ["content-home-harbor", "content-home-harbor-carousel", "content-home-harbor-stack", "content-home-harbor-square"].includes(section._key)).map((section) => `${section._type}:${section._key}:${section.title ?? ""}`);
console.log(`Harbor modules: ${harborKeys.join(" | ")}`);

if (process.argv.includes("--dry-run")) {
  console.log("Dry run: no document was written.");
} else {
  await client.patch(document._id).set({ sections: migratedSections }).commit();
  console.log(`Updated ${document._id} with ${migratedSections.length} independent sections.`);
}
