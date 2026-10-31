import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { transform } from "esbuild";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(projectRoot, "sanity", "seed", "generated");
const photosModulePath = path.join(projectRoot, "src", "data", "photos.ts");
const storiesModulePath = path.join(projectRoot, "src", "data", "stories.ts");

function stableHash(value, length = 12) {
  return createHash("sha1").update(value).digest("hex").slice(0, length);
}

function sanitizeIdPart(value, fallback) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return ascii || `${fallback}-${stableHash(value, 8)}`;
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fileBase(filename) {
  return path.basename(filename, path.extname(filename));
}

function blockFromText(text) {
  return {
    _key: randomUUID().replaceAll("-", "").slice(0, 12),
    _type: "block",
    style: "normal",
    markDefs: [],
    children: [
      {
        _key: randomUUID().replaceAll("-", "").slice(0, 12),
        _type: "span",
        marks: [],
        text,
      },
    ],
  };
}

async function importTsModule(filePath) {
  const source = await readFile(filePath, "utf8");
  const result = await transform(source, {
    loader: "ts",
    format: "esm",
    target: "es2022",
    sourcemap: false,
  });
  const encoded = Buffer.from(result.code).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

function localPathFromPublicSrc(src) {
  const parts = decodeURI(src).replace(/^\//, "").split("/");
  return path.join(projectRoot, "public", ...parts);
}

function ref(_ref) {
  return { _type: "reference", _ref };
}

async function writeNdjson(filename, docs) {
  const body = docs.map((doc) => JSON.stringify(doc)).join("\n");
  await writeFile(path.join(outputDir, filename), `${body}\n`, "utf8");
}

const [{ photos, categories }, { photoMeta, photoStories, aboutData }] = await Promise.all([
  importTsModule(photosModulePath),
  importTsModule(storiesModulePath),
]);

const categoryDocs = categories.map((title, index) => {
  const id = `category-${String(index + 1).padStart(2, "0")}-${sanitizeIdPart(title, "category")}`;

  return {
    _id: id,
    _type: "category",
    title,
    slug: {
      _type: "slug",
      current: slugify(title) || `category-${index + 1}`,
    },
    sortOrder: (index + 1) * 10,
    isVisible: true,
  };
});

const categoryIdByTitle = new Map(categoryDocs.map((doc) => [doc.title, doc._id]));

const photoDocs = photos.map((photo, index) => {
  const meta = photoMeta[photo.filename];
  const localPath = localPathFromPublicSrc(photo.src);
  const id = `photo-${sanitizeIdPart(fileBase(photo.filename), "photo")}-${stableHash(photo.src, 8)}`;

  return {
    _id: id,
    _type: "photo",
    title: photo.title,
    slug: {
      _type: "slug",
      current: slugify(fileBase(photo.filename)) || `photo-${index + 1}`,
    },
    legacyId: photo.id,
    sourceFilename: photo.filename,
    legacyPublicPath: photo.src,
    legacyLocalPath: localPath,
    dimensions: {
      width: photo.width,
      height: photo.height,
    },
    category: ref(categoryIdByTitle.get(photo.category)),
    date: meta?.date,
    location: meta?.location,
    camera: meta?.camera,
    lens: meta?.lens,
    aperture: meta?.aperture,
    shutter: meta?.shutter,
    iso: meta?.iso,
    focalLength: meta?.focalLength,
    isFeatured: Boolean(photoStories[photo.filename]),
    isHero: photo.filename === "DSC_0257.JPG",
    isHidden: false,
    sortOrder: (index + 1) * 10,
  };
});

const photoIdByFilename = new Map(photoDocs.map((doc) => [doc.sourceFilename, doc._id]));

for (const categoryDoc of categoryDocs) {
  const cover = photoDocs.find((photo) => photo.category._ref === categoryDoc._id);
  if (cover) {
    categoryDoc.coverPhoto = ref(cover._id);
  }
}

let storyIndex = 0;
const storyDocs = Object.entries(photoStories).flatMap(([filename, stories]) => {
  return stories.map((story) => {
    storyIndex += 1;
    const relatedPhotoId = photoIdByFilename.get(filename);
    const meta = photoMeta[filename];
    const id = `story-${sanitizeIdPart(`${filename}-${story.title}`, "story")}`;

    return {
      _id: id,
      _type: "story",
      title: story.title,
      slug: {
        _type: "slug",
        current: `${slugify(fileBase(filename)) || slugify(story.title) || `story-${storyIndex}`}`,
      },
      excerpt: story.excerpt,
      publishedAt: meta?.date ? `${meta.date}T00:00:00.000Z` : undefined,
      coverPhoto: relatedPhotoId ? ref(relatedPhotoId) : undefined,
      relatedPhotos: relatedPhotoId ? [ref(relatedPhotoId)] : [],
      body: (story.body ?? []).map(blockFromText),
      sortOrder: storyIndex * 10,
    };
  });
});

const heroPhoto = photoDocs.find((photo) => photo.isHero) ?? photoDocs[0];
const siteSettingsDoc = {
  _id: "siteSettings-main",
  _type: "siteSettings",
  siteTitle: "Queenstown Gallery",
  heroPhoto: heroPhoto ? ref(heroPhoto._id) : undefined,
  aboutName: aboutData.name,
  aboutLocation: aboutData.location,
  aboutBio: aboutData.bio.map(blockFromText),
  gear: aboutData.gear,
  socialLinks: aboutData.contact,
};

const photoRef = (filename, key) => {
  const photo = photoIdByFilename.get(filename);
  return photo ? { _key: key, _type: "reference", _ref: photo } : undefined;
};

const photoRefs = (filenames, keyPrefix) =>
  filenames.flatMap((filename, index) => {
    const reference = photoRef(filename, `${keyPrefix}-${index}`);
    return reference ? [reference] : [];
  });

const categoryRef = (title) => {
  const id = categoryIdByTitle.get(title);
  return id ? { _type: "reference", _ref: id } : undefined;
};

const categoryPhotos = (title, limit) => {
  const category = categoryRef(title);
  return category ? { category, limit } : {};
};

const squareFilenames = photos
  .filter((photo) => {
    const ratio = photo.width / photo.height;
    return ratio >= 0.82 && ratio <= 1.2;
  })
  .slice(0, 8)
  .map((photo) => photo.filename);
const quietFilenames = squareFilenames.length ? squareFilenames : photos.slice(0, 8).map((photo) => photo.filename);

const pageLayoutHome = {
  _id: "pageLayout-home",
  _type: "pageLayout",
  pageKey: "home",
  title: "Photography",
  subtitle: "A quiet photography archive shaped by landscape, harbor light, and small travel fragments.",
  heroPhoto: photoRef(photos.find((photo) => photo.isHero)?.filename ?? photos[0]?.filename, "home-hero"),
  sections: [
    {
      _key: "home-featured",
      _type: "pageSection",
      title: "Featured photography groups",
      style: "featureCards",
      isVisible: true,
      showTitle: false,
      photos: photoRefs(["DSC_0243.JPG", "DSC_0257.JPG", "DSC_4840.JPG"], "featured"),
    },
    {
      _key: "home-landscape",
      _type: "pageSection",
      title: "Landscape",
      style: "landscapeCarousel",
      isVisible: true,
      showTitle: true,
      ...categoryPhotos("山野", 24),
    },
    {
      _key: "home-quiet",
      _type: "pageSection",
      title: "Quiet moments",
      style: "grid",
      isVisible: true,
      showTitle: true,
      columns: 4,
      photos: photoRefs(quietFilenames, "quiet"),
    },
    {
      _key: "home-city",
      _type: "pageSection",
      title: "City",
      style: "landscapeCarousel",
      isVisible: true,
      showTitle: true,
      ...categoryPhotos("石塘度假区", 22),
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
      ...categoryPhotos("harbor", 18),
    },
    {
      _key: "home-harbor-stack",
      _type: "pageSection",
      title: "Harbor details",
      style: "stack",
      isVisible: true,
      showTitle: true,
      ...categoryPhotos("森林", 5),
    },
  ],
};

const pageLayoutPhotobalcony = {
  _id: "pageLayout-photobalcony",
  _type: "pageLayout",
  pageKey: "photobalcony",
  title: "Balcony View",
  subtitle: "A seasonal balcony of recent photographs.",
  heroPhoto: photoRef("DSC_0243.JPG", "balcony-hero"),
  sections: [
    {
      _key: "balcony-may",
      _type: "pageSection",
      title: "2026",
      style: "carousel",
      isVisible: true,
      showTitle: true,
      photos: photoRefs(["DSC_0257.JPG", "DSC_0518.JPG", "DSC_0521.JPG", "DSC_0522.JPG"], "may"),
    },
    {
      _key: "balcony-march-portraits",
      _type: "pageSection",
      title: "Jul 2026",
      style: "grid",
      isVisible: true,
      showTitle: true,
      columns: 4,
      photos: photoRefs(["DSC_0264.JPG", "DSC_0335.JPG", "DSC_0396.JPG", "DSC_0470.JPG"], "march-portrait"),
    },
    {
      _key: "balcony-march-wide",
      _type: "pageSection",
      title: "Jul 2026 — wide",
      style: "landscapeCarousel",
      isVisible: true,
      showTitle: false,
      photos: photoRefs(["DSC_0534.JPG", "DSC_0555.JPG", "DSC_0566.JPG"], "march-wide"),
    },
    {
      _key: "balcony-february",
      _type: "pageSection",
      title: "May - Jun 2026",
      style: "carousel",
      isVisible: true,
      showTitle: true,
      photos: photoRefs(["DSC_0580.JPG", "DSC_0613.JPG", "DSC_0626.JPG", "DSC_0632.JPG"], "february"),
    },
    {
      _key: "balcony-january",
      _type: "pageSection",
      title: "Apr 2026",
      style: "grid",
      isVisible: true,
      showTitle: true,
      columns: 4,
      photos: photoRefs(["DSC_0513.JPG", "DSC_0514.JPG", "DSC_0520.JPG", "DSC_0538.JPG"], "january"),
    },
    {
      _key: "balcony-winter",
      _type: "pageSection",
      title: "Mar 2026",
      style: "grid",
      isVisible: true,
      showTitle: true,
      columns: 4,
      photos: photoRefs(["DSC_0546.JPG", "DSC_0551.JPG", "DSC_0552.JPG", "DSC_0571.JPG"], "winter"),
    },
    {
      _key: "balcony-summer",
      _type: "pageSection",
      title: "Jan - Feb 2026",
      style: "stack",
      isVisible: true,
      showTitle: true,
      photos: photoRefs(["DSC_0638.JPG", "DSC_0648.JPG", "DSC_0917.JPG", "DSC_2196.JPG"], "summer"),
    },
  ],
};

const siteCopyDoc = {
  _id: "siteCopy-main",
  _type: "siteCopy",
  navigation: {
    home: "Home",
    photography: "Photography",
    balcony: "Balcony View",
    journal: "Journal",
    about: "About",
    photoNotes: "Photo Notes",
  },
  pages: {
    photography: "Photography",
    loading: "Loading this entry.",
    notFound: "This entry is not available.",
    backHome: "Back to Queenstown.top",
    returnToArchive: "Return to the photography archive",
    photoNotesKicker: "Photo Notes",
    photoNotesTitle: "Field notes behind selected photographs.",
    photostoryAboutTitle: "关于摄影师",
    photostoryMetadataTitle: "照片参数",
    photostoryMetadataDescription: "点击任意照片可以查看完整的 EXIF 信息——拍摄日期、地点、器材和参数。",
    photostoryJournalTitle: "创作手记",
    photostoryJournalDescription: "每张照片背后都有当时的场景、天气、心情。下面是几篇示例。",
    previewBannerTag: "测试模块",
    previewBannerText: "这是一个内容侧功能的预览版,用于评估效果。所有文字和参数都是基于现有照片的填充示例,可以稍后替换成真实内容或删除。访问 /photostory 查看。",
    footerPreviewKicker: "Design study",
    footerPreviewTitle: "Footer Background",
  },
  sections: {
    featured: "Featured photography groups",
    photographyArchive: "Photography archive",
    categories: "Photo categories",
    harbor: "Harbor",
    about: "About",
    explore: "Explore",
    contact: "Contact",
    follow: "Follow",
    photoDetails: "Photo details",
    stories: "Stories",
    journalNote: "Journal Note",
    aboutPhotographer: "关于摄影师",
    gear: "器材",
    contactDetails: "联系",
    metadata: "Metadata",
    relatedPhoto: "Related Photo",
    landscape: "Landscape",
    quiet: "Quiet moments",
    city: "City",
  },
  controls: {
    openMenu: "Open menu",
    closeMenu: "Close menu",
    backToTop: "Back to top",
    previous: "Previous",
    next: "Next",
    openPhoto: "Open photo",
    closePhoto: "Close photo details",
    selectPhoto: "Select photo",
    copyLink: "Copy link",
    copied: "Copied",
    slideshow: "slideshow",
    openStories: "Open photo notes and stories",
    readFieldNotes: "Read locations, camera settings, and field notes behind selected photographs.",
  },
  metadata: {
    date: "Date",
    location: "Location",
    camera: "Camera",
    lens: "Lens",
    aperture: "Aperture",
    shutter: "Shutter",
    iso: "ISO",
    focalLength: "Focal",
  },
  footer: {
    basedIn: "Based in Zhejiang",
    builtWith: "Built with React + Vite",
    tagline: "A quiet photography archive - landscape, harbor light, city edges, and small travel fragments.",
    aboutText:
      "Queenstown.top is a quiet photography archive shaped around landscape, harbor light, city edges, and small travel fragments. The site keeps images large, direct, and close to the rhythm of a visual notebook.",
    top: "Top",
    copyright: "All rights reserved",
  },
};

const assetManifest = photoDocs.map((photo) => ({
  photoId: photo._id,
  filename: photo.sourceFilename,
  publicPath: photo.legacyPublicPath,
  localPath: photo.legacyLocalPath,
  width: photo.dimensions.width,
  height: photo.dimensions.height,
}));

const allDocs = [
  ...categoryDocs,
  ...photoDocs,
  ...storyDocs,
  siteSettingsDoc,
  pageLayoutHome,
  pageLayoutPhotobalcony,
  siteCopyDoc,
].filter(Boolean);

await mkdir(outputDir, { recursive: true });
await writeNdjson("categories.ndjson", categoryDocs);
await writeNdjson("photos.ndjson", photoDocs);
await writeNdjson("stories.ndjson", storyDocs);
await writeNdjson("site-settings.ndjson", [siteSettingsDoc]);
await writeNdjson("page-layouts.ndjson", [pageLayoutHome, pageLayoutPhotobalcony]);
await writeNdjson("site-copy.ndjson", [siteCopyDoc]);
await writeNdjson("all.ndjson", allDocs);
await writeFile(path.join(outputDir, "assets-manifest.json"), `${JSON.stringify(assetManifest, null, 2)}\n`, "utf8");
await writeFile(
  path.join(outputDir, "summary.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      categories: categoryDocs.length,
      photos: photoDocs.length,
      stories: storyDocs.length,
      siteSettings: 1,
      pageLayouts: 2,
      siteCopy: 1,
      outputDir: pathToFileURL(outputDir).href,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Generated ${allDocs.length} Sanity seed documents in ${outputDir}`);
console.log(`Categories: ${categoryDocs.length}`);
console.log(`Photos: ${photoDocs.length}`);
console.log(`Stories: ${storyDocs.length}`);
