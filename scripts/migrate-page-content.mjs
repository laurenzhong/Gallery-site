import { createClient } from "@sanity/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const force = process.argv.includes("--force");

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

async function loadEnv() {
  await loadEnvFile(".env.local");
  await loadEnvFile(".env");
}

function getConfig() {
  const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.VITE_SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.VITE_SANITY_DATASET ?? "production";
  const token = process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_AUTH_TOKEN;
  if (!projectId || projectId === "your_sanity_project_id" || projectId === "yourprojectid") {
    throw new Error("Missing SANITY_STUDIO_PROJECT_ID or VITE_SANITY_PROJECT_ID.");
  }
  if (!token) throw new Error("Missing SANITY_WRITE_TOKEN or SANITY_AUTH_TOKEN.");
  return { projectId, dataset, token };
}

function ref(id, key) {
  return { _key: key, _type: "reference", _ref: id };
}

function createBuilder(photos, categories) {
  const photoByFilename = new Map(photos.map((photo) => [photo.sourceFilename, photo]));
  const categoryByTitle = new Map(categories.map((category) => [category.title, category]));

  const photoRef = (filename, key) => {
    const photo = photoByFilename.get(filename);
    if (!photo) throw new Error(`Missing Sanity photo document: ${filename}`);
    return ref(photo._id, key);
  };

  const refs = (filenames, keyPrefix) => filenames.map((filename, index) => photoRef(filename, `${keyPrefix}-${index}`));
  const categoryRef = (title) => {
    const category = categoryByTitle.get(title);
    if (!category) throw new Error(`Missing Sanity category document: ${title}`);
    return { _type: "reference", _ref: category._id };
  };
  const categorySection = (title, limit) => ({ category: categoryRef(title), limit });

  const squareFilenames = photos
    .filter((photo) => {
      const width = photo.dimensions?.width ?? 0;
      const height = photo.dimensions?.height ?? 0;
      const ratio = height ? width / height : 0;
      return ratio >= 0.82 && ratio <= 1.2;
    })
    .slice(0, 8)
    .map((photo) => photo.sourceFilename);

  const home = {
    _id: "pageLayout-home",
    _type: "pageLayout",
    pageKey: "home",
    title: "Photography",
    subtitle: "A quiet photography archive shaped by landscape, harbor light, and small travel fragments.",
    heroPhoto: photoRef(photos.find((photo) => photo.isHero)?.sourceFilename ?? "DSC_0257.JPG", "home-hero"),
    sections: [
      {
        _key: "home-featured",
        _type: "pageSection",
        title: "Featured photography groups",
        style: "featureCards",
        isVisible: true,
        showTitle: false,
        photos: refs(["DSC_0243.JPG", "DSC_0257.JPG", "DSC_4840.JPG"], "featured"),
      },
      {
        _key: "home-landscape",
        _type: "pageSection",
        title: "Landscape",
        style: "landscapeCarousel",
        isVisible: true,
        showTitle: true,
        ...categorySection("山野", 24),
      },
      {
        _key: "home-quiet",
        _type: "pageSection",
        title: "Quiet moments",
        style: "grid",
        isVisible: true,
        showTitle: true,
        columns: 4,
        photos: refs(squareFilenames.length ? squareFilenames : photos.slice(0, 8).map((photo) => photo.sourceFilename), "quiet"),
      },
      {
        _key: "home-city",
        _type: "pageSection",
        title: "City",
        style: "landscapeCarousel",
        isVisible: true,
        showTitle: true,
        ...categorySection("石塘度假区", 22),
      },
      {
        _key: "home-harbor-banner",
        _type: "pageSection",
        title: "Harbor",
        style: "banner",
        isVisible: true,
        showTitle: true,
        coverPhoto: photoRef("DSC_5026.JPG", "harbor-banner"),
      },
      {
        _key: "home-harbor-carousel",
        _type: "pageSection",
        title: "Harbor",
        style: "landscapeCarousel",
        isVisible: true,
        showTitle: false,
        ...categorySection("harbor", 18),
      },
      {
        _key: "home-harbor-stack",
        _type: "pageSection",
        title: "Harbor details",
        style: "stack",
        isVisible: true,
        showTitle: true,
        ...categorySection("森林", 5),
      },
    ],
  };

  const photobalcony = {
    _id: "pageLayout-photobalcony",
    _type: "pageLayout",
    pageKey: "photobalcony",
    title: "Balcony View",
    subtitle: "A seasonal balcony of recent photographs.",
    heroPhoto: photoRef("DSC_0243.JPG", "balcony-hero"),
    sections: [
      ["2026", "carousel", ["DSC_0257.JPG", "DSC_0518.JPG", "DSC_0521.JPG", "DSC_0522.JPG"], "may"],
      ["Jul 2026", "grid", ["DSC_0264.JPG", "DSC_0335.JPG", "DSC_0396.JPG", "DSC_0470.JPG"], "march-portrait"],
      ["Jul 2026 — wide", "landscapeCarousel", ["DSC_0534.JPG", "DSC_0555.JPG", "DSC_0566.JPG"], "march-wide"],
      ["May - Jun 2026", "carousel", ["DSC_0580.JPG", "DSC_0613.JPG", "DSC_0626.JPG", "DSC_0632.JPG"], "february"],
      ["Apr 2026", "grid", ["DSC_0513.JPG", "DSC_0514.JPG", "DSC_0520.JPG", "DSC_0538.JPG"], "january"],
      ["Mar 2026", "grid", ["DSC_0546.JPG", "DSC_0551.JPG", "DSC_0552.JPG", "DSC_0571.JPG"], "winter"],
      ["Jan - Feb 2026", "stack", ["DSC_0638.JPG", "DSC_0648.JPG", "DSC_0917.JPG", "DSC_2196.JPG"], "summer"],
    ].map(([title, style, filenames, key]) => ({
      _key: `balcony-${key}`,
      _type: "pageSection",
      title,
      style,
      isVisible: true,
      showTitle: true,
      columns: style === "grid" ? 4 : undefined,
      photos: refs(filenames, key),
    })),
  };

  return { home, photobalcony };
}

const siteCopy = {
  _id: "siteCopy-main",
  _type: "siteCopy",
  navigation: { home: "Home", photography: "Photography", balcony: "Balcony View", journal: "Journal", about: "About", photoNotes: "Photo Notes" },
  pages: { photography: "Photography", loading: "Loading this entry.", notFound: "This entry is not available.", backHome: "Back to Queenstown.top", returnToArchive: "Return to the photography archive", photoNotesKicker: "Photo Notes", photoNotesTitle: "Field notes behind selected photographs.", photostoryAboutTitle: "关于摄影师", photostoryMetadataTitle: "照片参数", photostoryMetadataDescription: "点击任意照片可以查看完整的 EXIF 信息——拍摄日期、地点、器材和参数。", photostoryJournalTitle: "创作手记", photostoryJournalDescription: "每张照片背后都有当时的场景、天气、心情。下面是几篇示例。", previewBannerTag: "测试模块", previewBannerText: "这是一个内容侧功能的预览版,用于评估效果。所有文字和参数都是基于现有照片的填充示例,可以稍后替换成真实内容或删除。访问 /photostory 查看。", footerPreviewKicker: "Design study", footerPreviewTitle: "Footer Background" },
  sections: { featured: "Featured photography groups", photographyArchive: "Photography archive", categories: "Photo categories", harbor: "Harbor", about: "About", explore: "Explore", contact: "Contact", follow: "Follow", photoDetails: "Photo details", stories: "Stories", journalNote: "Journal Note", aboutPhotographer: "关于摄影师", gear: "器材", contactDetails: "联系", metadata: "Metadata", relatedPhoto: "Related Photo", landscape: "Landscape", quiet: "Quiet moments", city: "City" },
  controls: { openMenu: "Open menu", closeMenu: "Close menu", backToTop: "Back to top", previous: "Previous", next: "Next", openPhoto: "Open photo", closePhoto: "Close photo details", selectPhoto: "Select photo", copyLink: "Copy link", copied: "Copied", slideshow: "slideshow", openStories: "Open photo notes and stories", readFieldNotes: "Read locations, camera settings, and field notes behind selected photographs." },
  metadata: { date: "Date", location: "Location", camera: "Camera", lens: "Lens", aperture: "Aperture", shutter: "Shutter", iso: "ISO", focalLength: "Focal" },
  footer: { basedIn: "Based in Zhejiang", builtWith: "Built with React + Vite", tagline: "A quiet photography archive - landscape, harbor light, city edges, and small travel fragments.", aboutText: "Queenstown.top is a quiet photography archive shaped around landscape, harbor light, city edges, and small travel fragments. The site keeps images large, direct, and close to the rhythm of a visual notebook.", top: "Top", copyright: "All rights reserved" },
};

async function main() {
  await loadEnv();
  const config = getConfig();
  const client = createClient({ projectId: config.projectId, dataset: config.dataset, apiVersion: "2025-02-19", token: config.token, useCdn: false });
  const [photos, categories] = await Promise.all([
    client.fetch('*[_type == "photo"]{_id, sourceFilename, isHero, dimensions}'),
    client.fetch('*[_type == "category"]{_id, title}'),
  ]);
  const { home, photobalcony } = createBuilder(photos, categories);
  const documents = [home, photobalcony, siteCopy];
  const transaction = client.transaction();
  for (const document of documents) {
    if (force) transaction.createOrReplace(document);
    else transaction.createIfNotExists(document);
  }
  const result = await transaction.commit({ autoGenerateArrayKeys: true });
  console.log(`${force ? "Created or replaced" : "Created if missing"} ${documents.length} CMS content documents.`);
  console.log(`Dataset: ${config.dataset}`);
  console.log(`Transaction: ${result.transactionId}`);
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
