import { useMemo, useState } from "react";
import type { Photo } from "../data/photos";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";

type MetroExperimentProps = {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
};

const lineNames = ["Lake line", "Ridge line", "Harbor line", "Forest line", "Garden line", "Night line"];

export function MetroExperiment({ photos, onOpen }: MetroExperimentProps) {
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const stations = useMemo(() => photos.slice(0, 18), [photos]);

  return (
    <article className="experiment-page metro-experiment">
      <header className="metro-header">
        <div className="metro-header__mark" aria-hidden="true">✦</div>
        <div className="metro-header__copy">
          <p className="experiment-kicker">Archive study / visual index</p>
          <h1>Queenstown<br />in motion</h1>
          <p>A documentation of places, weather, and the small transfers between one photograph and the next.</p>
        </div>
        <a className="experiment-back" href="/experiments">Back to lab <span aria-hidden="true">↗</span></a>
      </header>

      <div className="metro-toolbar">
        <span>Photography archive / {stations.length} frames</span>
        <div className="metro-toolbar__actions" aria-label="Choose archive layout">
          <button type="button" className={layout === "list" ? "is-active" : ""} onClick={() => setLayout("list")}>List</button>
          <button type="button" className={layout === "grid" ? "is-active" : ""} onClick={() => setLayout("grid")}>Grid</button>
        </div>
      </div>

      <div className={`metro-archive metro-archive--${layout}`}>
        {stations.map((photo, index) => (
          <button className="metro-item" key={photo.id} type="button" onClick={() => onOpen(photos.indexOf(photo), photos)}>
            <span className="metro-item__index">{String(index + 1).padStart(2, "0")}</span>
            <span className="metro-item__image">
              <img
                src={sizedImageUrl(photo.src, 1200, 82)}
                srcSet={imageSrcSet(photo.src, [480, 800, 1200], 82)}
                sizes={layout === "grid" ? "(max-width: 720px) 50vw, 30vw" : "180px"}
                alt={photo.altText ?? photo.title}
                width={photo.width}
                height={photo.height}
                loading={index < 4 ? "eager" : "lazy"}
                decoding="async"
              />
            </span>
            <span className="metro-item__name">{lineNames[index % lineNames.length]}</span>
            <span className="metro-item__title">{photo.title}</span>
            <span className="metro-item__category">{photo.category}</span>
            <span className="metro-item__arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </div>

      <footer className="metro-footer">
        <span>Prototype behavior</span>
        <p>The list is for orientation. The grid is for browsing. The image remains the primary destination in both.</p>
      </footer>
    </article>
  );
}
