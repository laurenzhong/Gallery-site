import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import exifr from "exifr";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const projectRoot = path.resolve(import.meta.dirname, "..");
const reportDir = path.join(projectRoot, "sanity", "seed", "generated");
const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const args = {
    dryRun: false,
    source: undefined,
    concurrency: 4,
    limit: undefined,
    publish: false,
    sortOffset: undefined,
    subjects: [],
    conditions: [],
    classify: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--source") {
      args.source = argv[i + 1];
      i += 1;
    } else if (a === "--limit") {
      const v = Number(argv[i + 1]);
      if (!Number.isInteger(v) || v < 1) throw new Error("--limit must be positive integer");
      args.limit = v;
      i += 1;
    } else if (a === "--concurrency") {
      const v = Number(argv[i + 1]);
      if (!Number.isInteger(v) || v < 1) throw new Error("--concurrency must be positive integer");
      args.concurrency = v;
      i += 1;
    } else if (a === "--publish") args.publish = true;
    else if (a === "--subjects") {
      args.subjects = String(argv[i + 1] ?? "").split(",").map((value) => value.trim()).filter(Boolean);
      i += 1;
    } else if (a === "--conditions") {
      args.conditions = String(argv[i + 1] ?? "").split(",").map((value) => value.trim()).filter(Boolean);
      i += 1;
    } else if (a === "--classify") args.classify = true;
    else if (a === "--sort-offset") {
      const v = Number(argv[i + 1]);
      if (!Number.isInteger(v)) throw new Error("--sort-offset must be integer");
      args.sortOffset = v;
      i += 1;
    } else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

async function loadEnvFile(filename) {
  try {
    const content = await readFile(path.join(projectRoot, filename), "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const sep = line.indexOf("=");
      if (sep === -1) continue;
      const key = line.slice(0, sep).trim();
      let value = line.slice(sep + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}

async function loadEnv() {
  await loadEnvFile(".env.local");
  await loadEnvFile(".env");
}

let PROJECT;
let DATASET;
let TOKEN;
const API = "2025-02-19";
let HOST;

async function sanFetch(method, path, body, headers, isBinary = false) {
  const url = `https://${HOST}${path}`;
  const init = {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(headers ?? {}) },
    signal: AbortSignal.timeout(120000),
  };
  if (body && !isBinary) init.body = JSON.stringify(body);
  else if (body && isBinary) init.body = body;

  for (let i = 0; i < 4; i += 1) {
    try {
      const r = await fetch(url, init);
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`${r.status} ${r.statusText}: ${t.slice(0, 200)}`);
      }
      return await r.json();
    } catch (e) {
      if (i === 3) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

async function listAll(q, pageSize = 200) {
  const all = [];
  let skip = 0;
  while (true) {
    const path = `/v${API}/data/query/${DATASET}?query=${encodeURIComponent(q)}&%24skip=${skip}&%24pageSize=${pageSize}`;
    const r = await sanFetch("GET", path);
    all.push(...r.result);
    if (r.result.length < pageSize) break;
    skip += pageSize;
  }
  return all;
}

async function mutate(body) {
  return sanFetch("POST", `/v${API}/data/mutate/${DATASET}`, body);
}

async function uploadAsset(filename, stream) {
  const path = `/v${API}/assets/images/${DATASET}?filename=${encodeURIComponent(filename)}`;
  const headers = { "Content-Type": "image/jpeg" };
  const streamToFetch = async () => {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  };
  const buf = await streamToFetch();
  const r = await sanFetch("POST", path, buf, headers, true);
  return r.asset;
}

function defaultSortOrderFromFilename(filename, offset) {
  const m = filename.match(/DSC_(\d+)/i);
  const num = m ? parseInt(m[1], 10) : 0;
  return offset + num;
}

async function listJpgFiles(sourceDir) {
  const collected = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (e) {
      if (e.code === "ENOENT") throw new Error(`Source directory not found: ${dir}`);
      throw e;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && /\.jpe?g$/i.test(entry.name)) collected.push(full);
    }
  }
  await walk(sourceDir);
  collected.sort((a, b) => a.localeCompare(b));
  return collected;
}

async function isDirectory(candidate) {
  try {
    return (await stat(candidate)).isDirectory();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function resolveSourceDirectory(rawSource) {
  const direct = path.resolve(projectRoot, rawSource);
  if (await isDirectory(direct)) return direct;

  // The docs are also commonly followed from the parent workspace, so accept
  // `gallery-site/<folder>` when the command itself runs in `gallery-site/`.
  const sourceParts = String(rawSource)
    .split(/[\\/]+/)
    .filter(Boolean);
  if (sourceParts[0]?.toLowerCase() === path.basename(projectRoot).toLowerCase()) {
    const withoutProjectPrefix = path.join(projectRoot, ...sourceParts.slice(1));
    if (await isDirectory(withoutProjectPrefix)) return withoutProjectPrefix;
  }

  throw new Error(
    `Source directory not found: ${direct}. Run from ${projectRoot} with --source .\\<folder>, or pass an absolute path.`,
  );
}

function fileBase(filename) {
  return path.basename(filename, path.extname(filename));
}

function stableHash(value, length = 8) {
  return createHash("sha1").update(value).digest("hex").slice(0, length);
}

function sanitizeIdPart(value, fallback) {
  const ascii = String(value)
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return ascii || `${fallback}-${stableHash(String(value))}`;
}

function photoDocumentId(category, basename) {
  return `photo-${sanitizeIdPart(category, "category")}-${sanitizeIdPart(basename, "photo")}`;
}

function slugifyForCategory(category, basename) {
  const base = `${category}-${basename}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `photo-${Date.now()}`;
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${(bytes / 1024).toFixed(0)}KB`;
}

function cleanExifString(value) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.split(String.fromCharCode(0)).join("").trim();
  return cleaned || undefined;
}

function formatDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})[:/-](\d{2})[:/-](\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }

  return undefined;
}

function formatAperture(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return `f/${Number.isInteger(value) ? value : value.toFixed(1).replace(/\.0$/, "")}`;
}

function formatShutter(value) {
  if (typeof value === "string") return cleanExifString(value);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;

  if (value >= 1) {
    return `${Number.isInteger(value) ? value : value.toFixed(1).replace(/\.0$/, "")}s`;
  }

  const denominator = Math.round(1 / value);
  return denominator > 0 ? `1/${denominator}s` : undefined;
}

function formatFocalLength(value) {
  if (typeof value === "string") return cleanExifString(value);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  const focal = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${focal}mm`;
}

function formatCamera(make, model) {
  const makeLabel = cleanExifString(make);
  const modelLabel = cleanExifString(model);
  if (!makeLabel && !modelLabel) return undefined;
  if (!makeLabel) return modelLabel;
  if (!modelLabel) return makeLabel;
  return modelLabel.toLowerCase().includes(makeLabel.toLowerCase()) ? modelLabel : `${makeLabel} ${modelLabel}`;
}

function formatLocation(gps) {
  const latitude = Number(gps?.latitude);
  const longitude = Number(gps?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
    : undefined;
}

async function readPhotoExif(localPath) {
  try {
    const [exif, gps] = await Promise.all([
      exifr.parse(localPath, [
        "Make",
        "Model",
        "LensModel",
        "Lens",
        "FNumber",
        "ExposureTime",
        "ISO",
        "FocalLength",
        "DateTimeOriginal",
        "CreateDate",
        "ModifyDate",
      ]),
      exifr.gps(localPath).catch(() => undefined),
    ]);

    if (!exif && !gps) return {};
    const exifTags = exif ?? {};

    const metadata = {
      date: formatDate(exifTags.DateTimeOriginal ?? exifTags.CreateDate ?? exifTags.ModifyDate),
      camera: formatCamera(exifTags.Make, exifTags.Model),
      lens: cleanExifString(exifTags.LensModel) ?? cleanExifString(exifTags.Lens),
      aperture: formatAperture(exifTags.FNumber),
      shutter: formatShutter(exifTags.ExposureTime),
      iso: typeof exifTags.ISO === "number" && Number.isFinite(exifTags.ISO) ? exifTags.ISO : undefined,
      focalLength: formatFocalLength(exifTags.FocalLength),
      location: formatLocation(gps),
    };

    return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
  } catch (e) {
    console.warn(`Could not read EXIF from ${localPath}: ${e.message ?? e}`);
    return {};
  }
}

function summarizeExif(metadata) {
  const parts = [
    metadata.date,
    metadata.location ? `GPS ${metadata.location}` : undefined,
    metadata.camera,
    metadata.lens,
    metadata.focalLength,
    metadata.aperture,
    metadata.shutter,
    typeof metadata.iso === "number" ? `ISO ${metadata.iso}` : undefined,
  ].filter(Boolean);

  return parts.length ? parts.join(" / ") : "no EXIF metadata";
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  });
  await Promise.all(workers);
}

async function ensureCategory(title) {
  const existing = await listAll(
    `*[_type == "category" && title == "${title.replace(/"/g, '\\"')}"]{ _id, title }`,
  );
  if (existing.length > 0) return existing[0];
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const r = await mutate({
    mutations: [
      {
        create: {
          _type: "category",
          title,
          slug: { _type: "slug", current: slug },
          sortOrder: 50,
        },
      },
    ],
  });
  return { _id: r.results[0].document._id ?? r.results[0].id, title };
}

async function uploadOne(category, categoryId, sourceDirAbs, localPath, filename, opts) {
  const base = fileBase(filename);
  const docId = photoDocumentId(category, base);
  const slug = slugifyForCategory(category, base);
  const exifMetadata = await readPhotoExif(localPath);

  const createMut = await mutate({
    mutations: [
      {
        create: {
          _id: docId,
          _type: "photo",
          title: base,
          altText: `${category} ${base}`,
          slug: { _type: "slug", current: slug },
          ...(categoryId ? { category: { _type: "reference", _ref: categoryId } } : {}),
          subjects: opts.subjects,
          conditions: opts.conditions,
          sortOrder: opts.sortOrder,
          isHidden: false,
          sourceFilename: filename,
          legacyLocalPath: localPath,
          legacyPublicPath: path.posix.join("photos", category, filename),
          dimensions: { _type: "object", width: null, height: null },
          ...exifMetadata,
        },
      },
    ],
  });

  const stream = createReadStream(localPath);
  const asset = await uploadAsset(filename, stream);

  await mutate({
    mutations: [
      {
        patch: {
          id: docId,
          set: {
            image: { _type: "image", asset: { _type: "reference", _ref: asset._id } },
          },
        },
      },
    ],
  });

  return { photoId: docId, assetId: asset._id, mutationId: createMut.transactionId, exifMetadata };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadEnv();

  PROJECT = process.env.SANITY_STUDIO_PROJECT_ID;
  DATASET = process.env.SANITY_STUDIO_DATASET ?? "production";
  TOKEN = process.env.SANITY_WRITE_TOKEN;
  HOST = `${PROJECT}.api.sanity.io`;

  const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? "http://127.0.0.1:7897";
  setGlobalDispatcher(new ProxyAgent({ uri: proxyUrl, requestTls: { rejectUnauthorized: true } }));

  if (!PROJECT || PROJECT === "your_sanity_project_id") {
    throw new Error("Missing SANITY_STUDIO_PROJECT_ID in .env.local");
  }

  if (!args.source) {
    const candidates = await readdir(projectRoot, { withFileTypes: true });
    const skip = ["node_modules", "dist", "sanity", "scripts", "src", "docs", "public", ".sanity", ".vercel", ".oxlintrc.json", ".gitignore", ".vercelignore", ".env.example", ".env.local", "package-lock.json", "package.json", "tsconfig.json", "index.html", "vite.config.ts", "sanity.cli.ts", "sanity.config.ts", "README.md", "dev.log"];
    const cats = candidates.filter((e) => e.isDirectory() && !skip.includes(e.name) && !e.name.startsWith("."));
    if (cats.length === 1) {
      args.source = path.join(projectRoot, cats[0].name);
      console.log(`Auto-selected source folder: ${args.source}`);
    } else {
      throw new Error(
        `--source required. Candidate folders: ${cats.map((c) => c.name).join(", ")}`,
      );
    }
  }

  const sourceAbs = await resolveSourceDirectory(args.source);
  const category = path.basename(sourceAbs);
  console.log(`Source: ${sourceAbs}`);
  console.log(`Category (derived from folder): ${category}`);
  if (args.subjects.length) console.log(`Default subject tags: ${args.subjects.join(", ")}`);
  if (args.conditions.length) console.log(`Default conditions: ${args.conditions.join(", ")}`);

  const files = await listJpgFiles(sourceAbs);
  console.log(`Found ${files.length} JPG files in ${category}/`);
  if (files.length === 0) return;

  const items = await Promise.all(
    files.map(async (p) => ({
      localPath: p,
      filename: path.basename(p),
      size: (await stat(p)).size,
    })),
  );

  const sortOffset = args.sortOffset ?? 100;
  if (!args.dryRun) {
    console.log(`Sort order offset: ${sortOffset} (DSC_0264 -> ${sortOffset + 264})`);
    console.log("Default visibility (isHidden): false (public)");
  }

  let existingByName = new Map();
  if (args.dryRun || !TOKEN) {
    if (!TOKEN) {
      console.log("(no SANITY_WRITE_TOKEN, skipping duplicate check)");
    }
  } else {
    const existing = await listAll(`*[_type == "photo" && defined(sourceFilename)]{ _id, sourceFilename }`);
    for (const d of existing) {
      if (!d.sourceFilename) continue;
      const list = existingByName.get(d.sourceFilename) ?? [];
      list.push(d);
      existingByName.set(d.sourceFilename, list);
    }
  }

  const limited = args.limit ? items.slice(0, args.limit) : items;
  const todo = limited.filter((it) => !(existingByName.get(it.filename)?.length));
  const skippedExisting = limited.length - todo.length;

  if (args.dryRun) {
    console.log("\nDry run: not connecting to Sanity for create/upload.");
    const report = [];
    for (const it of limited) {
      const matches = existingByName.get(it.filename) ?? [];
      const status = matches.length ? "exists" : "would-create";
      const exifMetadata = await readPhotoExif(it.localPath);
      console.log(
        `[${formatSize(it.size)}] ${it.filename} -> ${status}${matches.length ? " existing=" + matches.map((m) => m._id).join(",") : ""} | ${summarizeExif(exifMetadata)}`,
      );
      report.push({ file: it.filename, size: it.size, status, existing: matches.map((m) => m._id), exifMetadata });
    }
    const would = report.filter((r) => r.status === "would-create").length;
    const exists = report.filter((r) => r.status === "exists").length;
    console.log(`\nWould create: ${would}\nAlready present: ${exists}`);
    await mkdir(reportDir, { recursive: true });
    const out = path.join(reportDir, `upload-photos-dryrun-${category.toLowerCase()}.json`);
    await writeFile(out, JSON.stringify({ scannedAt: new Date().toISOString(), source: sourceAbs, items: report }, null, 2));
    console.log(`Report: ${out}`);
    return;
  }

  if (!TOKEN) throw new Error("Missing SANITY_WRITE_TOKEN (required for real upload)");

  console.log(`Ensuring category "${category}"...`);
  const catDoc = await ensureCategory(category);
  console.log(`Category: ${catDoc._id}`);

  console.log(`To upload: ${todo.length}  Already present: ${skippedExisting}\n`);
  const report = [];
  let ok = 0;
  let failed = 0;
  const startedAt = Date.now();

  await runPool(todo, args.concurrency, async (item, i) => {
    const prefix = `[${i + 1}/${todo.length}]`;
    try {
      const r = await uploadOne(category, catDoc._id, sourceAbs, item.localPath, item.filename, {
        sortOrder: defaultSortOrderFromFilename(item.filename, sortOffset),
        isHidden: false,
        subjects: args.subjects,
        conditions: args.conditions,
      });
      ok += 1;
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`${prefix} ok  ${item.filename} -> photo=${r.photoId} asset=${r.assetId}  ${summarizeExif(r.exifMetadata)}  (${elapsed}s)`);
      report.push({ ...item, status: "uploaded", ...r });
    } catch (e) {
      failed += 1;
      console.error(`${prefix} FAIL ${item.filename} -> ${e.message ?? e}`);
      report.push({ ...item, status: "failed", error: e.message ?? String(e) });
    }
  });

  if (args.classify) {
    const ids = report.map((item) => item.photoId).filter(Boolean);
    if (ids.length) {
      console.log(`\nStarting AI classification for ${ids.length} uploaded photo(s)...`);
      await execFileAsync(process.execPath, [path.join(projectRoot, "scripts", "classify-sanity-photos.mjs"), "--ids", ids.join(",")], { stdio: "inherit" });
    }
  }

  await mkdir(reportDir, { recursive: true });
  const out = path.join(reportDir, `upload-photos-${category.toLowerCase()}-${Date.now()}.json`);
  await writeFile(
    out,
    JSON.stringify(
      {
        uploadedAt: new Date().toISOString(),
        projectId: PROJECT,
        dataset: DATASET,
        category: { id: catDoc._id, title: category },
        ok,
        skipped: skippedExisting,
        failed,
        elapsedSec: ((Date.now() - startedAt) / 1000).toFixed(1),
        items: report,
      },
      null,
      2,
    ),
  );
  console.log(`\nOK: ${ok}  Skipped: ${skippedExisting}  Failed: ${failed}`);
  console.log(`Elapsed: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log(`Report: ${out}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
