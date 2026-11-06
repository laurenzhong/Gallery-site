import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import exifr from "exifr";
import { useClient } from "sanity";

type Place = { _id: string; title: string };
type Album = { _id: string; title: string };
type ExifData = { date?: string; location?: string; camera?: string; lens?: string; aperture?: string; shutter?: string; iso?: number; focalLength?: string; description?: string };
type ImportStatus = "pending" | "uploading" | "imported" | "processing" | "complete" | "skipped" | "error" | "deleting";
type ImportItem = { id: string; file: File; title: string; slug: string; previewUrl: string; exif: ExifData; manualLocation?: string; status: ImportStatus; documentId?: string; error?: string };
type RestoredTask = { id: string; title: string; sourceFilename?: string; status: "queued" | "processing" | "error" | "approved"; error?: string; imageUrl?: string; altText?: string };
type StoredImportItem = Omit<ImportItem, "previewUrl">;
type AssetUploadResult = { _id: string; metadata?: { dimensions?: { width?: number; height?: number } } };
type ImportProgress = { total: number; processed: number; imported: number; skipped: number; failed: number; currentPercent: number; current?: string; phase: "preparing" | "uploading" | "processing" | "complete" };
type StoredImportSession = ImportProgress & { itemIds: string[]; startedAt: string; active: boolean; placeTitle?: string; spot?: string; albumId?: string; generateStory?: boolean; storyPrompt?: string };

const clientApiVersion = "2025-02-19";
const importTaskStorageKey = "sanity-photo-import-task-ids";
const importSessionStorageKey = "sanity-photo-import-session";
const importDraftDbName = "sanity-photo-import-drafts";
const importDraftStoreName = "items";
let activeImportRun = false;
const basename = (filename: string) => filename.replace(/\.[^.]+$/, "");
function hashString(value: string) { let hash = 0; for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0; return (hash >>> 0).toString(36); }
function makeSlug(value: string) { const ascii = value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase(); return (ascii || `photo-${hashString(value)}`).slice(0, 88); }
function toStringValue(value: unknown) { return typeof value === "string" || typeof value === "number" ? String(value) : undefined; }
function formatDate(value: unknown) { if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10); if (typeof value !== "string") return undefined; const normalized = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3"); const date = new Date(normalized.replace(" ", "T")); return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10); }
function coordinateValue(value: unknown, reference: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const direction = String(reference ?? "").toUpperCase();
    return direction === "S" || direction === "W" ? -Math.abs(value) : value;
  }
  if (Array.isArray(value) && value.length >= 3) {
    const degrees = Number(value[0]);
    const minutes = Number(value[1]);
    const seconds = Number(value[2]);
    if (![degrees, minutes, seconds].every(Number.isFinite)) return undefined;
    const decimal = Math.abs(degrees) + minutes / 60 + seconds / 3600;
    const direction = String(reference ?? "").toUpperCase();
    return direction === "S" || direction === "W" ? -decimal : decimal;
  }
  return undefined;
}
function formatLocation(tags: Record<string, unknown>) {
  const latitude = coordinateValue(tags.latitude ?? tags.GPSLatitude, tags.latitudeRef ?? tags.GPSLatitudeRef);
  const longitude = coordinateValue(tags.longitude ?? tags.GPSLongitude, tags.longitudeRef ?? tags.GPSLongitudeRef);
  return latitude != null && longitude != null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
    : undefined;
}
function normalizeLocation(value: string | undefined) {
  const match = value?.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,，\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return undefined;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return undefined;
  const latitude = Math.abs(first) <= 90 && Math.abs(second) <= 180 ? first : Math.abs(second) <= 90 && Math.abs(first) <= 180 ? second : undefined;
  const longitude = latitude === first ? second : first;
  return latitude != null && Math.abs(longitude) <= 180 ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : undefined;
}
function formatExif(tags: Record<string, unknown> | undefined): ExifData {
  if (!tags) return {};
  const make = toStringValue(tags.Make); const model = toStringValue(tags.Model); const lens = toStringValue(tags.LensModel ?? tags.Lens); const fNumber = tags.FNumber ?? tags.ApertureValue; const exposure = tags.ExposureTime ?? tags.ExposureTimeOriginal; const isoValue = Number(tags.ISO ?? tags.ISOSpeedRatings); const focal = toStringValue(tags.FocalLength);
  return { date: formatDate(tags.DateTimeOriginal ?? tags.CreateDate ?? tags.ModifyDate), location: formatLocation(tags), camera: [make, model].filter(Boolean).join(" ") || undefined, lens, aperture: fNumber == null ? undefined : `f/${Number(fNumber).toFixed(1)}`, shutter: exposure == null ? undefined : `${exposure}s`, iso: Number.isFinite(isoValue) ? isoValue : undefined, focalLength: focal ? `${focal}mm` : undefined, description: toStringValue(tags.ImageDescription ?? tags.Title) };
}
async function readExif(file: File) {
  try {
    const [parsed, gps] = await Promise.all([
      exifr.parse(file, { tiff: true, exif: true, gps: true, xmp: true, mergeOutput: true }),
      exifr.gps(file).catch(() => undefined),
    ]);
    const tags = { ...((parsed ?? {}) as Record<string, unknown>), ...((gps ?? {}) as Record<string, unknown>) };
    return formatExif(tags);
  } catch {
    return {};
  }
}
function statusLabel(status: ImportStatus) { if (status === "uploading") return "正在上传"; if (status === "processing") return "AI 处理中"; if (status === "deleting") return "正在删除"; if (status === "imported") return "已上传，等待 AI"; if (status === "complete") return "已完成"; if (status === "skipped") return "已跳过（重复文件名）"; if (status === "error") return "处理失败"; return "待导入"; }
function formatImportError(reason: unknown) { if (reason instanceof Error && reason.message) return reason.message; if (reason && typeof reason === "object") { const candidate = reason as { message?: unknown; response?: { body?: { error?: { description?: unknown } } } }; const apiMessage = candidate.response?.body?.error?.description; if (typeof apiMessage === "string" && apiMessage) return apiMessage; if (typeof candidate.message === "string" && candidate.message) return candidate.message; } return "上传或 AI 处理失败，请检查登录状态、文件格式和网络连接后重试。"; }
function readImportTaskIds() { if (typeof window === "undefined") return []; try { const value = JSON.parse(window.localStorage.getItem(importTaskStorageKey) || "[]"); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(-50) : []; } catch { return []; } }
function rememberImportTask(id: string) { if (typeof window === "undefined") return; const ids = [...readImportTaskIds().filter((item) => item !== id), id].slice(-50); window.localStorage.setItem(importTaskStorageKey, JSON.stringify(ids)); }
function forgetImportTask(id: string) { if (typeof window === "undefined") return; window.localStorage.setItem(importTaskStorageKey, JSON.stringify(readImportTaskIds().filter((item) => item !== id))); }
function readImportSession(): StoredImportSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(importSessionStorageKey) || "null") as Partial<StoredImportSession> | null;
    if (!value || !Array.isArray(value.itemIds) || typeof value.total !== "number" || typeof value.phase !== "string") return null;
    return { total: value.total, processed: Number(value.processed) || 0, imported: Number(value.imported) || 0, skipped: Number(value.skipped) || 0, failed: Number(value.failed) || 0, currentPercent: Number(value.currentPercent) || 0, current: typeof value.current === "string" ? value.current : undefined, phase: value.phase as ImportProgress["phase"], itemIds: value.itemIds.filter((item): item is string => typeof item === "string"), startedAt: typeof value.startedAt === "string" ? value.startedAt : new Date().toISOString(), active: value.active !== false, placeTitle: typeof value.placeTitle === "string" ? value.placeTitle : undefined, spot: typeof value.spot === "string" ? value.spot : undefined, albumId: typeof value.albumId === "string" ? value.albumId : undefined, generateStory: value.generateStory === true, storyPrompt: typeof value.storyPrompt === "string" ? value.storyPrompt : undefined };
  } catch { return null; }
}
function writeImportSession(progress: ImportProgress, itemIds: string[], active = true, metadata?: Pick<StoredImportSession, "placeTitle" | "spot" | "albumId" | "generateStory" | "storyPrompt">) {
  if (typeof window === "undefined") return;
  const previous = readImportSession();
  const session: StoredImportSession = { ...progress, itemIds, startedAt: previous?.startedAt || new Date().toISOString(), active, placeTitle: metadata?.placeTitle ?? previous?.placeTitle, spot: metadata?.spot ?? previous?.spot, albumId: metadata?.albumId ?? previous?.albumId, generateStory: metadata?.generateStory ?? previous?.generateStory, storyPrompt: metadata?.storyPrompt ?? previous?.storyPrompt };
  window.localStorage.setItem(importSessionStorageKey, JSON.stringify(session));
}
function openImportDraftDb() { return new Promise<IDBDatabase>((resolve, reject) => { if (typeof window === "undefined" || !window.indexedDB) { reject(new Error("IndexedDB unavailable")); return; } const request = window.indexedDB.open(importDraftDbName, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(importDraftStoreName)) request.result.createObjectStore(importDraftStoreName, { keyPath: "id" }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error("IndexedDB open failed")); }); }
async function loadImportDraft() { const db = await openImportDraftDb(); return new Promise<StoredImportItem[]>((resolve, reject) => { const request = db.transaction(importDraftStoreName, "readonly").objectStore(importDraftStoreName).getAll(); request.onsuccess = () => { db.close(); resolve(request.result as StoredImportItem[]); }; request.onerror = () => { db.close(); reject(request.error || new Error("IndexedDB read failed")); }; }); }
async function saveImportDraft(items: ImportItem[]) { const db = await openImportDraftDb(); return new Promise<void>((resolve, reject) => { const transaction = db.transaction(importDraftStoreName, "readwrite"); const store = transaction.objectStore(importDraftStoreName); store.clear(); items.forEach((item) => store.put(item)); transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => { db.close(); reject(transaction.error || new Error("IndexedDB write failed")); }; }); }

export function PhotoImportDashboard() {
  const client = useClient({ apiVersion: clientApiVersion }); const inputRef = useRef<HTMLInputElement>(null); const itemsRef = useRef<ImportItem[]>([]); const importPhotosRef = useRef<(() => Promise<void>) | null>(null); const draftHydratedRef = useRef(false); const sessionResumedRef = useRef(false);
  const [places, setPlaces] = useState<Place[]>([]); const [albums, setAlbums] = useState<Album[]>([]); const [placeTitle, setPlaceTitle] = useState(""); const [albumId, setAlbumId] = useState(""); const [spot, setSpot] = useState(""); const [generateStory, setGenerateStory] = useState(false); const [storyPrompt, setStoryPrompt] = useState(""); const [items, setItems] = useState<ImportItem[]>([]); const [restoredTasks, setRestoredTasks] = useState<RestoredTask[]>([]); const [isDragging, setIsDragging] = useState(false); const [isLoadingPlaces, setIsLoadingPlaces] = useState(true); const [isLoadingAlbums, setIsLoadingAlbums] = useState(true); const [isImporting, setIsImporting] = useState(false); const [importProgress, setImportProgress] = useState<ImportProgress | null>(null); const [message, setMessage] = useState<string>(); const [error, setError] = useState<string>();

  useEffect(() => { let active = true; client.fetch<Place[]>(`*[_type == "place" && isVisible != false] | order(sortOrder asc, title asc) { _id, title }`).then((result) => { if (active) setPlaces(result); }).catch(() => { if (active) setError("无法读取地点列表，请刷新后重试。"); }).finally(() => { if (active) setIsLoadingPlaces(false); }); return () => { active = false; }; }, [client]);
  useEffect(() => { let active = true; client.fetch<Album[]>(`*[_type == "album" && isVisible != false] | order(sortOrder asc, title asc) { _id, title }`).then((result) => { if (active) setAlbums(result); }).catch(() => { if (active) setError("无法读取相册列表，请刷新后重试。"); }).finally(() => { if (active) setIsLoadingAlbums(false); }); return () => { active = false; }; }, [client]);
  useEffect(() => { let active = true; const storedSession = readImportSession(); if (storedSession?.active && storedSession.phase !== "complete") { setImportProgress(storedSession); if (storedSession.placeTitle) setPlaceTitle(storedSession.placeTitle); if (storedSession.albumId) setAlbumId(storedSession.albumId); if (storedSession.spot) setSpot(storedSession.spot); if (storedSession.generateStory) setGenerateStory(true); if (storedSession.storyPrompt) setStoryPrompt(storedSession.storyPrompt); } void loadImportDraft().then((storedItems) => { if (!active || !storedItems.length) return; const restoredItems = storedItems.filter((item) => item.file instanceof File).map((item) => ({ ...item, previewUrl: URL.createObjectURL(item.file) })); if (restoredItems.length) setItems((current) => current.length ? current : restoredItems); }).catch(() => undefined).finally(() => { if (active) draftHydratedRef.current = true; }); return () => { active = false; }; }, []);
  useEffect(() => { let active = true; const loadRestoredTasks = async () => { try { const ids = readImportTaskIds(); const result = await client.fetch<RestoredTask[]>(`*[_type == "photo" && ((_id in $ids) || aiClassification.status in ["queued", "processing", "error"])] | order(_updatedAt desc)[0...50]{ "id": _id, title, sourceFilename, "status": select(aiClassification.status == "approved" => "approved", aiClassification.status == "error" => "error", aiClassification.status == "processing" => "processing", "queued"), "error": aiClassification.error, "imageUrl": image.asset->url, altText }`, { ids }); if (active) setRestoredTasks(result); } catch { /* The import list remains usable when the background status query is unavailable. */ } }; void loadRestoredTasks(); const interval = window.setInterval(() => void loadRestoredTasks(), 4000); return () => { active = false; window.clearInterval(interval); }; }, [client]);
  useEffect(() => {
    if (!restoredTasks.length) return;
    setItems((current) => {
      let changed = false;
      const next = current.map((item) => {
        if (!item.documentId) return item;
        const task = restoredTasks.find((candidate) => candidate.id === item.documentId || (!item.documentId && candidate.sourceFilename === item.file.name));
        if (!task) return item;
        const status: ImportStatus = task.status === "approved" ? "complete" : task.status === "processing" ? "processing" : task.status === "error" ? "error" : "imported";
        const error = task.status === "error" ? task.error : undefined;
        if (item.status === status && item.error === error && item.documentId === task.id) return item;
        changed = true;
        return { ...item, status, documentId: task.id, error };
      });
      return changed ? next : current;
    });
  }, [restoredTasks]);
  useEffect(() => { itemsRef.current = items; }, [items]); useEffect(() => () => { itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)); }, []);
  useEffect(() => { if (draftHydratedRef.current) void saveImportDraft(items).catch(() => undefined); }, [items]);
  useEffect(() => { if (!importProgress || !draftHydratedRef.current) return; const session = readImportSession(); writeImportSession(importProgress, session?.itemIds?.length ? session.itemIds : items.map((item) => item.id), importProgress.phase !== "complete", { placeTitle: placeTitle.trim(), spot: spot.trim(), albumId, generateStory, storyPrompt: storyPrompt.trim() }); }, [albumId, generateStory, importProgress, items, placeTitle, spot, storyPrompt]);
  const pendingItems = useMemo(() => items.filter((item) => item.status === "pending"), [items]);
  const completedTaskIds = useMemo(() => new Set(restoredTasks.filter((task) => task.status === "approved").map((task) => task.id)), [restoredTasks]);
  const visibleItems = useMemo(() => items.filter((item) => !((item.documentId && completedTaskIds.has(item.documentId)) || item.status === "complete" || item.status === "skipped") && ["pending", "uploading", "error", "deleting"].includes(item.status)), [completedTaskIds, items]);
  const currentDocumentIds = useMemo(() => new Set(items.map((item) => item.documentId).filter(Boolean)), [items]);
  const visibleRestoredTasks = useMemo(() => restoredTasks.filter((task) => !currentDocumentIds.has(task.id)), [currentDocumentIds, restoredTasks]);
  useEffect(() => {
    if (!draftHydratedRef.current || !items.length) return;
    const session = readImportSession();
    if (!session?.active || session.phase === "complete") return;
    const trackedIds = new Set(session.itemIds);
    const trackedItems = items.filter((item) => trackedIds.has(item.id));
    if (!trackedItems.length) return;
    const uploading = trackedItems.some((item) => item.status === "pending" || item.status === "uploading");
    const processing = trackedItems.some((item) => item.status === "imported" || item.status === "processing");
    const activeItems = trackedItems.filter((item) => ["pending", "uploading", "imported", "processing"].includes(item.status));
    const processed = trackedItems.filter((item) => ["complete", "error", "skipped"].includes(item.status)).length;
    const failed = trackedItems.filter((item) => item.status === "error").length;
    const imported = trackedItems.filter((item) => ["imported", "processing", "complete"].includes(item.status)).length;
    const nextPhase: ImportProgress["phase"] = uploading ? "uploading" : processing ? "processing" : "complete";
    const nextCurrent = activeItems[0]?.title;
    setImportProgress((current) => {
      const total = session.total || trackedItems.length;
      const skipped = Math.max(session.skipped, trackedItems.filter((item) => item.status === "skipped").length);
      const nextProcessed = nextPhase === "processing" ? processed : nextPhase === "complete" ? total : Math.min(total, imported + skipped + failed);
      const next: ImportProgress = { total, processed: nextProcessed, imported: Math.max(session.imported, imported), skipped, failed: Math.max(session.failed, failed), currentPercent: nextPhase === "processing" ? 0 : current?.currentPercent ?? session.currentPercent, current: nextCurrent, phase: nextPhase };
      if (current && JSON.stringify(current) === JSON.stringify(next)) return current;
      return next;
    });
  }, [items]);
  useEffect(() => {
    if (importProgress?.phase !== "complete") return;
    const session = readImportSession();
    const trackedIds = new Set(session?.itemIds ?? []);
    if (!trackedIds.size) return;
    setItems((current) => {
      const finished = current.filter((item) => trackedIds.has(item.id) && ["imported", "processing", "complete", "skipped"].includes(item.status));
      if (!finished.length) return current;
      finished.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      const finishedIds = new Set(finished.map((item) => item.id));
      return current.filter((item) => !finishedIds.has(item.id));
    });
  }, [importProgress]);
  const addFiles = useCallback(async (fileList: FileList | File[]) => { const files = Array.from(fileList).filter((file) => file.type.startsWith("image/") || /\.(jpe?g|png|webp|tiff?|heic)$/i.test(file.name)); if (!files.length) { setError("没有找到可导入的图片文件。"); return; } setError(undefined); setImportProgress(null); const newItems = await Promise.all(files.map(async (file, index) => { const title = basename(file.name).trim() || `照片 ${index + 1}`; return { id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`, file, title, slug: makeSlug(title), previewUrl: URL.createObjectURL(file), exif: await readExif(file), status: "pending" as const }; })); setItems((current) => [...current, ...newItems]); }, []);
  const onFileInput = (event: React.ChangeEvent<HTMLInputElement>) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ""; };
  const removeItem = (id: string) => { setItems((current) => { const item = current.find((candidate) => candidate.id === id); if (item) URL.revokeObjectURL(item.previewUrl); return current.filter((candidate) => candidate.id !== id); }); };
  const updateManualLocation = (id: string, value: string) => { setItems((current) => current.map((item) => item.id === id ? { ...item, manualLocation: value } : item)); };
  const deletePhotoDocumentAndAsset = async (documentId: string) => {
    const photo = await client.fetch<{ _id: string; assetId?: string } | null>(`*[_id == $id][0]{_id,"assetId": image.asset._ref}`, { id: documentId });
    if (!photo) {
      forgetImportTask(documentId);
      return;
    }
    const assetId = photo.assetId;
    await client.delete(documentId);
    forgetImportTask(documentId);
    if (!assetId) return;
    const remainingReferences = await client.fetch<number>(`count(*[references($assetId)])`, { assetId });
    if (!remainingReferences) await client.delete(assetId);
  };
  const deleteImportedPhoto = async (item: ImportItem) => { if (!item.documentId || !["complete", "imported", "processing", "error"].includes(item.status)) return; if (!window.confirm(`确定删除“${item.title}”这张照片吗？此操作会删除照片文档。`)) return; setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: "deleting" } : candidate)); try { await deletePhotoDocumentAndAsset(item.documentId); URL.revokeObjectURL(item.previewUrl); setItems((current) => current.filter((candidate) => candidate.id !== item.id)); setMessage(`已删除“${item.title}”的照片文档。`); } catch (reason) { setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: "error", error: formatImportError(reason) } : candidate)); setError(`删除“${item.title}”失败，请打开照片文档后重试。`); } };
  const ensurePlace = async () => { const title = placeTitle.trim(); if (!title) return undefined; const existing = places.find((place) => place.title === title); if (existing) return existing._id; const existingId = await client.fetch<string | null>(`*[_type == "place" && title == $title][0]._id`, { title }); if (existingId) return existingId; const created = await client.create({ _type: "place", title, slug: { _type: "slug", current: makeSlug(title) }, isVisible: true, sortOrder: 100 }); setPlaces((current) => [...current, { _id: created._id, title }].sort((a, b) => a.title.localeCompare(b.title, "zh-CN"))); return created._id; };

  const importPhotos = async () => {
    if (activeImportRun) return;
    const importCandidates = itemsRef.current.filter((item) => item.status === "pending" || item.status === "uploading");
    if (!importCandidates.length) { setError("请先拖入或选择照片。"); return; }
    activeImportRun = true;
    const initialProgress: ImportProgress = { total: importCandidates.length, processed: 0, imported: 0, skipped: 0, failed: 0, currentPercent: 0, phase: "preparing" };
    writeImportSession(initialProgress, importCandidates.map((item) => item.id), true, { placeTitle: placeTitle.trim(), spot: spot.trim(), albumId, generateStory, storyPrompt: storyPrompt.trim() });
    setIsImporting(true); setError(undefined); setMessage(undefined); setImportProgress(initialProgress);
    try {
      const invalidLocation = importCandidates.find((item) => item.manualLocation?.trim() && !normalizeLocation(item.manualLocation));
      if (invalidLocation) {
        setError(`“${invalidLocation.title}”的地图坐标格式不正确，请输入“纬度, 经度”，例如 22.37250, 114.37524。`);
        activeImportRun = false;
        setIsImporting(false);
        return;
      }
      const placeId = await ensurePlace(); const selectedNames = importCandidates.map((item) => item.file.name); const existingNames = await client.fetch<string[]>(`*[_type == "photo" && sourceFilename in $names].sourceFilename`, { names: selectedNames }); let nextSortOrder = (await client.fetch<number | null>(`*[_type == "photo"] | order(sortOrder desc)[0].sortOrder`)) ?? 0; let importedCount = 0; let skippedCount = 0; let failedCount = 0; const createdItems: Array<{ itemId: string; documentId: string; title: string }> = [];
      setImportProgress((current) => current ? { ...current, phase: "uploading" } : current);
      for (const item of importCandidates) {
        setImportProgress((current) => current ? { ...current, current: item.title, currentPercent: 0 } : current);
        if (existingNames.includes(item.file.name)) { skippedCount += 1; setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: "skipped" } : candidate)); setImportProgress((current) => current ? { ...current, processed: current.processed + 1, skipped: current.skipped + 1 } : current); continue; }
        setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: "uploading" } : candidate));
        let uploadedAssetId: string | undefined;
        try {
          const uploadResult = await new Promise<AssetUploadResult>((resolve, reject) => { client.observable.assets.upload("image", item.file, { filename: item.file.name, ...(item.file.type ? { contentType: item.file.type } : {}) }).subscribe({ next: (event) => { if (event.type === "progress" && event.stage === "upload") { const eventPercent = Number(event.percent); const loaded = Number(event.loaded); const total = Number(event.total) > 0 ? Number(event.total) : item.file.size; const percent = Number.isFinite(eventPercent) && eventPercent >= 0 ? eventPercent : Number.isFinite(loaded) && total > 0 ? (loaded / total) * 100 : undefined; if (percent != null && Number.isFinite(percent)) setImportProgress((current) => current ? { ...current, currentPercent: Math.max(0, Math.min(100, percent)) } : current); } else if (event.type === "response") resolve(event.body.document as AssetUploadResult); }, error: reject }); });
          if (!uploadResult._id) throw new Error("Sanity 没有返回图片资源 ID，请重试。"); uploadedAssetId = uploadResult._id; const slugTaken = await client.fetch<number>(`count(*[_type == "photo" && slug.current == $slug])`, { slug: item.slug }); const slug = slugTaken ? `${item.slug}-${hashString(`${item.file.name}-${item.file.lastModified}`)}` : item.slug; const dimensions = uploadResult.metadata?.dimensions;
          const location = normalizeLocation(item.manualLocation) ?? item.exif.location;
          const createdPhoto = await client.create({ _type: "photo", title: item.exif.description || item.title, slug: { _type: "slug", current: slug }, image: { _type: "image", asset: { _type: "reference", _ref: uploadResult._id } }, altText: item.exif.description || item.title, ...(albumId ? { album: { _type: "reference", _ref: albumId } } : {}), ...(placeId ? { place: { _type: "reference", _ref: placeId } } : {}), ...(spot.trim() ? { spot: spot.trim() } : {}), aiClassification: { status: "queued", generateStory, prompt: storyPrompt.trim() }, sortOrder: nextSortOrder + 1, isHidden: false, isHero: false, isFeatured: false, sourceFilename: item.file.name, ...(item.exif.date ? { date: item.exif.date } : {}), ...(location ? { location } : {}), ...(item.exif.camera ? { camera: item.exif.camera } : {}), ...(item.exif.lens ? { lens: item.exif.lens } : {}), ...(item.exif.aperture ? { aperture: item.exif.aperture } : {}), ...(item.exif.shutter ? { shutter: item.exif.shutter } : {}), ...(item.exif.iso ? { iso: item.exif.iso } : {}), ...(item.exif.focalLength ? { focalLength: item.exif.focalLength } : {}), ...(dimensions?.width && dimensions?.height ? { dimensions: { _type: "object", width: dimensions.width, height: dimensions.height } } : {}) });
          nextSortOrder += 1; importedCount += 1; rememberImportTask(createdPhoto._id); createdItems.push({ itemId: item.id, documentId: createdPhoto._id, title: item.title }); setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: "imported", documentId: createdPhoto._id } : candidate)); setImportProgress((current) => current ? { ...current, processed: current.processed + 1, imported: current.imported + 1, currentPercent: 0 } : current);
        } catch (reason) { failedCount += 1; if (uploadedAssetId) await client.delete(uploadedAssetId).catch(() => undefined); setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: "error", error: formatImportError(reason) } : candidate)); setImportProgress((current) => current ? { ...current, processed: current.processed + 1, failed: current.failed + 1, currentPercent: 0 } : current); }
      }
      setImportProgress((current) => current ? { ...current, phase: "processing", processed: 0, currentPercent: 0 } : current);
       for (const created of createdItems) { try { let missingStateCount = 0; for (let attempt = 0; attempt < 90; attempt += 1) { const state = await client.fetch<{ status?: string; error?: string } | null>(`*[_id == $id][0].aiClassification`, { id: created.documentId }); if (!state) { missingStateCount += 1; if (missingStateCount >= 2) throw new Error("AI 处理失败，照片已自动清理"); } else { missingStateCount = 0; if (state.status === "approved") { setItems((current) => current.map((candidate) => candidate.id === created.itemId ? { ...candidate, status: "complete" } : candidate)); break; } if (state.status === "error") throw new Error(state.error || "AI 处理失败"); setItems((current) => current.map((candidate) => candidate.id === created.itemId ? { ...candidate, status: "processing" } : candidate)); } await new Promise((resolve) => window.setTimeout(resolve, 2000)); if (attempt === 89) throw new Error("AI 处理超时，请稍后在照片库重试。"); } } catch (reason) { failedCount += 1; importedCount = Math.max(0, importedCount - 1); let cleanupError: unknown; try { await deletePhotoDocumentAndAsset(created.documentId); } catch (error) { cleanupError = error; } const message = formatImportError(reason); const cleanupMessage = cleanupError ? `；自动清理失败：${formatImportError(cleanupError)}` : ""; setItems((current) => current.map((candidate) => candidate.id === created.itemId ? { ...candidate, status: "error", documentId: cleanupError ? created.documentId : undefined, error: `${message}${cleanupMessage}` } : candidate)); } setImportProgress((current) => current ? { ...current, processed: current.processed + 1, imported: importedCount, failed: failedCount } : current); }
      if (failedCount) setError(`${failedCount} 张照片上传或 AI 处理失败，请查看每张照片下方的错误并重试。`); if (importedCount || skippedCount) setMessage(`导入完成：${importedCount} 张成功${skippedCount ? `，${skippedCount} 张因文件名重复已跳过` : ""}。${generateStory ? "已提交手记生成任务。" : "已提交 AI 标签任务。"}`); setImportProgress((current) => current ? { ...current, current: undefined, currentPercent: 0, phase: "complete" } : current);
    } catch (reason) { setError(formatImportError(reason)); setImportProgress((current) => current ? { ...current, current: undefined, currentPercent: 0, phase: "complete" } : current); } finally { activeImportRun = false; setIsImporting(false); }
  };
  importPhotosRef.current = importPhotos;
  useEffect(() => {
    if (!draftHydratedRef.current || sessionResumedRef.current || isImporting || activeImportRun) return;
    const session = readImportSession();
    if (!session?.active || session.phase === "complete" || !items.length) return;
    const trackedIds = new Set(session.itemIds);
    const shouldResumeUpload = items.some((item) => trackedIds.has(item.id) && (item.status === "pending" || item.status === "uploading"));
    if (!shouldResumeUpload) return;
    sessionResumedRef.current = true;
    void importPhotosRef.current?.();
  }, [items, isImporting, restoredTasks]);

  return <main style={{ maxWidth: 980, padding: 24, color: "#1f2937" }}>
    <header style={{ marginBottom: 24 }}><p style={{ margin: "0 0 6px", color: "#6b7280", fontSize: 13, fontWeight: 600 }}>照片库</p><h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2 }}>导入照片</h1><p style={{ margin: "10px 0 0", color: "#4b5563", lineHeight: 1.5 }}>导入时会自动读取原图 EXIF，包括 GPS、拍摄日期、相机和镜头信息；随后由模型识别主体、时间 / 天气、标题、替代文本和图片说明。你可以为整批照片提供地点和手记提示词。</p></header>
    <section style={{ display: "grid", gap: 16, marginBottom: 24 }}><div style={{ display: "grid", gap: 14, padding: 16, border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc" }}><div><strong style={{ display: "block", fontSize: 16 }}>本批次信息</strong><span style={{ display: "block", marginTop: 5, color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>相册用于归档照片；未选择相册时会保留在「全部照片」。地点用于照片库筛选，具体拍摄点会提供给模型用于标题和手记。</span></div><label style={{ display: "grid", gap: 7, maxWidth: 520, fontWeight: 600 }}><span>相册（可选）</span><select value={albumId} onChange={(event) => setAlbumId(event.target.value)} disabled={isImporting || isLoadingAlbums} style={{ minHeight: 44, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 12px", fontSize: 15, background: "#fff" }}><option value="">不指定相册（全部照片）</option>{albums.map((album) => <option key={album._id} value={album._id}>{album.title}</option>)}</select>{!isLoadingAlbums && !albums.length ? <span style={{ color: "#64748b", fontSize: 12, fontWeight: 400 }}>还没有可选相册，请先在「照片库 → 相册」中创建。</span> : null}</label><label style={{ display: "grid", gap: 7, maxWidth: 520, fontWeight: 600 }}><span>地点标签（可选）</span><input list="photo-place-options" value={placeTitle} onChange={(event) => setPlaceTitle(event.target.value)} disabled={isImporting || isLoadingPlaces} placeholder="例如：麦理浩径" style={{ minHeight: 44, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 12px", fontSize: 15, background: "#fff" }} /><datalist id="photo-place-options">{places.map((place) => <option key={place._id} value={place.title} />)}</datalist></label><label style={{ display: "grid", gap: 7, maxWidth: 520, fontWeight: 600 }}><span>具体拍摄点（可选）</span><input value={spot} onChange={(event) => setSpot(event.target.value)} disabled={isImporting} placeholder="例如：破边洲" style={{ minHeight: 44, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 12px", fontSize: 15, background: "#fff" }} /></label><label style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 44, fontWeight: 600 }}><input type="checkbox" checked={generateStory} onChange={(event) => setGenerateStory(event.target.checked)} disabled={isImporting} style={{ width: 18, height: 18 }} />生成第一人称手记</label>{generateStory ? <label style={{ display: "grid", gap: 7, maxWidth: 680, fontWeight: 600 }}><span>手记提示词（可选）</span><textarea value={storyPrompt} onChange={(event) => setStoryPrompt(event.target.value)} disabled={isImporting} rows={4} placeholder="例如：写出徒步到达海边时的风和等待光线的过程。留空时根据照片、EXIF 和现有手记风格写作。" style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: 10, fontSize: 14, lineHeight: 1.5, resize: "vertical" }} /></label> : null}</div><input ref={inputRef} type="file" accept="image/*" multiple onChange={onFileInput} style={{ display: "none" }} /><div role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void addFiles(event.dataTransfer.files); }} style={{ minHeight: 150, border: `2px dashed ${isDragging ? "#2563eb" : "#cbd5e1"}`, borderRadius: 10, background: isDragging ? "#eff6ff" : "#f8fafc", display: "grid", placeItems: "center", textAlign: "center", padding: 24, cursor: "pointer", outline: "none" }}><div><strong style={{ display: "block", fontSize: 17 }}>拖入照片到这里</strong><span style={{ display: "block", marginTop: 7, color: "#64748b" }}>也可以点击选择多张图片</span><span style={{ display: "block", marginTop: 5, color: "#94a3b8", fontSize: 13 }}>支持 JPG、PNG、WebP、TIFF、HEIC</span></div></div></section>
    {importProgress ? (() => { const processedPercent = importProgress.total ? (importProgress.processed / importProgress.total) * 100 : 0; const uploadPercent = Math.max(0, Math.min(100, importProgress.currentPercent)); const isProcessing = importProgress.phase === "processing"; const displayPercent = importProgress.phase === "uploading" ? uploadPercent : processedPercent; return <section aria-label="照片导入进度" aria-live="polite" style={{ border: "1px solid #bfdbfe", borderRadius: 10, padding: 16, marginBottom: 16, background: "#eff6ff" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 9 }}><strong>{importProgress.phase === "preparing" ? "正在准备导入…" : importProgress.phase === "uploading" ? `正在上传：${importProgress.current || "照片"}` : isProcessing ? `AI 处理中：${importProgress.current || "照片"}` : "导入处理完成"}</strong><span style={{ color: "#1d4ed8", fontWeight: 700 }}>{isProcessing ? "模型调用中" : `${Math.round(displayPercent)}%`}</span></div><div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={isProcessing ? undefined : displayPercent} aria-valuetext={isProcessing ? "AI 模型处理中" : `${Math.round(displayPercent)}%`} aria-label="照片导入进度" style={{ height: 10, borderRadius: 999, overflow: "hidden", background: "#dbeafe" }}><div style={{ width: isProcessing ? "100%" : `${Math.min(100, displayPercent)}%`, height: "100%", borderRadius: 999, background: isProcessing ? "#60a5fa" : "#2563eb", opacity: isProcessing ? 0.65 : 1, transition: "width 180ms ease" }} /></div><div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 10, color: "#475569", fontSize: 13 }}><span>已处理 {importProgress.processed} / {importProgress.total}</span><span>成功 {importProgress.imported}</span><span>跳过 {importProgress.skipped}</span>{importProgress.failed ? <span style={{ color: "#b91c1c" }}>失败 {importProgress.failed}</span> : null}</div></section>; })() : null}
    {error ? <div style={{ border: "1px solid #f2b8b5", background: "#fff5f5", borderRadius: 7, padding: 12, color: "#a5281b", marginBottom: 16 }}>{error}</div> : null}{message ? <div style={{ border: "1px solid #b7dfc5", background: "#f1fbf4", borderRadius: 7, padding: 12, color: "#136c3a", marginBottom: 16 }}>{message}</div> : null}
    {visibleRestoredTasks.length ? <section aria-label="恢复中的 AI 任务" style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 18, background: "#f8fafc" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 10 }}><h2 style={{ margin: 0, fontSize: 18 }}>已导入照片</h2><span style={{ color: "#64748b", fontSize: 13 }}>刷新后仍会保留</span></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>{visibleRestoredTasks.map((task) => <article key={task.id} style={{ display: "grid", gap: 10, border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, minWidth: 0, background: "#fff" }}>{task.imageUrl ? <img src={task.imageUrl} alt={task.altText || ""} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 5, background: "#e2e8f0" }} /> : <div aria-hidden="true" style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: 5, background: "#e2e8f0" }} />}<div style={{ minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title || task.sourceFilename || "未命名照片"}</strong><span style={{ display: "block", marginTop: 4, color: "#64748b", fontSize: 13 }}>{task.sourceFilename || ""}</span>{task.error ? <span style={{ display: "block", marginTop: 4, color: "#a5281b", fontSize: 12 }}>{task.error}</span> : null}</div><span style={{ color: task.status === "error" ? "#a5281b" : task.status === "approved" ? "#136c3a" : "#1d4ed8", fontSize: 13, fontWeight: 600 }}>{task.status === "queued" ? "等待 AI" : task.status === "processing" ? "AI 处理中" : task.status === "approved" ? "已完成" : "处理失败"}</span></article>)}</div></section> : null}
     {visibleItems.length ? <section><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}><h2 style={{ margin: 0, fontSize: 18 }}>待处理照片（{visibleItems.length}）</h2><button type="button" onClick={() => void importPhotos()} disabled={isImporting || !pendingItems.length} style={{ minHeight: 44, border: 0, borderRadius: 6, padding: "0 16px", background: isImporting || !pendingItems.length ? "#cbd5e1" : "#1d4ed8", color: "#fff", fontWeight: 700, cursor: isImporting || !pendingItems.length ? "default" : "pointer" }}>{isImporting ? "正在导入和处理…" : `导入并处理 ${pendingItems.length} 张照片`}</button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>{visibleItems.map((item) => <article key={item.id} style={{ display: "grid", gap: 10, border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, minWidth: 0 }}><img src={item.previewUrl} alt="" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 5, background: "#e2e8f0" }} /><div style={{ minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</strong><span style={{ display: "block", marginTop: 4, color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>{[item.exif.date, item.manualLocation ? `手动 GPS ${item.manualLocation}` : item.exif.location ? `GPS ${item.exif.location}` : "未读取到 GPS", item.exif.camera, item.exif.lens, item.exif.iso ? `ISO ${item.exif.iso}` : undefined].filter(Boolean).join(" · ") || "未读取到 EXIF，可导入后手动补充"}</span><label style={{ display: "grid", gap: 4, marginTop: 8 }}><span style={{ color: "#475569", fontSize: 12, fontWeight: 600 }}>地图坐标（可选）</span><input value={item.manualLocation ?? ""} onChange={(event) => updateManualLocation(item.id, event.target.value)} disabled={isImporting || item.status !== "pending"} placeholder={item.exif.location ?? "纬度, 经度，例如 22.37250, 114.37524"} aria-label={`${item.title} 的地图坐标`} style={{ minHeight: 38, border: "1px solid #cbd5e1", borderRadius: 5, padding: "0 9px", fontSize: 12, background: "#fff" }} /></label>{item.error ? <span style={{ display: "block", marginTop: 4, color: "#a5281b", fontSize: 12 }}>{item.error}</span> : null}</div><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span style={{ color: item.status === "error" ? "#a5281b" : ["complete", "imported"].includes(item.status) ? "#136c3a" : "#64748b", fontSize: 13 }}>{statusLabel(item.status)}</span>{item.status === "pending" ? <button type="button" onClick={() => removeItem(item.id)} aria-label={`移除 ${item.title}`} style={{ minWidth: 44, minHeight: 44, border: 0, background: "transparent", color: "#64748b", cursor: "pointer" }}>移除</button> : null}{["complete", "imported", "processing", "error"].includes(item.status) && item.documentId ? <button type="button" onClick={() => void deleteImportedPhoto(item)} aria-label={`删除 ${item.title}`} style={{ minWidth: 44, minHeight: 44, border: 0, background: "transparent", color: "#a5281b", cursor: "pointer" }}>删除</button> : null}</div></article>)}</div></section> : null}
  </main>;
}
