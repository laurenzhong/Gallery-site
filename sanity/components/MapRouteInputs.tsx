import { useEffect, useState } from "react";
import { useClient, type ArrayOfObjectsInputProps } from "sanity";

type ReferenceItem = { _key: string; _ref?: string; _type?: string };
type TrackPointItem = { _key: string; latitude?: number; longitude?: number; elevationM?: number };
type PhotoPreview = { _id: string; title?: string; imageUrl?: string; filename?: string };

export function MapRoutePhotosInput(props: ArrayOfObjectsInputProps<ReferenceItem>) {
  const client = useClient({ apiVersion: "2025-02-19" });
  const ids = (props.value ?? []).map((item) => item._ref).filter((id): id is string => Boolean(id));
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);

  useEffect(() => {
    let active = true;
    if (!ids.length) {
      setPhotos([]);
      return undefined;
    }
    void client.fetch<PhotoPreview[]>(`*[_type == "photo" && _id in $ids]{ _id, title, sourceFilename, "imageUrl": image.asset->url }`, { ids })
      .then((result) => {
        if (active) setPhotos(result);
      })
      .catch(() => {
        if (active) setPhotos([]);
      });
    return () => {
      active = false;
    };
  }, [client, ids.join("|")]);

  return (
    <div>
      {photos.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 10, marginBottom: 12 }}>
          {photos.map((photo) => (
            <figure key={photo._id} style={{ margin: 0, overflow: "hidden", border: "1px solid #dfe3e8", borderRadius: 6, background: "#f7f8fa" }}>
              {photo.imageUrl ? <img src={`${photo.imageUrl}?w=320&q=75&auto=format`} alt="" style={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover" }} /> : <div style={{ aspectRatio: "4 / 3" }} />}
              <figcaption style={{ padding: "6px 7px", overflow: "hidden", fontSize: 11, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.title || photo.filename || "未命名照片"}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
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
