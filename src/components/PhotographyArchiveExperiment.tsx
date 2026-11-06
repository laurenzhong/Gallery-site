import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Photo } from "../data/photos";
import type { PhotoStory } from "../data/stories";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";

type PhotographyArchiveExperimentProps = {
  photos: Photo[];
  photoStories: Record<string, PhotoStory[]>;
  onOpen: (index: number, photos?: Photo[]) => void;
};

type ArchiveChapter = {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  categories: string[];
};

const chapterSeeds: ArchiveChapter[] = [
  {
    id: "land-weather",
    number: "01",
    title: "Land / weather",
    subtitle: "Mountain air and changing light",
    description: "Open distance, weather moving across the frame, and the shape of a day outside.",
    categories: ["山野", "日出日落", "森林"],
  },
  {
    id: "water-edge",
    number: "02",
    title: "Water / edge",
    subtitle: "Shorelines and slower hours",
    description: "Harbor light, river surfaces, and the quiet interval between departure and return.",
    categories: ["海洋", "河流", "harbor", "Harbor"],
  },
  {
    id: "small-distances",
    number: "03",
    title: "Small distances",
    subtitle: "Familiar places, looked at again",
    description: "Architecture, flowers, and the small travel fragments that keep an archive close to home.",
    categories: ["石塘度假区", "建筑", "花朵"],
  },
];

function chapterPhotos(chapter: ArchiveChapter, photos: Photo[]) {
  return photos.filter((photo) => chapter.categories.includes(photo.category));
}

function firstStory(photos: Photo[], stories: Record<string, PhotoStory[]>) {
  for (const [filename, entries] of Object.entries(stories)) {
    const photo = photos.find((item) => item.filename === filename);
    if (photo && entries[0]) return { photo, entry: entries[0] };
  }
  return undefined;
}

export function PhotographyArchiveExperiment({ photos, photoStories, onOpen }: PhotographyArchiveExperimentProps) {
  const [activeChapter, setActiveChapter] = useState("all");
  const chapters = useMemo(
    () => chapterSeeds.map((chapter) => ({ ...chapter, photos: chapterPhotos(chapter, photos) })),
    [photos],
  );
  const archivePhotos = useMemo(() => {
    if (activeChapter === "all") return photos;
    const chapter = chapters.find((item) => item.id === activeChapter);
    return chapter ? chapter.photos : photos;
  }, [activeChapter, chapters, photos]);
  const story = useMemo(() => firstStory(photos, photoStories), [photos, photoStories]);

  const selectChapter = (id: string) => {
    setActiveChapter(id);
    window.requestAnimationFrame(() => document.getElementById("archive-contact-sheet")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <article className="photography-archive-demo">
      <header className="photography-archive-demo__hero">
        <div className="photography-archive-demo__topline">
          <span>Photography / archive study</span>
          <a href="/experiments">Back to lab <ArrowUpRight aria-hidden="true" size={15} /></a>
        </div>
        <div className="photography-archive-demo__hero-grid">
          <div>
            <p className="photography-archive-demo__eyebrow">Queenstown.top / {photos.length} photographs</p>
            <h1>Photographs, arranged as chapters.</h1>
          </div>
          <div className="photography-archive-demo__hero-note">
            <p>A quieter way into the archive: start with a small set of visual threads, then open the complete contact sheet when you want to look closer.</p>
            <a href="#chapters">Start with the chapters <ArrowRight aria-hidden="true" size={17} /></a>
          </div>
        </div>
        <div className="photography-archive-demo__stats" aria-label="Archive statistics">
          <span><strong>{photos.length}</strong> photographs</span>
          <span><strong>{chapters.length}</strong> chapters</span>
          <span>Updated archive / 2026</span>
        </div>
      </header>

      <div className="photography-archive-demo__body">
        <aside className="photography-archive-demo__rail" aria-label="Archive navigation">
          <span className="photography-archive-demo__rail-brand">Q<span>.</span>top</span>
          <nav>
            <a href="#chapters"><span>01</span> Chapters</a>
            <a href="#archive-contact-sheet"><span>02</span> Archive</a>
            <a href="#archive-notes"><span>03</span> Notes</a>
          </nav>
          <p>Photography is the long view. The chapters are only doors.</p>
        </aside>

        <div className="photography-archive-demo__content">
          <section className="photography-archive-demo__section" id="chapters" aria-labelledby="archive-chapters-title">
            <div className="photography-archive-demo__section-head">
              <div>
                <p className="photography-archive-demo__label">01 / Bodies of work</p>
                <h2 id="archive-chapters-title">Start with a chapter.</h2>
              </div>
              <p className="photography-archive-demo__section-intro">The folders disappear here. What remains are three ways of looking at the same changing place.</p>
            </div>
            <div className="photography-archive-demo__chapters">
              {chapters.map((chapter) => {
                const cover = chapter.photos[0] ?? photos[0];
                if (!cover) return null;
                return (
                  <article className={`photography-archive-demo__chapter${activeChapter === chapter.id ? " is-active" : ""}`} key={chapter.id}>
                    <button type="button" onClick={() => selectChapter(chapter.id)} aria-label={`Open ${chapter.title} chapter`}>
                      <img
                        src={sizedImageUrl(cover.src, 1400, 84)}
                        srcSet={imageSrcSet(cover.src, [640, 1000, 1400], 84)}
                        sizes="(max-width: 720px) 100vw, 33vw"
                        alt={cover.altText ?? cover.title}
                        width={cover.width}
                        height={cover.height}
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                      />
                      <span>View chapter <ArrowUpRight aria-hidden="true" size={16} /></span>
                    </button>
                    <div className="photography-archive-demo__chapter-copy">
                      <p><span>{chapter.number}</span> / {chapter.photos.length} frames</p>
                      <h3>{chapter.title}</h3>
                      <small>{chapter.subtitle}</small>
                      <p>{chapter.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="photography-archive-demo__section photography-archive-demo__section--archive" id="archive-contact-sheet" aria-labelledby="archive-contact-sheet-title">
            <div className="photography-archive-demo__section-head">
              <div>
                <p className="photography-archive-demo__label">02 / Contact sheet</p>
                <h2 id="archive-contact-sheet-title">The full archive, at a glance.</h2>
              </div>
              <div className="photography-archive-demo__filters" aria-label="Filter archive by chapter">
                <button type="button" className={activeChapter === "all" ? "is-active" : ""} aria-pressed={activeChapter === "all"} onClick={() => setActiveChapter("all")}>All <span>{photos.length}</span></button>
                {chapters.map((chapter) => <button type="button" className={activeChapter === chapter.id ? "is-active" : ""} aria-pressed={activeChapter === chapter.id} onClick={() => setActiveChapter(chapter.id)} key={chapter.id}>{chapter.number} <span>{chapter.photos.length}</span></button>)}
              </div>
            </div>
            <div className="photography-archive-demo__contact-sheet">
              {archivePhotos.map((photo, archiveIndex) => {
                const index = photos.findIndex((item) => item.id === photo.id);
                return (
                  <button type="button" key={photo.id} onClick={() => onOpen(index, archivePhotos)} aria-label={`Open ${photo.title}`}>
                    <img
                      src={sizedImageUrl(photo.src, 720, 82)}
                      srcSet={imageSrcSet(photo.src, [360, 560, 720], 82)}
                      sizes="(max-width: 640px) 50vw, (max-width: 1000px) 33vw, 24vw"
                      alt={photo.altText ?? photo.title}
                      width={photo.width}
                      height={photo.height}
                      loading={archiveIndex < 8 ? "eager" : "lazy"}
                      fetchPriority={archiveIndex < 4 ? "high" : "auto"}
                      decoding="async"
                    />
                    <span>{photo.title}<ArrowUpRight aria-hidden="true" size={14} /></span>
                  </button>
                );
              })}
            </div>
            <p className="photography-archive-demo__archive-note">Showing {archivePhotos.length} of {photos.length} photographs. Select a frame to continue in the lightbox.</p>
          </section>

          {story ? (
            <section className="photography-archive-demo__note" id="archive-notes" aria-labelledby="archive-notes-title">
              <div>
                <p className="photography-archive-demo__label">03 / Field note</p>
                <h2 id="archive-notes-title">A little context behind the frames.</h2>
                <p>{story.entry.excerpt}</p>
                <a href="/journal">Read the journal <ArrowRight aria-hidden="true" size={17} /></a>
              </div>
              <img src={sizedImageUrl(story.photo.src, 1000, 82)} srcSet={imageSrcSet(story.photo.src, [520, 800, 1000], 82)} sizes="(max-width: 720px) 100vw, 42vw" alt={story.photo.altText ?? story.photo.title} width={story.photo.width} height={story.photo.height} loading="lazy" decoding="async" />
            </section>
          ) : null}
        </div>
      </div>

      <footer className="photography-archive-demo__footer">
        <span>End of archive study</span>
        <a href="/photography">Return to Photography <ArrowUpRight aria-hidden="true" size={15} /></a>
      </footer>
    </article>
  );
}
