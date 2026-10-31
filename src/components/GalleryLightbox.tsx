import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import type { Photo } from "../data/photos";
import {
  photoMeta as staticPhotoMeta,
  photoStories as staticPhotoStories,
  type PhotoMeta,
  type PhotoStory,
} from "../data/stories";
import { storyPath } from "../lib/routes";

type GalleryLightboxProps = {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onView: (index: number) => void;
  photoMeta?: Record<string, PhotoMeta>;
  photoStories?: Record<string, PhotoStory[]>;
  showMeta?: boolean;
};

function LightboxMetaRow({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === "") {
    return null;
  }

  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function GalleryLightbox({
  photos,
  index,
  onClose,
  onView,
  photoMeta = staticPhotoMeta,
  photoStories = staticPhotoStories,
  showMeta = true,
}: GalleryLightboxProps) {
  const slides = photos.map((photo) => ({
    src: photo.src,
    alt: `${photo.category} ${photo.title}`,
    width: photo.width,
    height: photo.height,
  }));

  return (
    <Lightbox
      open={index >= 0}
      close={onClose}
      index={index >= 0 ? index : 0}
      slides={slides}
      carousel={{ finite: false, preload: 2 }}
      controller={{ closeOnBackdropClick: true }}
      on={{
        view: ({ index: nextIndex }) => onView(nextIndex),
      }}
      render={showMeta ? {
        slideFooter: ({ slide }) => {
          const photoIndex = photos.findIndex((photo) => photo.src === slide.src);
          const photo = photoIndex >= 0 ? photos[photoIndex] : photos[index];

          if (!photo) {
            return null;
          }

          const meta = photoMeta[photo.filename];
          const story = photoStories[photo.filename]?.[0];
          const title = photo.title;
          const exposure = meta
            ? [
                meta.focalLength,
                meta.aperture,
                meta.shutter,
                typeof meta.iso === "number" ? `ISO ${meta.iso}` : undefined,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined;

          return (
            <div className="lightbox-meta">
              <div className="lightbox-meta-main">
                <p>{title}</p>
                <span>{meta?.location ?? photo.category}</span>
                {meta ? (
                  <dl className="lightbox-meta-list">
                    <LightboxMetaRow label="日期" value={meta.date} />
                    <LightboxMetaRow label="器材" value={meta.camera} />
                    <LightboxMetaRow label="镜头" value={meta.lens} />
                    <LightboxMetaRow label="参数" value={exposure} />
                  </dl>
                ) : null}
                {story ? (
                  <a className="lightbox-story-link" href={storyPath(story, photo.slug)}>
                    查看手记
                  </a>
                ) : null}
              </div>
              <span className="lightbox-count">{`${photoIndex + 1} / ${photos.length}`}</span>
            </div>
          );
        },
      } : undefined}
      styles={{
        root: {
          "--yarl__color_backdrop": "#050505",
        },
      }}
    />
  );
}
