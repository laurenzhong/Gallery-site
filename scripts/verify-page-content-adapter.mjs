import path from "node:path";
import { build } from "esbuild";

const projectRoot = path.resolve(import.meta.dirname, "..");
const adapterPath = path.join(projectRoot, "src", "lib", "pageContentAdapter.ts");

function fail(message) {
  throw new Error(`Page content adapter verification failed: ${message}`);
}

const { outputFiles: [compiled] } = await build({
  entryPoints: [adapterPath],
  bundle: true,
  write: false,
  format: "esm",
  target: "es2022",
});
const adapter = await import(`data:text/javascript;base64,${Buffer.from(compiled.contents).toString("base64")}`);

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

if (home.sections?.[0]?.cards?.[0]?.href !== "/photobalcony") fail("feature card link was not adapted");
if (home.sections?.[1]?.photos?.[0]?.id !== "photo-hero") fail("category gallery was not adapted");
if (home.sections?.[2]?.photo?.id !== "photo-two") fail("banner photo was not adapted");
if (home.sections?.[3]?.photo?.id !== "photo-three") fail("harbor hero was not adapted");
if (home.sections?.[4]?.photos?.[0]?.id !== "photo-two") fail("harbor carousel was not adapted");
if (home.sections?.map((section) => section.kind).join(",") !== "featureCards,gallery,banner,banner,gallery") {
  fail("homepage section order was not normalized");
}

const balcony = adapter.adaptPageContent(
  {
    id: "pageContent-photobalcony",
    pageKey: "photobalcony",
    title: "Balcony View",
    heroPhoto: reference("photo-hero"),
    sections: [
      { id: "march-portrait", type: "balconyPeriodSlot", periodKey: "marchPortraits", title: "Jul 2026", photos: [reference("photo-two")] },
      { id: "may", type: "balconyPeriodSlot", periodKey: "may", title: "2026", photos: [reference("photo-one")] },
      { id: "march-wide", type: "balconyPeriodSlot", periodKey: "marchWide", title: "Jul 2026", photos: [reference("photo-three")] },
      { id: "winter", type: "balconyPeriodSlot", periodKey: "winter", title: "Mar 2026", photos: [reference("photo-two")] },
    ],
  },
  photos,
);

if (balcony.photobalconyLayout?.heroPhoto?.id !== "photo-hero") fail("balcony hero was not adapted");
const legacyChapters = balcony.photobalconyLayout?.chapters;
if (legacyChapters?.map(({ title }) => title).join(",") !== "2026 Highlights,Jul 2026,Mar 2026") {
  fail("legacy selections and July galleries did not become chapters");
}
if (legacyChapters[1].galleries.map(({ presentation }) => presentation).join(",") !== "portraitRail,carousel") fail("July layouts were not preserved");

const draftPhoto = { id: "draft-only", title: "Draft photo", src: "https://example.com/draft.jpg" };
const draft = {
  id: "pageContent-photobalcony",
  pageKey: "photobalcony",
  title: "Balcony draft",
  subtitle: "Unpublished subtitle",
  heroPhoto: draftPhoto,
  sections: [{ id: "may", type: "balconyPeriodSlot", periodKey: "may", title: "2026", photos: [reference("photo-one")] }],
  balconyChapters: [
    { id: "new", title: "Dec 2026", galleries: [
      { id: "hidden", presentation: "carousel", isVisible: false, photos: [draftPhoto] },
      { id: "new-gallery", presentation: "leadGrid", photos: [draftPhoto, draftPhoto] },
      { id: "unsupported", presentation: "unknown", photos: [draftPhoto] },
    ] },
    { id: "hidden-chapter", isVisible: false, galleries: [{ id: "hidden", presentation: "grid", photos: [draftPhoto] }] },
  ],
};
const draftResult = adapter.adaptPageContent(draft, [], { draft: true });
const draftLayout = draftResult.photobalconyLayout;
if (draftLayout.title !== draft.title || draftLayout.subtitle !== draft.subtitle || draftLayout.heroPhoto?.id !== draftPhoto.id) fail("draft heading or hero missing");
if (draftLayout.chapters.map(({ title }) => title).join(",") !== "Dec 2026") fail("new chapters did not replace old periods");
if (draftLayout.chapters[0].galleries.length !== 1 || draftLayout.chapters[0].galleries[0].photos[0]?.id !== draftPhoto.id || draftLayout.chapters[0].galleries[0].photos.length !== 1) fail("draft photo or gallery visibility was not respected");
if (!draftResult.warnings.length) fail("invalid balcony layout did not produce a warning");
if (adapter.adaptPageContent({ ...draft, balconyChapters: [] }, photos).photobalconyLayout.chapters.length) fail("empty chapters brought back legacy content");

const invalid = adapter.adaptPageContent(
  {
    id: "pageContent-invalid",
    pageKey: "home",
    title: "Invalid",
    sections: [{ id: "invalid", type: "bannerSlot", photo: { id: "missing" } }],
  },
  photos,
);

if (invalid.sections?.length) fail("invalid photo reference was accepted");
if (!invalid.warnings.length) fail("invalid content did not produce a warning");

const pagePhotos = photos.map((photo, index) => ({ ...photo, categoryId: index === 1 ? "cat-second" : "cat-first" }));
const repeatGallery = { type: "gallerySlot", slotKey: "landscape", presentation: "leadGrid", photos: [reference("photo-two")] };
const pageDocuments = [
  { id: "pageContent-home", pageKey: "home", sections: [{ ...repeatGallery, isVisible: false }] },
  { id: "pageContent-about", pageKey: "about", sections: [
    { ...repeatGallery, id: "repeat-a" },
    { ...repeatGallery, id: "repeat-b", presentation: "portraitRail", limit: 1, photos: [null, reference("photo-three"), reference("photo-hero")] },
    { type: "bannerSlot", id: "link-a", photo: reference("photo-two"), title: "Map", description: "Discover the route", linkPage: "map", linkTarget: "/journal", linkLabel: "Open the map" },
    { type: "bannerSlot", id: "link-b", photo: reference("photo-two"), linkTarget: "/\\example.com" },
    { type: "gallerySlot", id: "category", sourceMode: "category", category: { id: "cat-second", title: "山野" }, limit: 1 },
  ] },
  { ...draft, extraSections: [{ type: "bannerSlot", photo: reference("photo-three") }] },
  { id: "duplicate", pageKey: "about", sections: [] },
];
const pages = adapter.adaptPublishedPages(pageDocuments, pagePhotos);
if (pages.home.sections.length) fail("hidden homepage modules reappeared");
if (pages.about.sections.map(({ id }) => id).join(",") !== "repeat-a,repeat-b,link-a,link-b,category") fail("repeated modules or ordering were lost");
if (pages.about.sections[1].photos.map(({ id }) => id).join(",") !== "photo-three") fail("broken reference or manual limit was mishandled");
if (pages.about.sections[2].href !== "/map" || pages.about.sections[2].description !== "Discover the route" || pages.about.sections[2].linkLabel !== "Open the map") fail("banner fields or page selection were ignored");
if (pages.about.sections[3].href) fail("external-style path was accepted");
if (pages.about.sections[4].photos[0]?.id !== "photo-one") fail("category selection matched the display name instead of document ID");
const placements = adapter.pagePhotoPlacements(pages, pagePhotos, { home: { landscapePhotoIds: ["photo-hero"] } });
if (placements.has("photo-hero") || placements.get("photo-two")?.has("home")) fail("hidden or superseded modules counted towards publication");
if (!placements.get("photo-three")?.has("photobalcony") || !placements.get("photo-one")?.has("about")) fail("add-on or category placement did not count");

console.log("Page content adapter verification passed: reusable modules, links, visibility, category placement, and legacy balcony content.");
