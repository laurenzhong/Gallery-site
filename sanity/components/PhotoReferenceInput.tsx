import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  getPublishedId,
  insert,
  PatchEvent,
  set,
  setIfMissing,
  unset,
  useClient,
  useFormValue,
  usePerspective,
  type ArrayInputFunctionsProps,
  type ArrayOfObjectsInputProps,
  type ReferenceInputProps,
} from "sanity";
import { photoConditionLabel, photoSubjectLabel } from "../photoTaxonomy";
import "./PhotoReferenceInput.css";

type Photo = {
  _id: string;
  _originalId?: string;
  _createdAt: string;
  title?: string;
  filename?: string;
  date?: string;
  sortOrder?: number;
  imageUrl?: string;
  width?: number;
  height?: number;
  isHidden?: boolean;
  categoryVisible?: boolean;
  album?: { _id: string; title: string };
  category?: { _id: string; title: string };
  subjects?: string[];
  conditions?: string[];
  location?: string;
  place?: string;
  spot?: string;
  published?: boolean;
};

const photosQuery = `*[_type == "photo"] {
  _id, _originalId, _createdAt, title, date, sortOrder, isHidden, subjects, conditions, location, spot,
  "filename": coalesce(sourceFilename, image.asset->originalFilename),
  "imageUrl": image.asset->url,
  "categoryVisible": category->isVisible,
  "width": coalesce(image.asset->metadata.dimensions.width, dimensions.width),
  "height": coalesce(image.asset->metadata.dimensions.height, dimensions.height),
  "place": place->title,
  album->{_id, title}, category->{_id, title}
}`;
const pageSize = 48;
const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
const orderings = {
  imported: { label: "最近导入", compare: (a: Photo, b: Photo) => b._createdAt.localeCompare(a._createdAt) },
  captured: { label: "拍摄日期（最新优先）", compare: (a: Photo, b: Photo) => (b.date ?? "").localeCompare(a.date ?? "") },
  sortOrder: { label: "排序值（从小到大）", compare: (a: Photo, b: Photo) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) },
  filename: { label: "文件名", compare: (a: Photo, b: Photo) => collator.compare(a.filename || "\uffff", b.filename || "\uffff") },
};
type Ordering = keyof typeof orderings;

function getOrientation(photo: Photo) {
  const { width, height } = photo;
  if (!width || !height) return "";
  if (width === height) return "方形";
  return width > height ? "横拍" : "竖拍";
}

function getOptions(photos: Photo[], field: "album" | "category") {
  const options = new Map<string, string>();
  for (const photo of photos) {
    const value = photo[field];
    if (value?.title) options.set(value._id, value.title);
  }
  return [...options].sort((a, b) => collator.compare(a[1], b[1]));
}

function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLowerCase();
}

function searchableText(photo: Photo) {
  const tags = [
    ...(photo.subjects ?? []).flatMap((tag) => [tag, photoSubjectLabel[tag]]),
    ...(photo.conditions ?? []).flatMap((tag) => [tag, photoConditionLabel[tag]]),
  ];
  return normalizeSearch([
    photo.title, photo.filename, photo.date, photo.album?.title, photo.category?.title,
    photo.place, photo.spot, photo.location, getOrientation(photo), ...tags,
  ].filter(Boolean).join(" "));
}

type PhotoPickerProps = {
  onSelect: (photos: Photo[]) => void;
  multiple?: boolean;
  currentIds?: string[];
  pagePhotos?: boolean;
};

function PhotoPicker({ onSelect, onDismiss, multiple, currentIds, pagePhotos }: PhotoPickerProps & { onDismiss: () => void }) {
  const client = useClient({ apiVersion: "2025-02-19" });
  const { perspectiveStack } = usePerspective();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [photos, setPhotos] = useState<Photo[]>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [album, setAlbum] = useState("");
  const [category, setCategory] = useState("");
  const [orientation, setOrientation] = useState("");
  const [ordering, setOrdering] = useState<Ordering>("imported");
  const [limit, setLimit] = useState(pageSize);
  const [selection, setSelection] = useState<Photo[]>([]);
  const current = new Set(currentIds);
  const pending = selection.filter((photo) => !current.has(photo._id));
  const selectedIds = new Set(pending.map((photo) => photo._id));

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    heading.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const load = async () => {
      const result = await client.fetch<Photo[]>(photosQuery, {}, { perspective: perspectiveStack, signal });
      const unpublishedCandidates = result.filter((photo) => photo._originalId && photo._originalId !== photo._id).map((photo) => photo._id);
      const published = new Set(unpublishedCandidates.length
        ? await client.fetch<string[]>(`*[_type == "photo" && _id in $ids]._id`, { ids: unpublishedCandidates }, { perspective: "published", signal })
        : []);
      if (!signal.aborted) {
        setPhotos(result.map((photo) => ({
          ...photo,
          published: !photo._originalId || photo._originalId === photo._id || published.has(photo._id),
        })));
      }
    };
    void load().catch(() => { if (!signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt, client, perspectiveStack]);

  const options = useMemo(() => ({
    albums: getOptions(photos ?? [], "album"),
    categories: getOptions(photos ?? [], "category"),
  }), [photos]);
  const indexedPhotos = useMemo(() => (photos ?? []).map((photo) => ({ photo, text: searchableText(photo) })), [photos]);
  const results = useMemo(() => {
    const terms = normalizeSearch(search).trim().split(/\s+/).filter(Boolean);
    return indexedPhotos
      .filter(({ photo, text }) =>
        (!album || photo.album?._id === album) &&
        (!category || photo.category?._id === category) &&
        (!orientation || getOrientation(photo) === orientation) &&
        terms.every((term) => text.includes(term)),
      )
      .map(({ photo }) => photo)
      .sort((a, b) => orderings[ordering].compare(a, b) || orderings.imported.compare(a, b) || a._id.localeCompare(b._id));
  }, [album, category, indexedPhotos, ordering, orientation, search]);

  const choosePhoto = (photo: Photo) => {
    if (!multiple) {
      onSelect([photo]);
      return;
    }
    setSelection((previous) => previous.some((item) => item._id === photo._id)
      ? previous.filter((item) => item._id !== photo._id)
      : [...previous, photo]);
  };

  return (
    <dialog
      className="photo-reference-dialog"
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); dialog.current?.close(); }}
      onClose={onDismiss}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        if (event.nativeEvent.isComposing) return;
        event.preventDefault();
        dialog.current?.close();
      }}
    >
      <div className="photo-reference-dialog__header">
        <h2 id={titleId} ref={heading} tabIndex={-1}>从照片库选图</h2>
        <button className="photo-reference-button" type="button" onClick={() => dialog.current?.close()}>关闭</button>
      </div>
      <div className="photo-reference-dialog__filters" onChange={() => {
        setLimit(pageSize);
        if (scrollArea.current) scrollArea.current.scrollTop = 0;
      }}>
        <label className="photo-reference-dialog__search">
          搜索照片
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="标题、文件名、地点、日期或标签" />
        </label>
        <label>
          相册
          <select value={album} onChange={(event) => setAlbum(event.target.value)}>
            <option value="">全部相册</option>
            {options.albums.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </label>
        <label>
          分类
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">全部分类</option>
            {options.categories.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </label>
        <label>
          横竖幅
          <select value={orientation} onChange={(event) => setOrientation(event.target.value)}>
            <option value="">全部比例</option>
            <option>横拍</option>
            <option>竖拍</option>
            <option>方形</option>
          </select>
        </label>
        <label>
          排序
          <select value={ordering} onChange={(event) => setOrdering(event.target.value as Ordering)}>
            {Object.entries(orderings).map(([id, { label }]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="photo-reference-dialog__results" ref={scrollArea}>
        <p className="photo-reference-dialog__status" role="status">
          {error ? "读取照片失败。" : !photos ? "正在读取照片…" : !results.length ? "没有符合条件的照片。" : `显示 ${Math.min(limit, results.length)} / ${results.length} 张照片`}
        </p>
        {error && <button className="photo-reference-button" type="button" onClick={() => { setError(false); setAttempt((value) => value + 1); }}>重试</button>}
        <div className="photo-reference-dialog__grid">
          {results.slice(0, limit).map((photo) => {
            const existing = current.has(photo._id);
            const selected = selectedIds.has(photo._id);
            const title = photo.title || photo.filename || "未命名照片";
            const hidden = photo.isHidden || photo.categoryVisible === false;
            const unavailable = pagePhotos && (hidden || !photo.imageUrl);
            const status = hidden ? "已隐藏" : !photo.imageUrl ? "缺少图片" : existing ? (multiple ? "已添加" : "当前照片") : selected ? "已选" : !photo.published ? "未发布" : "";
            return (
              <button
                className="photo-reference-card"
                key={photo._id}
                type="button"
                disabled={existing || unavailable}
                aria-pressed={multiple ? existing || selected : undefined}
                onClick={() => choosePhoto(photo)}
              >
                <span className="photo-reference-card__image">
                  {photo.imageUrl
                    ? <img src={`${photo.imageUrl}?w=400&h=320&fit=max&q=75&auto=format`} alt="" loading="lazy" />
                    : <span>暂无缩略图</span>}
                  {status && <span className="photo-reference-card__status">{status}</span>}
                </span>
                <span className="photo-reference-card__title" title={title}>{title}</span>
                <span className="photo-reference-card__detail">
                  <span title={photo.filename}>{photo.filename === title ? "" : photo.filename}</span>
                  {photo.date && <time dateTime={photo.date}>{photo.date}</time>}
                </span>
              </button>
            );
          })}
        </div>
        {limit < results.length && (
          <button className="photo-reference-button photo-reference-dialog__more" type="button" onClick={() => setLimit((value) => value + pageSize)}>加载更多</button>
        )}
      </div>
      {multiple && (
        <div className="photo-reference-dialog__footer">
          <span role="status">已选 {pending.length} 张</span>
          <button className="photo-reference-button photo-reference-button--primary" type="button" disabled={!pending.length} onClick={() => onSelect(pending)}>
            添加照片
          </button>
        </div>
      )}
    </dialog>
  );
}

function PhotoPickerButton({ label, onSelect, ...pickerProps }: PhotoPickerProps & { label: string }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const dismiss = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  return (
    <>
      <button className="photo-reference-button photo-reference-button--browse" ref={trigger} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <PhotoPicker {...pickerProps} onDismiss={dismiss} onSelect={(photos) => {
          dismiss();
          onSelect(photos);
        }} />
      )}
    </>
  );
}

function referenceData(photo: Photo, type: string, weak: boolean) {
  return {
    _type: type,
    _ref: getPublishedId(photo._id),
    ...((weak || !photo.published) && { _weak: true }),
    ...(!photo.published && { _strengthenOnPublish: { type: "photo", weak } }),
  };
}

export function PhotoReferenceInput(props: ReferenceInputProps) {
  const current = props.value?._ref;
  const pagePhotos = useFormValue(["_type"]) === "pageContent";
  return (
    <>
      {!props.readOnly && (
        <PhotoPickerButton
          label={current ? "从照片库更换" : "从照片库选图"}
          currentIds={current ? [getPublishedId(current)] : []}
          pagePhotos={pagePhotos}
          onSelect={([photo]) => {
            const reference = referenceData(photo, props.schemaType.name, Boolean(props.schemaType.weak));
            props.onChange([
              setIfMissing({}),
              set(reference._type, ["_type"]),
              set(reference._ref, ["_ref"]),
              reference._weak ? set(true, ["_weak"]) : unset(["_weak"]),
              reference._strengthenOnPublish
                ? set(reference._strengthenOnPublish, ["_strengthenOnPublish"])
                : unset(["_strengthenOnPublish"]),
            ]);
          }}
        />
      )}
      {props.renderDefault(props)}
    </>
  );
}

type PhotoReferenceItem = { _key: string; _ref?: string };

function PhotoArrayFunctions(props: ArrayInputFunctionsProps<PhotoReferenceItem, ArrayOfObjectsInputProps["schemaType"]>) {
  const pagePhotos = useFormValue(["_type"]) === "pageContent";
  const member = props.schemaType.of[0];
  if (props.readOnly || !member || !("to" in member) || props.schemaType.options?.disableActions?.includes("add")) return null;
  const currentIds = (props.value ?? []).flatMap((item) => item._ref ? [getPublishedId(item._ref)] : []);
  return (
    <PhotoPickerButton
      label="从照片库添加"
      multiple
      currentIds={currentIds}
      pagePhotos={pagePhotos}
      onSelect={(photos) => {
        const items = photos.map((photo) => ({
          ...referenceData(photo, member.name, "weak" in member && member.weak === true),
          _key: crypto.randomUUID(),
        }));
        props.onChange(PatchEvent.from([setIfMissing([]), insert(items, "after", [-1])]));
      }}
    />
  );
}

export function PhotoArrayInput(props: ArrayOfObjectsInputProps<PhotoReferenceItem>) {
  return props.renderDefault({ ...props, arrayFunctions: PhotoArrayFunctions });
}
