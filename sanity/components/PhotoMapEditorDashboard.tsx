import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import exifr from "exifr";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useClient } from "sanity";

type Coordinate = [number, number];
type Album = { _id: string; title: string };
type Photo = { _id: string; title?: string; sourceFilename?: string; imageUrl?: string; location?: string; album?: { _id?: string; title?: string } };

function validCoordinate(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90 && typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

function parseLocation(value: string | undefined): Coordinate | undefined {
  const match = value?.match(/(-?\d+(?:\.\d+)?)\s*[,，\s]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (validCoordinate(first, second)) return [first, second];
  if (validCoordinate(second, first)) return [second, first];
  return undefined;
}

function formatLocation([latitude, longitude]: Coordinate) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function slugFor(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 80) || `map-photo-${Date.now().toString(36)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function photoTooltip(photo: Photo) {
  const title = escapeHtml(photo.title || photo.sourceFilename || "未命名照片");
  const image = photo.imageUrl ? `<img src="${escapeHtml(`${photo.imageUrl}?w=260&q=78&auto=format`)}" alt="" style="display:block;width:180px;height:120px;object-fit:cover;border-radius:5px;margin-bottom:6px" />` : "";
  return `<div style="min-width:180px;font-size:12px;font-weight:600;color:#1f2937">${image}<span>${title}</span></div>`;
}

function photoPopup(photo: Photo) {
  const title = escapeHtml(photo.title || photo.sourceFilename || "未命名照片");
  const image = photo.imageUrl ? `<img src="${escapeHtml(`${photo.imageUrl}?w=320&q=80&auto=format`)}" alt="" style="display:block;width:210px;height:140px;object-fit:cover;border-radius:5px;margin-bottom:7px" />` : "";
  return `<div style="min-width:210px;color:#1f2937">${image}<strong style="display:block;margin-bottom:8px;font-size:12px">${title}</strong><div style="display:flex;gap:6px"><button type="button" data-photo-map-remove="true" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;color:#475569;cursor:pointer;font-size:11px">删除地图标记</button><button type="button" data-photo-map-delete="true" style="padding:6px 8px;border:1px solid #fecaca;border-radius:4px;background:#fff1f2;color:#b42318;cursor:pointer;font-size:11px">删除照片</button></div></div>`;
}

export function PhotoMapEditorDashboard() {
  const client = useClient({ apiVersion: "2025-02-19" });
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState("");
  const [coordinate, setCoordinate] = useState<Coordinate>();
  const [albumId, setAlbumId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const [photoResult, albumResult] = await Promise.all([
        client.fetch<Photo[]>(`*[_type == "photo" && isHidden != true && defined(image.asset)] | order(_updatedAt desc)[0...500]{ _id, title, sourceFilename, location, album->{_id, title}, "imageUrl": image.asset->url }`),
        client.fetch<Album[]>(`*[_type == "album" && isVisible != false] | order(sortOrder asc, title asc){ _id, title }`),
      ]);
      setPhotos(photoResult);
      setAlbums(albumResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法读取地图照片，请刷新重试。");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { void loadContent(); }, [loadContent]);

  useEffect(() => {
    const element = mapElementRef.current;
    if (!element || mapRef.current) return undefined;
    const map = L.map(element, { zoomControl: true, attributionControl: true });
    const openStreetMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
    let fallbackLoaded = false;
    const fallbackTiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", { attribution: "© Esri", maxZoom: 19 });
    openStreetMap.on("tileerror", () => { if (!fallbackLoaded) { fallbackLoaded = true; fallbackTiles.addTo(map); } });
    map.setView([22.35, 114.17], 10);
    map.on("click", (event: L.LeafletMouseEvent) => {
      setCoordinate([event.latlng.lat, event.latlng.lng]);
      setMessage("已选择地图位置。现在可以上传新照片，或把右侧选中的照片移动到这里。");
      setError(undefined);
    });
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.invalidateSize({ animate: false })) : undefined;
    resizeObserver?.observe(element);
    requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    const delayedResize = window.setTimeout(() => map.invalidateSize({ animate: false }), 400);
    return () => { resizeObserver?.disconnect(); window.clearTimeout(delayedResize); map.remove(); mapRef.current = null; markersRef.current = null; };
  }, []);

  const removeMarkerById = useCallback(async (photoId: string) => {
    setBusy(true); setMessage(undefined); setError(undefined);
    try {
      await client.patch(photoId).unset(["location"]).commit();
      setPhotos((current) => current.map((photo) => photo._id === photoId ? { ...photo, location: undefined } : photo));
      if (selectedPhotoId === photoId) setCoordinate(undefined);
      setMessage("已删除地图标记，照片仍保留在照片库中。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除地图标记失败，请重试。");
    } finally { setBusy(false); }
  }, [client, selectedPhotoId]);

  const deletePhotoById = useCallback(async (photoId: string) => {
    const selected = photos.find((photo) => photo._id === photoId);
    if (!selected || !window.confirm(`确定删除照片“${selected.title || selected.sourceFilename || "未命名照片"}”吗？此操作不可撤销。`)) return;
    setBusy(true); setMessage(undefined); setError(undefined);
    try {
      await client.delete(photoId);
      setPhotos((current) => current.filter((photo) => photo._id !== photoId));
      if (selectedPhotoId === photoId) { setSelectedPhotoId(""); setCoordinate(undefined); }
      setMessage("照片已删除；对应地图标记也已移除。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除照片失败，请重试。");
    } finally { setBusy(false); }
  }, [client, photos, selectedPhotoId]);

  useEffect(() => {
    const markers = markersRef.current;
    const map = mapRef.current;
    if (!markers || !map) return;
    markers.clearLayers();
    const located = photos.flatMap((photo) => { const point = parseLocation(photo.location); return point ? [{ photo, point }] : []; });
    located.forEach(({ photo, point }) => {
      const marker = L.circleMarker(point, { radius: photo._id === selectedPhotoId ? 10 : 7, color: "#fff", weight: 2, fillColor: photo._id === selectedPhotoId ? "#2563eb" : "#b42318", fillOpacity: 0.95 });
      marker.bindTooltip(photoTooltip(photo), { direction: "top", sticky: true, opacity: 1, className: "photo-map-thumbnail-tooltip" });
      const popup = L.popup({ maxWidth: 240 }).setContent(photoPopup(photo));
      marker.bindPopup(popup);
      marker.on("popupopen", () => {
        const element = popup.getElement();
        element?.querySelector<HTMLButtonElement>("[data-photo-map-remove]")?.addEventListener("click", () => { void removeMarkerById(photo._id); map.closePopup(); });
        element?.querySelector<HTMLButtonElement>("[data-photo-map-delete]")?.addEventListener("click", () => { void deletePhotoById(photo._id); map.closePopup(); });
      });
      marker.on("click", () => { setSelectedPhotoId(photo._id); setCoordinate(point); });
      marker.addTo(markers);
    });
    if (located.length && !coordinate) map.fitBounds(L.latLngBounds(located.map(({ point }) => point)), { padding: [24, 24], maxZoom: 13 });
  }, [coordinate, deletePhotoById, photos, removeMarkerById, selectedPhotoId]);

  const filteredPhotos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return photos.filter((photo) => !query || [photo.title, photo.sourceFilename, photo.album?.title, photo.location].some((value) => value?.toLowerCase().includes(query)));
  }, [photos, search]);

  const updateSelectedPhoto = async () => {
    if (!selectedPhotoId || !coordinate) return;
    setBusy(true); setMessage(undefined); setError(undefined);
    try {
      await client.patch(selectedPhotoId).set({ location: formatLocation(coordinate) }).commit();
      setPhotos((current) => current.map((photo) => photo._id === selectedPhotoId ? { ...photo, location: formatLocation(coordinate) } : photo));
      setMessage("已更新选中照片的位置。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "照片位置更新失败，请重试。");
    } finally { setBusy(false); }
  };

  const removeSelectedMarker = async () => {
    if (!selectedPhotoId) return;
    setBusy(true); setMessage(undefined); setError(undefined);
    try {
      await client.patch(selectedPhotoId).unset(["location"]).commit();
      setPhotos((current) => current.map((photo) => photo._id === selectedPhotoId ? { ...photo, location: undefined } : photo));
      setCoordinate(undefined);
      setMessage("已删除地图标记，照片仍保留在照片库中。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除地图标记失败，请重试。");
    } finally { setBusy(false); }
  };

  const deleteSelectedPhoto = async () => {
    const selected = photos.find((photo) => photo._id === selectedPhotoId);
    if (!selected || !window.confirm(`确定删除照片“${selected.title || selected.sourceFilename || "未命名照片"}”吗？此操作不可撤销。`)) return;
    setBusy(true); setMessage(undefined); setError(undefined);
    try {
      await client.delete(selected._id);
      setPhotos((current) => current.filter((photo) => photo._id !== selected._id));
      setSelectedPhotoId("");
      setCoordinate(undefined);
      setMessage("照片已删除；对应地图标记也已移除。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除照片失败，请重试。");
    } finally { setBusy(false); }
  };

  const uploadAtSelectedLocation = async (file: File) => {
    if (!coordinate) { setError("请先在地图上点击一个位置。"); return; }
    setBusy(true); setMessage(undefined); setError(undefined);
    try {
      const gps = await exifr.gps(file).catch(() => undefined) as { latitude?: number; longitude?: number } | undefined;
      const gpsCoordinate = validCoordinate(gps?.latitude, gps?.longitude) ? [gps.latitude, gps.longitude] as Coordinate : undefined;
      const finalCoordinate = gpsCoordinate ?? coordinate;
      const asset = await client.assets.upload("image", file, { filename: file.name, contentType: file.type || "image/jpeg" });
      const title = file.name.replace(/\.[^.]+$/, "") || "地图照片";
      const baseSlug = slugFor(title);
      const duplicate = await client.fetch<number>(`count(*[_type == "photo" && slug.current == $slug])`, { slug: baseSlug });
      const created = await client.create<Photo>({
        _type: "photo",
        title,
        slug: { _type: "slug", current: duplicate ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug },
        image: { _type: "image", asset: { _type: "reference", _ref: asset._id } },
        sourceFilename: file.name,
        altText: title,
        location: formatLocation(finalCoordinate),
        isHidden: false,
        isHero: false,
        isFeatured: false,
        ...(albumId ? { album: { _type: "reference", _ref: albumId } } : {}),
      });
      setPhotos((current) => [{ ...created, _id: created._id, imageUrl: asset.url, location: formatLocation(finalCoordinate) }, ...current]);
      setSelectedPhotoId(created._id);
      setCoordinate(finalCoordinate);
      setMessage(gpsCoordinate ? "照片已上传，并使用照片 GPS 位置。" : "照片已上传，并使用地图点击位置。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "照片上传失败，请重试。");
    } finally { setBusy(false); }
  };

  return <div style={{ display: "grid", gap: 16, padding: 24, maxWidth: 1400 }}>
    <header><p style={{ margin: "0 0 5px", color: "#64748b", fontSize: 13, fontWeight: 700 }}>独立照片位置编辑</p><h1 style={{ margin: 0, fontSize: 28 }}>照片地图</h1><p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.5 }}>这张地图不依赖徒步路线。先点击地图位置，再上传照片，或把已有照片移动到这里。</p></header>
    {error ? <p style={{ margin: 0, padding: 10, borderRadius: 6, background: "#fef2f2", color: "#b42318" }}>{error}</p> : null}
    {message ? <p style={{ margin: 0, padding: 10, borderRadius: 6, background: "#f0fdf4", color: "#166534" }}>{message}</p> : null}
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 16, alignItems: "start" }}>
      <div ref={mapElementRef} style={{ height: 620, minHeight: 420, border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden", background: "#e5eef5" }} />
      <aside style={{ display: "grid", gap: 12 }}>
        <section style={{ padding: 14, border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff" }}>
          <strong style={{ display: "block", marginBottom: 8, color: "#1e3a8a" }}>在地图位置添加照片</strong>
          <p style={{ margin: "0 0 10px", color: "#475569", fontSize: 12, lineHeight: 1.5 }}>{coordinate ? `当前坐标：${formatLocation(coordinate)}` : "请先点击地图选择位置。"}</p>
          <select value={albumId} onChange={(event) => setAlbumId(event.currentTarget.value)} disabled={busy} style={{ boxSizing: "border-box", width: "100%", minHeight: 38, marginBottom: 8, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 5, background: "#fff" }}><option value="">不指定相册</option>{albums.map((album) => <option key={album._id} value={album._id}>{album.title}</option>)}</select>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!coordinate || busy} style={{ width: "100%", minHeight: 40, border: 0, borderRadius: 5, background: !coordinate || busy ? "#94a3b8" : "#2563eb", color: "#fff", cursor: !coordinate || busy ? "not-allowed" : "pointer", fontWeight: 700 }}>{busy ? "处理中…" : "上传照片到此位置"}</button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadAtSelectedLocation(file); }} />
          <small style={{ display: "block", marginTop: 8, color: "#64748b", lineHeight: 1.45 }}>照片带 GPS 时优先使用照片 GPS；没有 GPS 时使用地图点击位置。</small>
        </section>
        <section style={{ padding: 14, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
          <strong style={{ display: "block", marginBottom: 8 }}>移动已有照片</strong>
          <input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="搜索照片或相册" style={{ boxSizing: "border-box", width: "100%", minHeight: 36, marginBottom: 8, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 5 }} />
          <div style={{ maxHeight: 300, overflow: "auto", display: "grid", gap: 6 }}>{filteredPhotos.map((photo) => <button type="button" key={photo._id} onClick={() => { setSelectedPhotoId(photo._id); const point = parseLocation(photo.location); if (point) setCoordinate(point); }} style={{ display: "flex", gap: 8, alignItems: "center", padding: 6, border: `1px solid ${selectedPhotoId === photo._id ? "#2563eb" : "#e2e8f0"}`, borderRadius: 5, background: selectedPhotoId === photo._id ? "#eff6ff" : "#fff", textAlign: "left", cursor: "pointer" }}><div style={{ width: 46, height: 38, flex: "0 0 auto", borderRadius: 3, overflow: "hidden", background: "#f1f5f9" }}>{photo.imageUrl ? <img src={`${photo.imageUrl}?w=120&q=70&auto=format`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}</div><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#334155", fontSize: 12 }}>{photo.title || photo.sourceFilename || "未命名照片"}</span></button>)}</div>
          <button type="button" onClick={() => void updateSelectedPhoto()} disabled={!selectedPhotoId || !coordinate || busy} style={{ width: "100%", minHeight: 38, marginTop: 10, border: "1px solid #2563eb", borderRadius: 5, background: !selectedPhotoId || !coordinate || busy ? "#f1f5f9" : "#fff", color: !selectedPhotoId || !coordinate || busy ? "#94a3b8" : "#1d4ed8", cursor: !selectedPhotoId || !coordinate || busy ? "not-allowed" : "pointer", fontWeight: 700 }}>把选中照片移动到地图位置</button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => void removeSelectedMarker()} disabled={!selectedPhotoId || busy} style={{ minHeight: 36, border: "1px solid #cbd5e1", borderRadius: 5, background: "#fff", color: "#475569", cursor: !selectedPhotoId || busy ? "not-allowed" : "pointer", fontSize: 12 }}>删除地图标记</button>
            <button type="button" onClick={() => void deleteSelectedPhoto()} disabled={!selectedPhotoId || busy} style={{ minHeight: 36, border: "1px solid #fecaca", borderRadius: 5, background: "#fff1f2", color: "#b42318", cursor: !selectedPhotoId || busy ? "not-allowed" : "pointer", fontSize: 12 }}>删除照片</button>
          </div>
        </section>
      </aside>
    </div>
    {loading ? <p style={{ color: "#64748b" }}>正在读取照片位置…</p> : null}
  </div>;
}
