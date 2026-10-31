import { ChevronLeft, ChevronRight, Copy, X } from "lucide-react";
import { useEffect, useState, type TouchEvent } from "react";
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
  const photo = index >= 0 ? photos[index] : undefined;
  const meta = photo ? photoMeta[photo.filename] : undefined;
  const story = photo ? photoStories[photo.filename]?.[0] : undefined;
  const hasStory = Boolean(story);
  const canGoPrev = index > 0;
  const canGoNext = index < photos.length - 1;

  const shareUrl = shareUrlOverride ?? (typeof window === "undefined" ? "" : window.location.href);

  useEffect(() => {
    if (!photo) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && canGoPrev) onNavigate(index - 1);
      if (event.key === "ArrowRight" && canGoNext) onNavigate(index + 1);
    };

    document.body.classList.add("advanced-lightbox-is-open");
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("advanced-lightbox-is-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canGoNext, canGoPrev, index, onClose, onNavigate, photo]);

  useEffect(() => {
    setCopyState("idle");
  }, [photo?.id]);

  if (!photo) return null;

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

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (!touchStart || event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    setTouchStart(null);

    if (Math.abs(deltaX) < 72 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    navigateByOffset(deltaX > 0 ? -1 : 1);
  };

  return (
    <section
      className="advanced-lightbox"
      aria-modal="true"
      role="dialog"
      aria-label={`${photo.title} details`}
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

        {canGoPrev ? (
            <button
              type="button"
              className="advanced-lightbox-nav advanced-lightbox-nav--prev"
              onClick={() => navigateByOffset(-1)}
              aria-label="Previous photo"
            >
              <ChevronLeft size={36} strokeWidth={1.7} />
            </button>
        ) : null}
        {canGoNext ? (
            <button
              type="button"
              className="advanced-lightbox-nav advanced-lightbox-nav--next"
              onClick={() => navigateByOffset(1)}
              aria-label="Next photo"
            >
              <ChevronRight size={36} strokeWidth={1.7} />
            </button>
        ) : null}

        <div className={`advanced-lightbox-layout${hasStory ? "" : " advanced-lightbox-layout--no-story"}`}>
          <div className="advanced-lightbox-media-column">
            <figure className="advanced-lightbox-photo">
              <img
                src={sizedImageUrl(photo.src, 2200, 90)}
                srcSet={imageSrcSet(photo.src, [1400, 2200, 3000], 90)}
                sizes="100vw"
                alt={`${photo.category} ${photo.title}`}
                width={photo.width}
                height={photo.height}
                decoding="async"
                fetchPriority="high"
              />
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
    </section>
  );
}
