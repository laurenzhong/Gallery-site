import { ChevronLeft, ChevronRight, Copy, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type TouchEvent } from "react";
import type { Photo } from "../data/photos";
import {
  photoMeta as staticPhotoMeta,
  photoStories as staticPhotoStories,
  type PhotoMeta,
  type PhotoStory,
} from "../data/stories";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";

type AdvancedPhotoLightboxProps = {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  photoMeta?: Record<string, PhotoMeta>;
  photoStories?: Record<string, PhotoStory[]>;
  shareUrl?: string;
};

function MetaRow({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === "") return null;

  return (
    <div className="advanced-lightbox-meta-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function LightboxPhoto({ photo, active }: { photo: Photo; active: boolean }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const isCdnImage = photo.src.includes("cdn.sanity.io");
  const srcSet = isCdnImage
    ? [imageSrcSet(photo.src, [480, 768, 960, 1200]), imageSrcSet(photo.src, [1400, 2200, 3000], 90)].join(", ")
    : undefined;
  const ratio = photo.width / photo.height;
  const phoneWidth = ratio > 0 && ratio < 1
    ? `min(calc(100vw - 36px), clamp(${260 * ratio}px, ${54 * ratio}vh, ${420 * ratio}px))`
    : "calc(100vw - 36px)";

  return (
    <div hidden={!active}>
      <img
        src={sizedImageUrl(photo.src, 2200, 90)}
        srcSet={srcSet}
        sizes={`(max-width: 640px) ${phoneWidth}, (max-width: 1000px) calc(100vw - 80px), 100vw`}
        alt={photo.altText || `${photo.category} ${photo.title}`}
        width={photo.width}
        height={photo.height}
        decoding="async"
        fetchPriority={active ? "high" : "low"}
        hidden={status !== "loaded"}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
      {active && status !== "loaded" && (
        <p className="advanced-lightbox-photo-status" role="status">
          {status === "error" ? "Photo unavailable" : "Loading photo…"}
        </p>
      )}
    </div>
  );
}

export function AdvancedPhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
  photoMeta = staticPhotoMeta,
  photoStories = staticPhotoStories,
  shareUrl: shareUrlOverride,
}: AdvancedPhotoLightboxProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const photo = index >= 0 ? photos[index] : undefined;
  const isOpen = Boolean(photo);
  const meta = photo ? photoMeta[photo.filename] : undefined;
  const story = photo ? photoStories[photo.filename]?.[0] : undefined;
  const hasStory = Boolean(story);
  const canGoPrev = index > 0;
  const canGoNext = index < photos.length - 1;

  const shareUrl = shareUrlOverride ?? (typeof window === "undefined" ? "" : window.location.href);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    dialog.showModal();
    document.body.classList.add("advanced-lightbox-is-open");

    return () => {
      document.body.classList.remove("advanced-lightbox-is-open");
      dialog.close();
    };
  }, [isOpen]);

  useEffect(() => {
    setCopyState("idle");
  }, [photo?.id]);

  if (!photo) return null;

  // Keep nearby CDN images mounted so a swipe can reveal the same preloaded element.
  const nearbyIndexes = [index, index + 1, index - 1];

  const copyLink = async () => {
    if (!navigator.clipboard || !shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopyState("copied");
  };

  const navigateByOffset = (offset: number) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= photos.length) return;
    onNavigate(nextIndex);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDialogElement>) => {
    if (!touchStart || event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    setTouchStart(null);

    if (Math.abs(deltaX) < 72 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    navigateByOffset(deltaX > 0 ? -1 : 1);
  };

  return (
    <dialog
      ref={dialogRef}
      className="advanced-lightbox"
      role="dialog"
      aria-label={`${photo.title} details`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") navigateByOffset(-1);
        if (event.key === "ArrowRight") navigateByOffset(1);
      }}
      onTouchStart={(event) => {
        if (event.touches.length === 1) {
          setTouchStart({ x: event.touches[0].clientX, y: event.touches[0].clientY });
        }
      }}
      onTouchCancel={() => setTouchStart(null)}
      onTouchEnd={handleTouchEnd}
    >
      <div className="advanced-lightbox-frame">
        <button type="button" className="advanced-lightbox-close" onClick={onClose} aria-label="Close photo details">
          <X size={30} strokeWidth={1.8} />
        </button>

        <button
          type="button"
          className="advanced-lightbox-nav advanced-lightbox-nav--prev"
          onClick={() => navigateByOffset(-1)}
          aria-label="Previous photo"
          aria-disabled={!canGoPrev}
        >
          <ChevronLeft size={36} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="advanced-lightbox-nav advanced-lightbox-nav--next"
          onClick={() => navigateByOffset(1)}
          aria-label="Next photo"
          aria-disabled={!canGoNext}
        >
          <ChevronRight size={36} strokeWidth={1.7} />
        </button>

        <div className={`advanced-lightbox-layout${hasStory ? "" : " advanced-lightbox-layout--no-story"}`}>
          <div className="advanced-lightbox-media-column">
            <figure className="advanced-lightbox-photo">
              {nearbyIndexes.map((photoIndex) => {
                const candidate = photos[photoIndex];
                const active = photoIndex === index;
                if (!candidate || (!active && !candidate.src.includes("cdn.sanity.io"))) return null;
                return <LightboxPhoto key={`${photoIndex}:${candidate.id}:${candidate.src}`} photo={candidate} active={active} />;
              })}
            </figure>

            <section className="advanced-lightbox-meta" aria-labelledby="advanced-lightbox-meta-title">
              <div className="advanced-lightbox-section-head">
                <p>{photo.category}</p>
                <h2 id="advanced-lightbox-meta-title">{photo.title}</h2>
              </div>
              <dl className="advanced-lightbox-meta-list">
                <MetaRow label="Date" value={meta?.date} />
                <MetaRow label="Location" value={meta?.location} />
                <MetaRow label="Camera" value={meta?.camera} />
                <MetaRow label="Lens" value={meta?.lens} />
                <MetaRow label="Aperture" value={meta?.aperture} />
                <MetaRow label="Shutter" value={meta?.shutter} />
                <MetaRow label="ISO" value={meta?.iso} />
                <MetaRow label="Focal" value={meta?.focalLength} />
              </dl>
              <button type="button" className="advanced-lightbox-copy" onClick={copyLink}>
                <Copy size={16} strokeWidth={1.8} />
                <span>{copyState === "copied" ? "Copied" : "Copy link"}</span>
              </button>
            </section>
          </div>

          {story ? (
            <article className="advanced-lightbox-story" aria-labelledby="advanced-lightbox-story-title">
              <div className="advanced-lightbox-section-head">
                <p>Journal Note</p>
                <h2 id="advanced-lightbox-story-title">{story.title}</h2>
              </div>

              {story.excerpt ? <p className="advanced-lightbox-story-excerpt">{story.excerpt}</p> : null}

              <div className="advanced-lightbox-story-body">
                {story.body.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
