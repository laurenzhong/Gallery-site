import { useMemo, useState, type CSSProperties } from "react";
import { ArrowUpRight, ChevronRight, Folder, Globe2, Tag } from "lucide-react";
import type { Photo } from "../data/photos";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";

type AgarunAtlasExperimentProps = {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
};

type AtlasAlbum = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  type: "place" | "study";
  color: string;
  x: number;
  y: number;
  photos: Photo[];
};

const albumSeeds = [
  { title: "Mountain weather", subtitle: "山野", category: "山野", type: "place" as const, color: "#b9e4d0", x: 26, y: 30 },
  { title: "Forest edges", subtitle: "森林", category: "森林", type: "place" as const, color: "#91b9d7", x: 44, y: 21 },
  { title: "River notes", subtitle: "河流", category: "河流", type: "place" as const, color: "#dfb78b", x: 64, y: 35 },
  { title: "Harbor light", subtitle: "harbor", category: "harbor", type: "place" as const, color: "#e7afc4", x: 75, y: 57 },
  { title: "Stone and shelter", subtitle: "建筑", category: "建筑", type: "study" as const, color: "#d9d4a4", x: 52, y: 66 },
  { title: "Quiet color", subtitle: "花朵", category: "花朵", type: "study" as const, color: "#d8b7e3", x: 30, y: 70 },
];

function createAlbums(photos: Photo[]) {
  return albumSeeds.map((seed): AtlasAlbum => ({
    ...seed,
    id: seed.category.toLowerCase(),
    photos: photos.filter((photo) => photo.category === seed.category),
  })).filter((album) => album.photos.length > 0);
}

export function AgarunAtlasExperiment({ photos, onOpen }: AgarunAtlasExperimentProps) {
  const albums = useMemo(() => createAlbums(photos), [photos]);
  const [activeId, setActiveId] = useState(albums[0]?.id ?? "");
  const [filter, setFilter] = useState<"all" | "place" | "study">("all");
  const activeAlbum = albums.find((album) => album.id === activeId) ?? albums[0];
  const visibleAlbums = albums.filter((album) => filter === "all" || album.type === filter);
  const totalImages = albums.reduce((sum, album) => sum + album.photos.length, 0);

  const selectAlbum = (album: AtlasAlbum) => setActiveId(album.id);

  return (
    <article className="atlas-experiment">
      <header className="atlas-header">
        <div className="atlas-header__brand"><Globe2 aria-hidden="true" size={22} strokeWidth={1.5} /><span>Q.top / atlas</span></div>
        <a className="atlas-header__back" href="/experiments">Back to lab <ArrowUpRight aria-hidden="true" size={16} /></a>
      </header>

      <div className="atlas-shell">
        <aside className="atlas-intro">
          <p className="atlas-kicker">A location-led archive experiment</p>
          <h1>Photographs,<br /><em>in orbit.</em></h1>
          <p className="atlas-intro__body">A lightweight interpretation of the albums, folders, tags, and globe model used by photos.agarun.com.</p>
          <div className="atlas-stats">
            <span><strong>{totalImages}</strong> frames</span>
            <span><strong>{albums.length}</strong> collections</span>
            <span><strong>{new Set(photos.map((photo) => photo.category)).size}</strong> categories</span>
          </div>
          <div className="atlas-legend"><span className="atlas-legend__dot atlas-legend__dot--place" /> Place collection <span className="atlas-legend__dot atlas-legend__dot--study" /> Visual study</div>
        </aside>

        <section className="atlas-stage" aria-labelledby="atlas-stage-title">
          <div className="atlas-stage__topline">
            <span id="atlas-stage-title">Interactive atlas</span>
            <span>Prototype coordinates / {visibleAlbums.length} visible</span>
          </div>
          <div className="atlas-orbit" aria-label="Interactive collection atlas">
            <div className="atlas-orbit__ring atlas-orbit__ring--outer" />
            <div className="atlas-orbit__ring atlas-orbit__ring--inner" />
            <div className="atlas-orbit__glow" />
            <svg className="atlas-orbit__lines" viewBox="0 0 100 100" aria-hidden="true">
              <path d="M 22 71 C 28 41, 40 19, 74 28 S 83 72, 51 80 S 27 56, 22 71" />
              <path d="M 13 51 C 32 31, 57 25, 85 51 S 55 81, 13 51" />
              <path d="M 24 28 C 39 48, 53 65, 77 73" />
            </svg>
            <div className="atlas-orbit__core"><span>Q</span><small>archive</small></div>
            {albums.map((album) => (
              <button
                className={`atlas-marker atlas-marker--${album.type}${activeAlbum?.id === album.id ? " is-active" : ""}`}
                key={album.id}
                type="button"
                style={{ left: `${album.x}%`, top: `${album.y}%`, "--marker-color": album.color } as CSSProperties}
                aria-label={`Open ${album.title} collection`}
                aria-pressed={activeAlbum?.id === album.id}
                onClick={() => selectAlbum(album)}
              >
                <span className="atlas-marker__dot" />
                <span className="atlas-marker__label">{album.title}</span>
              </button>
            ))}
            {activeAlbum?.photos[0] ? (
              <button className="atlas-orbit__preview" type="button" onClick={() => onOpen(photos.indexOf(activeAlbum.photos[0]), photos)}>
                <img
                  src={sizedImageUrl(activeAlbum.photos[0].src, 540, 80)}
                  srcSet={imageSrcSet(activeAlbum.photos[0].src, [240, 360, 540], 80)}
                  sizes="56px"
                  alt=""
                  width={activeAlbum.photos[0].width}
                  height={activeAlbum.photos[0].height}
                />
                <span>{activeAlbum.title} / {activeAlbum.photos.length} frames</span>
              </button>
            ) : null}
          </div>
          <p className="atlas-stage__hint">Select a point to change the collection preview. The image remains the destination.</p>
        </section>

        <section className="atlas-collections" aria-labelledby="collections-title">
          <div className="atlas-collections__header">
            <div>
              <p className="atlas-kicker">Browse by collection</p>
              <h2 id="collections-title">Albums</h2>
            </div>
            <div className="atlas-filters" aria-label="Filter collections">
              <button type="button" className={filter === "all" ? "is-active" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
              <button type="button" className={filter === "place" ? "is-active" : ""} aria-pressed={filter === "place"} onClick={() => setFilter("place")}><Folder aria-hidden="true" size={14} /> Places</button>
              <button type="button" className={filter === "study" ? "is-active" : ""} aria-pressed={filter === "study"} onClick={() => setFilter("study")}><Tag aria-hidden="true" size={14} /> Studies</button>
            </div>
          </div>
          <div className="atlas-collection-list">
            {visibleAlbums.map((album) => {
              const photo = album.photos[0];
              return (
                <button className={`atlas-collection${activeAlbum?.id === album.id ? " is-active" : ""}`} type="button" key={album.id} onClick={() => selectAlbum(album)}>
                  <span className="atlas-collection__number">{String(albums.indexOf(album) + 1).padStart(2, "0")}</span>
                  <span className="atlas-collection__thumb"><img src={sizedImageUrl(photo.src, 360, 80)} alt="" width={photo.width} height={photo.height} loading="lazy" /></span>
                  <span className="atlas-collection__copy"><strong>{album.title}</strong><small>{album.subtitle} / {album.photos.length} frames</small></span>
                  <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
                </button>
              );
            })}
          </div>
          <a className="atlas-open-link" href="/photography">Open complete archive <ArrowUpRight aria-hidden="true" size={16} /></a>
        </section>
      </div>
    </article>
  );
}
