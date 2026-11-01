import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Photo } from "../data/photos";
import type { PhotoMeta, PhotoStory } from "../data/stories";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import type { PhotobalconyLayout, PhotobalconyPeriod } from "../lib/photobalconyLayout";
import { photoPath } from "../lib/routes";
import { AdvancedPhotoLightbox } from "./AdvancedPhotoLightbox";

type BalconyViewProps = {
  photos: Photo[];
  layout?: PhotobalconyLayout;
  photoMeta?: Record<string, PhotoMeta>;
  photoStories?: Record<string, PhotoStory[]>;
};

type BalconyCarouselProps = {
  title: string;
  photos: Photo[];
  onOpen: (photo: Photo) => void;
};

type PhotoButtonProps = {
  photo: Photo;
  className: string;
  sizes?: string;
  src?: string;
  srcSet?: string;
  loading?: "eager" | "lazy";
  onOpen: (photo: Photo) => void;
};

const CAROUSEL_TRANSITION_MS = 600;
const SWIPE_THRESHOLD_PX = 48;
const DEFAULT_BALCONY_TITLES = {
  may: "2026",
  march: "Jul 2026",
  february: "May - Jun 2026",
  january: "Apr 2026",
  winter: "Mar 2026",
  summer: "Jan - Feb 2026",
};

const byFilenames = (photos: Photo[], filenames: string[]) =>
  filenames.flatMap((filename) => {
    const photo = photos.find((item) => item.filename === filename);
    return photo ? [photo] : [];
  });

const configuredPhotos = (layout: PhotobalconyLayout | undefined, configured: Photo[] | undefined, fallback: Photo[]) =>
  layout ? (configured ?? []) : fallback;

function uniquePhotos(...groups: Photo[][]) {
  const seen = new Set<string>();
  return groups.flat().filter((photo) => {
    if (seen.has(photo.src)) return false;
    seen.add(photo.src);
    return true;
  });
}

function PhotoButton({
  photo,
  className,
  sizes = "(max-width: 700px) 92vw, 32vw",
  src = sizedImageUrl(photo.src, 900),
  srcSet = imageSrcSet(photo.src, [700, 1100]),
  loading = "lazy",
  onOpen,
}: PhotoButtonProps) {
  return (
    <button type="button" className={className} onClick={() => onOpen(photo)} aria-label={`Open ${photo.title}`}>
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={`${photo.category} ${photo.title}`}
        width={photo.width}
        height={photo.height}
        loading={loading}
        decoding="async"
      />
    </button>
  );
}

function MonthTitle({ title }: { title: string }) {
  return (
    <header className="balcony-month-title">
      <h2>{title}</h2>
    </header>
  );
}

function BalconyCarousel({ title, photos, onOpen }: BalconyCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<"next" | "prev">("next");
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const ignoreNextClickRef = useRef(false);
  const active = photos[activeIndex];
  const previous = previousIndex === null ? undefined : photos[previousIndex];

  useEffect(() => {
    if (previousIndex === null) return undefined;
    const timer = window.setTimeout(() => setPreviousIndex(null), CAROUSEL_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [previousIndex]);

  const changeSlide = (direction: "next" | "prev") => {
    setTransitionDirection(direction);
    setActiveIndex((index) => {
      setPreviousIndex(index);
      return direction === "next" ? (index + 1) % photos.length : (index - 1 + photos.length) % photos.length;
    });
  };
  const goPrev = () => changeSlide("prev");
  const goNext = () => changeSlide("next");
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
    onOpen(active);
  };

  if (photos.length === 0) return null;

  return (
    <section className="balcony-carousel" aria-label={`${title} slideshow`}>
      <button
        type="button"
        className="balcony-carousel-arrow balcony-carousel-arrow--prev"
        aria-label={`Previous ${title} photo`}
        onClick={goPrev}
      >
        <ChevronLeft size={42} strokeWidth={1.3} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="balcony-carousel-main"
        onClick={handleOpen}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          touchStartRef.current = null;
        }}
        aria-label={`Open ${active.title}`}
      >
        {previous ? (
          <img
            key={`previous-${previous.id}`}
            className={`balcony-carousel-image balcony-carousel-image--previous balcony-carousel-image--${transitionDirection}`}
            src={sizedImageUrl(previous.src, 1500, 86)}
            srcSet={`${sizedImageUrl(previous.src, 1100)} 1100w, ${sizedImageUrl(previous.src, 1700, 86)} 1700w`}
            sizes="(max-width: 900px) 100vw, 76vw"
            alt=""
            decoding="async"
          />
        ) : null}
        <img
          key={`active-${active.id}`}
          className={`balcony-carousel-image${previous ? ` balcony-carousel-image--active balcony-carousel-image--${transitionDirection}` : ""}`}
          src={sizedImageUrl(active.src, 1500, 86)}
          srcSet={`${sizedImageUrl(active.src, 1100)} 1100w, ${sizedImageUrl(active.src, 1700, 86)} 1700w`}
          sizes="(max-width: 900px) 92vw, 76vw"
          alt={`${active.category} ${active.title}`}
          width={active.width}
          height={active.height}
          loading="eager"
          decoding="async"
        />
      </button>

      <button
        type="button"
        className="balcony-carousel-arrow balcony-carousel-arrow--next"
        aria-label={`Next ${title} photo`}
        onClick={goNext}
      >
        <ChevronRight size={42} strokeWidth={1.3} aria-hidden="true" />
      </button>
    </section>
  );
}

export function BalconyView({ photos, layout, photoMeta, photoStories }: BalconyViewProps) {
  const [lightboxState, setLightboxState] = useState<{ photos: Photo[]; index: number } | null>(null);

  const content = useMemo(() => {
    const fallbackHero =
      photos.find((photo) => photo.filename === "DSC_0243.JPG") ??
      photos.find((photo) => photo.category === "石塘度假区") ??
      photos[0];

    const fallbackMay = byFilenames(photos, ["DSC_0257.JPG", "DSC_0518.JPG", "DSC_0521.JPG", "DSC_0522.JPG"]);
    const fallbackMarchPortraits = byFilenames(photos, ["DSC_0264.JPG", "DSC_0335.JPG", "DSC_0396.JPG", "DSC_0470.JPG"]);
    const fallbackMarchWide = byFilenames(photos, ["DSC_0534.JPG", "DSC_0555.JPG", "DSC_0566.JPG"]);
    const fallbackFebruary = byFilenames(photos, ["DSC_0580.JPG", "DSC_0613.JPG", "DSC_0626.JPG", "DSC_0632.JPG"]);
    const fallbackJanuary = byFilenames(photos, ["DSC_0513.JPG", "DSC_0514.JPG", "DSC_0520.JPG", "DSC_0538.JPG"]);
    const fallbackWinter = byFilenames(photos, ["DSC_0546.JPG", "DSC_0551.JPG", "DSC_0552.JPG", "DSC_0571.JPG"]);
    const fallbackSummer = byFilenames(photos, ["DSC_0638.JPG", "DSC_0648.JPG", "DSC_0917.JPG", "DSC_2196.JPG"]);

    const may = configuredPhotos(layout, layout?.mayPhotos, fallbackMay);
    const marchPortraits = configuredPhotos(layout, layout?.marchPortraitPhotos, fallbackMarchPortraits);
    const marchWide = configuredPhotos(layout, layout?.marchWidePhotos, fallbackMarchWide);
    const february = configuredPhotos(layout, layout?.februaryPhotos, fallbackFebruary);
    const january = configuredPhotos(layout, layout?.januaryPhotos, fallbackJanuary);
    const winter = configuredPhotos(layout, layout?.winterPhotos, fallbackWinter);
    const summer = configuredPhotos(layout, layout?.summerPhotos, fallbackSummer);

    const fallbackPeriods: PhotobalconyPeriod[] = [
      { key: "may", title: layout?.mayTitle || DEFAULT_BALCONY_TITLES.may, photos: may },
      { key: "marchPortraits", title: layout?.marchTitle || DEFAULT_BALCONY_TITLES.march, photos: marchPortraits },
      { key: "marchWide", title: layout?.marchTitle || DEFAULT_BALCONY_TITLES.march, photos: marchWide },
      { key: "february", title: layout?.februaryTitle || DEFAULT_BALCONY_TITLES.february, photos: february },
      { key: "january", title: layout?.januaryTitle || DEFAULT_BALCONY_TITLES.january, photos: january },
      { key: "winter", title: layout?.winterTitle || DEFAULT_BALCONY_TITLES.winter, photos: winter },
      { key: "summer", title: layout?.summerTitle || DEFAULT_BALCONY_TITLES.summer, photos: summer },
    ];

    return {
      hero: layout?.heroPhoto ?? fallbackHero,
      periods: layout?.periods?.length ? layout.periods : fallbackPeriods,
      may,
      marchPortraits,
      marchWide,
      february,
      january,
      winter,
      summer,
      lightboxPhotos: uniquePhotos(may, marchPortraits, marchWide, february, january, winter, summer),
    };
  }, [layout, photos]);

  if (!content.hero) return null;

  const openPhoto = (photo: Photo, lightboxPhotos: Photo[]) => {
    const index = lightboxPhotos.findIndex((item) => item.src === photo.src);
    if (index >= 0) {
      setLightboxState({ photos: lightboxPhotos, index });
    }
  };

  const renderPeriod = (period: PhotobalconyPeriod) => {
    const onOpen = (photo: Photo) => openPhoto(photo, period.photos);

    if (period.key === "marchPortraits") {
      return (
        <section className="balcony-portrait-row" aria-label={`${period.title} portrait photos`}>
          {period.photos.map((photo) => (
            <PhotoButton key={photo.id} photo={photo} className="balcony-portrait-photo" onOpen={onOpen} />
          ))}
        </section>
      );
    }

    if (period.key === "marchWide" || period.key === "may" || period.key === "february") {
      return <BalconyCarousel title={period.title} photos={period.photos} onOpen={onOpen} />;
    }

    if (period.key === "january") {
      return (
        <section className="balcony-grid" aria-label={`${period.title} photo grid`}>
          {period.photos.map((photo) => (
            <PhotoButton key={photo.id} photo={photo} className="balcony-grid-photo" onOpen={onOpen} />
          ))}
        </section>
      );
    }

    if (period.key === "winter") {
      return (
        <section className="balcony-grid balcony-grid--wide" aria-label={`${period.title} photo grid`}>
          {period.photos.map((photo, index) => (
            <PhotoButton
              key={photo.id}
              photo={photo}
              className="balcony-grid-photo"
              src={sizedImageUrl(photo.src, 1800, 86)}
              srcSet={imageSrcSet(photo.src, [1200, 1800, 2400], 86)}
              sizes={index === 0 ? "100vw" : "(max-width: 700px) 100vw, 50vw"}
              onOpen={onOpen}
            />
          ))}
        </section>
      );
    }

    return (
      <section className="balcony-final-stack" aria-label={`${period.title} photo stack`}>
        {period.photos.map((photo, index) => (
          <PhotoButton
            key={photo.id}
            photo={photo}
            className={index === 0 ? "balcony-final-photo balcony-final-photo--large" : "balcony-final-photo"}
            src={sizedImageUrl(photo.src, 1800, 86)}
            srcSet={imageSrcSet(photo.src, [1200, 1800, 2400], 86)}
            sizes="100vw"
            onOpen={onOpen}
          />
        ))}
      </section>
    );
  };

  return (
    <article className="balcony-page" aria-labelledby="balcony-title">
      <h1 id="balcony-title" className="sr-only">
        Balcony View
      </h1>

      <section className="balcony-hero" aria-label="Balcony View hero">
        <img
          src={sizedImageUrl(content.hero.src, 1800, 88)}
          srcSet={`${sizedImageUrl(content.hero.src, 1200)} 1200w, ${sizedImageUrl(content.hero.src, 2200, 88)} 2200w`}
          sizes="100vw"
          alt={`${content.hero.category} ${content.hero.title}`}
          width={content.hero.width}
          height={content.hero.height}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </section>

      {content.periods.map((period, index) => {
        const previous = content.periods[index - 1];
        const showTitle = !previous || previous.title !== period.title;
        return (
          <Fragment key={`${period.key}-${index}`}>
            {showTitle ? <MonthTitle title={period.title} /> : null}
            {renderPeriod(period)}
          </Fragment>
        );
      })}

      <AdvancedPhotoLightbox
        photos={lightboxState?.photos ?? []}
        index={lightboxState?.index ?? -1}
        onClose={() => setLightboxState(null)}
        onNavigate={(index) => {
          if (!lightboxState) return;
          setLightboxState({ photos: lightboxState.photos, index });
        }}
        photoMeta={photoMeta}
        photoStories={photoStories}
        shareUrl={
          lightboxState
            ? `${window.location.origin}${photoPath(lightboxState.photos[lightboxState.index])}`
            : undefined
        }
      />
    </article>
  );
}
