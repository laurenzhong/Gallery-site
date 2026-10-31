import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Photo } from "../data/photos";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";

const ARROW_PATH_NEXT = "m9 18 6-6-6-6";
const ARROW_PATH_PREV = "m15 18-6-6 6-6";

const AUTOPLAY_MS = 3000;
const CAROUSEL_TRANSITION_MS = 600;
const SWIPE_THRESHOLD_PX = 48;

type LandscapeSectionProps = {
  id: string;
  title: string;
  photos: Photo[];
  onOpen: (photo: Photo, carouselPhotos: Photo[]) => void;
  className?: string;
  showTitle?: boolean;
  filterLandscape?: boolean;
};

export function LandscapeSection({
  id,
  title,
  photos,
  onOpen,
  className,
  showTitle = true,
  filterLandscape = true,
}: LandscapeSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<"next" | "prev">("next");
  const [isPaused, setIsPaused] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLButtonElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const ignoreNextClickRef = useRef(false);

  const landscapePhotos = useMemo(
    () => (filterLandscape ? photos.filter((photo) => photo.width > photo.height) : photos),
    [filterLandscape, photos],
  );

  const total = landscapePhotos.length;
  const hasMultiplePhotos = total > 1;
  const active = total > 0 ? landscapePhotos[activeIndex] : undefined;
  const previous =
    previousIndex !== null && previousIndex !== activeIndex
      ? landscapePhotos[previousIndex]
      : undefined;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.25 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView || isPaused || !hasMultiplePhotos) return undefined;
    const timer = window.setTimeout(() => {
      if (mainRef.current?.matches(":hover, :focus-visible")) {
        setIsPaused(true);
        return;
      }
      setActiveIndex((index) => {
        const nextIndex = (index + 1) % total;
        if (nextIndex !== index) {
          setTransitionDirection("next");
          setPreviousIndex(index);
        }
        return nextIndex;
      });
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, hasMultiplePhotos, isInView, isPaused, total]);

  useEffect(() => {
    if (previousIndex === null) return undefined;
    const timer = window.setTimeout(() => setPreviousIndex(null), CAROUSEL_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [previousIndex]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children.item(activeIndex) as HTMLElement | undefined;
    if (!child) return;
    const container = track.parentElement;
    if (!container) return;
    const containerWidth = container.clientWidth;
    const trackWidth = track.scrollWidth;
    const maxScroll = Math.max(0, trackWidth - containerWidth);
    const desiredScroll = child.offsetLeft - (containerWidth - child.offsetWidth) / 2;
    const scroll = Math.max(0, Math.min(maxScroll, desiredScroll));
    track.style.transform = `translate3d(${-scroll}px, 0, 0)`;
  }, [activeIndex, total]);

  if (!active) return null;

  const changeActiveIndex = (getNextIndex: (index: number) => number, direction?: "next" | "prev") => {
    setActiveIndex((index) => {
      const nextIndex = getNextIndex(index);
      if (nextIndex !== index) {
        setTransitionDirection(direction ?? (nextIndex > index ? "next" : "prev"));
        setPreviousIndex(index);
      }
      return nextIndex;
    });
  };
  const goPrev = () => changeActiveIndex((index) => (index - 1 + total) % total, "prev");
  const goNext = () => changeActiveIndex((index) => (index + 1) % total, "next");
  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch") {
      touchStartRef.current = { x: event.clientX, y: event.clientY };
    }
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const touchStart = touchStartRef.current;
    touchStartRef.current = null;
    if (event.pointerType !== "touch" || !touchStart) return;

    const horizontalDistance = event.clientX - touchStart.x;
    const verticalDistance = event.clientY - touchStart.y;
    if (
      Math.abs(horizontalDistance) < SWIPE_THRESHOLD_PX ||
      Math.abs(horizontalDistance) <= Math.abs(verticalDistance)
    ) {
      return;
    }

    ignoreNextClickRef.current = true;
    if (horizontalDistance > 0) {
      goPrev();
    } else {
      goNext();
    }
  };
  const handleOpen = () => {
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }
    onOpen(active, landscapePhotos);
  };
  const caption = active.title
    .replace(/^[A-Z]+_/i, "")
    .replace(/[_-]+/g, " ")
    .trim();

  return (
    <section
      ref={sectionRef}
      className={`landscape-section${className ? ` ${className}` : ""}`}
      id={id}
      aria-label={showTitle ? undefined : `${title} gallery`}
      aria-labelledby={showTitle ? `${id}-title` : undefined}
    >
      {showTitle ? (
        <div className="featured-title-bar">
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
      ) : null}

      <div className="landscape-stage">
        {hasMultiplePhotos && (
          <button
            type="button"
            className="landscape-arrow landscape-arrow--prev"
            aria-label={`Previous ${title} photo`}
            onClick={goPrev}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="42"
              height="42"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={ARROW_PATH_PREV} />
            </svg>
          </button>
        )}

        <button
          ref={mainRef}
          type="button"
          className={`landscape-main${active.width < active.height ? " landscape-main--portrait" : ""}`}
          style={{ aspectRatio: `${active.width} / ${active.height}` }}
          onClick={handleOpen}
          onBlur={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onPointerEnter={() => setIsPaused(true)}
          onPointerLeave={() => setIsPaused(false)}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            touchStartRef.current = null;
          }}
          aria-label={`Open ${caption}`}
        >
          {previous ? (
            <img
              key={`previous-${previous.id}`}
              className={`landscape-image landscape-image--previous landscape-image--${transitionDirection}`}
              src={sizedImageUrl(previous.src, 1800, 84)}
              srcSet={imageSrcSet(previous.src, [900, 1400, 2000], 84)}
              sizes="100vw"
              alt=""
              decoding="async"
            />
          ) : null}
          <img
            key={`active-${active.id}`}
            className={`landscape-image landscape-image--active${previous ? ` landscape-image--${transitionDirection}` : ""}`}
            src={sizedImageUrl(active.src, 1800, 84)}
            srcSet={imageSrcSet(active.src, [900, 1400, 2000], 84)}
            sizes="100vw"
            alt={caption}
            loading="lazy"
            decoding="async"
          />
          <span className="landscape-caption">{caption}</span>
        </button>

        {hasMultiplePhotos && (
          <button
            type="button"
            className="landscape-arrow landscape-arrow--next"
            aria-label={`Next ${title} photo`}
            onClick={goNext}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="42"
              height="42"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={ARROW_PATH_NEXT} />
            </svg>
          </button>
        )}
      </div>

      <div className="landscape-thumbs" role="tablist" aria-label={`${title} thumbnails`}>
        <div ref={trackRef} className="landscape-thumbs-track">
          {landscapePhotos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              role="tab"
              className={`landscape-thumb ${index === activeIndex ? "is-active" : ""}`}
              aria-selected={index === activeIndex}
              aria-label={`Select ${photo.title}`}
              onClick={() => changeActiveIndex(() => index)}
            >
              <img
                src={sizedImageUrl(photo.src, 420, 76)}
                srcSet={imageSrcSet(photo.src, [280, 420, 560], 76)}
                sizes="140px"
                alt=""
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
