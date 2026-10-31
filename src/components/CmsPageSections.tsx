import type { Photo } from "../data/photos";
import type { PageLayout, PageSection } from "../lib/pageLayout";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { LandscapeSection } from "./LandscapeSection";
import { SectionCarousel } from "./SectionCarousel";
import { SectionGrid } from "./SectionGrid";
import { SectionStack } from "./SectionStack";

type CmsPageSectionsProps = {
  layout: PageLayout;
  onOpen: (photo: Photo, collection?: Photo[]) => void;
};

function SectionHeading({ section }: { section: PageSection }) {
  if (!section.showTitle && !section.description && !section.eyebrow) return null;

  return (
    <header className="cms-section-heading">
      {section.eyebrow ? <p className="cms-section-eyebrow">{section.eyebrow}</p> : null}
      {section.showTitle && section.title ? <h2>{section.title}</h2> : null}
      {section.description ? <p className="cms-section-description">{section.description}</p> : null}
    </header>
  );
}

function SectionLink({ section }: { section: PageSection }) {
  if (!section.linkTarget || !section.linkLabel) return null;
  return (
    <a className="cms-section-link" href={section.linkTarget}>
      {section.linkLabel}
    </a>
  );
}

function HeroSection({ section, onOpen }: { section: PageSection; onOpen: CmsPageSectionsProps["onOpen"] }) {
  const photo = section.coverPhoto ?? section.photos[0];
  if (!photo) return null;

  return (
    <section className="cms-section cms-section--hero">
      <button type="button" className="cms-hero-photo" onClick={() => onOpen(photo, section.photos)} aria-label={`${section.title ?? "Open"} ${photo.title}`}>
        <img
          src={sizedImageUrl(photo.src, 2400, 88)}
          srcSet={imageSrcSet(photo.src, [1400, 2000, 2800], 88)}
          sizes="100vw"
          alt={photo.altText ?? photo.title}
          width={photo.width}
          height={photo.height}
          fetchPriority="high"
          decoding="async"
        />
      </button>
      <div className="cms-section-overlay">
        <SectionHeading section={section} />
        <SectionLink section={section} />
      </div>
    </section>
  );
}

function BannerSection({ section, onOpen }: { section: PageSection; onOpen: CmsPageSectionsProps["onOpen"] }) {
  const photo = section.coverPhoto ?? section.photos[0];
  if (!photo) return null;

  return (
    <section className="cms-section cms-section--banner">
      <SectionHeading section={section} />
      <button type="button" className="cms-banner-photo" onClick={() => onOpen(photo, section.photos)} aria-label={`${section.title ?? "Open"} ${photo.title}`}>
        <img
          src={sizedImageUrl(photo.src, 2000, 86)}
          srcSet={imageSrcSet(photo.src, [900, 1400, 2200], 86)}
          sizes="100vw"
          alt={photo.altText ?? `${photo.category} ${photo.title}`}
          width={photo.width}
          height={photo.height}
          loading="lazy"
          decoding="async"
        />
      </button>
      <SectionLink section={section} />
    </section>
  );
}

function FeatureCardsSection({ section, onOpen }: { section: PageSection; onOpen: CmsPageSectionsProps["onOpen"] }) {
  if (!section.photos.length) return null;

  return (
    <section className="cms-section cms-section--feature-cards">
      <SectionHeading section={section} />
      <div className="feature-grid" aria-label={section.title ?? "Featured photography groups"}>
        {section.photos.map((photo) => (
          <button type="button" className="feature-card" key={photo.id} onClick={() => onOpen(photo, section.photos)} aria-label={`${section.title ?? "Open"} ${photo.title}`}>
            <img
              src={sizedImageUrl(photo.src, 900, 82)}
              srcSet={imageSrcSet(photo.src, [520, 820, 1100], 82)}
              sizes="(max-width: 640px) 100vw, 33vw"
              alt={photo.altText ?? `${section.title ?? ""} ${photo.title}`.trim()}
              loading="lazy"
              decoding="async"
            />
            <span>{photo.title}</span>
          </button>
        ))}
      </div>
      <SectionLink section={section} />
    </section>
  );
}

function SplitSection({ section, onOpen }: { section: PageSection; onOpen: CmsPageSectionsProps["onOpen"] }) {
  const photo = section.coverPhoto ?? section.photos[0];
  if (!photo) return null;

  return (
    <section className="cms-section cms-section--split">
      <button type="button" className="cms-split-photo" onClick={() => onOpen(photo, section.photos)} aria-label={`${section.title ?? "Open"} ${photo.title}`}>
        <img src={sizedImageUrl(photo.src, 1400, 84)} alt={photo.altText ?? photo.title} width={photo.width} height={photo.height} loading="lazy" decoding="async" />
      </button>
      <div className="cms-split-copy">
        <SectionHeading section={section} />
        <SectionLink section={section} />
      </div>
    </section>
  );
}

function RenderSection({ section, onOpen }: { section: PageSection; onOpen: CmsPageSectionsProps["onOpen"] }) {
  if (!section.isVisible) return null;
  const className = `cms-section cms-section--${section.style}${section.theme ? ` cms-section--${section.theme}` : ""}`;

  if (section.style === "hero") return <HeroSection section={section} onOpen={onOpen} />;
  if (section.style === "banner") return <BannerSection section={section} onOpen={onOpen} />;
  if (section.style === "featureCards") return <FeatureCardsSection section={section} onOpen={onOpen} />;
  if (section.style === "split") return <SplitSection section={section} onOpen={onOpen} />;

  return (
    <section className={className}>
      {section.style === "landscapeCarousel" ? (
        <LandscapeSection
          id={section.id}
          title={section.title ?? ""}
          photos={section.photos}
          showTitle={section.showTitle}
          onOpen={onOpen}
        />
      ) : <SectionHeading section={section} />}
      {section.style === "carousel" ? <SectionCarousel photos={section.photos} onOpen={(photo) => onOpen(photo, section.photos)} /> : null}
      {section.style === "grid" ? <SectionGrid photos={section.photos} columns={section.columns} onOpen={(photo) => onOpen(photo, section.photos)} /> : null}
      {section.style === "stack" ? <SectionStack photos={section.photos} onOpen={(photo) => onOpen(photo, section.photos)} /> : null}
      <SectionLink section={section} />
    </section>
  );
}

export function CmsPageSections({ layout, onOpen }: CmsPageSectionsProps) {
  return (
    <div className="cms-page-sections">
      {layout.sections.map((section) => (
        <RenderSection key={section.id} section={section} onOpen={onOpen} />
      ))}
    </div>
  );
}
