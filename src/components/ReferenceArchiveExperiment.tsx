import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Grid2X2, List, Map, MoveRight } from "lucide-react";
import type { Photo } from "../data/photos";
import type { PhotoStory } from "../data/stories";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";

type ReferenceArchiveExperimentProps = {
  photos: Photo[];
  photoStories: Record<string, PhotoStory[]>;
  onOpen: (index: number, photos?: Photo[]) => void;
};

type Chapter = {
  title: string;
  label: string;
  description: string;
  photo?: Photo;
};

const chapterSeeds = [
  { title: "Land / weather", label: "Chapter 01", category: "山野", description: "Open distance, changing light, and the shape of a day outside." },
  { title: "Water / edge", label: "Chapter 02", category: "海洋", description: "Harbor light, shorelines, and the slower rhythm at the waterline." },
  { title: "Small distances", label: "Chapter 03", category: "石塘度假区", description: "An ongoing record of familiar places becoming unfamiliar again." },
];

function pickPhotos(photos: Photo[], count: number) {
  return photos.filter((photo, index, all) => all.findIndex((item) => item.id === photo.id) === index).slice(0, count);
}

function ArchivePhoto({ photo, index, photos, onOpen }: { photo: Photo; index: number; photos: Photo[]; onOpen: (index: number, photos?: Photo[]) => void }) {
  return (
    <button className="reference-archive__photo" type="button" onClick={() => onOpen(index, photos)}>
      <img
        src={sizedImageUrl(photo.src, 1200, 84)}
        srcSet={imageSrcSet(photo.src, [480, 800, 1200], 84)}
        sizes="(max-width: 720px) 50vw, 24vw"
        alt={photo.altText ?? photo.title}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
      />
      <span className="reference-archive__photo-caption">
        <span>{photo.title}</span>
        <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
      </span>
    </button>
  );
}

export function ReferenceArchiveExperiment({ photos, photoStories, onOpen }: ReferenceArchiveExperimentProps) {
  const [view, setView] = useState<"chapters" | "archive">("chapters");
  const archivePhotos = useMemo(() => pickPhotos(photos, 12), [photos]);
  const chapters = useMemo<Chapter[]>(
    () => chapterSeeds.map((seed) => ({ ...seed, photo: photos.find((photo) => photo.category === seed.category) ?? archivePhotos[0] })),
    [archivePhotos, photos],
  );
  const story = useMemo(() => {
    for (const [filename, entries] of Object.entries(photoStories)) {
      const photo = photos.find((item) => item.filename === filename);
      if (photo && entries[0]) return { photo, entry: entries[0] };
    }
    return undefined;
  }, [photoStories, photos]);

  return (
    <article className="reference-archive">
      <header className="reference-archive__hero">
        <div className="reference-archive__hero-top">
          <span className="reference-archive__eyebrow">Reference composition / open-source patterns</span>
          <a className="reference-archive__back" href="/experiments">Back to lab <ArrowUpRight aria-hidden="true" size={16} /></a>
        </div>
        <div className="reference-archive__hero-grid">
          <div>
            <p className="reference-archive__overline">Queenstown.top / field archive</p>
            <h1>A living archive of light, weather, and place.</h1>
          </div>
          <div className="reference-archive__hero-note">
            <p>Chapter-led navigation for a growing photography archive. Designed as a calmer alternative to a homepage that tries to show everything at once.</p>
            <a className="reference-archive__hero-link" href="#chapters">Explore the chapters <ArrowRight aria-hidden="true" size={18} /></a>
          </div>
        </div>
      </header>

      <div className="reference-archive__body">
        <aside className="reference-archive__rail" aria-label="Archive navigation">
          <div className="reference-archive__rail-brand">Q<span>.</span>top</div>
          <nav>
            <a className="is-current" href="#chapters"><span>01</span> Chapters</a>
            <a href="#archive"><span>02</span> Archive</a>
            <a href="#notes"><span>03</span> Notes</a>
          </nav>
          <div className="reference-archive__rail-foot">
            <span>{photos.length} photographs</span>
            <span>Queenstown / China</span>
          </div>
        </aside>

        <main className="reference-archive__content">
          <section className="reference-archive__section" id="chapters" aria-labelledby="chapters-title">
            <div className="reference-archive__section-head">
              <div>
                <p className="reference-archive__section-label">01 / Bodies of work</p>
                <h2 id="chapters-title">Start with a chapter.</h2>
              </div>
              <p className="reference-archive__section-intro">A small set of entry points keeps the archive readable while leaving room for the photographs to lead.</p>
            </div>
            <div className="reference-archive__chapters">
              {chapters.map((chapter, index) => (
                <article className="reference-archive__chapter" key={chapter.title}>
                  <button type="button" onClick={() => chapter.photo && onOpen(photos.indexOf(chapter.photo), photos)}>
                    {chapter.photo ? (
                      <img
                        src={sizedImageUrl(chapter.photo.src, 1500, 85)}
                        srcSet={imageSrcSet(chapter.photo.src, [640, 1000, 1500], 85)}
                        sizes="(max-width: 720px) 100vw, 34vw"
                        alt={chapter.photo.altText ?? chapter.photo.title}
                        width={chapter.photo.width}
                        height={chapter.photo.height}
                        loading={index === 0 ? "eager" : "lazy"}
                        decoding="async"
                      />
                    ) : null}
                    <span className="reference-archive__chapter-action">Open chapter <ArrowUpRight aria-hidden="true" size={17} /></span>
                  </button>
                  <div className="reference-archive__chapter-copy">
                    <span>{chapter.label}</span>
                    <h3>{chapter.title}</h3>
                    <p>{chapter.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="reference-archive__section reference-archive__section--archive" id="archive" aria-labelledby="archive-title">
            <div className="reference-archive__section-head">
              <div>
                <p className="reference-archive__section-label">02 / Contact sheet</p>
                <h2 id="archive-title">The full archive, at a glance.</h2>
              </div>
              <div className="reference-archive__view-toggle" aria-label="Choose archive preview">
                <button type="button" className={view === "chapters" ? "is-active" : ""} aria-pressed={view === "chapters"} onClick={() => setView("chapters")}><List aria-hidden="true" size={16} /> Chapters</button>
                <button type="button" className={view === "archive" ? "is-active" : ""} aria-pressed={view === "archive"} onClick={() => setView("archive")}><Grid2X2 aria-hidden="true" size={16} /> Grid</button>
              </div>
            </div>
            <div className={`reference-archive__grid reference-archive__grid--${view}`}>
              {archivePhotos.map((photo) => <ArchivePhoto key={photo.id} photo={photo} index={photos.indexOf(photo)} photos={photos} onOpen={onOpen} />)}
            </div>
            <a className="reference-archive__all-link" href="/photography">Open the complete photography archive <MoveRight aria-hidden="true" size={18} /></a>
          </section>

          <section className="reference-archive__note" id="notes" aria-labelledby="notes-title">
            <div className="reference-archive__note-image">
              {story?.photo ? <img src={sizedImageUrl(story.photo.src, 1200, 84)} alt={story.photo.altText ?? story.photo.title} width={story.photo.width} height={story.photo.height} loading="lazy" decoding="async" /> : <Map aria-hidden="true" size={32} />}
            </div>
            <div className="reference-archive__note-copy">
              <p className="reference-archive__section-label">03 / Field notes</p>
              <h2 id="notes-title">Photographs can carry a little context.</h2>
              <p>{story?.entry.excerpt ?? "A journal layer gives the archive a sense of time without turning every image into a caption."}</p>
              <a className="reference-archive__hero-link" href={story ? "/journal" : "/about"}>Read the notes <ArrowRight aria-hidden="true" size={18} /></a>
            </div>
          </section>
        </main>
      </div>
    </article>
  );
}
