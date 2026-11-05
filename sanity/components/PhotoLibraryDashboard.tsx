import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClient } from "sanity";
import { useRouter } from "sanity/router";
import { photoConditionLabel, photoConditionOptions, photoSubjectLabel, photoSubjectOptions } from "../photoTaxonomy";

type PhotoCard = {
  _id: string;
  title: string;
  sourceFilename?: string;
  category?: string;
  album?: { _id?: string; title?: string };
  subjects?: string[];
  conditions?: string[];
  primarySubject?: string;
  altText?: string;
  caption?: string;
  spot?: string;
  location?: string;
  place?: { _id?: string; title?: string };
  aiClassification?: {
    status?: "queued" | "processing" | "suggested" | "approved" | "error";
    subjects?: { value?: string; confidence?: number }[];
    conditions?: { value?: string; confidence?: number }[];
    primarySubject?: string;
    altText?: string;
    caption?: string;
    error?: string;
    generateStory?: boolean;
    prompt?: string;
    model?: string;
  };
  isHidden?: boolean;
  createdAt?: string;
  date?: string;
  sortOrder?: number;
  imageUrl?: string;
  usageCount: number;
};
type Album = { _id: string; title: string; isVisible?: boolean };

const photosQuery = `*[_type == "photo"] | order(_createdAt desc) {
  _id, title, sourceFilename, "category": category->title, "album": album->{_id, title}, subjects, conditions, primarySubject, altText, caption, spot, location,
  "place": place->{_id, title}, aiClassification, isHidden, "createdAt": _createdAt, date, sortOrder,
  "imageUrl": image.asset->url,
  "usageCount": count(*[_type in ["album", "pageContent", "homepageLayout", "photobalconyLayout", "siteSettings", "story"] && references(^._id)])
}`;
const albumsQuery = `*[_type == "album"] | order(sortOrder asc, title asc) { _id, title, isVisible }`;

function formatDate(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function makeAlbumSlug(value: string) {
  const slug = value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return slug || `album-${Date.now().toString(36)}`;
}

function MultiSelect({ label, values, options, onToggle, color }: { label: string; values: string[]; options: { title: string; value: string }[]; onToggle: (value: string) => void; color: "blue" | "teal" }) {
  return <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
    <legend style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{label}（可多选）</legend>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((option) => {
        const checked = values.includes(option.value);
        const active = color === "blue" ? { border: "#2563eb", background: "#dbeafe", text: "#1d4ed8" } : { border: "#0f766e", background: "#ccfbf1", text: "#0f766e" };
        return <button key={option.value} type="button" onClick={() => onToggle(option.value)} aria-pressed={checked} style={{ minHeight: 34, padding: "0 10px", border: `1px solid ${checked ? active.border : "#cbd5e1"}`, borderRadius: 999, background: checked ? active.background : "#fff", color: checked ? active.text : "#475569", cursor: "pointer" }}>{option.title}</button>;
      })}
    </div>
  </fieldset>;
}

export function PhotoLibraryDashboard() {
  const client = useClient({ apiVersion: "2025-02-19" });
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoCard[]>([]);
  const lastSelectedIdRef = useRef<string>();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [isUpdatingClassification, setIsUpdatingClassification] = useState(false);
  const [isApplyingAi, setIsApplyingAi] = useState(false);
  const [isUpdatingAlbum, setIsUpdatingAlbum] = useState(false);
  const [search, setSearch] = useState("");
  const [subjectsFilter, setSubjectsFilter] = useState<string[]>([]);
  const [conditionsFilter, setConditionsFilter] = useState<string[]>([]);
  const [placesFilter, setPlacesFilter] = useState<string[]>([]);
  const [albumFilter, setAlbumFilter] = useState<string>("");
  const [albumToAssign, setAlbumToAssign] = useState<string>("");
  const [batchSubjects, setBatchSubjects] = useState<string[]>([]);
  const [batchConditions, setBatchConditions] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<"createdAt" | "date" | "sortOrder">("createdAt");
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const loadPhotos = useCallback(() => {
    setIsLoading(true);
    Promise.all([client.fetch<PhotoCard[]>(photosQuery), client.fetch<Album[]>(albumsQuery)]).then(([photoResult, albumResult]) => { setPhotos(photoResult); setAlbums(albumResult.filter((album) => album.isVisible !== false)); setSelectedIds(new Set()); setError(undefined); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "无法读取照片列表，请刷新后重试。")).finally(() => setIsLoading(false));
  }, [client]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const placeOptions = useMemo(() => Array.from(new Set(photos.map((photo) => photo.place?.title).filter((title): title is string => Boolean(title)))).sort((a, b) => a.localeCompare(b, "zh-CN")).map((title) => ({ title, value: title })), [photos]);
  const albumOptions = useMemo(() => {
    return albums.map((album) => ({ title: album.title, value: album._id, count: photos.filter((photo) => photo.album?._id === album._id).length }));
  }, [albums, photos]);
  const filteredPhotos = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = photos.filter((photo) => {
      const searchableValues = [photo.title, photo.sourceFilename, photo.album?.title, photo.spot, photo.place?.title, photo.caption, photo.altText, photo.location, ...(photo.subjects ?? []), ...(photo.conditions ?? [])];
      const matchesSearch = !query || searchableValues.some((value) => value?.toLowerCase().includes(query));
      const matchesSubjects = !subjectsFilter.length || subjectsFilter.some((value) => photo.subjects?.includes(value));
      const matchesConditions = !conditionsFilter.length || conditionsFilter.some((value) => photo.conditions?.includes(value));
      const matchesPlaces = !placesFilter.length || placesFilter.includes(photo.place?.title ?? "");
      const matchesAlbum = albumFilter === "unassigned" ? !photo.album?._id : !albumFilter || photo.album?._id === albumFilter;
      return matchesSearch && matchesSubjects && matchesConditions && matchesPlaces && matchesAlbum;
    });
    return [...filtered].sort((left, right) => sortMode === "date" ? (right.date ?? "").localeCompare(left.date ?? "") : sortMode === "sortOrder" ? (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER) : (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
  }, [albumFilter, conditionsFilter, photos, placesFilter, search, sortMode, subjectsFilter]);
  const selectedPhotos = useMemo(() => filteredPhotos.filter((photo) => selectedIds.has(photo._id)), [filteredPhotos, selectedIds]);
  const allSelected = filteredPhotos.length > 0 && selectedPhotos.length === filteredPhotos.length;
  const blockedPhotos = selectedPhotos.filter((photo) => photo.usageCount > 0);
  const toggleValue = (setter: (update: (current: string[]) => string[]) => void, value: string) => setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  const selectPhoto = (id: string, event: React.MouseEvent<HTMLInputElement>) => {
    const index = filteredPhotos.findIndex((photo) => photo._id === id);
    const anchorIndex = lastSelectedIdRef.current ? filteredPhotos.findIndex((photo) => photo._id === lastSelectedIdRef.current) : -1;
    const hasModifier = event.ctrlKey || event.metaKey;
    if (event.shiftKey && index >= 0 && anchorIndex >= 0) {
      const start = Math.min(index, anchorIndex); const end = Math.max(index, anchorIndex);
      setSelectedIds((current) => { const next = hasModifier ? new Set(current) : new Set<string>(); filteredPhotos.slice(start, end + 1).forEach((photo) => next.add(photo._id)); return next; });
    } else if (hasModifier) {
      setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    } else {
      setSelectedIds(new Set([id]));
    }
    lastSelectedIdRef.current = id;
  };
  const toggleAll = () => setSelectedIds((current) => { const next = new Set(current); if (allSelected) filteredPhotos.forEach((photo) => next.delete(photo._id)); else filteredPhotos.forEach((photo) => next.add(photo._id)); return next; });

  const updateVisibility = async (isHidden: boolean) => {
    if (!selectedPhotos.length || !window.confirm(`确定${isHidden ? "隐藏" : "公开"}选中的 ${selectedPhotos.length} 张照片吗？`)) return;
    setIsUpdatingVisibility(true); setError(undefined); setMessage(undefined);
    try { let transaction = client.transaction(); selectedPhotos.forEach((photo) => { transaction = transaction.patch(photo._id, { set: { isHidden } }); }); await transaction.commit(); setMessage(`已${isHidden ? "隐藏" : "公开"} ${selectedPhotos.length} 张照片。`); loadPhotos(); } catch (reason) { setError(reason instanceof Error ? reason.message : "更新照片状态失败，请稍后重试。"); } finally { setIsUpdatingVisibility(false); }
  };

  const addClassification = async () => {
    if (!selectedPhotos.length || (!batchSubjects.length && !batchConditions.length)) { setError("请先选择要添加的主体标签或时间 / 天气标签。"); return; }
    setIsUpdatingClassification(true); setError(undefined); setMessage(undefined);
    try { let transaction = client.transaction(); selectedPhotos.forEach((photo) => transaction = transaction.patch(photo._id, { set: { ...(batchSubjects.length ? { subjects: Array.from(new Set([...(photo.subjects ?? []), ...batchSubjects])).slice(0, 5) } : {}), ...(batchConditions.length ? { conditions: Array.from(new Set([...(photo.conditions ?? []), ...batchConditions])).slice(0, 4) } : {}) } })); await transaction.commit(); setMessage(`已为 ${selectedPhotos.length} 张照片添加标签。`); setBatchSubjects([]); setBatchConditions([]); loadPhotos(); } catch (reason) { setError(reason instanceof Error ? reason.message : "批量添加标签失败，请稍后重试。"); } finally { setIsUpdatingClassification(false); }
  };

  const applyAiSuggestions = async () => {
    const suggestions = selectedPhotos.filter((photo) => photo.aiClassification?.status === "suggested");
    if (!suggestions.length) { setError("选中的照片没有待确认的 AI 分类建议。"); return; }
    if (!window.confirm(`确定应用 ${suggestions.length} 张照片的 AI 建议吗？`)) return;
    const subjectValues = new Set<string>(photoSubjectOptions.map((option) => option.value)); const conditionValues = new Set<string>(photoConditionOptions.map((option) => option.value));
    setIsApplyingAi(true); setError(undefined); setMessage(undefined);
    try { let transaction = client.transaction(); suggestions.forEach((photo) => { const ai = photo.aiClassification; const suggestedSubjects = (ai?.subjects ?? []).map((item) => item.value).filter((value): value is string => Boolean(value && subjectValues.has(value))); const suggestedConditions = (ai?.conditions ?? []).map((item) => item.value).filter((value): value is string => Boolean(value && conditionValues.has(value))); transaction = transaction.patch(photo._id, { set: { subjects: Array.from(new Set([...(photo.subjects ?? []), ...suggestedSubjects])).slice(0, 5), conditions: Array.from(new Set([...(photo.conditions ?? []), ...suggestedConditions])).slice(0, 4), ...(ai?.primarySubject && subjectValues.has(ai.primarySubject) ? { primarySubject: ai.primarySubject } : {}), ...(!photo.altText && ai?.altText ? { altText: ai.altText.slice(0, 160) } : {}), aiClassification: { ...ai, status: "approved" } } }); }); await transaction.commit(); setMessage(`已应用 ${suggestions.length} 张照片的 AI 建议。`); loadPhotos(); } catch (reason) { setError(reason instanceof Error ? reason.message : "应用 AI 建议失败，请稍后重试。"); } finally { setIsApplyingAi(false); }
  };

  const createAlbum = async () => {
    const title = window.prompt("请输入新相册名称")?.trim();
    if (!title) return;
    const existing = albums.find((album) => album.title === title);
    if (existing) { setAlbumToAssign(existing._id); setMessage(`已选择已有相册“${title}”。`); return; }
    setIsUpdatingAlbum(true); setError(undefined); setMessage(undefined);
    try {
      const existingId = await client.fetch<string | null>(`*[_type == "album" && title == $title][0]._id`, { title });
      const created = existingId ? { _id: existingId } : await client.create({ _type: "album", title, slug: { _type: "slug", current: makeAlbumSlug(title) }, isVisible: true, sortOrder: 100 });
      const album = { _id: created._id, title, isVisible: true };
      setAlbums((current) => [...current.filter((item) => item._id !== album._id), album].sort((a, b) => a.title.localeCompare(b.title, "zh-CN")));
      setAlbumToAssign(album._id);
      setMessage(`已创建相册“${title}”，请选择照片后点击“加入相册”。`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "新建相册失败，请稍后重试。"); }
    finally { setIsUpdatingAlbum(false); }
  };

  const updateAlbum = async () => {
    if (!selectedPhotos.length) { setError("请先选择照片。"); return; }
    setIsUpdatingAlbum(true); setError(undefined); setMessage(undefined);
    try {
      let transaction = client.transaction();
      selectedPhotos.forEach((photo) => { transaction = albumToAssign ? transaction.patch(photo._id, { set: { album: { _type: "reference", _ref: albumToAssign } } }) : transaction.patch(photo._id, { unset: ["album"] }); });
      await transaction.commit();
      const title = albums.find((album) => album._id === albumToAssign)?.title;
      setMessage(albumToAssign ? `已将 ${selectedPhotos.length} 张照片加入“${title || "所选相册"}”。` : `已将 ${selectedPhotos.length} 张照片移出相册。`);
      setSelectedIds(new Set());
      loadPhotos();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "更新相册归属失败，请稍后重试。"); }
    finally { setIsUpdatingAlbum(false); }
  };

  const deleteSelected = async () => {
    if (!selectedPhotos.length) return;
    if (blockedPhotos.length) { setError(`有 ${blockedPhotos.length} 张照片仍被相册、页面或手记使用，请先移除这些引用后再删除。`); return; }
    if (!window.confirm(`确定删除选中的 ${selectedPhotos.length} 张照片吗？删除后照片文档将无法恢复。`)) return;
    setIsDeleting(true); setError(undefined); setMessage(undefined);
    try { let transaction = client.transaction(); selectedPhotos.forEach((photo) => transaction = transaction.delete(photo._id)); await transaction.commit(); setMessage(`已删除 ${selectedPhotos.length} 张照片。`); loadPhotos(); } catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败，请稍后重试。"); } finally { setIsDeleting(false); }
  };

  const deleteOne = async (photo: PhotoCard) => { setSelectedIds(new Set([photo._id])); if (photo.usageCount > 0) { setError("这张照片仍被相册、页面或手记使用，请先移除引用后再删除。"); return; } if (!window.confirm(`确定删除“${photo.title}”吗？删除后照片文档将无法恢复。`)) return; setIsDeleting(true); setError(undefined); setMessage(undefined); try { await client.delete(photo._id); setMessage(`已删除“${photo.title}”。`); loadPhotos(); } catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败，请稍后重试。"); } finally { setIsDeleting(false); } };

  const retryAi = async (photo: PhotoCard) => { if (photo.aiClassification?.status !== "error") return; setError(undefined); setMessage(undefined); try { await client.patch(photo._id).set({ aiClassification: { ...photo.aiClassification, status: "queued" } }).unset(["aiClassification.error"]).commit(); setMessage(`已重新提交“${photo.title}”的 AI 处理。`); loadPhotos(); } catch (reason) { setError(reason instanceof Error ? reason.message : "重新提交 AI 处理失败，请稍后重试。"); } };

  const busy = isDeleting || isUpdatingVisibility || isUpdatingClassification || isApplyingAi || isUpdatingAlbum;
  return <main style={{ maxWidth: 1180, padding: 24, color: "#1f2937" }}>
    <header style={{ marginBottom: 20 }}><p style={{ margin: "0 0 6px", color: "#6b7280", fontSize: 13, fontWeight: 600 }}>照片库</p><h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2 }}>全部照片</h1><p style={{ margin: "10px 0 0", color: "#4b5563", lineHeight: 1.5 }}>使用相册、主体、时间 / 天气和地点标签查找照片。普通点击选择一张，按住 Ctrl / ⌘ 可多选，按住 Shift 可连续选择。未指定相册的照片会显示在「未分配相册」。</p></header>
    <section aria-label="相册筛选" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: 12, border: "1px solid #e2e8f0", borderRadius: 9, marginBottom: 18, background: "#fff" }}><strong style={{ marginRight: 4, fontSize: 13, color: "#475569" }}>按相册查看</strong><button type="button" onClick={() => setAlbumFilter("")} aria-pressed={!albumFilter} style={{ minHeight: 36, border: `1px solid ${!albumFilter ? "#2563eb" : "#cbd5e1"}`, borderRadius: 999, padding: "0 12px", background: !albumFilter ? "#dbeafe" : "#fff", color: !albumFilter ? "#1d4ed8" : "#475569", cursor: "pointer" }}>全部相册（{photos.length}）</button>{albumOptions.map((album) => <button type="button" key={album.value} onClick={() => setAlbumFilter(album.value)} aria-pressed={albumFilter === album.value} style={{ minHeight: 36, border: `1px solid ${albumFilter === album.value ? "#0f766e" : "#cbd5e1"}`, borderRadius: 999, padding: "0 12px", background: albumFilter === album.value ? "#ccfbf1" : "#fff", color: albumFilter === album.value ? "#0f766e" : "#475569", cursor: "pointer" }}>{album.title}（{album.count}）</button>)}<button type="button" onClick={() => setAlbumFilter("unassigned")} aria-pressed={albumFilter === "unassigned"} style={{ minHeight: 36, border: `1px solid ${albumFilter === "unassigned" ? "#8a4b00" : "#cbd5e1"}`, borderRadius: 999, padding: "0 12px", background: albumFilter === "unassigned" ? "#fff8eb" : "#fff", color: albumFilter === "unassigned" ? "#8a4b00" : "#475569", cursor: "pointer" }}>未分配相册（{photos.filter((photo) => !photo.album?._id).length}）</button></section>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}><label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, cursor: filteredPhotos.length ? "pointer" : "default" }}><input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!filteredPhotos.length || busy} style={{ width: 18, height: 18 }} /><span>全选</span></label><span style={{ color: "#64748b", fontSize: 14 }}>显示 {filteredPhotos.length} / 共 {photos.length} 张，已选 {selectedPhotos.length} 张</span>{selectedPhotos.some((photo) => photo.aiClassification?.status === "suggested") ? <button type="button" onClick={() => void applyAiSuggestions()} disabled={busy} style={{ minHeight: 44, border: "1px solid #c4b5fd", borderRadius: 6, padding: "0 13px", background: "#f5f3ff", color: "#6d28d9", fontWeight: 700 }}>应用已有 AI 建议</button> : null}<button type="button" onClick={() => void updateVisibility(false)} disabled={!selectedPhotos.length || busy} style={{ minHeight: 44, border: "1px solid #b7dfc5", borderRadius: 6, padding: "0 13px", background: "#f1fbf4", color: "#136c3a", fontWeight: 700 }}>批量公开</button><button type="button" onClick={() => void updateVisibility(true)} disabled={!selectedPhotos.length || busy} style={{ minHeight: 44, border: "1px solid #f2cf8f", borderRadius: 6, padding: "0 13px", background: "#fff8eb", color: "#8a4b00", fontWeight: 700 }}>批量隐藏</button><button type="button" onClick={() => void deleteSelected()} disabled={!selectedPhotos.length || busy} style={{ minHeight: 44, border: 0, borderRadius: 6, padding: "0 15px", background: !selectedPhotos.length || busy ? "#cbd5e1" : "#b42318", color: "#fff", fontWeight: 700 }}>{isDeleting ? "正在删除…" : `删除已选 (${selectedPhotos.length})`}</button><button type="button" onClick={loadPhotos} disabled={isLoading || busy} style={{ minHeight: 44, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 15px", background: "#fff", color: "#334155", fontWeight: 600 }}>刷新</button></div>
    <section style={{ display: "grid", gap: 14, padding: 14, border: "1px solid #e2e8f0", borderRadius: 9, marginBottom: 18, background: "#f8fafc" }}><label style={{ display: "grid", gap: 5, fontSize: 12, color: "#64748b" }}>搜索标题、文件名或具体拍摄点<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="例如：破边洲、海边、IMG_" style={{ minHeight: 40, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 10px", fontSize: 14, background: "#fff" }} /></label><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}><MultiSelect label="主体" values={subjectsFilter} options={photoSubjectOptions as unknown as { title: string; value: string }[]} onToggle={(value) => toggleValue(setSubjectsFilter, value)} color="blue" /><MultiSelect label="时间 / 天气" values={conditionsFilter} options={photoConditionOptions as unknown as { title: string; value: string }[]} onToggle={(value) => toggleValue(setConditionsFilter, value)} color="teal" /><MultiSelect label="地点" values={placesFilter} options={placeOptions} onToggle={(value) => toggleValue(setPlacesFilter, value)} color="blue" /></div><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b" }}>排序<select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)} style={{ minHeight: 36, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 8px", background: "#fff" }}><option value="createdAt">最近导入</option><option value="date">拍摄日期</option><option value="sortOrder">排序值</option></select></label></section>
    {error ? <div style={{ border: "1px solid #f2b8b5", background: "#fff5f5", borderRadius: 7, padding: 12, color: "#a5281b", marginBottom: 16 }}>{error}</div> : null}{message ? <div style={{ border: "1px solid #b7dfc5", background: "#f1fbf4", borderRadius: 7, padding: 12, color: "#136c3a", marginBottom: 16 }}>{message}</div> : null}
    {selectedPhotos.length ? <section style={{ display: "grid", gap: 12, marginBottom: 18, padding: 16, border: "1px solid #99f6e4", borderRadius: 9, background: "#f0fdfa" }}><div><strong>批量管理相册</strong><span style={{ display: "block", marginTop: 4, color: "#475569", fontSize: 13 }}>选择照片后，可以一次加入相册或移出相册。</span></div><div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}><select value={albumToAssign} onChange={(event) => setAlbumToAssign(event.target.value)} disabled={busy} style={{ flex: "1 1 240px", minHeight: 40, border: "1px solid #99f6e4", borderRadius: 6, padding: "0 10px", background: "#fff" }}><option value="">移出相册</option>{albums.map((album) => <option key={album._id} value={album._id}>{album.title}</option>)}</select><button type="button" onClick={() => void updateAlbum()} disabled={busy || !albumToAssign} style={{ minHeight: 40, border: 0, borderRadius: 6, padding: "0 14px", background: busy || !albumToAssign ? "#cbd5e1" : "#0f766e", color: "#fff", fontWeight: 700 }}>加入相册</button><button type="button" onClick={() => void updateAlbum()} disabled={busy || Boolean(albumToAssign)} style={{ minHeight: 40, border: "1px solid #0f766e", borderRadius: 6, padding: "0 14px", background: busy || albumToAssign ? "#fff" : "#ccfbf1", color: "#0f766e", fontWeight: 700 }}>移出相册</button><button type="button" onClick={() => void createAlbum()} disabled={busy} style={{ minHeight: 40, border: "1px solid #2563eb", borderRadius: 6, padding: "0 14px", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700 }}>新建相册</button></div></section> : null}{selectedPhotos.length ? <section style={{ display: "grid", gap: 12, marginBottom: 18, padding: 16, border: "1px solid #bfdbfe", borderRadius: 9, background: "#eff6ff" }}><div><strong>批量添加标签</strong><span style={{ display: "block", marginTop: 4, color: "#475569", fontSize: 13 }}>会把选中的标签追加到已选照片，不会覆盖已有标签。</span></div><MultiSelect label="主体" values={batchSubjects} options={photoSubjectOptions as unknown as { title: string; value: string }[]} onToggle={(value) => toggleValue(setBatchSubjects, value)} color="blue" /><MultiSelect label="时间 / 天气" values={batchConditions} options={photoConditionOptions as unknown as { title: string; value: string }[]} onToggle={(value) => toggleValue(setBatchConditions, value)} color="teal" /><button type="button" onClick={() => void addClassification()} disabled={isUpdatingClassification || (!batchSubjects.length && !batchConditions.length)} style={{ justifySelf: "start", minHeight: 40, border: 0, borderRadius: 6, padding: "0 14px", background: isUpdatingClassification || (!batchSubjects.length && !batchConditions.length) ? "#cbd5e1" : "#1d4ed8", color: "#fff", fontWeight: 700 }}>{isUpdatingClassification ? "正在保存…" : "应用到已选照片"}</button></section> : null}
    {isLoading ? <p style={{ color: "#64748b" }}>正在读取照片…</p> : null}{!isLoading && !photos.length ? <p style={{ color: "#64748b" }}>还没有照片。</p> : null}{!isLoading && photos.length > 0 && !filteredPhotos.length ? <p style={{ color: "#64748b" }}>没有符合当前标签或搜索条件的照片。</p> : null}
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>{filteredPhotos.map((photo) => { const selected = selectedIds.has(photo._id); const labels = [photo.album?.title ? `相册：${photo.album.title}` : "未分配相册", photo.subjects?.map((subject) => photoSubjectLabel[subject] ?? subject).join("、"), photo.conditions?.map((condition) => photoConditionLabel[condition] ?? condition).join("、"), photo.place?.title, photo.spot, formatDate(photo.createdAt)].filter(Boolean).join(" · "); return <article key={photo._id} style={{ border: `1px solid ${selected ? "#2563eb" : "#e5e7eb"}`, borderRadius: 9, overflow: "hidden", background: "#fff", boxShadow: selected ? "0 0 0 2px #bfdbfe" : "none" }}><button type="button" onClick={() => router.navigateIntent("edit", { id: photo._id, type: "photo" })} style={{ display: "block", width: "100%", padding: 0, border: 0, background: "transparent", cursor: "pointer", textAlign: "left" }}>{photo.imageUrl ? <img src={`${photo.imageUrl}?w=640&q=80&auto=format`} alt={photo.altText || ""} style={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover", background: "#e2e8f0" }} /> : <div style={{ display: "grid", placeItems: "center", width: "100%", aspectRatio: "4 / 3", background: "#f1f5f9", color: "#94a3b8" }}>无图片</div>}</button><div style={{ padding: 11 }}><label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={selected} onClick={(event) => selectPhoto(photo._id, event)} onChange={() => undefined} disabled={busy} style={{ width: 18, height: 18, marginTop: 2, flex: "0 0 auto" }} /><span style={{ minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.title || photo.sourceFilename || "未命名照片"}</strong><span style={{ display: "block", marginTop: 4, color: labels ? "#64748b" : "#8a4b00", fontSize: 12 }}>{labels || "等待 AI 标签"}</span></span></label><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 9 }}><span style={{ color: photo.isHidden ? "#8a4b00" : "#136c3a", fontSize: 12 }}>{photo.isHidden ? "已隐藏" : "公开"}{photo.aiClassification?.status === "queued" || photo.aiClassification?.status === "processing" ? " · AI处理中" : photo.aiClassification?.status === "error" ? " · AI失败" : ""}</span><div style={{ display: "flex", gap: 4 }}>{photo.aiClassification?.status === "error" ? <button type="button" onClick={() => void retryAi(photo)} disabled={busy} style={{ minHeight: 36, border: 0, borderRadius: 5, padding: "0 7px", background: "transparent", color: "#1d4ed8", cursor: busy ? "default" : "pointer" }}>重试 AI</button> : null}<button type="button" onClick={() => void deleteOne(photo)} disabled={busy} style={{ minHeight: 36, border: 0, borderRadius: 5, padding: "0 9px", background: "transparent", color: "#b42318", cursor: busy ? "default" : "pointer" }}>删除</button></div></div></div></article>; })}</section>
  </main>;
}
