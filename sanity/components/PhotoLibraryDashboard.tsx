import { useCallback, useEffect, useMemo, useState } from "react";
import { useClient } from "sanity";
import { useRouter } from "sanity/router";

type PhotoCard = {
  _id: string;
  title: string;
  sourceFilename?: string;
  category?: string;
  isHidden?: boolean;
  createdAt?: string;
  imageUrl?: string;
  usageCount: number;
};

const photosQuery = `*[_type == "photo"] | order(_createdAt desc) {
  _id,
  title,
  sourceFilename,
  "category": category->title,
  isHidden,
  "createdAt": _createdAt,
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

  const selectedPhotos = useMemo(
    () => photos.filter((photo) => selectedIds.has(photo._id)),
    [photos, selectedIds],
  );
  const allSelected = photos.length > 0 && selectedPhotos.length === photos.length;
  const blockedPhotos = selectedPhotos.filter((photo) => photo.usageCount > 0);

  const togglePhoto = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(photos.map((photo) => photo._id)));
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
          最新导入的照片显示在前面。选择照片后可以批量删除；正在页面或手记中使用的照片需要先移除引用。
        </p>
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, cursor: photos.length ? "pointer" : "default" }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!photos.length || isDeleting} style={{ width: 18, height: 18 }} />
          <span>全选</span>
        </label>
        <span style={{ color: "#64748b", fontSize: 14 }}>共 {photos.length} 张，已选 {selectedPhotos.length} 张</span>
        <button
          type="button"
          onClick={() => void deleteSelected()}
          disabled={!selectedPhotos.length || isDeleting}
          style={{ minHeight: 44, border: 0, borderRadius: 6, padding: "0 15px", background: !selectedPhotos.length || isDeleting ? "#cbd5e1" : "#b42318", color: "#fff", fontWeight: 700, cursor: !selectedPhotos.length || isDeleting ? "default" : "pointer" }}
        >
          {isDeleting ? "正在删除…" : `删除已选 (${selectedPhotos.length})`}
        </button>
        <button type="button" onClick={loadPhotos} disabled={isLoading || isDeleting} style={{ minHeight: 44, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 15px", background: "#fff", color: "#334155", fontWeight: 600, cursor: isLoading || isDeleting ? "default" : "pointer" }}>
          刷新
        </button>
      </div>

      {error ? <div style={{ border: "1px solid #f2b8b5", background: "#fff5f5", borderRadius: 7, padding: 12, color: "#a5281b", marginBottom: 16 }}>{error}</div> : null}
      {message ? <div style={{ border: "1px solid #b7dfc5", background: "#f1fbf4", borderRadius: 7, padding: 12, color: "#136c3a", marginBottom: 16 }}>{message}</div> : null}

      {isLoading ? <p style={{ color: "#64748b" }}>正在读取照片…</p> : null}
      {!isLoading && !photos.length ? <p style={{ color: "#64748b" }}>还没有照片。</p> : null}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
        {photos.map((photo) => {
          const selected = selectedIds.has(photo._id);
          return (
            <article key={photo._id} style={{ border: `1px solid ${selected ? "#2563eb" : "#e5e7eb"}`, borderRadius: 9, overflow: "hidden", background: "#fff", boxShadow: selected ? "0 0 0 2px #bfdbfe" : "none" }}>
              <button type="button" onClick={() => router.navigateIntent("edit", { id: photo._id, type: "photo" })} style={{ display: "block", width: "100%", padding: 0, border: 0, background: "transparent", cursor: "pointer", textAlign: "left" }}>
                {photo.imageUrl ? <img src={`${photo.imageUrl}?w=640&q=80&auto=format`} alt="" style={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover", background: "#e2e8f0" }} /> : <div style={{ display: "grid", placeItems: "center", width: "100%", aspectRatio: "4 / 3", background: "#f1f5f9", color: "#94a3b8" }}>无图片</div>}
              </button>
              <div style={{ padding: 11 }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={selected} onChange={() => togglePhoto(photo._id)} disabled={isDeleting} style={{ width: 18, height: 18, marginTop: 2, flex: "0 0 auto" }} />
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.title || photo.sourceFilename || "未命名照片"}</strong>
                    <span style={{ display: "block", marginTop: 4, color: "#64748b", fontSize: 12 }}>{[photo.category, formatDate(photo.createdAt)].filter(Boolean).join(" · ") || "未分类"}</span>
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
