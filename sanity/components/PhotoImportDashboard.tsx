import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import exifr from "exifr";
import { useClient } from "sanity";
import { photoConditionOptions, photoSubjectOptions } from "../photoTaxonomy";

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

type ImportStatus = "pending" | "uploading" | "imported" | "skipped" | "error" | "deleting";

type ImportItem = {
  id: string;
  file: File;
  title: string;
  slug: string;
  previewUrl: string;
  exif: ExifData;
  status: ImportStatus;
  documentId?: string;
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

type ImportProgress = {
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  failed: number;
  currentPercent: number;
  current?: string;
  phase: "preparing" | "uploading" | "complete";
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
  if (status === "deleting") return "正在删除";
  if (status === "imported") return "已导入";
  if (status === "skipped") return "已跳过（重复文件名）";
  if (status === "error") return "导入失败";
  return "待导入";
}

function formatImportError(reason: unknown) {
  if (reason instanceof Error && reason.message) return reason.message;
  if (reason && typeof reason === "object") {
    const candidate = reason as { message?: unknown; response?: { body?: { error?: { description?: unknown } } } };
    const apiMessage = candidate.response?.body?.error?.description;
    if (typeof apiMessage === "string" && apiMessage) return apiMessage;
    if (typeof candidate.message === "string" && candidate.message) return candidate.message;
  }
  return "上传失败，请检查登录状态、文件格式和网络连接后重试。";
}

export function PhotoImportDashboard() {
  const client = useClient({ apiVersion: clientApiVersion });
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<ImportItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subjectTags, setSubjectTags] = useState<string[]>([]);
  const [conditionTags, setConditionTags] = useState<string[]>([]);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
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
    setImportProgress(null);
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

  const deleteImportedPhoto = async (item: ImportItem) => {
    if (!item.documentId || item.status !== "imported") return;
    const confirmed = window.confirm(`确定删除“${item.title}”这张照片吗？此操作会删除照片文档。`);
    if (!confirmed) return;

    setItems((current) => current.map((candidate) => (candidate.id === item.id ? { ...candidate, status: "deleting" } : candidate)));
    try {
      await client.delete(item.documentId);
      URL.revokeObjectURL(item.previewUrl);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      setMessage(`已删除“${item.title}”的照片文档。`);
    } catch (reason) {
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, status: "error", error: reason instanceof Error ? reason.message : "删除失败" }
            : candidate,
        ),
      );
      setError(`删除“${item.title}”失败，请打开照片文档后重试。`);
    }
  };

  const importPhotos = async () => {
    if (!pendingItems.length) {
      setError("请先拖入或选择照片。");
      return;
    }
    if (subjectTags.length > 5) {
      setError("主体标签最多选择 5 个，请减少后再导入。");
      return;
    }
    if (conditionTags.length > 4) {
      setError("时间 / 天气标签最多选择 4 个，请减少后再导入。");
      return;
    }

    setIsImporting(true);
    setError(undefined);
    setMessage(undefined);
    setImportProgress({
      total: pendingItems.length,
      processed: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      currentPercent: 0,
      phase: "preparing",
    });
    try {
      const selectedNames = pendingItems.map((item) => item.file.name);
      const existingNames = await client.fetch<string[]>(
        `*[_type == "photo" && sourceFilename in $names].sourceFilename`,
        { names: selectedNames },
      );
      let nextSortOrder =
        (await client.fetch<number | null>(
          categoryId
            ? `*[_type == "photo" && category._ref == $category] | order(sortOrder desc)[0].sortOrder`
            : `*[_type == "photo"] | order(sortOrder desc)[0].sortOrder`,
          categoryId ? { category: categoryId } : {},
        )) ?? 0;
      let importedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      setImportProgress((current) => (current ? { ...current, phase: "uploading" } : current));

      for (const item of pendingItems) {
        setImportProgress((current) => (current ? { ...current, current: item.title, currentPercent: 0 } : current));
        if (existingNames.includes(item.file.name)) {
          skippedCount += 1;
          setItems((current) => current.map((candidate) => (candidate.id === item.id ? { ...candidate, status: "skipped" } : candidate)));
          setImportProgress((current) =>
            current
              ? { ...current, processed: current.processed + 1, skipped: current.skipped + 1 }
              : current,
          );
          continue;
        }

        setItems((current) => current.map((candidate) => (candidate.id === item.id ? { ...candidate, status: "uploading" } : candidate)));
        try {
          const uploadOptions = {
            filename: item.file.name,
            ...(item.file.type ? { contentType: item.file.type } : {}),
          };
          const uploadResult = await new Promise<AssetUploadResult>((resolve, reject) => {
            client.observable.assets.upload("image", item.file, uploadOptions).subscribe({
              next: (event) => {
                if (event.type === "progress" && event.stage === "upload" && Number.isFinite(event.percent)) {
                  setImportProgress((current) =>
                    current
                      ? { ...current, currentPercent: Math.max(0, Math.min(100, event.percent)) }
                      : current,
                  );
                } else if (event.type === "response") {
                  resolve(event.body.document as AssetUploadResult);
                }
              },
              error: reject,
            });
          });
          if (!uploadResult._id) throw new Error("Sanity 没有返回图片资源 ID，请重试。");
          const slugTaken = await client.fetch<number>(`count(*[_type == "photo" && slug.current == $slug])`, { slug: item.slug });
          const slug = slugTaken ? `${item.slug}-${hashString(`${item.file.name}-${item.file.lastModified}`)}` : item.slug;
          const dimensions = uploadResult.metadata?.dimensions;
          const createdPhoto = await client.create({
            _type: "photo",
            title: item.exif.description || item.title,
            slug: { _type: "slug", current: slug },
            image: { _type: "image", asset: { _type: "reference", _ref: uploadResult._id } },
            altText: item.exif.description || item.title,
            ...(categoryId ? { category: { _type: "reference", _ref: categoryId } } : {}),
            subjects: subjectTags,
            conditions: conditionTags,
            sortOrder: nextSortOrder + 1,
            isHidden: subjectTags.length === 0,
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
          setImportProgress((current) =>
            current
              ? { ...current, processed: current.processed + 1, imported: current.imported + 1, currentPercent: 0 }
              : current,
          );
          setItems((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? { ...candidate, status: "imported", documentId: createdPhoto._id }
                : candidate,
            ),
          );
        } catch (reason) {
          failedCount += 1;
          setImportProgress((current) =>
            current
              ? { ...current, processed: current.processed + 1, failed: current.failed + 1, currentPercent: 0 }
              : current,
          );
          setItems((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? { ...candidate, status: "error", error: formatImportError(reason) }
                : candidate,
            ),
          );
        }
      }
      const pendingClassification = subjectTags.length === 0 ? `其中 ${importedCount} 张暂时隐藏，等待补充主体标签。` : "已应用本批次默认标签。";
      if (failedCount) {
        setError(`${failedCount} 张照片导入失败。请查看每张照片下方的具体错误，修正后可重新导入。`);
      }
      if (importedCount || skippedCount) {
        setMessage(`导入完成：${importedCount} 张成功${skippedCount ? `，${skippedCount} 张因文件名重复已跳过` : ""}。${pendingClassification}`);
      }
      setImportProgress((current) => (current ? { ...current, current: undefined, currentPercent: 0, phase: "complete" } : current));
    } catch (reason) {
      setError(formatImportError(reason));
      setImportProgress((current) => (current ? { ...current, current: undefined, currentPercent: 0, phase: "complete" } : current));
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
          一次拖入多张照片，系统会读取 EXIF 拍摄信息并创建照片文档。下面的标签是本批次默认值，导入后仍可在照片库中批量调整。
        </p>
      </header>

      <section style={{ display: "grid", gap: 16, marginBottom: 24 }}>
        <div style={{ display: "grid", gap: 14, padding: 16, border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc" }}>
          <div>
            <strong style={{ display: "block", fontSize: 16 }}>本批次默认信息</strong>
            <span style={{ display: "block", marginTop: 5, color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
              不需要逐张选择。这里选择的标签会应用到本次导入的所有照片；不同的照片可以稍后在照片库中单独补充。
            </span>
          </div>
          <label style={{ display: "grid", gap: 7, maxWidth: 420, fontWeight: 600 }}>
            <span>旧版展示栏目（可选）</span>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={isImporting || isLoadingCategories}
            style={{ minHeight: 44, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 12px", fontSize: 15, background: "#fff" }}
          >
            <option value="">{isLoadingCategories ? "正在读取栏目…" : "不设置展示栏目"}</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.title}
              </option>
            ))}
          </select>
          </label>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>主体标签（可多选）</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {photoSubjectOptions.map((option) => {
                const checked = subjectTags.includes(option.value);
                return (
                  <label key={option.value} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 10px", border: `1px solid ${checked ? "#2563eb" : "#cbd5e1"}`, borderRadius: 999, background: checked ? "#eff6ff" : "#fff", color: checked ? "#1d4ed8" : "#475569", cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={checked} onChange={() => setSubjectTags((current) => (checked ? current.filter((value) => value !== option.value) : [...current, option.value]))} disabled={isImporting} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
                    {option.title}
                  </label>
                );
              })}
            </div>
            <span style={{ display: "block", marginTop: 6, color: "#64748b", fontSize: 12 }}>
              留空也可以导入，但照片会进入“待分类”并保持隐藏。
            </span>
          </fieldset>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>时间 / 天气（可选）</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {photoConditionOptions.map((option) => {
                const checked = conditionTags.includes(option.value);
                return (
                  <label key={option.value} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 10px", border: `1px solid ${checked ? "#0f766e" : "#cbd5e1"}`, borderRadius: 999, background: checked ? "#f0fdfa" : "#fff", color: checked ? "#0f766e" : "#475569", cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={checked} onChange={() => setConditionTags((current) => (checked ? current.filter((value) => value !== option.value) : [...current, option.value]))} disabled={isImporting} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
                    {option.title}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

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

      {importProgress ? (
        <section
          aria-label="照片导入进度"
          aria-live="polite"
          style={{ border: "1px solid #bfdbfe", borderRadius: 10, padding: 16, marginBottom: 16, background: "#eff6ff" }}
        >
          {(() => {
            const percentage = importProgress.total
              ? Math.min(100, ((importProgress.processed + (importProgress.phase === "uploading" ? importProgress.currentPercent / 100 : 0)) / importProgress.total) * 100)
              : 0;
            const percentageLabel = `${percentage < 10 && percentage % 1 ? percentage.toFixed(1) : Math.round(percentage)}%`;
            const status = importProgress.phase === "preparing"
              ? "正在准备导入…"
              : importProgress.phase === "complete"
                ? "导入处理完成"
                : importProgress.current
                  ? `正在处理：${importProgress.current}（当前文件 ${Math.round(importProgress.currentPercent)}%）`
                  : "正在上传照片…";
            return (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 9 }}>
                  <strong>{status}</strong>
                  <span style={{ color: "#1d4ed8", fontWeight: 700 }}>{percentageLabel}</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percentage}
                  aria-label="照片导入进度"
                  style={{ height: 10, borderRadius: 999, overflow: "hidden", background: "#dbeafe" }}
                >
                  <div style={{ width: `${percentage}%`, height: "100%", borderRadius: 999, background: "#2563eb", transition: "width 180ms ease" }} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 10, color: "#475569", fontSize: 13 }}>
                  <span>已处理 {importProgress.processed} / {importProgress.total}</span>
                  <span>成功 {importProgress.imported}</span>
                  <span>跳过 {importProgress.skipped}</span>
                  {importProgress.failed ? <span style={{ color: "#b91c1c" }}>失败 {importProgress.failed}</span> : null}
                </div>
              </>
            );
          })()}
        </section>
      ) : null}

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {items.map((item) => (
              <article key={item.id} style={{ display: "grid", gap: 10, border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, minWidth: 0 }}>
                <img src={item.previewUrl} alt="" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 5, background: "#e2e8f0" }} />
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</strong>
                  <span style={{ display: "block", marginTop: 4, color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
                    {[item.exif.date, item.exif.camera, item.exif.lens, item.exif.iso ? `ISO ${item.exif.iso}` : undefined].filter(Boolean).join(" · ") || "未读取到 EXIF，可导入后手动补充"}
                  </span>
                  {item.error ? <span style={{ display: "block", marginTop: 4, color: "#a5281b", fontSize: 12 }}>{item.error}</span> : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ color: item.status === "error" ? "#a5281b" : item.status === "imported" ? "#136c3a" : "#64748b", fontSize: 13 }}>{statusLabel(item.status)}</span>
                  {item.status === "pending" ? (
                    <button type="button" onClick={() => removeItem(item.id)} aria-label={`移除 ${item.title}`} style={{ minWidth: 44, minHeight: 44, border: 0, background: "transparent", color: "#64748b", cursor: "pointer" }}>移除</button>
                  ) : null}
                  {item.status === "imported" ? (
                    <button type="button" onClick={() => void deleteImportedPhoto(item)} aria-label={`删除 ${item.title}`} style={{ minWidth: 44, minHeight: 44, border: 0, background: "transparent", color: "#a5281b", cursor: "pointer" }}>删除</button>
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
