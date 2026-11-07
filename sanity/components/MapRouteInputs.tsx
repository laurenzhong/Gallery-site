import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import exifr from "exifr";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { set, useClient, useFormValue, type ArrayOfObjectsInputProps } from "sanity";

type ReferenceItem = { _key: string; _ref?: string; _type?: string };
type TrackPointItem = { _key: string; latitude?: number; longitude?: number; elevationM?: number };
type StopItem = {
  _key: string;
  _type?: string;
  title?: string;
  localTitle?: string;
  trackIndex?: number;
  coordinate?: { latitude?: number; longitude?: number };
  photos?: ReferenceItem[];
};
type PhotoPreview = { _id: string; title?: string; imageUrl?: string; filename?: string; album?: { _id: string; title: string } };
type AlbumPreview = { _id: string; title: string; isVisible?: boolean };
type RouteCoordinate = [number, number];

function keyFor(prefix: string, id = "item") {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${random}`;
}

function validCoordinate(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90 && typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

function parseGpx(xml: string): RouteCoordinate[] {
  if (typeof DOMParser === "undefined") return [];
  const document = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(document.querySelectorAll("trkpt")).flatMap((point) => {
    const latitude = Number(point.getAttribute("lat"));
    const longitude = Number(point.getAttribute("lon"));
    return validCoordinate(latitude, longitude) ? [[latitude, longitude] as RouteCoordinate] : [];
  });
}

function nearestTrackIndex(track: RouteCoordinate[], coordinate: RouteCoordinate) {
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  track.forEach(([latitude, longitude], index) => {
    const next = (latitude - coordinate[0]) ** 2 + (longitude - coordinate[1]) ** 2;
    if (next < distance) { nearest = index; distance = next; }
  });
  return nearest;
}

export function MapRoutePhotosInput(props: ArrayOfObjectsInputProps<ReferenceItem>) {
  const client = useClient({ apiVersion: "2025-02-19" });
  const readOnly = Boolean(props.readOnly);
  const selectedIds = useMemo(() => (props.value ?? []).map((item) => item._ref).filter((id): id is string => Boolean(id)), [props.value]);
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [albums, setAlbums] = useState<AlbumPreview[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState("");
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [albumAdding, setAlbumAdding] = useState(false);

  useEffect(() => {
    let active = true;
    if (!pickerOpen && !selectedIds.length) {
      setPhotos([]);
      setAlbums([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const query = pickerOpen
      ? `*[_type == "photo" && (_id in $selectedIds || (($albumId == "" || album._ref == $albumId) && (title match $search || sourceFilename match $search)))] | order(_updatedAt desc)[0...240]{ _id, title, sourceFilename, album->{_id, title}, "imageUrl": image.asset->url }`
      : `*[_type == "photo" && _id in $selectedIds]{ _id, title, sourceFilename, album->{_id, title}, "imageUrl": image.asset->url }`;
    void Promise.all([
      client.fetch<PhotoPreview[]>(query, { selectedIds, albumId: selectedAlbumId, search: search.trim() ? `${search.trim()}*` : "*" }),
      pickerOpen ? client.fetch<AlbumPreview[]>(`*[_type == "album" && isVisible != false] | order(sortOrder asc, title asc){ _id, title, isVisible }`) : Promise.resolve<AlbumPreview[]>([]),
    ])
      .then(([result, albumResult]) => { if (active) { setPhotos(result); setAlbums(albumResult); } })
      .catch(() => { if (active) setPhotos([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, selectedIds.join("|"), search, selectedAlbumId, pickerOpen]);

  const selected = selectedIds.map((id) => photos.find((photo) => photo._id === id)).filter((photo): photo is PhotoPreview => Boolean(photo));
  const togglePhoto = (id: string) => {
    const current = props.value ?? [];
    const exists = current.some((item) => item._ref === id);
    const next = exists
      ? current.filter((item) => item._ref !== id)
      : [...current, { _key: keyFor("photo", id), _type: "reference", _ref: id }];
    props.onChange(set(next));
  };
  const addWholeAlbum = async () => {
    if (readOnly || !selectedAlbumId) return;
    setAlbumAdding(true);
    try {
      const albumPhotos = await client.fetch<PhotoPreview[]>(`*[_type == "photo" && album._ref == $albumId] | order(_updatedAt desc){ _id, title, sourceFilename, album->{_id, title}, "imageUrl": image.asset->url }`, { albumId: selectedAlbumId });
      const current = props.value ?? [];
      const existing = new Set(current.map((item) => item._ref).filter((id): id is string => Boolean(id)));
      const additions = albumPhotos.filter((photo) => !existing.has(photo._id)).map((photo) => ({ _key: keyFor("photo", photo._id), _type: "reference", _ref: photo._id }));
      if (additions.length) props.onChange(set([...current, ...additions]));
      setPhotos((currentPhotos) => [...albumPhotos, ...currentPhotos.filter((photo) => !albumPhotos.some((item) => item._id === photo._id))]);
    } catch {
      // Keep the picker open so the user can retry without losing the current selection.
    } finally {
      setAlbumAdding(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 10, padding: 10, border: "1px solid #dbeafe", borderRadius: 7, background: "#eff6ff", color: "#1e3a8a", fontSize: 12, lineHeight: 1.55 }}>
        先在“照片 → 全部照片”上传或确认照片，再点击“添加照片”选择。选中后这里会直接显示缩略图；照片会跟随当前标注点显示在路线地图上。
      </div>
      {selected.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 10, marginBottom: 12 }}>
          {selected.map((photo) => (
            <figure key={photo._id} style={{ position: "relative", margin: 0, overflow: "hidden", border: "1px solid #dfe3e8", borderRadius: 6, background: "#f7f8fa" }}>
              {photo.imageUrl ? <img src={`${photo.imageUrl}?w=320&q=75&auto=format`} alt="" style={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover" }} /> : <div style={{ aspectRatio: "4 / 3" }} />}
              <figcaption style={{ padding: "6px 7px", overflow: "hidden", fontSize: 11, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.title || photo.filename || "未命名照片"}</figcaption>
              {!readOnly ? <button type="button" onClick={() => togglePhoto(photo._id)} style={{ position: "absolute", top: 5, right: 5, width: 24, height: 24, border: 0, borderRadius: 999, background: "rgba(17,24,39,.78)", color: "#fff", cursor: "pointer" }} aria-label="移除照片">×</button> : null}
            </figure>
          ))}
        </div>
      ) : <p style={{ margin: "0 0 10px", color: "#6b7280", fontSize: 12 }}>还没有关联照片。</p>}
      {readOnly ? <p style={{ margin: "10px 0 0", color: "#92400e", fontSize: 12 }}>当前是已发布只读视图，不能添加或移除照片。请打开不带 <code>?perspective=published</code> 的 Studio 地址进行编辑。</p> : null}
      {!readOnly ? <button type="button" onClick={() => setPickerOpen((value) => !value)} style={{ minHeight: 36, padding: "0 12px", border: "1px solid #2563eb", borderRadius: 5, background: pickerOpen ? "#dbeafe" : "#fff", color: "#1d4ed8", cursor: "pointer", fontWeight: 600 }}>{pickerOpen ? "收起照片选择" : "添加照片"}</button> : null}
      {pickerOpen && !readOnly ? (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #dfe3e8", borderRadius: 7, background: "#fff" }}>
          <label style={{ display: "block", marginBottom: 6, color: "#374151", fontSize: 12, fontWeight: 700 }}>第一步：选择相册</label>
          <select value={selectedAlbumId} onChange={(event) => { setSelectedAlbumId(event.currentTarget.value); setSearch(""); }} style={{ boxSizing: "border-box", width: "100%", minHeight: 38, marginBottom: 10, padding: "0 9px", border: "1px solid #cbd5e1", borderRadius: 5, background: "#fff" }}>
            <option value="">全部相册</option>
            {albums.map((album) => <option key={album._id} value={album._id}>{album.title}</option>)}
          </select>
          <button type="button" onClick={() => void addWholeAlbum()} disabled={!selectedAlbumId || albumAdding} style={{ minHeight: 36, marginBottom: 12, padding: "0 12px", border: "1px solid #0f766e", borderRadius: 5, background: !selectedAlbumId || albumAdding ? "#f1f5f9" : "#ccfbf1", color: !selectedAlbumId || albumAdding ? "#94a3b8" : "#0f766e", cursor: !selectedAlbumId || albumAdding ? "not-allowed" : "pointer", fontWeight: 700 }}>{albumAdding ? "正在添加相册…" : "添加整个相册"}</button>
          <label style={{ display: "block", marginBottom: 6, color: "#374151", fontSize: 12, fontWeight: 700 }}>第二步：选择相册里的图片</label>
          <input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="搜索照片标题或文件名" style={{ boxSizing: "border-box", width: "100%", minHeight: 36, marginBottom: 10, padding: "0 9px", border: "1px solid #cbd5e1", borderRadius: 5 }} />
          {loading ? <p style={{ color: "#6b7280", fontSize: 12 }}>正在读取照片…</p> : null}
          {!loading && !photos.length ? <p style={{ color: "#6b7280", fontSize: 12 }}>没有找到照片。请先到“照片 → 全部照片”上传。</p> : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 10, maxHeight: 420, overflow: "auto" }}>
            {photos.map((photo) => {
              const checked = selectedIds.includes(photo._id);
              return <button type="button" key={photo._id} onClick={() => togglePhoto(photo._id)} style={{ position: "relative", padding: 0, overflow: "hidden", border: `2px solid ${checked ? "#2563eb" : "#e5e7eb"}`, borderRadius: 6, background: "#f7f8fa", textAlign: "left", cursor: "pointer" }} aria-pressed={checked}>
                {photo.imageUrl ? <img src={`${photo.imageUrl}?w=320&q=70&auto=format`} alt="" style={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover" }} /> : <div style={{ aspectRatio: "4 / 3" }} />}
                <span style={{ display: "block", padding: "6px 7px", overflow: "hidden", fontSize: 11, textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#374151" }}>{photo.title || photo.filename || "未命名照片"}</span>
                {checked ? <span style={{ position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: 999, background: "#2563eb", color: "#fff", textAlign: "center", lineHeight: "22px" }}>✓</span> : null}
              </button>;
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MapRouteStopsInput(props: ArrayOfObjectsInputProps<StopItem>) {
  const client = useClient({ apiVersion: "2025-02-19" });
  const readOnly = Boolean(props.readOnly);
  const trackFile = useFormValue(["trackFile"]) as { asset?: { _ref?: string } } | undefined;
  const trackPoints = useFormValue(["trackPoints"]) as TrackPointItem[] | undefined;
  const [track, setTrack] = useState<RouteCoordinate[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [activeStopKey, setActiveStopKey] = useState<string>();
  const [albums, setAlbums] = useState<AlbumPreview[]>([]);
  const [albumId, setAlbumId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>();
  const [uploadError, setUploadError] = useState<string>();
  const mapElementRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const valueRef = useRef(props.value);
  const onChangeRef = useRef(props.onChange);
  valueRef.current = props.value;
  onChangeRef.current = props.onChange;

  useEffect(() => {
    const manualTrack = (trackPoints ?? []).flatMap((point) => validCoordinate(point.latitude, point.longitude) ? [[point.latitude, point.longitude] as RouteCoordinate] : []);
    const assetId = trackFile?.asset?._ref;
    if (!assetId) { setTrack(manualTrack); return undefined; }
    let active = true;
    setTrackLoading(true);
    void client.fetch<string | null>(`*[_id == $assetId][0].url`, { assetId })
      .then(async (url) => {
        if (!url) return manualTrack;
        const response = await fetch(url);
        return response.ok ? parseGpx(await response.text()) : manualTrack;
      })
      .then((nextTrack) => { if (active) setTrack(nextTrack.length >= 2 ? nextTrack : manualTrack); })
      .catch(() => { if (active) setTrack(manualTrack); })
      .finally(() => { if (active) setTrackLoading(false); });
    return () => { active = false; };
  }, [client, trackFile?.asset?._ref, JSON.stringify(trackPoints)]);

  const addStopAt = useCallback((trackIndex: number) => {
    if (readOnly) return;
    const next: StopItem = { _key: keyFor("stop"), _type: "object", title: "新标注点", localTitle: "", trackIndex, coordinate: track[trackIndex] ? { latitude: track[trackIndex][0], longitude: track[trackIndex][1] } : {} };
    onChangeRef.current(set([...(valueRef.current ?? []), next]));
    setActiveStopKey(next._key);
  }, [readOnly, track]);
  const addStop = useCallback(() => addStopAt(0), [addStopAt]);

  useEffect(() => {
    if (!activeStopKey) return undefined;
    let active = true;
    void client.fetch<AlbumPreview[]>(`*[_type == "album" && isVisible != false] | order(sortOrder asc, title asc){ _id, title, isVisible }`)
      .then((result) => { if (active) setAlbums(result); })
      .catch(() => { if (active) setAlbums([]); });
    return () => { active = false; };
  }, [activeStopKey, client]);

  const uploadPhotoAtActiveStop = useCallback(async (file: File) => {
    if (readOnly || !activeStopKey) return;
    const stop = (valueRef.current ?? []).find((item) => item._key === activeStopKey);
    if (!stop) return;
    setUploading(true);
    setUploadMessage(undefined);
    setUploadError(undefined);
    try {
      const gps = await exifr.gps(file).catch(() => undefined) as { latitude?: number; longitude?: number } | undefined;
      const gpsCoordinate = validCoordinate(gps?.latitude, gps?.longitude) ? [gps.latitude, gps.longitude] as RouteCoordinate : undefined;
      const clickedCoordinate = validCoordinate(stop.coordinate?.latitude, stop.coordinate?.longitude)
        ? [stop.coordinate.latitude, stop.coordinate.longitude] as RouteCoordinate
        : Number.isInteger(stop.trackIndex) && track.length ? track[Math.min(Math.max(0, stop.trackIndex as number), track.length - 1)] : undefined;
      const coordinate = gpsCoordinate ?? clickedCoordinate;
      if (!coordinate) throw new Error("当前标注点没有有效地图位置，请先点击路线设置位置。");
      const asset = await client.assets.upload("image", file, { filename: file.name, contentType: file.type || "image/jpeg" });
      const sourceFilename = file.name.trim() || "map-photo.jpg";
      const baseSlug = sourceFilename.replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "map-photo";
      const duplicateSlug = await client.fetch<number>(`count(*[_type == "photo" && slug.current == $slug])`, { slug: baseSlug });
      const slug = duplicateSlug ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
      const created = await client.create<{ _id: string }>({
        _type: "photo",
        title: sourceFilename.replace(/\.[^.]+$/, "") || "地图照片",
        slug: { _type: "slug", current: slug },
        image: { _type: "image", asset: { _type: "reference", _ref: asset._id } },
        altText: sourceFilename,
        sourceFilename,
        location: `${coordinate[0].toFixed(6)}, ${coordinate[1].toFixed(6)}`,
        isHidden: false,
        isHero: false,
        isFeatured: false,
        ...(albumId ? { album: { _type: "reference", _ref: albumId } } : {}),
      });
      const nextStops = (valueRef.current ?? []).map((item) => {
        if (item._key !== activeStopKey) return item;
        const nextPhoto = { _key: keyFor("photo", created._id), _type: "reference", _ref: created._id };
        const nextItem = { ...item, photos: [...(item.photos ?? []), nextPhoto] };
        if (gpsCoordinate) {
          const { trackIndex: _trackIndex, ...withoutTrackIndex } = nextItem;
          return { ...withoutTrackIndex, coordinate: { latitude: coordinate[0], longitude: coordinate[1] } };
        }
        return { ...nextItem, coordinate: { latitude: coordinate[0], longitude: coordinate[1] } };
      });
      onChangeRef.current(set(nextStops));
      setUploadMessage(gpsCoordinate ? "照片已上传；已读取照片 GPS，并将标注移动到照片位置。" : "照片已上传，并已放到你点击的路线位置。");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "照片上传失败，请重试。");
    } finally {
      setUploading(false);
    }
  }, [activeStopKey, albumId, client, readOnly, track]);

  useEffect(() => {
    const element = mapElementRef.current;
    if (!element || track.length < 2 || mapRef.current) return undefined;
    const map = L.map(element, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
    const routeLayer = L.polyline(track, { color: "#2563eb", weight: 5, opacity: 0.85 }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [24, 24] });
    routeLayer.on("click", (event: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event);
      addStopAt(nearestTrackIndex(track, [event.latlng.lat, event.latlng.lng]));
    });
    mapRef.current = map;
    routeLayerRef.current = routeLayer;
    markersLayerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      markersLayerRef.current = null;
    };
  }, [addStopAt, track]);

  useEffect(() => {
    const markers = markersLayerRef.current;
    if (!markers || !track.length) return;
    markers.clearLayers();
    (props.value ?? []).forEach((stop, index) => {
      const point = Number.isInteger(stop.trackIndex)
        ? track[Math.min(Math.max(0, stop.trackIndex as number), track.length - 1)]
        : validCoordinate(stop.coordinate?.latitude, stop.coordinate?.longitude) ? [stop.coordinate.latitude, stop.coordinate.longitude] as RouteCoordinate : undefined;
      if (!point) return;
      const marker = L.circleMarker(point, { radius: 8, color: "#fff", weight: 2, fillColor: "#b42318", fillOpacity: 1 }).bindTooltip(`${index + 1}. ${stop.title || "未命名标注点"}`);
      marker.on("click", () => setActiveStopKey(stop._key));
      marker.addTo(markers);
    });
  }, [props.value, track]);

  return (
    <div>
      <div style={{ marginBottom: 10, padding: 10, border: "1px solid #dcfce7", borderRadius: 7, background: "#f0fdf4", color: "#166534", fontSize: 12, lineHeight: 1.6 }}>
        点击下面地图上的路线即可新增标注点，系统会自动计算轨迹点索引。新增后展开标注点，填写名称并点击“添加照片”；照片会显示在刚才点击的位置。也可以手动填写轨迹点索引或经纬度。
      </div>
      {trackLoading ? <p style={{ margin: "0 0 10px", color: "#6b7280", fontSize: 12 }}>正在读取 GPX 路线…</p> : null}
      {track.length >= 2 ? <div style={{ position: "relative", marginBottom: 12, overflow: "hidden", border: "1px solid #cbd5e1", borderRadius: 8 }}>
        <div ref={mapElementRef} style={{ width: "100%", height: 320, background: "#e5eef5" }} />
        <div style={{ position: "absolute", left: 10, bottom: 10, zIndex: 500, padding: "5px 8px", borderRadius: 5, background: "rgba(255,255,255,.94)", color: "#334155", fontSize: 12, boxShadow: "0 1px 4px rgba(15,23,42,.18)" }}>点击蓝色路线添加标注点 · 已有标注点为红色</div>
      </div> : <p style={{ margin: "0 0 10px", padding: 10, border: "1px dashed #cbd5e1", borderRadius: 7, color: "#6b7280", fontSize: 12 }}>请先上传 GPX 文件，或在“手动轨迹点”中填写至少两个坐标，地图预览会显示在这里。</p>}
      {activeStopKey ? <div style={{ marginBottom: 12, padding: 12, border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff" }}>
        <strong style={{ display: "block", marginBottom: 6, color: "#1e3a8a", fontSize: 13 }}>给当前标注点上传照片</strong>
        <p style={{ margin: "0 0 10px", color: "#475569", fontSize: 12, lineHeight: 1.5 }}>照片有 GPS 时优先使用照片 GPS；没有 GPS 时使用你刚才点击的路线位置。</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={albumId} onChange={(event) => setAlbumId(event.currentTarget.value)} disabled={uploading || readOnly} style={{ minHeight: 36, minWidth: 180, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 5, background: "#fff" }}>
            <option value="">不指定相册</option>
            {albums.map((album) => <option key={album._id} value={album._id}>{album.title}</option>)}
          </select>
          <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={uploading || readOnly} style={{ minHeight: 36, padding: "0 12px", border: 0, borderRadius: 5, background: uploading || readOnly ? "#94a3b8" : "#2563eb", color: "#fff", cursor: uploading || readOnly ? "not-allowed" : "pointer", fontWeight: 700 }}>{uploading ? "正在上传…" : "选择图片并上传到此点"}</button>
          <input ref={uploadInputRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadPhotoAtActiveStop(file); }} />
        </div>
        {uploadMessage ? <p style={{ margin: "8px 0 0", color: "#166534", fontSize: 12 }}>{uploadMessage}</p> : null}
        {uploadError ? <p style={{ margin: "8px 0 0", color: "#b42318", fontSize: 12 }}>{uploadError}</p> : null}
      </div> : null}
      {readOnly ? <p style={{ margin: "0 0 10px", color: "#92400e", fontSize: 12 }}>当前是已发布只读视图，不能新增标注点。请打开不带 <code>?perspective=published</code> 的 Studio 地址进行编辑。</p> : <button type="button" onClick={addStop} style={{ minHeight: 38, marginBottom: 10, padding: "0 13px", border: 0, borderRadius: 5, background: "#166534", color: "#fff", cursor: "pointer", fontWeight: 700 }}>＋ 新增标注点</button>}
      {props.renderDefault(props)}
    </div>
  );
}

export function CollapsedTrackPointsInput(props: ArrayOfObjectsInputProps<TrackPointItem>) {
  const [expanded, setExpanded] = useState(false);
  const count = props.value?.length ?? 0;

  return (
    <div>
      <button type="button" onClick={() => setExpanded((value) => !value)} style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", minHeight: 42, padding: "0 10px", border: "1px solid #dfe3e8", borderRadius: 5, background: "#f7f8fa", color: "#3b4148", cursor: "pointer", fontSize: 13 }}>
        <span>手动轨迹点 · {count} 个坐标</span>
        <strong>{expanded ? "收起" : "展开"}</strong>
      </button>
      {expanded ? <div style={{ marginTop: 10 }}>{props.renderDefault(props)}</div> : <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 12 }}>轨迹点默认收起；上传 GPX 后通常不需要逐点编辑。</p>}
    </div>
  );
}
