import { readFile } from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";

const projectRoot = path.resolve(import.meta.dirname, "..");
const adapterPath = path.join(projectRoot, "src", "lib", "pageContentAdapter.ts");

function fail(message) {
  throw new Error(`Page content adapter verification failed: ${message}`);
}

const source = await readFile(adapterPath, "utf8");
const compiled = await transform(source, {
  loader: "ts",
  format: "esm",
  target: "es2022",
  sourcemap: false,
});
const adapter = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`);

const photos = [
  { id: "photo-hero", src: "/hero.jpg", title: "Hero", category: "山野", filename: "hero.jpg", width: 1600, height: 1000 },
  { id: "photo-one", src: "/one.jpg", title: "One", category: "山野", filename: "one.jpg", width: 1600, height: 1000 },
  { id: "photo-two", src: "/two.jpg", title: "Two", category: "海洋", filename: "two.jpg", width: 1600, height: 1000 },
  { id: "photo-three", src: "/three.jpg", title: "Three", category: "石塘度假区", filename: "three.jpg", width: 1600, height: 1000 },
];

const reference = (id) => ({ id, title: id });

const home = adapter.adaptPageContent(
  {
    id: "pageContent-home",
    pageKey: "home",
    title: "Photography",
    sections: [
      {
        id: "features",
        type: "featureCardsSlot",
        cards: [{ title: "Balcony View", photo: reference("photo-one"), linkTarget: "/photobalcony" }],
      },
      {
        id: "landscape",
        type: "gallerySlot",
        slotKey: "landscape",
        sourceMode: "category",
        category: { title: "山野" },
        limit: 1,
      },
      { id: "banner", type: "bannerSlot", photo: reference("photo-two") },
      {
        id: "harbor",
        type: "harborSlot",
        heroPhoto: reference("photo-three"),
        carouselPhotos: [reference("photo-two")],
      },
    ],
  },
  photos,
);

if (home.homepageLayout?.featureCards?.length !== 1) fail("feature card was not adapted");
if (home.homepageLayout?.landscapePhotos?.[0]?.id !== "photo-hero") fail("category gallery was not adapted");
if (home.homepageLayout?.bannerOnePhoto?.id !== "photo-two") fail("banner photo was not adapted");
if (home.homepageLayout?.plantsHeroPhoto?.id !== "photo-three") fail("harbor hero was not adapted");
if (home.homepageLayout?.plantsCarouselPhotos?.[0]?.id !== "photo-two") fail("harbor carousel was not adapted");
if (home.homepageLayout?.sections?.map((section) => section.kind).join(",") !== "featureCards,gallery,banner,banner,gallery") {
  fail("homepage section order was not normalized");
}

const balcony = adapter.adaptPageContent(
  {
    id: "pageContent-photobalcony",
    pageKey: "photobalcony",
    title: "Balcony View",
    heroPhoto: reference("photo-hero"),
    sections: [
      { id: "may", type: "balconyPeriodSlot", periodKey: "may", title: "2026", photos: [reference("photo-one")] },
      { id: "march-wide", type: "balconyPeriodSlot", periodKey: "marchWide", title: "Jul 2026", photos: [reference("photo-three")] },
      { id: "winter", type: "balconyPeriodSlot", periodKey: "winter", title: "Mar 2026", photos: [reference("photo-two")] },
    ],
  },
  photos,
);

if (balcony.photobalconyLayout?.heroPhoto?.id !== "photo-hero") fail("balcony hero was not adapted");
if (balcony.photobalconyLayout?.mayTitle !== "2026") fail("balcony title was not adapted");
if (balcony.photobalconyLayout?.mayPhotos?.[0]?.id !== "photo-one") fail("balcony period was not adapted");
if (balcony.photobalconyLayout?.marchWidePhotos?.[0]?.id !== "photo-three") fail("second March balcony period was not adapted");
if (balcony.photobalconyLayout?.winterPhotos?.[0]?.id !== "photo-two") fail("second balcony period was not adapted");
if (balcony.photobalconyLayout?.periods?.map((period) => period.key).join(",") !== "may,marchWide,winter") {
  fail("balcony period order was not preserved");
}

const invalid = adapter.adaptPageContent(
  {
    id: "pageContent-invalid",
    pageKey: "home",
    title: "Invalid",
    sections: [{ id: "invalid", type: "bannerSlot", photo: { id: "missing" } }],
  },
  photos,
);

if (invalid.homepageLayout?.bannerOnePhoto) fail("invalid photo reference was accepted");
if (!invalid.warnings.length) fail("invalid content did not produce a warning");

console.log("Page content adapter verification passed: home, photobalcony, category source, and invalid-reference fallback.");
