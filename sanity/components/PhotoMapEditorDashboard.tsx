import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import exifr from "exifr";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useClient } from "sanity";
import { addMapBasemap } from "../../src/lib/mapBasemap";

type Coordinate = [number, number];
type Album = { _id: string; title: string };
type Photo = { _id: string; title?: string; sourceFilename?: string; imageUrl?: string; location?: string; geo?: { latitude?: number; longitude?: number; source?: "exif" | "manual" | "estimated"; visibility?: "exact" | "approximate" | "private" }; album?: { _id?: string; title?: string } };
type MapRouteStop = { _key: string; title?: string };
type MapRoute = { _id: string; title: string; color?: string; trackUrl?: string; trackPoints?: { latitude?: number; longitude?: number }[]; stops?: MapRouteStop[] };
type LocatedRoute = MapRoute & { track: Coordinate[] };

async function loadRoute(route: MapRoute, signal: AbortSignal): Promise<LocatedRoute> {
  const manualTrack = (route.trackPoints ?? []).flatMap((point) => validCoordinate(point.latitude, point.longitude) ? [[point.latitude, point.longitude] as Coordinate] : []);
  if (route.trackUrl) {
    try {
      const url = new URL(route.trackUrl, window.location.origin);
      const requestUrl = url.origin === window.location.origin ? url.href : `/api/gpx?url=${encodeURIComponent(url.href)}`;
      const response = await fetch(requestUrl, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
      if (!response.ok) throw new Error("无法读取 GPX");
      const document = new DOMParser().parseFromString(await response.text(), "application/xml");
      const track = Array.from(document.getElementsByTagNameNS("*", "trkpt")).flatMap((point) => {
        const latitude = point.getAttribute("lat");
        const longitude = point.getAttribute("lon");
        return latitude !== null && longitude !== null && validCoordinate(Number(latitude), Number(longitude)) ? [[Number(latitude), Number(longitude)] as Coordinate] : [];
      });
      if (track.length >= 2) return { ...route, track };
    } catch (reason) {
      if (signal.aborted || manualTrack.length < 2) throw reason;
    }
  }
  if (manualTrack.length < 2) throw new Error("路线缺少有效轨迹");
  return { ...route, track: manualTrack };
}

function routeColor(route: MapRoute, index: number) {
  return route.color || ["#2563eb", "#0f766e", "#9333ea", "#c2410c"][index % 4];
}

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

function photoCoordinate(photo: Pick<Photo, "location" | "geo">): Coordinate | undefined {
  const geo = photo.geo;
  if (validCoordinate(geo?.latitude, geo?.longitude)) return [geo.latitude, geo.longitude];
  return parseLocation(photo.location);
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
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasAutoFitRef = useRef(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoTotal, setPhotoTotal] = useState(0);
  const [photoOffset, setPhotoOffset] = useState(0);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [routes, setRoutes] = useState<LocatedRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError, setRoutesError] = useState<string>();
  const [selectedPhotoId, setSelectedPhotoId] = useState("");
  const [coordinate, setCoordinate] = useState<Coordinate>();
  const [latitudeInput, setLatitudeInput] = useState("");
  const [longitudeInput, setLongitudeInput] = useState("");
  const [albumId, setAlbumId] = useState("");
  const [search, setSearch] = useState("");
  const [photoFilter, setPhotoFilter] = useState<"all" | "located" | "unlocated">("all");
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkAlbumId, setBulkAlbumId] = useState("");
  const [bulkRouteId, setBulkRouteId] = useState("");
  const [bulkRouteStopKey, setBulkRouteStopKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const [photoResult, albumResult] = await Promise.all([
        client.fetch<Photo[]>(`*[_type == "photo" && isHidden != true && defined(image.asset)] | order(_updatedAt desc)[0...500]{ _id, title, sourceFilename, location, geo, album->{_id, title}, "imageUrl": image.asset->url }`),
        client.fetch<Album[]>(`*[_type == "album" && isVisible != false] | order(sortOrder asc, title asc){ _id, title }`),
      ]);
      const total = await client.fetch<number>(`count(*[_type == "photo" && isHidden != true && defined(image.asset)])`);
      setPhotos(photoResult);
      setPhotoTotal(total);
      setPhotoOffset(photoResult.length);
      setAlbums(albumResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法读取地图照片，请刷新重试。");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { void loadContent(); }, [loadContent]);

  const loadMorePhotos = async () => {
    if (loadingMore || photoOffset >= photoTotal) return;
    setLoadingMore(true);
    setError(undefined);
    try {
      const next = await client.fetch<Photo[]>(`*[_type == "photo" && isHidden != true && defined(image.asset)] | order(_updatedAt desc)[${photoOffset}...${photoOffset + 500}]{ _id, title, sourceFilename, location, geo, album->{_id, title}, "imageUrl": image.asset->url }`);
      setPhotos((current) => [...current, ...next.filter((photo) => !current.some((item) => item._id === photo._id))]);
      setPhotoOffset((current) => current + next.length);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法继续读取照片，请重试。");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setRoutesLoading(true);
    setRoutesError(undefined);
    void client.fetch<MapRoute[]>(`*[_type == "mapRoute" && isVisible != false] | order(_updatedAt desc){ _id, title, color, "trackUrl": trackFile.asset->url, trackPoints[]{ latitude, longitude }, stops[]{ _key, title } }`)
      .then(async (records) => {
        const results = await Promise.allSettled(records.map((route) => loadRoute(route, controller.signal)));
        if (controller.signal.aborted) return;
        setRoutes(results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
        const failed = results.filter((result) => result.status === "rejected").length;
        if (failed) setRoutesError(`${failed} 条路线未能加载，请刷新重试。`);
      })
      .catch(() => { if (!controller.signal.aborted) setRoutesError("无法读取地图路线，请刷新重试。"); })
      .finally(() => { if (!controller.signal.aborted) setRoutesLoading(false); });
    return () => controller.abort();
  }, [client]);

  useEffect(() => {
    const element = mapElementRef.current;
    if (!element || mapRef.current) return undefined;
    const map = L.map(element, { zoomControl: true, attributionControl: true });
    addMapBasemap(map);
    map.setView([22.35, 114.17], 10);
    map.on("click", (event: L.LeafletMouseEvent) => {
      setCoordinate([event.latlng.lat, event.latlng.lng]);
      setLatitudeInput(event.latlng.lat.toFixed(6));
      setLongitudeInput(event.latlng.lng.toFixed(6));
      setMessage("已选择地图位置。现在可以上传新照片，或把右侧选中的照片移动到这里。");
      setError(undefined);
    });
    mapRef.current = map;
    routesLayerRef.current = L.layerGroup().addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.invalidateSize({ animate: false })) : undefined;
    resizeObserver?.observe(element);
    requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    const delayedResize = window.setTimeout(() => map.invalidateSize({ animate: false }), 400);
    return () => { resizeObserver?.disconnect(); window.clearTimeout(delayedResize); map.remove(); mapRef.current = null; markersRef.current = null; routesLayerRef.current = null; };
  }, []);

  useEffect(() => {
    const layer = routesLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    routes.forEach((route, index) => {
      L.polyline(route.track, { color: routeColor(route, index), weight: 4, opacity: 0.9 })
        .bindTooltip(escapeHtml(route.title), { sticky: true })
        .addTo(layer);
    });
  }, [routes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading || routesLoading || coordinate || hasAutoFitRef.current) return;
    const points = [...photos.flatMap((photo) => { const point = photoCoordinate(photo); return point ? [point] : []; }), ...routes.flatMap((route) => route.track)];
    if (points.length) {
      map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 13 });
      hasAutoFitRef.current = true;
    }
  }, [coordinate, loading, photos, routes, routesLoading]);

  const removeMarkerById = useCallback(async (photoId: string) => {
    setBusy(true); setMessage(undefined); setError(undefined);
    try {
      const selected = photos.find((photo) => photo._id === photoId);
      const patch = client.patch(photoId).unset(["geo"]);
      if (selected && parseLocation(selected.location)) patch.unset(["location"]);
      await patch.commit();
      setPhotos((current) => current.map((photo) => photo._id === photoId ? { ...photo, geo: undefined, ...(parseLocation(photo.location) ? { location: undefined } : {}) } : photo));
      if (selectedPhotoId === photoId) setCoordinate(undefined);
      setMessage("已删除地图标记，照片仍保留在照片库中。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除地图标记失败，请重试。");
    } finally { setBusy(false); }
  }, [client, photos, selectedPhotoId]);

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
    const located = photos.flatMap((photo) => { const point = photoCoordinate(photo); return point ? [{ photo, point }] : []; });
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
      marker.on("click", () => { setSelectedPhotoId(photo._id); setCoordinate(point); setLatitudeInput(point[0].toFixed(6)); setLongitudeInput(point[1].toFixed(6)); });
      marker.addTo(markers);
    });
  }, [deletePhotoById, photos, removeMarkerById, selectedPhotoId]);

  const filteredPhotos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return photos.filter((photo) => {
      const located = Boolean(photoCoordinate(photo));
      if (photoFilter === "located" && !located) return false;
      if (photoFilter === "unlocated" && located) return false;
      return !query || [photo.title, photo.sourceFilename, photo.album?.title, photo.location].some((value) => value?.toLowerCase().includes(query));
    });
  }, [photoFilter, photos, search]);

  const locatedPhotoCount = useMemo(() => photos.filter((photo) => Boolean(photoCoordinate(photo))).length, [photos]);
  const legacyCoordinatePhotos = useMemo(() => photos.filter((photo) => !photo.geo && Boolean(parseLocation(photo.location))), [photos]);
  const bulkSelectedPhotos = useMemo(() => photos.filter((photo) => bulkSelectedIds.includes(photo._id)), [bulkSelectedIds, photos]);
  const bulkRouteStops = useMemo(() => routes.find((route) => route._id === bulkRouteId)?.stops ?? [], [bulkRouteId, routes]);
  const toggleBulkPhoto = (photoId: string) => setBulkSelectedIds((current) => current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId]);
  const clearBulkSelection = () => setBulkSelectedIds([]);

  const applyBulkVisibility = async (visibility: "exact" | "approximate" | "private") => {
    const located = bulkSelectedPhotos.filter((photo) => photoCoordinate(photo));
    if (!located.length || busy) return;
    setBusy(true); setMessage(undefined); setError(undefined);
    try {
      const transaction = client.transaction();
      for (const photo of located) {
        const point = photoCoordinate(photo);
        if (!point) continue;
        transaction.patch(photo._id, (patch) => patch
          .setIfMissing({ geo: { latitude: point[0], longitude: point[1], source: "manual" } })
          .set({ "geo.visibility": visibility }));
      }
      await transaction.commit();
      const ids = new Set(located.map((photo) => photo._id));
      setPhotos((current) => current.map((photo) => {
        if (!ids.has(photo._id)) return photo;
        const point = photoCoordinate(photo);
        return point ? { ...photo, geo: { latitude: point[0], longitude: point[1], ...photo.geo, visibility } } : photo;
      }));
      setMessage(`已批量设置 ${located.length} 张照片的地图精度为“${visibility === "exact" ? "精确" : visibility === "approximate" ? "约略" : "私密"}”。${located.length < bulkSelectedPhotos.length ? `另有 ${bulkSelectedPhotos.length - located.length} 张未定位照片已跳过。` : ""}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量设置地图精度失败，请重试。");
    } finally { setBusy(false); }
  };

  const applyBulkAlbum = async () => {
    if (!bulkSelectedPhotos.length || busy) return;
    setBusy(true); setMessage(undefined); setError(undefined);
    try {
      await Promise.all(bulkSelectedPhotos.map((photo) => {
        const patch = client.patch(photo._id);
        if (bulkAlbumId) patch.set({ album: { _type: "reference", _ref: bulkAlbumId } });
        else patch.unset(["album"]);
        return patch.commit();
      }));
      const album = albums.find((item) => item._id === bulkAlbumId);
      const ids = new Set(bulkSelectedIds);
      setPhotos((current) => current.map((photo) => ids.has(photo._id) ? { ...photo, album: album ? { _id: album._id, title: album.title } : undefined } : photo));
      setMessage(bulkAlbumId ? `已将 ${bulkSelectedPhotos.length} 张照片关联到“${album?.title ?? "所选相册"}”。` : `已清除 ${bulkSelectedPhotos.length} 张照片的相册关联。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量关联相册失败，请重试。");
    } finally { setBusy(false); }
  };

  const applyBulkRouteStop = async () => {
    if (!bulkSelectedPhotos.length || !bulkRouteId || !bulkRouteStopKey || busy) return;
    setBusy(true); setMessage(undefined); setError(undefined);
    try {
      const route = await client.fetch<{ stops?: { _key: string; title?: string; photos?: { _ref?: string }[] }[] } | null>(`*[_type == "mapRoute" && _id == $routeId][0]{ stops[]{ _key, title, photos[]{ _ref } } }`, { routeId: bulkRouteId });
      const selectedRefs = bulkSelectedPhotos.map((photo) => photo._id);
      const selectedSet = new Set(selectedRefs);
      const stopIndex = (route?.stops ?? []).findIndex((stop) => stop._key === bulkRouteStopKey);
      if (stopIndex < 0) throw new Error("路线标注点已不存在，请刷新后重试。");
      const targetStop = route?.stops?.[stopIndex];
      const existing = (targetStop?.photos ?? []).map((photo) => photo._ref).filter((id): id is string => Boolean(id));
      const nextIds = Array.from(new Set([...existing, ...selectedRefs]));
      await client.patch(bulkRouteId).set({ [`stops[${stopIndex}].photos`]: nextIds.map((id) => ({ _type: "reference", _ref: id })) }).commit();
      const selectedRoute = routes.find((routeItem) => routeItem._id === bulkRouteId);
      const selectedStop = selectedRoute?.stops?.find((stop) => stop._key === bulkRouteStopKey);
      setMessage(`已将 ${selectedSet.size} 张照片关联到“${selectedRoute?.title ?? "所选路线"} · ${selectedStop?.title ?? "所选标注点"}”。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量关联路线标注点失败，请重试。");
    } finally { setBusy(false); }
  };

  const migrateLegacyCoordinates = async () => {
    if (!legacyCoordinatePhotos.length || busy) return;
    if (!window.confirm(`将 ${legacyCoordinatePhotos.length} 张照片的旧坐标迁移到结构化地图位置吗？原有文字地点会保留。`)) return;
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    try {
      await Promise.all(legacyCoordinatePhotos.map(async (photo) => {
        const point = parseLocation(photo.location);
        if (!point) return;
        await client.patch(photo._id).set({ geo: { latitude: point[0], longitude: point[1], source: "manual", visibility: "exact" } }).commit();
      }));
      const migratedIds = new Set(legacyCoordinatePhotos.map((photo) => photo._id));
      setPhotos((current) => current.map((photo) => {
        if (!migratedIds.has(photo._id)) return photo;
        const point = parseLocation(photo.location);
        return point ? { ...photo, geo: { latitude: point[0], longitude: point[1], source: "manual", visibility: "exact" } } : photo;
      }));
      setMessage(`已迁移 ${legacyCoordinatePhotos.length} 张照片的旧地图坐标。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "旧坐标迁移失败，请重试。");
    } finally {
      setBusy(false);
    }
  };
  const goToInputCoordinate = () => {
    const latitude = Number(latitudeInput);
    const longitude = Number(longitudeInput);
    if (!validCoordinate(latitude, longitude)) { setError("请输入有效的纬度和经度，例如 22.3193、114.1694。"); return; }
    const next: Coordinate = [latitude, longitude];
    setCoordinate(next);
    mapRef.current?.setView(next, 14);
    setMessage("已定位到输入的坐标，可以上传照片或移动已有照片。");
    setError(undefined);
  };
  const showWorld = () => { setCoordinate(undefined); mapRef.current?.setView([20, 0], 2); setMessage("已显示全球地图，请缩放或拖动到目标位置。"); };

  const updateSelectedPhoto = async () => {
    if (!selectedPhotoId || !coordinate) return;
    setBusy(true); setMessage(undefined); setError(undefined);
    try {
      const [latitude, longitude] = coordinate;
      await client.patch(selectedPhotoId)
        .setIfMissing({ geo: { visibility: "exact" } })
        .set({ "geo.latitude": latitude, "geo.longitude": longitude, "geo.source": "manual" })
        .commit();
      setPhotos((current) => current.map((photo) => photo._id === selectedPhotoId ? { ...photo, geo: { visibility: "exact", ...photo.geo, latitude, longitude, source: "manual" } } : photo));
      setMessage("已更新选中照片的位置。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "照片位置更新失败，请重试。");
    } finally { setBusy(false); }
  };

  const removeSelectedMarker = async () => {
    if (!selectedPhotoId) return;
    setBusy(true); setMessage(undefined); setError(undefined);
    try {
      const selected = photos.find((photo) => photo._id === selectedPhotoId);
      const patch = client.patch(selectedPhotoId).unset(["geo"]);
      if (selected && parseLocation(selected.location)) patch.unset(["location"]);
      await patch.commit();
      setPhotos((current) => current.map((photo) => photo._id === selectedPhotoId ? { ...photo, geo: undefined, ...(parseLocation(photo.location) ? { location: undefined } : {}) } : photo));
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
        geo: { latitude: finalCoordinate[0], longitude: finalCoordinate[1], source: gpsCoordinate ? "exif" : "manual", visibility: "exact" },
        isHidden: false,
        isHero: false,
        isFeatured: false,
        ...(albumId ? { album: { _type: "reference", _ref: albumId } } : {}),
      });
      setPhotos((current) => [{ ...created, _id: created._id, imageUrl: asset.url, geo: { latitude: finalCoordinate[0], longitude: finalCoordinate[1], source: gpsCoordinate ? "exif" : "manual", visibility: "exact" } }, ...current]);
      setSelectedPhotoId(created._id);
      setCoordinate(finalCoordinate);
      setMessage(gpsCoordinate ? "照片已上传，并使用照片 GPS 位置。" : "照片已上传，并使用地图点击位置。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "照片上传失败，请重试。");
    } finally { setBusy(false); }
  };

  return <div style={{ display: "grid", gap: 16, padding: 24, maxWidth: 1400 }}>
    <header><p style={{ margin: "0 0 5px", color: "#64748b", fontSize: 13, fontWeight: 700 }}>照片位置与徒步路线</p><h1 style={{ margin: 0, fontSize: 28 }}>照片地图</h1><p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.5 }}>照片标记和徒步路线会同时显示。点击地图位置可上传或移动照片；点击下方路线名称可查看完整轨迹。</p></header>
    {error ? <p style={{ margin: 0, padding: 10, borderRadius: 6, background: "#fef2f2", color: "#b42318" }}>{error}</p> : null}
    {message ? <p style={{ margin: 0, padding: 10, borderRadius: 6, background: "#f0fdf4", color: "#166534" }}>{message}</p> : null}
    {routesError ? <p role="alert" style={{ margin: 0, padding: 10, borderRadius: 6, background: "#fffbeb", color: "#92400e" }}>{routesError}</p> : null}
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 16, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div ref={mapElementRef} style={{ height: 620, minHeight: 420, border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden", background: "#e5eef5" }} />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", color: "#64748b", fontSize: 12 }}><span>已定位照片：{locatedPhotoCount} / 已加载 {photos.length}{photoTotal ? ` / 共 ${photoTotal}` : ""} · {routesLoading ? "正在读取路线…" : `路线：${routes.length}`}</span><button type="button" onClick={showWorld} style={{ minHeight: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 5, background: "#fff", color: "#475569", cursor: "pointer" }}>显示全球地图</button></div>
        {routes.length ? <nav aria-label="地图路线" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {routes.map((route, index) => <button key={route._id} type="button" onClick={() => mapRef.current?.fitBounds(L.latLngBounds(route.track), { padding: [32, 32], maxZoom: 15 })} style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 5, background: "#fff", color: "#334155", cursor: "pointer", fontSize: 12 }}><span aria-hidden="true" style={{ width: 18, height: 4, borderRadius: 2, background: routeColor(route, index) }} />{route.title}</button>)}
        </nav> : null}
      </div>
      <aside style={{ display: "grid", gap: 12 }}>
        <section style={{ padding: 14, border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff" }}>
          <strong style={{ display: "block", marginBottom: 8, color: "#1e3a8a" }}>在地图位置添加照片</strong>
          <p style={{ margin: "0 0 10px", color: "#475569", fontSize: 12, lineHeight: 1.5 }}>{coordinate ? `当前坐标：${formatLocation(coordinate)}` : "请先点击地图选择位置。"}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, marginBottom: 8 }}><input value={latitudeInput} onChange={(event) => setLatitudeInput(event.currentTarget.value)} placeholder="纬度" aria-label="纬度" style={{ minHeight: 36, width: "100%", boxSizing: "border-box", padding: "0 7px", border: "1px solid #cbd5e1", borderRadius: 5 }} /><input value={longitudeInput} onChange={(event) => setLongitudeInput(event.currentTarget.value)} placeholder="经度" aria-label="经度" style={{ minHeight: 36, width: "100%", boxSizing: "border-box", padding: "0 7px", border: "1px solid #cbd5e1", borderRadius: 5 }} /><button type="button" onClick={goToInputCoordinate} style={{ minHeight: 36, padding: "0 8px", border: "1px solid #2563eb", borderRadius: 5, background: "#fff", color: "#1d4ed8", cursor: "pointer" }}>定位</button></div>
          <select value={albumId} onChange={(event) => setAlbumId(event.currentTarget.value)} disabled={busy} style={{ boxSizing: "border-box", width: "100%", minHeight: 38, marginBottom: 8, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 5, background: "#fff" }}><option value="">不指定相册</option>{albums.map((album) => <option key={album._id} value={album._id}>{album.title}</option>)}</select>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!coordinate || busy} style={{ width: "100%", minHeight: 40, border: 0, borderRadius: 5, background: !coordinate || busy ? "#94a3b8" : "#2563eb", color: "#fff", cursor: !coordinate || busy ? "not-allowed" : "pointer", fontWeight: 700 }}>{busy ? "处理中…" : "上传照片到此位置"}</button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadAtSelectedLocation(file); }} />
          <small style={{ display: "block", marginTop: 8, color: "#64748b", lineHeight: 1.45 }}>照片带 GPS 时优先使用照片 GPS；没有 GPS 时使用地图点击位置。</small>
        </section>
        <section style={{ padding: 14, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
          <strong style={{ display: "block", marginBottom: 8 }}>移动已有照片</strong>
          <input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="搜索照片或相册" style={{ boxSizing: "border-box", width: "100%", minHeight: 36, marginBottom: 8, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 5 }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }} aria-label="照片定位筛选">{([['all', `全部 ${photos.length}`], ['located', `已定位 ${locatedPhotoCount}`], ['unlocated', `未定位 ${photos.length - locatedPhotoCount}`]] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setPhotoFilter(value)} style={{ minHeight: 30, padding: "0 9px", border: `1px solid ${photoFilter === value ? "#2563eb" : "#cbd5e1"}`, borderRadius: 999, background: photoFilter === value ? "#dbeafe" : "#fff", color: photoFilter === value ? "#1d4ed8" : "#475569", cursor: "pointer", fontSize: 11 }}>{label}</button>)}{legacyCoordinatePhotos.length ? <button type="button" onClick={() => void migrateLegacyCoordinates()} disabled={busy} style={{ minHeight: 30, padding: "0 9px", border: "1px solid #0f766e", borderRadius: 999, background: "#ccfbf1", color: "#0f766e", cursor: busy ? "wait" : "pointer", fontSize: 11 }}>{busy ? "正在迁移…" : `迁移旧坐标 ${legacyCoordinatePhotos.length}`}</button> : null}</div>
          {bulkSelectedPhotos.length ? <div style={{ marginBottom: 8, padding: 9, border: "1px solid #bfdbfe", borderRadius: 6, background: "#eff6ff" }}>
            <strong style={{ display: "block", marginBottom: 7, color: "#1e3a8a", fontSize: 12 }}>已选择 {bulkSelectedPhotos.length} 张照片</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, marginBottom: 6 }}>
              <select value={bulkAlbumId} onChange={(event) => setBulkAlbumId(event.currentTarget.value)} disabled={busy} aria-label="批量关联相册" style={{ minHeight: 32, minWidth: 0, padding: "0 7px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontSize: 11 }}><option value="">不指定相册（清除关联）</option>{albums.map((album) => <option key={album._id} value={album._id}>{album.title}</option>)}</select>
              <button type="button" onClick={() => void applyBulkAlbum()} disabled={busy} style={{ minHeight: 32, padding: "0 8px", border: "1px solid #2563eb", borderRadius: 4, background: "#fff", color: "#1d4ed8", cursor: busy ? "wait" : "pointer", fontSize: 11 }}>应用相册</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, marginBottom: 6 }}>
              <select value={bulkRouteId} onChange={(event) => { setBulkRouteId(event.currentTarget.value); setBulkRouteStopKey(""); }} disabled={busy} aria-label="批量关联路线" style={{ minHeight: 32, minWidth: 0, padding: "0 7px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontSize: 11 }}><option value="">选择路线</option>{routes.map((route) => <option key={route._id} value={route._id}>{route.title}</option>)}</select>
              <select value={bulkRouteStopKey} onChange={(event) => setBulkRouteStopKey(event.currentTarget.value)} disabled={busy || !bulkRouteId} aria-label="批量关联路线标注点" style={{ minHeight: 32, minWidth: 0, padding: "0 7px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontSize: 11 }}><option value="">选择标注点</option>{bulkRouteStops.map((stop) => <option key={stop._key} value={stop._key}>{stop.title || "未命名标注点"}</option>)}</select>
              <button type="button" onClick={() => void applyBulkRouteStop()} disabled={busy || !bulkRouteId || !bulkRouteStopKey} style={{ minHeight: 32, padding: "0 8px", border: "1px solid #2563eb", borderRadius: 4, background: "#fff", color: "#1d4ed8", cursor: busy || !bulkRouteId || !bulkRouteStopKey ? "not-allowed" : "pointer", fontSize: 11 }}>应用路线</button>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}><button type="button" onClick={() => void applyBulkVisibility("exact")} disabled={busy} style={{ minHeight: 29, padding: "0 7px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", color: "#475569", cursor: busy ? "wait" : "pointer", fontSize: 11 }}>精确</button><button type="button" onClick={() => void applyBulkVisibility("approximate")} disabled={busy} style={{ minHeight: 29, padding: "0 7px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", color: "#475569", cursor: busy ? "wait" : "pointer", fontSize: 11 }}>约略</button><button type="button" onClick={() => void applyBulkVisibility("private")} disabled={busy} style={{ minHeight: 29, padding: "0 7px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", color: "#475569", cursor: busy ? "wait" : "pointer", fontSize: 11 }}>私密</button><button type="button" onClick={clearBulkSelection} disabled={busy} style={{ minHeight: 29, marginLeft: "auto", padding: "0 7px", border: 0, background: "transparent", color: "#64748b", cursor: busy ? "wait" : "pointer", fontSize: 11 }}>清除选择</button></div>
          </div> : null}
          <div style={{ maxHeight: 300, overflow: "auto", display: "grid", gap: 6 }}>{filteredPhotos.map((photo) => <div key={photo._id} style={{ display: "flex", gap: 5, alignItems: "center" }}><input type="checkbox" checked={bulkSelectedIds.includes(photo._id)} onChange={() => toggleBulkPhoto(photo._id)} aria-label={`选择${photo.title || photo.sourceFilename || "未命名照片"}`} /><button type="button" onClick={() => { setSelectedPhotoId(photo._id); const point = photoCoordinate(photo); setCoordinate(point); if (point) { setLatitudeInput(point[0].toFixed(6)); setLongitudeInput(point[1].toFixed(6)); } else { setLatitudeInput(""); setLongitudeInput(""); } }} style={{ display: "flex", flex: 1, gap: 8, alignItems: "center", padding: 6, border: `1px solid ${selectedPhotoId === photo._id ? "#2563eb" : "#e2e8f0"}`, borderRadius: 5, background: selectedPhotoId === photo._id ? "#eff6ff" : "#fff", textAlign: "left", cursor: "pointer" }}><div style={{ width: 46, height: 38, flex: "0 0 auto", borderRadius: 3, overflow: "hidden", background: "#f1f5f9" }}>{photo.imageUrl ? <img src={`${photo.imageUrl}?w=120&q=70&auto=format`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}</div><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#334155", fontSize: 12 }}>{photo.title || photo.sourceFilename || "未命名照片"}</span></button></div>)}</div>
          {photoOffset < photoTotal ? <button type="button" onClick={() => void loadMorePhotos()} disabled={loadingMore} style={{ minHeight: 36, marginTop: 8, border: "1px solid #cbd5e1", borderRadius: 5, background: "#fff", color: "#475569", cursor: loadingMore ? "wait" : "pointer", fontSize: 12 }}>{loadingMore ? "正在加载更多…" : `加载更多照片（剩余 ${photoTotal - photoOffset}）`}</button> : null}
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
