import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Photo } from "../data/photos";
import type { PhotoMeta, PhotoStory } from "../data/stories";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { chaptersFromLegacyBalcony, type BalconyGallery, type PhotobalconyLayout, type PhotobalconyPeriod } from "../lib/photobalconyLayout";
import { photoPath } from "../lib/routes";
import { AdvancedPhotoLightbox } from "./AdvancedPhotoLightbox";

type BalconyViewProps = {
  photos: Photo[];
  layout?: PhotobalconyLayout;
  photoMeta?: Record<string, PhotoMeta>;
  photoStories?: Record<string, PhotoStory[]>;
};

export const DEFAULT_BALCONY_TITLE = "Balcony View";

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

function BalconyCarousel({ title, photos, onOpen }: BalconyCarouselProps) {
  const [activeId, setActiveId] = useState(photos[0]?.id);
  const [transition, setTransition] = useState<{ previous: Photo; direction: "next" | "prev" }>();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const ignoreNextClickRef = useRef(false);
  const activeIndex = Math.max(0, photos.findIndex((photo) => photo.id === activeId));
  const active = photos[activeIndex];

  useEffect(() => {
    if (!transition) return;
    const timer = window.setTimeout(() => setTransition(undefined), CAROUSEL_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [transition]);

  const changeSlide = (direction: "next" | "prev") => {
    const offset = direction === "next" ? 1 : -1;
    setTransition({ previous: active, direction });
    setActiveId(photos[(activeIndex + offset + photos.length) % photos.length].id);
  };
  const goPrev = () => changeSlide("prev");
  const goNext = () => changeSlide("next");
  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    ignoreNextClickRef.current = false;
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
  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.detail && ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }
    onOpen(active);
  };

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
        {transition ? (
          <img
            key={`previous-${transition.previous.id}`}
            className={`balcony-carousel-image balcony-carousel-image--previous balcony-carousel-image--${transition.direction}`}
            src={sizedImageUrl(transition.previous.src, 1500, 86)}
            srcSet={imageSrcSet(transition.previous.src, [700, 1100, 1700], 86)}
            sizes="(max-width: 900px) 100vw, 92vw"
            alt=""
            decoding="async"
          />
        ) : null}
        <img
          key={`active-${active.id}`}
          className={`balcony-carousel-image${transition ? ` balcony-carousel-image--active balcony-carousel-image--${transition.direction}` : ""}`}
          src={sizedImageUrl(active.src, 1500, 86)}
          srcSet={imageSrcSet(active.src, [700, 1100, 1700], 86)}
          sizes="(max-width: 900px) 100vw, 92vw"
          alt={`${active.category} ${active.title}`}
          width={active.width}
          height={active.height}
          loading={transition ? "eager" : "lazy"}
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
      <span className="balcony-carousel-count" aria-live="polite" aria-atomic="true">
        <span className="sr-only">Photo </span>{activeIndex + 1} / {photos.length}
      </span>
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
      chapters: layout?.chapters ?? chaptersFromLegacyBalcony(fallbackPeriods.filter((period) => period.photos.length)),
    };
  }, [layout, photos]);

  const openPhoto = (photo: Photo, lightboxPhotos: Photo[]) => {
    const index = lightboxPhotos.findIndex((item) => item.id === photo.id);
    if (index >= 0) {
      setLightboxState({ photos: lightboxPhotos, index });
    }
  };

  return (
    <article className="balcony-page" aria-labelledby="balcony-title">
      {content.hero && <div className="balcony-hero">
        <img
          src={sizedImageUrl(content.hero.src, 1800, 88)}
          srcSet={imageSrcSet(content.hero.src, [1200, 2200], 88)}
          sizes="100vw"
          alt={content.hero.altText || `${content.hero.category} ${content.hero.title}`}
          width={content.hero.width}
          height={content.hero.height}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </div>}

      <header className="balcony-intro">
        <h1 id="balcony-title">{layout?.title?.trim() || DEFAULT_BALCONY_TITLE}</h1>
        {layout?.subtitle?.trim() ? <p>{layout.subtitle}</p> : null}
      </header>

      {content.chapters.map((chapter) => (
        <section className="balcony-chapter" key={chapter.id} aria-labelledby={`balcony-${chapter.id}`}>
          <header className="balcony-month-title">
            <h2 id={`balcony-${chapter.id}`}>{chapter.title}</h2>
          </header>
          {chapter.galleries.map((gallery) => (
            <div className="balcony-gallery" key={gallery.id}>
              <BalconyPhotoGroup title={chapter.title} photos={gallery.photos} presentation={gallery.presentation} onOpen={(photo) => openPhoto(photo, gallery.photos)} />
            </div>
          ))}
        </section>
      ))}

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
        shareUrl={lightboxState ? `${window.location.origin}${photoPath(lightboxState.photos[lightboxState.index])}` : undefined}
      />
    </article>
  );
}

export function BalconyPhotoGroup({ photos, presentation, title, onOpen }: Pick<BalconyGallery<Photo>, "photos" | "presentation"> & {
  title: string;
  onOpen: (photo: Photo) => void;
}) {
  if (photos.length === 1 && presentation === "carousel") {
    return (
      <div className="balcony-carousel balcony-carousel--single">
        <PhotoButton
          photo={photos[0]}
          className="balcony-carousel-main"
          sizes="(max-width: 900px) 100vw, 92vw"
          src={sizedImageUrl(photos[0].src, 1500, 86)}
          srcSet={imageSrcSet(photos[0].src, [700, 1100, 1700], 86)}
          onOpen={onOpen}
        />
      </div>
    );
  }

  if (presentation === "carousel") {
    return <BalconyCarousel title={title} photos={photos} onOpen={onOpen} />;
  }

  if (presentation === "portraitRail") {
    return (
      <div className="balcony-portrait-row" role="group" aria-label={`${title} portrait photos`}>
        {photos.map((photo) => (
          <PhotoButton key={photo.id} photo={photo} className="balcony-portrait-photo" onOpen={onOpen} />
        ))}
      </div>
    );
  }

  if (presentation === "grid" || presentation === "leadGrid") {
    const featured = presentation === "leadGrid";
    return (
      <div className={`balcony-grid${featured ? " balcony-grid--wide" : ""}`} role="group" aria-label={`${title} photo grid`}>
        {photos.map((photo, index) => {
          const wide = featured && (index === 0 || (index === photos.length - 1 && photos.length % 2 === 0));
          return (
            <PhotoButton
              key={photo.id}
              photo={photo}
              className={`balcony-grid-photo${wide ? " balcony-grid-photo--wide" : ""}`}
              src={sizedImageUrl(photo.src, wide ? 1700 : 900, 86)}
              srcSet={imageSrcSet(photo.src, wide ? [700, 1100, 1700, 2200] : [500, 900, 1300], 86)}
              sizes={wide ? "100vw" : featured ? "50vw" : "(max-width: 700px) 100vw, 50vw"}
              onOpen={onOpen}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="balcony-final-stack" role="group" aria-label={`${title} photo stack`}>
      {photos.map((photo, index) => (
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
    </div>
  );
}
