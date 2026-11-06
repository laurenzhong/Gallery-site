import { useMemo, useState } from "react";
import type { Photo } from "../data/photos";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";

type SashaKurmazExperimentProps = {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
};

type ArchiveFilter = {
  label: string;
  categories: string[];
};

const filters: ArchiveFilter[] = [
  { label: "All works", categories: [] },
  { label: "Landscape", categories: ["山野", "日出日落", "森林", "河流", "海洋", "harbor"] },
  { label: "Place", categories: ["建筑", "石塘度假区"] },
  { label: "Details", categories: ["花朵"] },
];

const notes = [
  "A changing place, held still for a moment.",
  "Light, distance, and the traces people leave behind.",
  "Small details from the edge of a day.",
  "A field note from the archive.",
];

function displayCategory(category: string) {
  if (category === "石塘度假区") return "Shitang / place";
  if (category === "日出日落") return "Light / weather";
  if (category === "山野") return "Land / weather";
  if (category === "harbor") return "Harbor / water";
  return category;
}

export function SashaKurmazExperiment({ photos, onOpen }: SashaKurmazExperimentProps) {
  const [activeFilter, setActiveFilter] = useState("All works");
  const currentFilter = filters.find((filter) => filter.label === activeFilter) ?? filters[0];
  const visiblePhotos = useMemo(
    () => currentFilter.categories.length === 0
      ? photos
      : photos.filter((photo) => currentFilter.categories.includes(photo.category)),
    [currentFilter.categories, photos],
  );

  return (
    <article className="sasha-kurmaz-demo">
      <div className="sasha-kurmaz-demo__topbar">
        <nav className="sasha-kurmaz-demo__nav" aria-label="Prototype navigation">
          <a href="#archive">Archive</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="sasha-kurmaz-demo__wordmark" href="#top" aria-label="Queenstown.top home">Queenstown.top</a>
        <a className="sasha-kurmaz-demo__back" href="/experiments">Lab <span aria-hidden="true">↗</span></a>
      </div>

      <header className="sasha-kurmaz-demo__intro" id="top">
        <p className="sasha-kurmaz-demo__micro">Photography / index study / 2026</p>
        <h1>Images as an ongoing<br /><em>field note.</em></h1>
        <p className="sasha-kurmaz-demo__lede">
          A loose, image-first index for landscapes, places, and the small fragments that stay with us.
        </p>
        <div className="sasha-kurmaz-demo__intro-meta">
          <span>{photos.length} works</span>
          <span>Queenstown.top archive</span>
          <a href="#archive">View the index <span aria-hidden="true">↓</span></a>
        </div>
      </header>

      <section className="sasha-kurmaz-demo__archive" id="archive" aria-labelledby="sasha-archive-title">
        <div className="sasha-kurmaz-demo__archive-head">
          <div>
            <p className="sasha-kurmaz-demo__micro">Selected works / {visiblePhotos.length}</p>
            <h2 id="sasha-archive-title">The archive</h2>
          </div>
          <div className="sasha-kurmaz-demo__filters" aria-label="Filter works">
            {filters.map((filter) => (
              <button
                type="button"
                key={filter.label}
                className={activeFilter === filter.label ? "is-active" : ""}
                aria-pressed={activeFilter === filter.label}
                onClick={() => setActiveFilter(filter.label)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sasha-kurmaz-demo__masonry">
          {visiblePhotos.map((photo, index) => {
            const originalIndex = photos.findIndex((item) => item.id === photo.id);
            return (
              <figure className="sasha-kurmaz-demo__item" key={photo.id}>
                <button
                  type="button"
                  onClick={() => onOpen(originalIndex, visiblePhotos)}
                  aria-label={`Open ${photo.title}`}
                >
                  <img
                    src={sizedImageUrl(photo.src, 1200, 84)}
                    srcSet={imageSrcSet(photo.src, [480, 760, 1200], 84)}
                    sizes="(max-width: 720px) 100vw, 50vw"
                    alt={photo.altText ?? `${displayCategory(photo.category)} / ${photo.title}`}
                    width={photo.width}
                    height={photo.height}
                    loading={index < 4 ? "eager" : "lazy"}
                    fetchPriority={index < 2 ? "high" : "auto"}
                    decoding="async"
                  />
                  <span className="sasha-kurmaz-demo__open" aria-hidden="true">Open ↗</span>
                </button>
                <figcaption>
                  <div>
                    <strong>{photo.title}</strong>
                    <span>{displayCategory(photo.category)}</span>
                  </div>
                  <p>{notes[index % notes.length]}</p>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      <section className="sasha-kurmaz-demo__statement" id="about" aria-labelledby="sasha-about-title">
        <p className="sasha-kurmaz-demo__micro">About this study</p>
        <h2 id="sasha-about-title">The index is the experience.</h2>
        <p>Inspired by Sasha Kurmaz&apos;s open archive: a quiet surface, a fixed name, and enough room for each image to arrive on its own terms.</p>
      </section>

      <footer className="sasha-kurmaz-demo__footer" id="contact">
        <span>Queenstown.top / Photography study</span>
        <a href="mailto:3552219514@qq.com">Get in touch <span aria-hidden="true">↗</span></a>
      </footer>
    </article>
  );
}
