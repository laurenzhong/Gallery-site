import { useState } from "react";
import type { Photo } from "../data/photos";
import type { PhotoMeta, PhotoStory } from "../data/stories";
import type { PageLayout, PageSection } from "../lib/pageLayout";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { photoPath } from "../lib/routes";
import { useSiteCopy } from "../lib/siteCopyContext";
import { AdvancedPhotoLightbox } from "./AdvancedPhotoLightbox";
import { BalconyCarousel, BalconyMonthTitle, BalconyPhotoButton } from "./BalconyView";

type CmsBalconyViewProps = {
  layout: PageLayout;
  photoMeta?: Record<string, PhotoMeta>;
  photoStories?: Record<string, PhotoStory[]>;
};

function SectionPhotos({ section, onOpen }: { section: PageSection; onOpen: (photo: Photo) => void }) {
  if (!section.photos.length) return null;

  if (section.style === "carousel" || section.style === "landscapeCarousel") {
    return <BalconyCarousel title={section.title ?? "Gallery"} photos={section.photos} onOpen={onOpen} />;
  }

  if (section.style === "featureCards") {
    return (
      <section className="balcony-portrait-row" aria-label={section.title ?? "Featured photos"}>
        {section.photos.map((photo) => (
          <BalconyPhotoButton key={photo.id} photo={photo} className="balcony-portrait-photo" onOpen={onOpen} />
        ))}
      </section>
    );
  }

  if (section.style === "stack") {
    return (
      <section className="balcony-final-stack" aria-label={section.title ?? "Photo stack"}>
        {section.photos.map((photo, index) => (
          <BalconyPhotoButton
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
  }

  return (
    <section className="balcony-grid" aria-label={section.title ?? "Photo grid"}>
      {section.photos.map((photo) => (
        <BalconyPhotoButton key={photo.id} photo={photo} className="balcony-grid-photo" onOpen={onOpen} />
      ))}
    </section>
  );
}

export function CmsBalconyView({ layout, photoMeta, photoStories }: CmsBalconyViewProps) {
  const copy = useSiteCopy();
  const [lightboxState, setLightboxState] = useState<{ photos: Photo[]; index: number } | null>(null);
  const sections = layout.sections.filter((section) => section.isVisible && (section.photos.length || section.coverPhoto));
  const openPhoto = (photo: Photo, photos: Photo[] = [photo]) => {
    const index = photos.findIndex((item) => item.id === photo.id);
    if (index >= 0) setLightboxState({ photos, index });
  };

  return (
    <article className="balcony-page" aria-labelledby="balcony-title">
      <h1 id="balcony-title" className="sr-only">{layout.title ?? copy.navigation.balcony}</h1>
      {layout.heroPhoto ? (
        <section className="balcony-hero" aria-label={`${layout.title ?? copy.navigation.balcony} hero`}>
          <button type="button" className="balcony-hero-button" onClick={() => openPhoto(layout.heroPhoto!, [layout.heroPhoto!])}>
            <img
              src={sizedImageUrl(layout.heroPhoto.src, 1800, 88)}
              srcSet={`${sizedImageUrl(layout.heroPhoto.src, 1200)} 1200w, ${sizedImageUrl(layout.heroPhoto.src, 2200, 88)} 2200w`}
              sizes="100vw"
              alt={layout.heroPhoto.altText ?? `${layout.heroPhoto.category} ${layout.heroPhoto.title}`}
              width={layout.heroPhoto.width}
              height={layout.heroPhoto.height}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </button>
        </section>
      ) : null}

      {sections.map((section) => (
        <div className="cms-balcony-section" key={section.id}>
          {section.showTitle && section.title ? <BalconyMonthTitle title={section.title} /> : null}
          {section.coverPhoto && ["hero", "banner", "split"].includes(section.style) ? (
            <section className="balcony-hero" aria-label={section.title ?? "Banner"}>
              <button type="button" className="balcony-hero-button" onClick={() => openPhoto(section.coverPhoto!, section.photos)}>
                <img
                  src={sizedImageUrl(section.coverPhoto.src, 1800, 86)}
                  srcSet={`${sizedImageUrl(section.coverPhoto.src, 1200)} 1200w, ${sizedImageUrl(section.coverPhoto.src, 2200, 86)} 2200w`}
                  sizes="100vw"
                  alt={section.coverPhoto.altText ?? `${section.coverPhoto.category} ${section.coverPhoto.title}`}
                  width={section.coverPhoto.width}
                  height={section.coverPhoto.height}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </section>
          ) : (
            <SectionPhotos section={section} onOpen={(photo) => openPhoto(photo, section.photos)} />
          )}
        </div>
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
