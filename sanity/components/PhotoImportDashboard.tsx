import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import exifr from "exifr";
import { useClient } from "sanity";

type Category = {
  _id: string;
  title: string;
};

type ExifData = {
  date?: string;
  location?: string;
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter?: string;
  iso?: number;
  focalLength?: string;
  description?: string;
};

type ImportStatus = "pending" | "uploading" | "imported" | "skipped" | "error";

type ImportItem = {
  id: string;
  file: File;
  title: string;
  slug: string;
  previewUrl: string;
  exif: ExifData;
  status: ImportStatus;
  error?: string;
};

type AssetUploadResult = {
  _id: string;
  metadata?: {
    dimensions?: {
      width?: number;
      height?: number;
    };
  };
};

const clientApiVersion = "2025-02-19";

function basename(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function makeSlug(value: string) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return (ascii || `photo-${hashString(value)}`).slice(0, 88);
}

function toStringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function formatDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
  const date = new Date(normalized.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function formatLocation(tags: Record<string, unknown>) {
  const latitude = Number(tags.latitude ?? tags.GPSLatitude);
  const longitude = Number(tags.longitude ?? tags.GPSLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatExif(tags: Record<string, unknown> | undefined): ExifData {
  if (!tags) return {};
  const make = toStringValue(tags.Make);
  const model = toStringValue(tags.Model);
  const lens = toStringValue(tags.LensModel ?? tags.Lens);
  const fNumber = tags.FNumber ?? tags.ApertureValue;
  const exposure = tags.ExposureTime ?? tags.ExposureTimeOriginal;
  const isoValue = Number(tags.ISO ?? tags.ISOSpeedRatings);
  const focal = toStringValue(tags.FocalLength);

  return {
    date: formatDate(tags.DateTimeOriginal ?? tags.CreateDate ?? tags.ModifyDate),
    location: formatLocation(tags),
    camera: [make, model].filter(Boolean).join(" ") || undefined,
    lens,
    aperture: fNumber == null ? undefined : `f/${Number(fNumber).toFixed(1)}`,
    shutter: exposure == null ? undefined : `${exposure}s`,
    iso: Number.isFinite(isoValue) ? isoValue : undefined,
    focalLength: focal ? `${focal}mm` : undefined,
    description: toStringValue(tags.ImageDescription ?? tags.Title),
  };
}

async function readExif(file: File) {
  try {
    const tags = (await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      xmp: true,
      mergeOutput: true,
    })) as Record<string, unknown> | undefined;
    return formatExif(tags);
  } catch {
    return {};
  }
}

function statusLabel(status: ImportStatus) {
  if (status === "uploading") return "正在上传";
  if (status === "imported") return "已导入";
  if (status === "skipped") return "已跳过（重复文件名）";
  if (status === "error") return "导入失败";
  return "待导入";
}

export function PhotoImportDashboard() {
  const client = useClient({ apiVersion: clientApiVersion });
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<ImportItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [items, setItems] = useState<ImportItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    client
      .fetch<Category[]>(`*[_type == "category"] | order(sortOrder asc, title asc) { _id, title }`)
      .then((result) => {
        if (active) setCategories(result);
      })
      .catch(() => {
        if (active) setError("无法读取分类，请刷新后重试。");
      })
      .finally(() => {
        if (active) setIsLoadingCategories(false);
      });
    return () => {
      active = false;
    };
  }, [client]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(
    () => () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    [],
  );

  const pendingItems = useMemo(() => items.filter((item) => item.status === "pending"), [items]);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/") || /\.(jpe?g|png|webp|tiff?|heic)$/i.test(file.name));
    if (!files.length) {
      setError("没有找到可导入的图片文件。");
      return;
    }
    setError(undefined);
    const newItems = await Promise.all(
      files.map(async (file, index) => {
        const title = basename(file.name).trim() || `照片 ${index + 1}`;
        return {
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          file,
          title,
          slug: makeSlug(title),
          previewUrl: URL.createObjectURL(file),
          exif: await readExif(file),
          status: "pending" as const,
        };
      }),
    );
    setItems((current) => [...current, ...newItems]);
  }, []);

  const onFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void addFiles(event.target.files);
    event.target.value = "";
  };

  const removeItem = (id: string) => {
    setItems((current) => {
      const item = current.find((candidate) => candidate.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return current.filter((candidate) => candidate.id !== id);
    });
  };

  const importPhotos = async () => {
    if (!categoryId) {
      setError("请先选择照片分类。");
      return;
    }
    if (!pendingItems.length) {
      setError("请先拖入或选择照片。");
      return;
    }

    setIsImporting(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const selectedNames = pendingItems.map((item) => item.file.name);
      const existingNames = await client.fetch<string[]>(
        `*[_type == "photo" && sourceFilename in $names].sourceFilename`,
        { names: selectedNames },
      );
      let nextSortOrder =
        (await client.fetch<number | null>(
          `*[_type == "photo" && category._ref == $category] | order(sortOrder desc)[0].sortOrder`,
          { category: categoryId },
        )) ?? 0;
      let importedCount = 0;
      let skippedCount = 0;

      for (const item of pendingItems) {
        if (existingNames.includes(item.file.name)) {
          skippedCount += 1;
          setItems((current) => current.map((candidate) => (candidate.id === item.id ? { ...candidate, status: "skipped" } : candidate)));
          continue;
        }

        setItems((current) => current.map((candidate) => (candidate.id === item.id ? { ...candidate, status: "uploading" } : candidate)));
        try {
          const asset = await client.assets.upload("image", item.file, {
            filename: item.file.name,
            contentType: item.file.type || undefined,
          });
          const uploadResult = asset as AssetUploadResult;
          const slugTaken = await client.fetch<number>(`count(*[_type == "photo" && slug.current == $slug])`, { slug: item.slug });
          const slug = slugTaken ? `${item.slug}-${hashString(`${item.file.name}-${item.file.lastModified}`)}` : item.slug;
          const dimensions = uploadResult.metadata?.dimensions;
          await client.create({
            _type: "photo",
            title: item.exif.description || item.title,
            slug: { _type: "slug", current: slug },
            image: { _type: "image", asset: { _type: "reference", _ref: uploadResult._id } },
            altText: item.exif.description || item.title,
            category: { _type: "reference", _ref: categoryId },
            sortOrder: nextSortOrder + 1,
            isHidden: true,
            isHero: false,
            isFeatured: false,
            sourceFilename: item.file.name,
            ...(item.exif.date ? { date: item.exif.date } : {}),
            ...(item.exif.location ? { location: item.exif.location } : {}),
            ...(item.exif.camera ? { camera: item.exif.camera } : {}),
            ...(item.exif.lens ? { lens: item.exif.lens } : {}),
            ...(item.exif.aperture ? { aperture: item.exif.aperture } : {}),
            ...(item.exif.shutter ? { shutter: item.exif.shutter } : {}),
            ...(item.exif.iso ? { iso: item.exif.iso } : {}),
            ...(item.exif.focalLength ? { focalLength: item.exif.focalLength } : {}),
            ...(dimensions?.width && dimensions?.height
              ? { dimensions: { _type: "object", width: dimensions.width, height: dimensions.height } }
              : {}),
          });
          nextSortOrder += 1;
          importedCount += 1;
          setItems((current) => current.map((candidate) => (candidate.id === item.id ? { ...candidate, status: "imported" } : candidate)));
        } catch (reason) {
          setItems((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? { ...candidate, status: "error", error: reason instanceof Error ? reason.message : "上传失败" }
                : candidate,
            ),
          );
        }
      }
      setMessage(`导入完成：${importedCount} 张成功${skippedCount ? `，${skippedCount} 张因文件名重复已跳过` : ""}。新照片默认隐藏，请在照片库中确认后再发布。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入失败，请稍后重试。");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <main style={{ maxWidth: 980, padding: 24, color: "#1f2937" }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ margin: "0 0 6px", color: "#6b7280", fontSize: 13, fontWeight: 600 }}>照片库</p>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2 }}>导入照片</h1>
        <p style={{ margin: "10px 0 0", color: "#4b5563", lineHeight: 1.5 }}>
          一次拖入多张照片，系统会读取 EXIF 拍摄信息并创建照片文档。导入后默认隐藏，不会立即出现在网站上。
        </p>
      </header>

      <section style={{ display: "grid", gap: 16, marginBottom: 24 }}>
        <label style={{ display: "grid", gap: 7, maxWidth: 420, fontWeight: 600 }}>
          <span>照片分类（必选）</span>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={isImporting || isLoadingCategories}
            style={{ minHeight: 44, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 12px", fontSize: 15, background: "#fff" }}
          >
            <option value="">{isLoadingCategories ? "正在读取分类…" : "请选择分类"}</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.title}
              </option>
            ))}
          </select>
        </label>

        <input ref={inputRef} type="file" accept="image/*" multiple onChange={onFileInput} style={{ display: "none" }} />
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void addFiles(event.dataTransfer.files);
          }}
          style={{
            minHeight: 150,
            border: `2px dashed ${isDragging ? "#2563eb" : "#cbd5e1"}`,
            borderRadius: 10,
            background: isDragging ? "#eff6ff" : "#f8fafc",
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            padding: 24,
            cursor: "pointer",
            outline: "none",
          }}
        >
          <div>
            <strong style={{ display: "block", fontSize: 17 }}>拖入照片到这里</strong>
            <span style={{ display: "block", marginTop: 7, color: "#64748b" }}>也可以点击选择多张图片</span>
            <span style={{ display: "block", marginTop: 5, color: "#94a3b8", fontSize: 13 }}>支持 JPG、PNG、WebP、TIFF、HEIC</span>
          </div>
        </div>
      </section>

      {error ? <div style={{ border: "1px solid #f2b8b5", background: "#fff5f5", borderRadius: 7, padding: 12, color: "#a5281b", marginBottom: 16 }}>{error}</div> : null}
      {message ? <div style={{ border: "1px solid #b7dfc5", background: "#f1fbf4", borderRadius: 7, padding: 12, color: "#136c3a", marginBottom: 16 }}>{message}</div> : null}

      {items.length ? (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>待处理照片（{items.length}）</h2>
            <button
              type="button"
              onClick={() => void importPhotos()}
              disabled={isImporting || !pendingItems.length}
              style={{ minHeight: 44, border: 0, borderRadius: 6, padding: "0 16px", background: isImporting || !pendingItems.length ? "#cbd5e1" : "#1d4ed8", color: "#fff", fontWeight: 700, cursor: isImporting || !pendingItems.length ? "default" : "pointer" }}
            >
              {isImporting ? "正在导入…" : `导入 ${pendingItems.length} 张照片`}
            </button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((item) => (
              <article key={item.id} style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr) auto", gap: 12, alignItems: "center", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
                <img src={item.previewUrl} alt="" style={{ width: 72, height: 58, objectFit: "cover", borderRadius: 5, background: "#e2e8f0" }} />
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</strong>
                  <span style={{ display: "block", marginTop: 4, color: "#64748b", fontSize: 13 }}>
                    {[item.exif.date, item.exif.camera, item.exif.lens, item.exif.iso ? `ISO ${item.exif.iso}` : undefined].filter(Boolean).join(" · ") || "未读取到 EXIF，可导入后手动补充"}
                  </span>
                  {item.error ? <span style={{ display: "block", marginTop: 4, color: "#a5281b", fontSize: 12 }}>{item.error}</span> : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: item.status === "error" ? "#a5281b" : item.status === "imported" ? "#136c3a" : "#64748b", fontSize: 13, whiteSpace: "nowrap" }}>{statusLabel(item.status)}</span>
                  {item.status === "pending" ? (
                    <button type="button" onClick={() => removeItem(item.id)} aria-label={`移除 ${item.title}`} style={{ minWidth: 44, minHeight: 44, border: 0, background: "transparent", color: "#64748b", cursor: "pointer" }}>移除</button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
