import { useEffect, useMemo, useRef } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import CanvasMap from "../lib/lookbut/canvas-map";
import type { Photo } from "../data/photos";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";

type LookButNoStoppingExperimentProps = {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
  mapSrc?: string;
  mapCredit?: { label: string; href: string };
};

type LookButChapter = {
  photo: Photo;
  date: string;
  title: string;
  place: string;
  copy: string;
};

const chapterText = [
  ["Field note 01", "Lantau / first light", "A route begins before it has a name. The first frame is only a reason to keep walking.", "山野"],
  ["Field note 02", "Central / above the water", "The horizon opens slowly. Weather, distance, and the quiet between two steps become part of the image.", "森林"],
  ["Field note 03", "Kowloon / changing weather", "The archive follows the change rather than the destination: a softer sky, a darker road, a new direction.", "日出日落"],
  ["Field note 04", "Sha Tin / waterline", "At the edge of the water, the same landscape keeps revising itself. Waiting is part of the photograph.", "河流"],
  ["Field note 05", "Sai Kung / no stopping", "The view is familiar only for a moment. Keep moving and it becomes something else again.", "海洋"],
  ["Field note 06", "Tai Po / the long way back", "Every return leaves a different trace. A journey is measured by the details that stay with you.", "harbor"],
  ["Field note 07", "Tuen Mun / after light", "The last image is not an ending. It is the point where another walk begins.", "建筑"],
] as const;

function buildChapters(photos: Photo[]) {
  const preferred = chapterText.map(([, , , category]) => photos.find((photo) => photo.category === category));
  const fallback = photos.filter((photo) => !preferred.some((item) => item?.id === photo.id));
  return chapterText.map((copy, index): LookButChapter | null => {
    const photo = preferred[index] ?? fallback[index] ?? photos[index];
    if (!photo) return null;
    return { date: copy[0], title: copy[1], copy: copy[2], place: copy[3], photo };
  }).filter((chapter): chapter is LookButChapter => Boolean(chapter));
}

/**
 * This page mounts the MIT-licensed newfoundland canvas-map implementation
 * from `src/lib/lookbut`, while supplying local story data.
 */
export function LookButNoStoppingExperiment({ photos, onOpen, mapSrc = "/lookbut-map.svg", mapCredit }: LookButNoStoppingExperimentProps) {
  const chapters = useMemo(() => buildChapters(photos), [photos]);
  const storyRef = useRef<HTMLElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!storyRef.current || !canvasHostRef.current || chapters.length === 0) return undefined;

    const map = CanvasMap({
      textContainer: storyRef.current,
      mapSrc,
      trailVisitedColor: "#b6424b",
      trailVisitedWidth: 6,
      trailColor: "rgba(64, 91, 84, 0.34)",
      pointPresentColor: "#b6424b",
      fontPresentColor: "#405b54",
      fontPastColor: "#8d8a80",
      fontFutureColor: "#b4afa4",
    });

    map.appendTo(canvasHostRef.current);
    return () => map.destroy?.();
  }, [chapters.length, mapSrc]);

  if (!chapters.length) return null;

  return (
    <article className="lookbut-experiment">
      <section className="lookbut-parallax" aria-label="Layered landscape introduction">
        <div className="lookbut-parallax__layers" aria-hidden="true">
          {chapters.map((chapter, index) => (
            <img
              key={chapter.photo.id}
              src={sizedImageUrl(chapter.photo.src, 1800, 78)}
              srcSet={imageSrcSet(chapter.photo.src, [900, 1400, 1800], 78)}
              sizes="100vw"
              alt=""
              style={{ "--lookbut-layer": index } as React.CSSProperties}
            />
          ))}
        </div>
        <div className="lookbut-parallax__veil" />
        <div className="lookbut-parallax__quote">
          <p>“The traveller sees what he sees.<br />The tourist sees what he has come to see.”</p>
          <span>— G. K. Chesterton</span>
          <ChevronDown aria-hidden="true" size={22} />
        </div>
      </section>

      <header className="lookbut-hero">
        <p className="lookbut-kicker">Hong Kong / an imagined route</p>
        <h1><span>Look,</span><em>keep moving.</em></h1>
        <p className="lookbut-hero__subtitle">A field record assembled from six pauses across one changing landscape.</p>
        <a className="lookbut-back" href="/experiments">Back to lab <ArrowUpRight aria-hidden="true" size={16} /></a>
      </header>

      <div className="lookbut-intro-line">
        <span>Hong Kong route / 07 notes</span>
        <span>Scroll to move the route</span>
      </div>

      <div className="lookbut-body">
        <main className="lookbut-story" ref={storyRef}>
          {chapters.map((chapter, index) => (
            <section
              className="js-section lookbut-chapter"
              // Begin with an establishing shot of the whole Hong Kong plate,
              // then let the route chapters move into individual places.
              data-zoom-start={index === 0 ? "0.68" : index === 3 ? "1.35" : "1.5"}
              data-zoom-middle={index === 0 ? "1.08" : index % 2 === 0 ? "1.25" : "1.15"}
              data-stay={index === 0 || index === chapters.length - 1 ? "true" : undefined}
              key={chapter.photo.id}
            >
              <p className="lookbut-chapter__date">{chapter.date}</p>
              <h2>{chapter.title}</h2>
              <p className="lookbut-chapter__lead">{chapter.copy}</p>
              <p className="lookbut-chapter__meta">{chapter.place} / {chapter.photo.title}</p>
              <figure>
                <button type="button" onClick={() => onOpen(photos.indexOf(chapter.photo), photos)}>
                  <img
                    className="js-image"
                    data-pos={Math.min(index / Math.max(chapters.length - 1, 1), 1).toFixed(2)}
                    src={sizedImageUrl(chapter.photo.src, 1400, 86)}
                    srcSet={imageSrcSet(chapter.photo.src, [720, 1000, 1400], 86)}
                    sizes="(max-width: 740px) 100vw, 52vw"
                    alt={chapter.photo.altText ?? chapter.photo.title}
                    width={chapter.photo.width}
                    height={chapter.photo.height}
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  <span>Open photograph <ArrowUpRight aria-hidden="true" size={15} /></span>
                </button>
                <figcaption>{chapter.photo.caption ?? `${chapter.place} / ${chapter.photo.title}`}</figcaption>
              </figure>
            </section>
          ))}
        </main>
        <div ref={canvasHostRef} className="lookbut-canvas-host" aria-hidden="true" />
      </div>

      <footer className="lookbut-footer">
        <span>End of field record</span>
        {mapCredit ? <a className="lookbut-credit" href={mapCredit.href} target="_blank" rel="noreferrer">{mapCredit.label}</a> : null}
        <a href="/photography">Return to the archive <ArrowUpRight aria-hidden="true" size={16} /></a>
      </footer>
    </article>
  );
}
