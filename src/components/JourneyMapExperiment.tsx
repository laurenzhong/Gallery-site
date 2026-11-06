import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { Photo } from "../data/photos";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";

type JourneyMapExperimentProps = {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
};

type JourneyStop = {
  title: string;
  date: string;
  place: string;
  copy: string;
  note: string;
  photo: Photo;
  x: number;
  y: number;
};

const stopCopy = [
  ["Arrival", "Field note 01", "The first hour is all edges: a road, a ridge, a low cloud moving across the water.", "Start here"],
  ["Above the line", "Field note 02", "A change in altitude changes the scale of everything. Weather becomes a subject of its own.", "High ground"],
  ["Between weather", "Field note 03", "The archive holds the in-between moments: not a destination, just enough time to notice.", "Soft weather"],
  ["Waterline", "Field note 04", "The shoreline is a slow edit. Each return leaves a different version of the same frame.", "Low tide"],
  ["The long turn", "Field note 05", "A familiar view keeps its distance. The work is to stay with it until it changes.", "Return route"],
  ["After light", "Field note 06", "The last image is not an ending. It is the point where another walk begins.", "After hours"],
] as const;

const pointPositions = [[13, 76], [28, 55], [43, 62], [59, 40], [75, 29], [89, 16]] as const;

function buildStops(photos: Photo[]) {
  const preferred = [
    photos.find((photo) => photo.isHero),
    photos.find((photo) => photo.category === "山野"),
    photos.find((photo) => photo.category === "森林"),
    photos.find((photo) => photo.category === "河流"),
    photos.find((photo) => photo.category === "海洋"),
    photos.find((photo) => photo.category === "harbor"),
  ].filter((photo): photo is Photo => Boolean(photo));
  const rest = photos.filter((photo) => !preferred.some((item) => item.id === photo.id));
  return [...preferred, ...rest].slice(0, stopCopy.length).map((photo, index): JourneyStop => ({
    title: stopCopy[index][0],
    date: stopCopy[index][1],
    place: `${stopCopy[index][3]} / ${photo.category}`,
    copy: stopCopy[index][2],
    note: stopCopy[index][3],
    photo,
    x: pointPositions[index][0],
    y: pointPositions[index][1],
  }));
}

export function JourneyMapExperiment({ photos, onOpen }: JourneyMapExperimentProps) {
  const stops = useMemo(() => buildStops(photos), [photos]);
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);
  const mapProgress = activeIndex / Math.max(stops.length - 1, 1);

  useEffect(() => {
    const sections = sectionRefs.current.filter(Boolean) as HTMLElement[];
    if (!sections.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveIndex(Number((visible.target as HTMLElement).dataset.journeyIndex));
      },
      { rootMargin: "-35% 0px -45%", threshold: [0.2, 0.45, 0.8] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [stops.length]);

  const scrollToStop = (index: number) => sectionRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <article className="journey-reference">
      <section className="journey-parallax" aria-label="Layered landscape introduction">
        <div className="journey-parallax__layers" aria-hidden="true">
          {stops.slice(0, 6).map((stop, index) => (
            <img key={stop.photo.id} src={sizedImageUrl(stop.photo.src, 1800, 80)} srcSet={imageSrcSet(stop.photo.src, [900, 1400, 1800], 80)} sizes="100vw" alt="" style={{ "--journey-layer": index } as CSSProperties} />
          ))}
        </div>
        <div className="journey-parallax__cover">
          <p className="journey-quote">“The traveller sees what he sees.<br />The tourist sees what he has come to see.”</p>
          <span>— G. K. Chesterton</span>
          <ChevronDown aria-hidden="true" size={22} />
        </div>
      </section>

      <header className="journey-reference__hero">
        <p className="journey-reference__eyebrow">Queenstown / an interactive field record</p>
        <h1><span>Follow the</span><em>weather</em></h1>
        <p className="journey-reference__subtitle">Six pauses across one changing landscape</p>
        <a className="journey-reference__back" href="/experiments">Back to lab <ArrowUpRight aria-hidden="true" size={16} /></a>
      </header>

      <div className="journey-reference__mobile-intro">
        <p>Scroll to move through the field record.</p>
        <span>01 — 06</span>
      </div>

      <div className="journey-reference__body">
        <main className="journey-reference__story">
          {stops.map((stop, index) => (
            <section className={`journey-reference__section${activeIndex === index ? " is-active" : ""}`} data-journey-index={index} key={stop.photo.id} ref={(element) => { sectionRefs.current[index] = element; }}>
              <h2>
                <span>{stop.date}</span>
                {stop.title}
              </h2>
              <p className="journey-reference__lead">{stop.copy}</p>
              <p className="journey-reference__body-copy">{index === 0 ? "This is a route built from attention rather than distance. The photographs are ordered by the feeling of moving through a day, so the map can stay deliberately approximate." : "The image is the coordinate. The small details around it — temperature, light, the time it took to stop — are what make the place legible."}</p>
              <figure>
                <button type="button" onClick={() => onOpen(photos.indexOf(stop.photo), photos)}>
                  <img src={sizedImageUrl(stop.photo.src, 1200, 84)} srcSet={imageSrcSet(stop.photo.src, [640, 900, 1200], 84)} sizes="(max-width: 720px) 100vw, 48vw" alt={stop.photo.altText ?? stop.photo.title} width={stop.photo.width} height={stop.photo.height} loading={index === 0 ? "eager" : "lazy"} decoding="async" />
                  <span>Open photograph <ArrowUpRight aria-hidden="true" size={15} /></span>
                </button>
                <figcaption>{stop.note} / {stop.photo.title}</figcaption>
              </figure>
            </section>
          ))}
        </main>

        <aside className="journey-reference__map" aria-label="Scroll-linked route map">
          <div className="journey-reference__map-inner">
            <div className="journey-reference__map-topline"><span>Route / {String(stops.length).padStart(2, "0")} field notes</span><span>Scroll-linked</span></div>
            <svg viewBox="0 0 100 100" role="img" aria-label="Abstract route through six field notes">
              <path className="journey-reference__map-contour" d="M4 85 C17 70 16 47 31 48 S41 17 57 29 S65 58 79 47 S89 26 97 9" />
              <path className="journey-reference__map-route" pathLength="1" style={{ strokeDashoffset: 1 - mapProgress }} d="M13 76 C23 63 22 51 36 55 S46 29 56 37 S65 58 77 42 S85 26 89 16" />
              {stops.map((stop, index) => (
                <g className={`journey-reference__map-point${activeIndex === index ? " is-active" : ""}`} key={stop.photo.id} onClick={() => scrollToStop(index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); scrollToStop(index); } }} tabIndex={0} role="button" aria-label={`Go to ${stop.title}`}>
                  <circle cx={stop.x} cy={stop.y} r={activeIndex === index ? 3.4 : 2.2} />
                  <text x={stop.x + 4} y={stop.y + 1}>{String(index + 1).padStart(2, "0")}</text>
                </g>
              ))}
            </svg>
            <div className="journey-reference__map-current"><span>Current note</span><strong>{stops[activeIndex]?.title}</strong><small>{stops[activeIndex]?.place}</small></div>
            <div className="journey-reference__map-controls"><button type="button" onClick={() => scrollToStop(Math.max(0, activeIndex - 1))} aria-label="Previous field note">↑</button><span>{String(activeIndex + 1).padStart(2, "0")} / {String(stops.length).padStart(2, "0")}</span><button type="button" onClick={() => scrollToStop(Math.min(stops.length - 1, activeIndex + 1))} aria-label="Next field note">↓</button></div>
          </div>
        </aside>
      </div>

      <footer className="journey-reference__footer"><span>End of field record</span><a href="/photography">Return to the archive <ArrowUpRight aria-hidden="true" size={16} /></a></footer>
    </article>
  );
}

