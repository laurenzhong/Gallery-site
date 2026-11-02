import { useCallback, useEffect, useMemo, useState } from "react";
import { useClient } from "sanity";
import { useRouter } from "sanity/router";
import { photoConditionOptions, photoSubjectLabel, photoSubjectOptions } from "../photoTaxonomy";

type PhotoCard = {
  _id: string;
  title: string;
  sourceFilename?: string;
  category?: string;
  subjects?: string[];
  conditions?: string[];
  primarySubject?: string;
  altText?: string;
  aiClassification?: {
    status?: "processing" | "suggested" | "approved" | "error";
    subjects?: { value?: string; confidence?: number }[];
    conditions?: { value?: string; confidence?: number }[];
    primarySubject?: string;
    altText?: string;
    caption?: string;
    error?: string;
  };
  isHidden?: boolean;
  createdAt?: string;
  date?: string;
  sortOrder?: number;
  imageUrl?: string;
  usageCount: number;
};

const photosQuery = `*[_type == "photo"] | order(_createdAt desc) {
  _id,
  title,
  sourceFilename,
  "category": category->title,
  subjects,
  conditions,
  primarySubject,
  altText,
  aiClassification,
  isHidden,
  "createdAt": _createdAt,
  date,
  sortOrder,
  "imageUrl": image.asset->url,
  "usageCount": count(*[_type in ["pageContent", "homepageLayout", "photobalconyLayout", "siteSettings", "story"] && references(^._id)])
}`;

function formatDate(value: string | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export function PhotoLibraryDashboard() {
  const client = useClient({ apiVersion: "2025-02-19" });
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoCard[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [isUpdatingClassification, setIsUpdatingClassification] = useState(false);
  const [isApplyingAi, setIsApplyingAi] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "visible" | "hidden">("all");
  const [classificationFilter, setClassificationFilter] = useState<"all" | "classified" | "pending">("all");
  const [batchSubjects, setBatchSubjects] = useState<string[]>([]);
  const [batchConditions, setBatchConditions] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<"createdAt" | "date" | "sortOrder">("createdAt");
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const loadPhotos = useCallback(() => {
    setIsLoading(true);
    client
      .fetch<PhotoCard[]>(photosQuery)
      .then((result) => {
        setPhotos(result);
        setSelectedIds(new Set());
        setError(undefined);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "无法读取照片列表，请刷新后重试。");
      })
      .finally(() => setIsLoading(false));
  }, [client]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const categories = useMemo(
    () => Array.from(new Set(photos.map((photo) => photo.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN")),
    [photos],
  );
  const filteredPhotos = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = photos.filter((photo) => {
      const searchableValues = [
        photo.title,
        photo.sourceFilename,
        photo.category,
        ...(photo.subjects ?? []),
        ...(photo.conditions ?? []),
      ];
      const matchesSearch = !query || searchableValues.some((value) => value?.toLowerCase().includes(query));
      const matchesCategory = categoryFilter === "all" || photo.category === categoryFilter;
      const matchesVisibility = visibilityFilter === "all" || (visibilityFilter === "visible" ? photo.isHidden !== true : photo.isHidden === true);
      const matchesClassification =
        classificationFilter === "all" ||
        (classificationFilter === "classified" ? Boolean(photo.subjects?.length) : !photo.subjects?.length);
      return matchesSearch && matchesCategory && matchesVisibility && matchesClassification;
    });
    return [...filtered].sort((left, right) => {
      if (sortMode === "date") return (right.date ?? "").localeCompare(left.date ?? "");
      if (sortMode === "sortOrder") return (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER);
      return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
    });
  }, [categoryFilter, classificationFilter, photos, search, sortMode, visibilityFilter]);
  const selectedPhotos = useMemo(
    () => filteredPhotos.filter((photo) => selectedIds.has(photo._id)),
    [filteredPhotos, selectedIds],
  );
  const allSelected = filteredPhotos.length > 0 && selectedPhotos.length === filteredPhotos.length;
  const blockedPhotos = selectedPhotos.filter((photo) => photo.usageCount > 0);

  const toggleBatchValue = (value: string, setter: (update: (current: string[]) => string[]) => void) => {
    setter((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  const togglePhoto = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) filteredPhotos.forEach((photo) => next.delete(photo._id));
      else filteredPhotos.forEach((photo) => next.add(photo._id));
      return next;
    });
  };

  const updateVisibility = async (isHidden: boolean) => {
    if (!selectedPhotos.length) return;
    const actionLabel = isHidden ? "隐藏" : "公开";
    const unclassified = selectedPhotos.filter((photo) => !photo.subjects?.length);
    if (!isHidden && unclassified.length) {
      const confirmed = window.confirm(`选中的照片中有 ${unclassified.length} 张还没有主体标签。仍然公开吗？建议先批量添加标签。`);
      if (!confirmed) return;
    }
    if (!window.confirm(`确定${actionLabel}选中的 ${selectedPhotos.length} 张照片吗？`)) return;
    setIsUpdatingVisibility(true);
    setError(undefined);
    setMessage(undefined);
    try {
      let transaction = client.transaction();
      selectedPhotos.forEach((photo) => {
        transaction = transaction.patch(photo._id, { set: { isHidden } });
      });
      await transaction.commit();
      setMessage(`已${actionLabel} ${selectedPhotos.length} 张照片。`);
      loadPhotos();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `${actionLabel}失败，请稍后重试。`);
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const addClassification = async () => {
    if (!selectedPhotos.length || (!batchSubjects.length && !batchConditions.length)) {
      setError("请先选择要添加的主体标签或时间 / 天气标签。");
      return;
    }

    setIsUpdatingClassification(true);
    setError(undefined);
    setMessage(undefined);
    try {
      let transaction = client.transaction();
      selectedPhotos.forEach((photo) => {
        const subjects = Array.from(new Set([...(photo.subjects ?? []), ...batchSubjects]));
        const conditions = Array.from(new Set([...(photo.conditions ?? []), ...batchConditions]));
        transaction = transaction.patch(photo._id, {
          set: {
            ...(batchSubjects.length ? { subjects } : {}),
            ...(batchConditions.length ? { conditions } : {}),
          },
        });
      });
      await transaction.commit();
      setMessage(`已为 ${selectedPhotos.length} 张照片添加分类标签。`);
      setBatchSubjects([]);
      setBatchConditions([]);
      loadPhotos();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量添加标签失败，请稍后重试。");
    } finally {
      setIsUpdatingClassification(false);
    }
  };

  const applyAiSuggestions = async () => {
    const suggestions = selectedPhotos.filter((photo) => photo.aiClassification?.status === "suggested");
    if (!suggestions.length) {
      setError("选中的照片没有待确认的 AI 分类建议。");
      return;
    }
    if (!window.confirm(`确定应用 ${suggestions.length} 张照片的 AI 分类建议吗？现有主体标签会保留并合并。`)) return;

    const subjectValues = new Set(photoSubjectOptions.map((option) => option.value));
    const conditionValues = new Set(photoConditionOptions.map((option) => option.value));
    setIsApplyingAi(true);
    setError(undefined);
    setMessage(undefined);
    try {
      let transaction = client.transaction();
      suggestions.forEach((photo) => {
        const ai = photo.aiClassification;
        const suggestedSubjects = (ai?.subjects ?? []).map((item) => item.value).filter((value): value is string => Boolean(value && subjectValues.has(value)));
        const suggestedConditions = (ai?.conditions ?? []).map((item) => item.value).filter((value): value is string => Boolean(value && conditionValues.has(value)));
        const subjects = Array.from(new Set([...(photo.subjects ?? []), ...suggestedSubjects])).slice(0, 5);
        const conditions = Array.from(new Set([...(photo.conditions ?? []), ...suggestedConditions])).slice(0, 4);
        transaction = transaction.patch(photo._id, {
          set: {
            subjects,
            conditions,
            ...(ai?.primarySubject && subjectValues.has(ai.primarySubject) ? { primarySubject: ai.primarySubject } : {}),
            ...(!photo.altText && ai?.altText ? { altText: ai.altText.slice(0, 160) } : {}),
            aiClassification: { ...ai, status: "approved" },
          },
        });
      });
      await transaction.commit();
      setMessage(`已应用 ${suggestions.length} 张照片的 AI 分类建议；照片仍保持原有公开状态。`);
      loadPhotos();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "应用 AI 分类建议失败，请稍后重试。");
    } finally {
      setIsApplyingAi(false);
    }
  };

  const deleteSelected = async () => {
    if (!selectedPhotos.length) return;
    if (blockedPhotos.length) {
      setError(`有 ${blockedPhotos.length} 张照片仍被页面或手记使用，请先移除这些引用后再删除。`);
      return;
    }
    const confirmed = window.confirm(`确定删除选中的 ${selectedPhotos.length} 张照片吗？删除后照片文档将无法恢复。`);
    if (!confirmed) return;

    setIsDeleting(true);
    setError(undefined);
    setMessage(undefined);
    try {
      let transaction = client.transaction();
      selectedPhotos.forEach((photo) => {
        transaction = transaction.delete(photo._id);
      });
      await transaction.commit();
      setMessage(`已删除 ${selectedPhotos.length} 张照片。`);
      loadPhotos();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除失败，请稍后重试。");
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteOne = async (photo: PhotoCard) => {
    setSelectedIds(new Set([photo._id]));
    if (photo.usageCount > 0) {
      setError("这张照片仍被页面或手记使用，请先移除引用后再删除。");
      return;
    }
    const confirmed = window.confirm(`确定删除“${photo.title}”吗？删除后照片文档将无法恢复。`);
    if (!confirmed) return;

    setIsDeleting(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await client.delete(photo._id);
      setMessage(`已删除“${photo.title}”。`);
      loadPhotos();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除失败，请稍后重试。");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main style={{ maxWidth: 1180, padding: 24, color: "#1f2937" }}>
      <header style={{ marginBottom: 20 }}>
        <p style={{ margin: "0 0 6px", color: "#6b7280", fontSize: 13, fontWeight: 600 }}>照片库</p>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2 }}>全部照片</h1>
        <p style={{ margin: "10px 0 0", color: "#4b5563", lineHeight: 1.5 }}>
          最新导入的照片显示在前面。选择照片后可以批量添加主体标签、公开或隐藏；正在页面或手记中使用的照片需要先移除引用才能删除。
        </p>
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, cursor: filteredPhotos.length ? "pointer" : "default" }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!filteredPhotos.length || isDeleting || isUpdatingVisibility} style={{ width: 18, height: 18 }} />
          <span>全选</span>
        </label>
        <span style={{ color: "#64748b", fontSize: 14 }}>显示 {filteredPhotos.length} / 共 {photos.length} 张，已选 {selectedPhotos.length} 张</span>
        <button type="button" onClick={() => void applyAiSuggestions()} disabled={!selectedPhotos.length || isDeleting || isUpdatingVisibility || isUpdatingClassification || isApplyingAi} style={{ minHeight: 44, border: "1px solid #c4b5fd", borderRadius: 6, padding: "0 13px", background: !selectedPhotos.length || isDeleting || isUpdatingVisibility || isUpdatingClassification || isApplyingAi ? "#f1f5f9" : "#f5f3ff", color: "#6d28d9", fontWeight: 700, cursor: !selectedPhotos.length || isDeleting || isUpdatingVisibility || isUpdatingClassification || isApplyingAi ? "default" : "pointer" }}>应用 AI 建议</button>
        <button type="button" onClick={() => void updateVisibility(false)} disabled={!selectedPhotos.length || isDeleting || isUpdatingVisibility || isUpdatingClassification || isApplyingAi} style={{ minHeight: 44, border: "1px solid #b7dfc5", borderRadius: 6, padding: "0 13px", background: !selectedPhotos.length || isDeleting || isUpdatingVisibility || isUpdatingClassification || isApplyingAi ? "#f1f5f9" : "#f1fbf4", color: "#136c3a", fontWeight: 700, cursor: !selectedPhotos.length || isDeleting || isUpdatingVisibility || isUpdatingClassification || isApplyingAi ? "default" : "pointer" }}>批量公开</button>
        <button type="button" onClick={() => void updateVisibility(true)} disabled={!selectedPhotos.length || isDeleting || isUpdatingVisibility || isUpdatingClassification || isApplyingAi} style={{ minHeight: 44, border: "1px solid #f2cf8f", borderRadius: 6, padding: "0 13px", background: !selectedPhotos.length || isDeleting || isUpdatingVisibility || isUpdatingClassification || isApplyingAi ? "#f1f5f9" : "#fff8eb", color: "#8a4b00", fontWeight: 700, cursor: !selectedPhotos.length || isDeleting || isUpdatingVisibility || isUpdatingClassification || isApplyingAi ? "default" : "pointer" }}>批量隐藏</button>
        <button
          type="button"
          onClick={() => void deleteSelected()}
          disabled={!selectedPhotos.length || isDeleting || isUpdatingVisibility || isUpdatingClassification || isApplyingAi}
          style={{ minHeight: 44, border: 0, borderRadius: 6, padding: "0 15px", background: !selectedPhotos.length || isDeleting || isUpdatingVisibility ? "#cbd5e1" : "#b42318", color: "#fff", fontWeight: 700, cursor: !selectedPhotos.length || isDeleting || isUpdatingVisibility ? "default" : "pointer" }}
        >
          {isDeleting ? "正在删除…" : `删除已选 (${selectedPhotos.length})`}
        </button>
        <button type="button" onClick={loadPhotos} disabled={isLoading || isDeleting || isUpdatingVisibility || isUpdatingClassification || isApplyingAi} style={{ minHeight: 44, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 15px", background: "#fff", color: "#334155", fontWeight: 600, cursor: isLoading || isDeleting || isUpdatingVisibility || isUpdatingClassification || isApplyingAi ? "default" : "pointer" }}>
          刷新
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1.5fr) repeat(3, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>
        <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#64748b" }}>
          搜索
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="标题或文件名" style={{ minHeight: 40, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 10px", fontSize: 14 }} />
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#64748b" }}>
          旧版栏目
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} style={{ minHeight: 40, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 8px", background: "#fff" }}>
            <option value="all">全部分类</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#64748b" }}>
          分类状态
          <select value={classificationFilter} onChange={(event) => setClassificationFilter(event.target.value as typeof classificationFilter)} style={{ minHeight: 40, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 8px", background: "#fff" }}>
            <option value="all">全部</option>
            <option value="classified">已有主体标签</option>
            <option value="pending">待分类</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#64748b" }}>
          状态
          <select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as typeof visibilityFilter)} style={{ minHeight: 40, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 8px", background: "#fff" }}>
            <option value="all">全部状态</option>
            <option value="visible">公开</option>
            <option value="hidden">已隐藏</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#64748b" }}>
          排序
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)} style={{ minHeight: 40, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 8px", background: "#fff" }}>
            <option value="createdAt">最近导入</option>
            <option value="date">拍摄日期</option>
            <option value="sortOrder">排序值</option>
          </select>
        </label>
      </div>

      {error ? <div style={{ border: "1px solid #f2b8b5", background: "#fff5f5", borderRadius: 7, padding: 12, color: "#a5281b", marginBottom: 16 }}>{error}</div> : null}
      {message ? <div style={{ border: "1px solid #b7dfc5", background: "#f1fbf4", borderRadius: 7, padding: 12, color: "#136c3a", marginBottom: 16 }}>{message}</div> : null}

      {selectedPhotos.length ? (
        <section style={{ display: "grid", gap: 12, marginBottom: 18, padding: 16, border: "1px solid #bfdbfe", borderRadius: 9, background: "#eff6ff" }}>
          <div>
            <strong>批量添加标签</strong>
            <span style={{ display: "block", marginTop: 4, color: "#475569", fontSize: 13 }}>会把选中的标签追加到已选 {selectedPhotos.length} 张照片，不会覆盖已有标签。</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {photoSubjectOptions.map((option) => {
              const checked = batchSubjects.includes(option.value);
              return <button key={option.value} type="button" onClick={() => toggleBatchValue(option.value, setBatchSubjects)} disabled={isUpdatingClassification} style={{ minHeight: 34, padding: "0 10px", border: `1px solid ${checked ? "#2563eb" : "#cbd5e1"}`, borderRadius: 999, background: checked ? "#dbeafe" : "#fff", color: checked ? "#1d4ed8" : "#475569", cursor: isUpdatingClassification ? "default" : "pointer" }}>{option.title}</button>;
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {photoConditionOptions.map((option) => {
              const checked = batchConditions.includes(option.value);
              return <button key={option.value} type="button" onClick={() => toggleBatchValue(option.value, setBatchConditions)} disabled={isUpdatingClassification} style={{ minHeight: 34, padding: "0 10px", border: `1px solid ${checked ? "#0f766e" : "#cbd5e1"}`, borderRadius: 999, background: checked ? "#ccfbf1" : "#fff", color: checked ? "#0f766e" : "#475569", cursor: isUpdatingClassification ? "default" : "pointer" }}>{option.title}</button>;
            })}
          </div>
          <button type="button" onClick={() => void addClassification()} disabled={isUpdatingClassification || (!batchSubjects.length && !batchConditions.length)} style={{ justifySelf: "start", minHeight: 40, border: 0, borderRadius: 6, padding: "0 14px", background: isUpdatingClassification || (!batchSubjects.length && !batchConditions.length) ? "#cbd5e1" : "#1d4ed8", color: "#fff", fontWeight: 700, cursor: isUpdatingClassification || (!batchSubjects.length && !batchConditions.length) ? "default" : "pointer" }}>{isUpdatingClassification ? "正在保存…" : "应用到已选照片"}</button>
        </section>
      ) : null}

      {isLoading ? <p style={{ color: "#64748b" }}>正在读取照片…</p> : null}
      {!isLoading && !photos.length ? <p style={{ color: "#64748b" }}>还没有照片。</p> : null}
      {!isLoading && photos.length > 0 && !filteredPhotos.length ? <p style={{ color: "#64748b" }}>没有符合当前搜索或筛选条件的照片。</p> : null}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
        {filteredPhotos.map((photo) => {
          const selected = selectedIds.has(photo._id);
          return (
            <article key={photo._id} style={{ border: `1px solid ${selected ? "#2563eb" : "#e5e7eb"}`, borderRadius: 9, overflow: "hidden", background: "#fff", boxShadow: selected ? "0 0 0 2px #bfdbfe" : "none" }}>
              <button type="button" onClick={() => router.navigateIntent("edit", { id: photo._id, type: "photo" })} style={{ display: "block", width: "100%", padding: 0, border: 0, background: "transparent", cursor: "pointer", textAlign: "left" }}>
                {photo.imageUrl ? <img src={`${photo.imageUrl}?w=640&q=80&auto=format`} alt="" style={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover", background: "#e2e8f0" }} /> : <div style={{ display: "grid", placeItems: "center", width: "100%", aspectRatio: "4 / 3", background: "#f1f5f9", color: "#94a3b8" }}>无图片</div>}
              </button>
              <div style={{ padding: 11 }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={selected} onChange={() => togglePhoto(photo._id)} disabled={isDeleting || isUpdatingClassification} style={{ width: 18, height: 18, marginTop: 2, flex: "0 0 auto" }} />
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.title || photo.sourceFilename || "未命名照片"}</strong>
                  <span style={{ display: "block", marginTop: 4, color: photo.subjects?.length ? "#64748b" : "#8a4b00", fontSize: 12 }}>{[photo.subjects?.map((subject) => photoSubjectLabel[subject] ?? subject).join("、"), photo.category, formatDate(photo.createdAt)].filter(Boolean).join(" · ") || "待分类"}</span>
                  {photo.aiClassification?.status === "suggested" ? <span style={{ display: "block", marginTop: 4, color: "#6d28d9", fontSize: 12 }}>有 AI 建议{photo.aiClassification.subjects?.length ? ` · ${photo.aiClassification.subjects.length} 个主体` : ""}</span> : null}
                  </span>
                </label>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 9 }}>
                  <span style={{ color: photo.isHidden ? "#8a4b00" : "#136c3a", fontSize: 12 }}>{photo.isHidden ? "已隐藏" : "公开"}</span>
                  <button type="button" onClick={() => void deleteOne(photo)} disabled={isDeleting} style={{ minHeight: 36, border: 0, borderRadius: 5, padding: "0 9px", background: "transparent", color: "#b42318", cursor: isDeleting ? "default" : "pointer" }}>删除</button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
