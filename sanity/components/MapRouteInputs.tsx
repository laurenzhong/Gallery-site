import { useEffect, useMemo, useState } from "react";
import { set, useClient, type ArrayOfObjectsInputProps } from "sanity";

type ReferenceItem = { _key: string; _ref?: string; _type?: string };
type TrackPointItem = { _key: string; latitude?: number; longitude?: number; elevationM?: number };
type StopItem = {
  _key: string;
  _type?: string;
  title?: string;
  localTitle?: string;
  trackIndex?: number;
  coordinate?: { latitude?: number; longitude?: number };
};
type PhotoPreview = { _id: string; title?: string; imageUrl?: string; filename?: string; album?: { _id: string; title: string } };
type AlbumPreview = { _id: string; title: string; isVisible?: boolean };

function keyFor(prefix: string, id = "item") {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${random}`;
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = `*[_type == "photo" && (_id in $selectedIds || (($albumId == "" || album._ref == $albumId) && (title match $search || sourceFilename match $search)))] | order(_updatedAt desc)[0...240]{ _id, title, sourceFilename, album->{_id, title}, "imageUrl": image.asset->url }`;
    void Promise.all([
      client.fetch<PhotoPreview[]>(query, { selectedIds, albumId: selectedAlbumId, search: search.trim() ? `${search.trim()}*` : "*" }),
      client.fetch<AlbumPreview[]>(`*[_type == "album" && isVisible != false] | order(sortOrder asc, title asc){ _id, title, isVisible }`),
    ])
      .then(([result, albumResult]) => { if (active) { setPhotos(result); setAlbums(albumResult); } })
      .catch(() => { if (active) setPhotos([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, selectedIds.join("|"), search, selectedAlbumId]);

  const selected = selectedIds.map((id) => photos.find((photo) => photo._id === id)).filter((photo): photo is PhotoPreview => Boolean(photo));
  const togglePhoto = (id: string) => {
    const current = props.value ?? [];
    const exists = current.some((item) => item._ref === id);
    const next = exists
      ? current.filter((item) => item._ref !== id)
      : [...current, { _key: keyFor("photo", id), _type: "reference", _ref: id }];
    props.onChange(set(next));
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
          <select value={selectedAlbumId} onChange={(event) => setSelectedAlbumId(event.currentTarget.value)} style={{ boxSizing: "border-box", width: "100%", minHeight: 38, marginBottom: 10, padding: "0 9px", border: "1px solid #cbd5e1", borderRadius: 5, background: "#fff" }}>
            <option value="">全部相册</option>
            {albums.map((album) => <option key={album._id} value={album._id}>{album.title}</option>)}
          </select>
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
  const readOnly = Boolean(props.readOnly);
  const addStop = () => {
    const next: StopItem = { _key: keyFor("stop"), _type: "object", title: "新标注点", localTitle: "", trackIndex: 0, coordinate: {} };
    props.onChange(set([...(props.value ?? []), next]));
  };

  return (
    <div>
      <div style={{ marginBottom: 10, padding: 10, border: "1px solid #dcfce7", borderRadius: 7, background: "#f0fdf4", color: "#166534", fontSize: 12, lineHeight: 1.6 }}>
        添加流程：点击“新增标注点” → 填名称 → 填“轨迹点索引”。轨迹点索引从 <strong>0</strong> 开始，系统会自动把标注和关联照片放到 GPX 路线对应位置；有精确经纬度时也可以直接填写坐标。
      </div>
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
