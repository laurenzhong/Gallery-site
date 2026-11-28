import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Photo } from "../data/photos";
import type { HomepageContentSection, HomepageLayout } from "../lib/homepageLayout";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { enablePinnedGalleryScroll } from "../lib/pinnedGalleryScroll";
import { LandscapeSection } from "./LandscapeSection";

const BalconyPhotoGroup = lazy(() => import("./BalconyView").then((module) => ({ default: module.BalconyPhotoGroup })));

type OpenGalleryPhoto = (photo: Photo, lightboxPhotos: Photo[]) => void;

type GallerySectionsProps = {
  photos: Photo[];
  homepageLayout?: HomepageLayout;
  onOpen: OpenGalleryPhoto;
};

type PhotoGroup = {
  id: string;
  title: string;
  photos: Photo[];
  variant?: "square" | "cinema" | "mixed";
};

const byCategory = (photos: Photo[], category: string, count: number, offset = 0) =>
  photos.filter((photo) => photo.category === category).slice(offset, offset + count);

const byAspect = (photos: Photo[], kind: "landscape" | "portrait" | "square") =>
  photos.filter((photo) => {
    const ratio = photo.width / photo.height;
    if (kind === "landscape") return ratio > 1.2;
    if (kind === "portrait") return ratio < 0.82;
    return ratio >= 0.82 && ratio <= 1.2;
  });

const landscapeOnly = (items: Photo[]) => items.filter((photo) => photo.width / photo.height > 1.2);

const byFilenames = (photos: Photo[], filenames: string[]) =>
  filenames.flatMap((filename) => {
    const photo = photos.find((item) => item.filename === filename);
    return photo ? [photo] : [];
  });

const configuredPhotos = (layout: HomepageLayout | undefined, photos: Photo[] | undefined, fallback: Photo[]) =>
  layout ? (photos ?? []) : fallback;

function uniquePhotos(...groups: Photo[][]) {
  const seen = new Set<string>();
  return groups.flat().filter((photo) => {
    if (seen.has(photo.id)) return false;
    seen.add(photo.id);
    return true;
  });
}

function GalleryRail({
  group,
  onOpen,
  showTitle = true,
  description,
  scrollWithVerticalInput = false,
  followingBanner,
}: {
  group: PhotoGroup;
  onOpen: OpenGalleryPhoto;
  showTitle?: boolean;
  description?: string;
  scrollWithVerticalInput?: boolean;
  followingBanner?: ReactNode;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [preloadPhotos, setPreloadPhotos] = useState(false);

  useEffect(() => {
    const rail = railRef.current;
    const stage = stageRef.current;
    const frame = frameRef.current;
    if (!scrollWithVerticalInput || !rail || !stage || !frame) return;

    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    let disableScroll: (() => void) | undefined;
    const attachScroll = () => {
      disableScroll?.();
      disableScroll = motion.matches
        ? enablePinnedGalleryScroll(stage, frame, rail, () => setPreloadPhotos(true))
        : undefined;
    };

    attachScroll();
    motion.addEventListener("change", attachScroll);
    return () => {
      motion.removeEventListener("change", attachScroll);
      disableScroll?.();
    };
  }, [scrollWithVerticalInput, group.photos.length]);

  const gallery = (
    <section
      className="collection-section"
      id={group.id}
      aria-label={showTitle ? undefined : `${group.title} gallery`}
      aria-labelledby={showTitle ? `${group.id}-title` : undefined}
    >
      {showTitle ? (
        <div className="section-title-row">
          <h2 id={`${group.id}-title`}>{group.title}</h2>
        </div>
      ) : null}
      {description ? <p className="page-module-description">{description}</p> : null}

      <div
        ref={railRef}
        className={`gallery-rail gallery-rail--${group.variant ?? "cinema"}${scrollWithVerticalInput ? " gallery-rail--vertical-input" : ""}`}
      >
        {group.photos.map((photo) => (
          <button
            type="button"
            className="rail-photo"
            key={`${group.id}-${photo.id}`}
            onClick={() => onOpen(photo, group.photos)}
            aria-label={`Open ${group.title} ${photo.title}`}
          >
            <img
              src={sizedImageUrl(photo.src, group.variant === "square" ? 720 : 980)}
              srcSet={imageSrcSet(photo.src, group.variant === "square" ? [420, 720, 960] : [640, 980, 1320])}
              sizes={group.variant === "square" ? "(max-width: 640px) 48vw, 25vw" : "(max-width: 640px) 82vw, 34vw"}
              alt={`${photo.category} ${photo.title}`}
              loading={preloadPhotos ? "eager" : "lazy"}
              fetchPriority={preloadPhotos ? "low" : undefined}
              decoding="async"
            />
          </button>
        ))}
      </div>
    </section>
  );

  return scrollWithVerticalInput ? (
    <div className="gallery-rail-stage" ref={stageRef}>
      <div className="gallery-rail-stage-frame" ref={frameRef}>
        {gallery}
        {followingBanner}
      </div>
    </div>
  ) : gallery;
}

function BannerImage({
  photo,
  onOpen,
  href,
  label,
}: {
  photo: Photo | undefined;
  onOpen: OpenGalleryPhoto;
  href?: string;
  label?: string;
}) {
  if (!photo) return null;

  const image = (
      <img
        src={sizedImageUrl(photo.src, 1800, 84)}
        srcSet={imageSrcSet(photo.src, [900, 1400, 2000], 84)}
        sizes="100vw"
        alt={photo.altText || `${photo.category} ${photo.title}`}
        loading="lazy"
        decoding="async"
      />
  );
  return href ? (
    <a className="wide-banner" href={href} aria-label={label || photo.title}>{image}{label && <span className="page-module-link-label">{label}</span>}</a>
  ) : (
    <button type="button" className="wide-banner" onClick={() => onOpen(photo, [photo])} aria-label={`Open ${photo.title}`}>{image}</button>
  );
}

function referenceImageWidth(className: string) {
  if (className.includes("banner") || className.includes("full")) return 1800;
  if (className.includes("feature")) return 1200;
  return 820;
}

function ReferencePhoto({
  photo,
  lightboxPhotos = [photo],
  onOpen,
  className,
  loading = "lazy",
  href,
  label,
}: {
  photo: Photo;
  lightboxPhotos?: Photo[];
  onOpen: GallerySectionsProps["onOpen"];
  className: string;
  loading?: "eager" | "lazy";
  href?: string;
  label?: string;
}) {
  const imageWidth = referenceImageWidth(className);
  const image = (
      <img
        src={sizedImageUrl(photo.src, imageWidth)}
        srcSet={imageSrcSet(photo.src, [Math.round(imageWidth * 0.55), imageWidth, Math.round(imageWidth * 1.3)])}
        sizes={className.includes("banner") || className.includes("full") ? "100vw" : "(max-width: 640px) 100vw, 50vw"}
        alt={photo.altText || `${photo.category} ${photo.title}`}
        width={photo.width}
        height={photo.height}
        loading={loading}
        decoding="async"
      />
  );
  const classes = `plants-reference-photo ${className}`;
  return href ? (
    <a className={classes} href={href} aria-label={label || photo.title}>{image}{label && <span className="page-module-link-label">{label}</span>}</a>
  ) : (
    <button type="button" className={classes} onClick={() => onOpen(photo, lightboxPhotos)} aria-label={`Open ${photo.category} ${photo.title}`}>
      {image}
    </button>
  );
}

function PlantsReferenceLayout({
  id,
  title,
  heroPhoto,
  carouselPhotos,
  featurePhoto,
  stackPhotos,
  squarePhotos,
  onOpen,
}: {
  id: string;
  title: string;
  heroPhoto: Photo;
  carouselPhotos: Photo[];
  featurePhoto?: Photo;
  stackPhotos: Photo[];
  squarePhotos: Photo[];
  onOpen: OpenGalleryPhoto;
}) {
  return (
    <section className="plants-reference" id={id} aria-label={`${title} gallery`}>
      <ReferencePhoto
        photo={heroPhoto}
        onOpen={onOpen}
        className="plants-reference-banner"
        loading="eager"
      />

      <LandscapeSection
        id={`${id}-carousel`}
        title={`${title} carousel`}
        photos={carouselPhotos}
        showTitle={false}
        className="plants-reference-carousel"
        filterLandscape={false}
        onOpen={onOpen}
      />

      {featurePhoto ? (
        <div className="plants-reference-feature" aria-label={`${title} feature`}>
          <ReferencePhoto
            photo={featurePhoto}
            onOpen={onOpen}
            className="plants-reference-feature-photo"
          />
        </div>
      ) : null}

      <div className="plants-reference-stack" aria-label={`${title} full-width gallery`}>
        {stackPhotos.map((photo) => {
          const ratio = photo.width / photo.height;
          const sizeClass =
            ratio < 0.82
              ? "plants-reference-full--portrait"
              : ratio > 1.2
                ? "plants-reference-full--wide"
                : "plants-reference-full--four-three";

          return (
            <ReferencePhoto
              key={`plants-stack-${photo.id}`}
              photo={photo}
              lightboxPhotos={stackPhotos}
              onOpen={onOpen}
              className={`plants-reference-full ${sizeClass}`}
            />
          );
        })}
      </div>

      <div className="plants-reference-squares" aria-label={`${title} square gallery`}>
        {squarePhotos.map((photo) => (
          <ReferencePhoto
            key={`plants-square-${photo.id}`}
            photo={photo}
            lightboxPhotos={squarePhotos}
            onOpen={onOpen}
            className="plants-reference-square"
          />
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ title, description }: { title?: string; description?: string }) {
  if (!title && !description) return null;
  return (
    <>
      {title && <div className="section-title-row section-title-row--compact"><h2>{title}</h2></div>}
      {description && <p className="page-module-description">{description}</p>}
    </>
  );
}

function FeatureCardImage({ photo, title }: { photo: Photo; title: string }) {
  const [loaded, setLoaded] = useState(false);

  // Production uses Sanity and does not include the local source photos.
  if (import.meta.env.PROD && photo.src.startsWith("/photos/")) return null;

  return (
    <img
      src={sizedImageUrl(photo.src, 900, 82)}
      srcSet={imageSrcSet(photo.src, [520, 820, 1100], 82)}
      sizes="(max-width: 640px) 100vw, 33vw"
      alt={photo.altText || `${title} ${photo.title}`}
      loading="eager"
      fetchPriority="low"
      decoding="async"
      data-loaded={loaded}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(false)}
    />
  );
}

function isQuietRail(section: HomepageContentSection | undefined) {
  return section?.kind === "gallery" && section.presentation === "squareRail" && section.slotKey === "quiet";
}

function HomepageBanner({ section, onOpen }: {
  section: Extract<HomepageContentSection, { kind: "banner" }>;
  onOpen: GallerySectionsProps["onOpen"];
}) {
  if (section.slotKey === "harbor") {
    return (
      <section className="plants-reference" id={section.id} aria-label={`${section.title ?? "Harbor"} gallery`}>
        <SectionTitle title={section.title} description={section.description} />
        <ReferencePhoto photo={section.photo} onOpen={onOpen} className="plants-reference-banner" href={section.href} label={section.linkLabel} />
      </section>
    );
  }

  return (
    <section id={section.id} aria-label={section.title ?? "Banner"}>
      <SectionTitle title={section.title} description={section.description} />
      <BannerImage photo={section.photo} onOpen={onOpen} href={section.href} label={section.linkLabel} />
    </section>
  );
}

export function PageSections({
  sections,
  onOpen,
  home = false,
}: {
  sections: HomepageContentSection[];
  onOpen: OpenGalleryPhoto;
  home?: boolean;
}) {
  if (!sections.length) return null;
  const firstCarousel = home ? sections.find((section) => section.kind === "gallery" && section.presentation === "landscapeCarousel") : undefined;
  return (
    <section className="reference-content" id={home ? "photography" : "page-photo-modules"} aria-label={home ? "Photography archive" : "Photo collections"}>
      {sections.map((section, index) => {
        if (section.kind === "featureCards") {
          return (
            <section id={section.id} aria-label={section.title ?? "Featured photography groups"} key={section.id}>
              <SectionTitle title={section.id === "content-home-featured" && section.title === "Featured photography groups" ? undefined : section.title} description={section.description} />
              <div className="feature-grid" data-card-count={section.cards.length}>{section.cards.map((card) => {
                const cardContent = (
                  <>
                    <FeatureCardImage key={card.photo.src} photo={card.photo} title={card.title} />
                    <span>{card.title}{card.href && card.linkLabel && <small>{card.linkLabel}</small>}</span>
                  </>
                );

                return card.href ? (
                  <a className="feature-card feature-card--link" href={card.href} key={card.id}>
                    {cardContent}
                  </a>
                ) : (
                  <button className="feature-card feature-card--link" type="button" onClick={() => onOpen(card.photo, [card.photo])} key={card.id}>
                    {cardContent}
                  </button>
                );
              })}</div>
            </section>
          );
        }

        if (section.kind === "banner") {
          if (home && section.slotKey === "bannerOne" && isQuietRail(sections[index - 1])) return null;
          return <HomepageBanner section={section} onOpen={onOpen} key={section.id} />;
        }

        if (section.presentation === "landscapeCarousel") {
          return (
            <LandscapeSection
              id={section.id}
              key={section.id}
              title={section.title ?? "Gallery"}
              photos={section.photos}
              description={section.description}
              prioritizeFirst={section === firstCarousel}
              showTitle={Boolean(section.title && !(section.slotKey === "harborCarousel" && section.title === "carousel"))}
              filterLandscape={false}
              onOpen={onOpen}
            />
          );
        }

        if (section.presentation === "squareRail") {
          const pinnedOnMobile = home && isQuietRail(section);
          const next = sections[index + 1];
          const followingBanner = pinnedOnMobile && next?.kind === "banner" && next.slotKey === "bannerOne"
            ? <HomepageBanner section={next} onOpen={onOpen} />
            : undefined;

          return (
            <GalleryRail
              key={section.id}
              group={{ id: section.id, title: section.title ?? "Gallery", photos: section.photos, variant: "square" }}
              onOpen={onOpen}
              showTitle={Boolean(section.title && !(pinnedOnMobile && section.title === "Quiet moments"))}
              description={section.description}
              scrollWithVerticalInput={pinnedOnMobile}
              followingBanner={followingBanner}
            />
          );
        }

        if (section.presentation === "portraitRail" || section.presentation === "grid" || section.presentation === "leadGrid") {
          return (
            <section className="balcony-gallery page-module-balcony-gallery" id={section.id} key={section.id} aria-label={section.title ?? "Photo gallery"}>
              <SectionTitle title={section.title} description={section.description} />
              <Suspense fallback={null}>
                <BalconyPhotoGroup title={section.title ?? "Gallery"} presentation={section.presentation} photos={section.photos} onOpen={(photo) => onOpen(photo, section.photos)} />
              </Suspense>
            </section>
          );
        }

        if (section.presentation === "stack") {
          return (
            <section className="plants-reference" id={section.id} key={section.id} aria-label={`${section.title ?? "Gallery"} stack`}>
              <SectionTitle title={section.title} description={section.description} />
              <div className="plants-reference-stack">
                {section.photos.map((photo) => {
                  const ratio = photo.width / photo.height;
                  const sizeClass =
                    ratio < 0.82
                      ? "plants-reference-full--portrait"
                      : ratio > 1.2
                        ? "plants-reference-full--wide"
                        : "plants-reference-full--four-three";
                  return (
                    <ReferencePhoto
                      key={`${section.id}-${photo.id}`}
                      photo={photo}
                      lightboxPhotos={section.photos}
                      onOpen={onOpen}
                      className={`plants-reference-full ${sizeClass}`}
                    />
                  );
                })}
              </div>
            </section>
          );
        }

        return (
          <section className="plants-reference" id={section.id} key={section.id} aria-label={`${section.title ?? "Gallery"} square gallery`}>
            <SectionTitle title={section.title} description={section.description} />
            <div className="plants-reference-squares">
              {section.photos.map((photo) => (
                <ReferencePhoto
                  key={`${section.id}-${photo.id}`}
                  photo={photo}
                  lightboxPhotos={section.photos}
                  onOpen={onOpen}
                  className="plants-reference-square"
                />
              ))}
            </div>
          </section>
        );
      })}
    </section>
  );
}

export function GallerySections({ photos, homepageLayout, onOpen }: GallerySectionsProps) {
  const landscapeCandidates = uniquePhotos(
    byCategory(photos, "山野", 9),
    byCategory(photos, "日出日落", 8),
    byCategory(photos, "河流", 2),
    byCategory(photos, "海洋", 3),
  );
  const landscape = uniquePhotos(landscapeOnly(landscapeCandidates), landscapeCandidates);
  const cityCandidates = uniquePhotos(byCategory(photos, "石塘度假区", 18), byCategory(photos, "建筑", 2));
  const city = uniquePhotos(landscapeOnly(cityCandidates), cityCandidates);
  const harborCandidates = uniquePhotos(
    byCategory(photos, "harbor", 18),
    byCategory(photos, "Harbor", 18),
    byCategory(photos, "海洋", 3),
    byCategory(photos, "石塘度假区", 8),
  );
  const legacyPlantFallback = uniquePhotos(byCategory(photos, "花朵", 9), byCategory(photos, "森林", 5));
  const plants = uniquePhotos(landscapeOnly(harborCandidates), harborCandidates, landscapeOnly(legacyPlantFallback), legacyPlantFallback);
  const squareSet = byAspect(photos, "square").slice(0, 8);
  const mixedArchive = uniquePhotos(byAspect(photos, "portrait"), byAspect(photos, "landscape"), photos).slice(0, 30);

  const fallbackFeatureCards = [
    {
      id: "balcony-view",
      title: "Balcony View",
      photo: photos.find((photo) => photo.filename === "DSC_0243.JPG") ?? city[0] ?? photos[0],
      href: "/photobalcony",
    },
    { id: "auckland", title: "Auckland", photo: byCategory(photos, "海洋", 1)[0] ?? landscape[0] ?? photos[0] },
    { id: "australia", title: "Australia", photo: landscape[1] ?? landscape[0] ?? photos[0] },
  ];
  const featureCards = fallbackFeatureCards.map((fallbackCard, index) => {
    const configuredCard = homepageLayout?.featureCards?.[index];

    return configuredCard
      ? {
          id: fallbackCard.id,
          title: configuredCard.title,
          photo: configuredCard.photo,
          href: configuredCard.href,
        }
      : fallbackCard;
  });

  const groups: PhotoGroup[] = [
    {
      id: "landscape",
      title: "Landscape",
      photos: configuredPhotos(homepageLayout, homepageLayout?.landscapePhotos, landscape.slice(0, 24)),
      variant: "cinema",
    },
    {
      id: "quiet",
      title: "Quiet moments",
      photos: configuredPhotos(homepageLayout, homepageLayout?.quietPhotos, squareSet.length ? squareSet : plants.slice(0, 8)),
      variant: "square",
    },
    {
      id: "city",
      title: "City",
      photos: configuredPhotos(homepageLayout, homepageLayout?.cityPhotos, city.slice(0, 22)),
      variant: "cinema",
    },
    {
      id: "plants",
      title: "Harbor",
      photos: configuredPhotos(homepageLayout, homepageLayout?.plantsCarouselPhotos, plants.slice(0, 18)),
      variant: "cinema",
    },
  ];

  const bannerOne = homepageLayout?.bannerOnePhoto ?? byCategory(photos, "石塘度假区", 1, 8)[0] ?? city[0];
  const plantLandscapePhotos = byAspect(plants, "landscape");
  const plantPortraitPhotos = byAspect(plants, "portrait");
  const bannerTwo =
    homepageLayout?.plantsHeroPhoto ??
    photos.find((photo) => photo.filename === "DSC_5026.JPG") ??
    photos.find((photo) => photo.filename === "DSC_0555.JPG") ??
    plantLandscapePhotos[0] ??
    plants[0];
  const plantCarouselPhotos = groups[3].photos;
  const plantStackPhotos = configuredPhotos(
    homepageLayout,
    homepageLayout?.plantsStackPhotos,
    byFilenames(photos, ["DSC_3343.JPG", "DSC_2952.JPG", "DSC_3247.JPG", "DSC_0243.JPG", "DSC_0257.JPG"]),
  );
  const plantFeaturePhoto =
    homepageLayout?.plantsFeaturePhoto ??
    photos.find((photo) => photo.filename === "52f66c_f3b6720d4f004573ab558814dd14c842~mv2.avif");
  const plantSquarePhotos = configuredPhotos(
    homepageLayout,
    homepageLayout?.plantsSquarePhotos,
    uniquePhotos(plantPortraitPhotos.slice(1), plantLandscapePhotos.slice(8), mixedArchive).slice(0, 8),
  );

  return (
    <section className="reference-content" id="photography" aria-label="Photography archive">
      <div className="feature-grid" aria-label="Featured photography groups">
        {featureCards.map(({ id, title, photo, href }) => {
          const cardContent = (
            <>
              <FeatureCardImage key={photo.src} photo={photo} title={title} />
              <span>{title}</span>
            </>
          );

          return href ? (
            <a className="feature-card feature-card--link" href={href} key={id} aria-label={title}>
              {cardContent}
            </a>
          ) : (
            <div className="feature-card" key={id} aria-label={title}>
              {cardContent}
            </div>
          );
        })}
      </div>

      <LandscapeSection
        id={groups[0].id}
        title={groups[0].title}
        photos={groups[0].photos}
        prioritizeFirst
        onOpen={onOpen}
      />
      <GalleryRail
        group={groups[1]}
        onOpen={onOpen}
        showTitle={false}
        scrollWithVerticalInput
        followingBanner={<BannerImage photo={bannerOne} onOpen={onOpen} />}
      />
      <LandscapeSection
        id={groups[2].id}
        title={groups[2].title}
        photos={groups[2].photos}
        filterLandscape={false}
        onOpen={onOpen}
      />
      <div className="section-title-row section-title-row--compact">
        <h2>Harbor</h2>
      </div>
      {bannerTwo ? (
        <PlantsReferenceLayout
          id={groups[3].id}
          title={groups[3].title}
          heroPhoto={bannerTwo}
          carouselPhotos={plantCarouselPhotos}
          featurePhoto={plantFeaturePhoto}
          stackPhotos={plantStackPhotos}
          squarePhotos={plantSquarePhotos}
          onOpen={onOpen}
        />
      ) : null}
    </section>
  );
}
