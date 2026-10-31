import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { imageSizeFromFile } from "image-size/fromFile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = projectRoot;
const publicPhotoRoot = path.join(projectRoot, "public", "photos");
const dataFile = path.join(projectRoot, "src", "data", "photos.ts");

const categories = ["山野", "建筑", "日出日落", "森林", "河流", "海洋", "石塘度假区", "花朵", "harbor"];

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const imageCdnParams = "?w=2560&q=90&auto=format&fit=max";

const toPosix = (value) => value.split(path.sep).join("/");

const titleFromFilename = (filename) => path.basename(filename, path.extname(filename));

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function loadLocalEnv() {
  for (const filename of [".env.local", ".env"]) {
    const envPath = path.join(projectRoot, filename);

    try {
      const contents = await readFile(envPath, "utf8");
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

        const [key, ...valueParts] = trimmed.split("=");
        if (process.env[key]) continue;

        process.env[key] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      // Optional local env files are not required in CI.
    }
  }
}

function withImageParams(src) {
  if (!src || src.includes("?")) return src;
  return `${src}${imageCdnParams}`;
}

function fetchJsonWithPowerShell(url) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; (Invoke-WebRequest -Uri '${url}' -UseBasicParsing -TimeoutSec 30).Content`,
      ],
      { windowsHide: true, maxBuffer: 1024 * 1024 * 4 },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          resolve(JSON.parse(stdout));
        } catch (parseError) {
          reject(parseError);
        }
      },
    );
  });
}

async function fetchJson(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Sanity responded ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (process.platform === "win32") {
      return fetchJsonWithPowerShell(url);
    }

    throw error;
  }
}

async function fetchCmsHeroPhoto() {
  await loadLocalEnv();

  const projectId = process.env.VITE_SANITY_PROJECT_ID ?? process.env.SANITY_STUDIO_PROJECT_ID;
  const dataset = process.env.VITE_SANITY_DATASET ?? process.env.SANITY_STUDIO_DATASET ?? "production";

  if (!projectId || !dataset) {
    return { configured: false, photo: undefined };
  }

  const query = `{
    "hero": coalesce(
      *[_type == "siteSettings"][0].heroPhoto->{
        "id": _id,
        "src": image.asset->url,
        title,
        "slug": slug.current,
        "category": category->title,
        "filename": sourceFilename,
        "width": coalesce(image.asset->metadata.dimensions.width, dimensions.width),
        "height": coalesce(image.asset->metadata.dimensions.height, dimensions.height)
      },
      *[_type == "photo" && isHidden != true && category->isVisible != false && isHero == true][0]{
        "id": _id,
        "src": image.asset->url,
        title,
        "slug": slug.current,
        "category": category->title,
        "filename": sourceFilename,
        "width": coalesce(image.asset->metadata.dimensions.width, dimensions.width),
        "height": coalesce(image.asset->metadata.dimensions.height, dimensions.height)
      }
    )
  }`;

  try {
    const payload = await fetchJson(
      `https://${projectId}.api.sanity.io/v2025-02-19/data/query/${dataset}?query=${encodeURIComponent(query)}`,
    );
    return { configured: true, photo: payload.result?.hero };
  } catch (error) {
    console.warn(
      `Could not read Sanity hero for initial data: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return { configured: true, photo: undefined };
  }
}

async function copyIfChanged(source, target) {
  const sourceStats = await stat(source);

  try {
    const targetStats = await stat(target);
    if (
      targetStats.size === sourceStats.size &&
      Math.floor(targetStats.mtimeMs) >= Math.floor(sourceStats.mtimeMs)
    ) {
      return;
    }
  } catch {
    // Missing target: copy below.
  }

  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
}

async function removeStaleFiles(root, expected) {
  let entries = [];

  try {
    entries = await readdir(root, { recursive: true, withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const fullPath = path.resolve(entry.parentPath, entry.name);
    if (!expected.has(fullPath)) {
      await rm(fullPath, { force: true });
    }
  }
}

async function collectPhotos(heroFilename) {
  const photos = [];
  const expectedFiles = new Set();
  let foundSourceCategory = false;

  await mkdir(publicPhotoRoot, { recursive: true });

  for (const category of categories) {
    const sourceCategoryDir = path.join(sourceRoot, category);
    const targetCategoryDir = path.join(publicPhotoRoot, category);

    let entries;
    try {
      entries = await readdir(sourceCategoryDir, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    foundSourceCategory = true;
    await mkdir(targetCategoryDir, { recursive: true });

    const files = entries
      .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true, sensitivity: "base" }));

    for (const filename of files) {
      const sourcePath = path.join(sourceCategoryDir, filename);
      const targetPath = path.join(targetCategoryDir, filename);
      expectedFiles.add(path.resolve(targetPath));

      await copyIfChanged(sourcePath, targetPath);

      const dimensions = await imageSizeFromFile(sourcePath);
      const rawWidth = dimensions.width ?? 1;
      const rawHeight = dimensions.height ?? 1;
      const shouldSwap = dimensions.orientation && dimensions.orientation >= 5 && dimensions.orientation <= 8;

      photos.push({
        id: `photo-${String(photos.length + 1).padStart(3, "0")}`,
        src: `/${toPosix(path.relative(path.join(projectRoot, "public"), targetPath))}`,
        title: titleFromFilename(filename),
        slug: slugify(titleFromFilename(filename)) || `photo-${String(photos.length + 1).padStart(3, "0")}`,
        category,
        filename,
        width: shouldSwap ? rawHeight : rawWidth,
        height: shouldSwap ? rawWidth : rawHeight,
        isHero: filename === heroFilename,
      });
    }
  }

  if (foundSourceCategory) {
    await removeStaleFiles(publicPhotoRoot, expectedFiles);
  }

  return photos;
}

function toInitialHeroPhoto(cmsHeroPhoto, photos) {
  if (!cmsHeroPhoto?.filename) return undefined;

  const matchingPhoto = photos.find((photo) => photo.filename === cmsHeroPhoto.filename);
  if (!matchingPhoto && !cmsHeroPhoto.src) return undefined;

  return {
    id: cmsHeroPhoto.id ?? matchingPhoto?.id ?? `hero-${slugify(cmsHeroPhoto.filename)}`,
    src: withImageParams(cmsHeroPhoto.src) ?? matchingPhoto?.src,
    title: cmsHeroPhoto.title ?? matchingPhoto?.title ?? titleFromFilename(cmsHeroPhoto.filename),
    slug: cmsHeroPhoto.slug ?? matchingPhoto?.slug,
    category: cmsHeroPhoto.category ?? matchingPhoto?.category ?? "",
    filename: cmsHeroPhoto.filename,
    width: cmsHeroPhoto.width || matchingPhoto?.width || 1,
    height: cmsHeroPhoto.height || matchingPhoto?.height || 1,
    isHero: true,
  };
}

function serializeData(photos, initialHeroPhoto) {
  return `export type Photo = {
  id: string;
  src: string;
  title: string;
  slug?: string;
  category: string;
  filename: string;
  width: number;
  height: number;
  isHero?: boolean;
  altText?: string;
  caption?: string;
  credit?: string;
};

export const categories = ${JSON.stringify(categories, null, 2)} as const;

export const photos: Photo[] = ${JSON.stringify(photos, null, 2)};

export const initialHeroPhoto: Photo | undefined = ${JSON.stringify(initialHeroPhoto, null, 2)};
`;
}

const cmsHero = await fetchCmsHeroPhoto();
const heroFilename = cmsHero.photo?.filename ?? (cmsHero.configured ? undefined : "DSC_0257.JPG");
const photos = await collectPhotos(heroFilename);
const initialHeroPhoto = toInitialHeroPhoto(cmsHero.photo, photos);

if (photos.length > 0) {
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, serializeData(photos, initialHeroPhoto), "utf8");
  console.log(`Synced ${photos.length} photos into public/photos and generated src/data/photos.ts`);
} else {
  console.log("No local source photos found; keeping the existing static data file for remote CMS builds.");
}
