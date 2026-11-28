import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Photo } from "../data/photos";
import { enableVerticalGalleryScroll } from "../lib/galleryRailScroll";
import type { HomepageContentSection, HomepageLayout } from "../lib/homepageLayout";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { enableMobileGalleryScroll, mobileGalleryScrollQuery } from "../lib/mobileGalleryScroll";
import { LandscapeSection } from "./LandscapeSection";

type GallerySectionsProps = {
  photos: Photo[];
  homepageLayout?: HomepageLayout;
  onOpen: (index: number, lightboxPhotos?: Photo[]) => void;
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

const photoIndex = (photos: Photo[], photo: Photo) => photos.findIndex((item) => item.id === photo.id);

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
  allPhotos,
  onOpen,
  showTitle = true,
  scrollWithVerticalInput = false,
  followingBanner,
}: {
  group: PhotoGroup;
  allPhotos: Photo[];
  onOpen: (index: number, lightboxPhotos?: Photo[]) => void;
  showTitle?: boolean;
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

    const mobileScroll = window.matchMedia(mobileGalleryScrollQuery);
    let disableScroll: (() => void) | undefined;
    const attachScroll = () => {
      disableScroll?.();
      disableScroll = mobileScroll.matches
        ? enableMobileGalleryScroll(stage, frame, rail, () => setPreloadPhotos(true))
        : enableVerticalGalleryScroll(rail);
    };

    attachScroll();
    mobileScroll.addEventListener("change", attachScroll);
    return () => {
      mobileScroll.removeEventListener("change", attachScroll);
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

      <div
        ref={railRef}
        className={`gallery-rail gallery-rail--${group.variant ?? "cinema"}${scrollWithVerticalInput ? " gallery-rail--vertical-input" : ""}`}
      >
        {group.photos.map((photo) => (
          <button
            type="button"
            className="rail-photo"
            key={`${group.id}-${photo.id}`}
            onClick={() => onOpen(photoIndex(allPhotos, photo))}
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
  allPhotos,
  onOpen,
}: {
  photo: Photo | undefined;
  allPhotos: Photo[];
  onOpen: (index: number, lightboxPhotos?: Photo[]) => void;
}) {
  if (!photo) return null;

  return (
    <button type="button" className="wide-banner" onClick={() => onOpen(photoIndex(allPhotos, photo))} aria-label={`Open ${photo.title}`}>
      <img
        src={sizedImageUrl(photo.src, 1800, 84)}
        srcSet={imageSrcSet(photo.src, [900, 1400, 2000], 84)}
        sizes="100vw"
        alt={`${photo.category} ${photo.title}`}
        loading="lazy"
        decoding="async"
      />
    </button>
  );
}

function referenceImageWidth(className: string) {
  if (className.includes("banner") || className.includes("full")) return 1800;
  if (className.includes("feature")) return 1200;
  return 820;
}

function ReferencePhoto({
  photo,
  allPhotos,
  onOpen,
  className,
  loading = "lazy",
}: {
  photo: Photo;
  allPhotos: Photo[];
  onOpen: (index: number) => void;
  className: string;
  loading?: "eager" | "lazy";
}) {
  const imageWidth = referenceImageWidth(className);

  return (
    <button
      type="button"
      className={`plants-reference-photo ${className}`}
      onClick={() => onOpen(photoIndex(allPhotos, photo))}
      aria-label={`Open ${photo.category} ${photo.title}`}
    >
      <img
        src={sizedImageUrl(photo.src, imageWidth)}
        srcSet={imageSrcSet(photo.src, [Math.round(imageWidth * 0.55), imageWidth, Math.round(imageWidth * 1.3)])}
        sizes={className.includes("banner") || className.includes("full") ? "100vw" : "(max-width: 640px) 100vw, 50vw"}
        alt={`${photo.category} ${photo.title}`}
        width={photo.width}
        height={photo.height}
        loading={loading}
        decoding="async"
      />
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
  allPhotos,
  onOpen,
}: {
  id: string;
  title: string;
  heroPhoto: Photo;
  carouselPhotos: Photo[];
  featurePhoto?: Photo;
  stackPhotos: Photo[];
  squarePhotos: Photo[];
  allPhotos: Photo[];
  onOpen: (index: number, lightboxPhotos?: Photo[]) => void;
}) {
  return (
    <section className="plants-reference" id={id} aria-label={`${title} gallery`}>
      <ReferencePhoto
        photo={heroPhoto}
        allPhotos={allPhotos}
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
        onOpen={(photo, carouselPhotos) => onOpen(photoIndex(allPhotos, photo), carouselPhotos)}
      />

      {featurePhoto ? (
        <div className="plants-reference-feature" aria-label={`${title} feature`}>
          <ReferencePhoto
            photo={featurePhoto}
            allPhotos={allPhotos}
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
              allPhotos={allPhotos}
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
            allPhotos={allPhotos}
            onOpen={onOpen}
            className="plants-reference-square"
          />
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <div className="section-title-row section-title-row--compact">
      <h2>{title}</h2>
    </div>
  );
}

function FeatureCardImage({ photo, title }: { photo: Photo; title: string }) {
  // Production uses Sanity and does not include the local source photos.
  if (import.meta.env.PROD && photo.src.startsWith("/photos/")) return null;

  return (
    <img
      src={sizedImageUrl(photo.src, 900, 82)}
      srcSet={imageSrcSet(photo.src, [320, 520, 820, 1100], 82)}
      sizes="(max-width: 640px) 55vw, 33vw"
      alt={`${title} ${photo.title}`}
      loading="eager"
      decoding="async"
    />
  );
}

function isQuietRail(section: HomepageContentSection | undefined) {
  return section?.kind === "gallery" && section.presentation === "squareRail" && section.slotKey === "quiet";
}

function HomepageBanner({ section, photos, onOpen }: {
  section: Extract<HomepageContentSection, { kind: "banner" }>;
  photos: Photo[];
  onOpen: GallerySectionsProps["onOpen"];
}) {
  if (section.slotKey === "harbor") {
    return (
      <section className="plants-reference" id={section.id} aria-label={`${section.title ?? "Harbor"} gallery`}>
        <SectionTitle title={section.title} />
        <ReferencePhoto photo={section.photo} allPhotos={photos} onOpen={onOpen} className="plants-reference-banner" />
      </section>
    );
  }

  return (
    <section aria-label={section.title ?? "Banner"}>
      <SectionTitle title={section.title} />
      <BannerImage photo={section.photo} allPhotos={photos} onOpen={onOpen} />
    </section>
  );
}

function OrderedHomepageSections({
  sections,
  photos,
  onOpen,
}: {
  sections: HomepageContentSection[];
  photos: Photo[];
  onOpen: (index: number, lightboxPhotos?: Photo[]) => void;
}) {
  const firstCarousel = sections.find((section) => section.kind === "gallery" && section.presentation === "landscapeCarousel");
  return (
    <section className="reference-content" id="photography" aria-label="Photography archive">
      {sections.map((section, index) => {
        if (section.kind === "featureCards") {
          return (
            <div className="feature-grid" aria-label={section.title ?? "Featured photography groups"} key={section.id}>
              {section.cards.map((card) => {
                const cardContent = (
                  <>
                    <FeatureCardImage key={card.photo.src} photo={card.photo} title={card.title} />
                    <span>{card.title}</span>
                  </>
                );

                return card.href ? (
                  <a className="feature-card feature-card--link" href={card.href} key={`${section.id}-${card.title}`} aria-label={card.title}>
                    {cardContent}
                  </a>
                ) : (
                  <div className="feature-card" key={`${section.id}-${card.title}`} aria-label={card.title}>
                    {cardContent}
                  </div>
                );
              })}
            </div>
          );
        }

        if (section.kind === "banner") {
          if (section.slotKey === "bannerOne" && isQuietRail(sections[index - 1])) return null;
          return <HomepageBanner section={section} photos={photos} onOpen={onOpen} key={section.id} />;
        }

        if (section.presentation === "landscapeCarousel") {
          return (
            <LandscapeSection
              id={section.id}
              key={section.id}
              title={section.title ?? "Gallery"}
              photos={section.photos}
              prioritizeFirst={section === firstCarousel}
              showTitle={Boolean(section.title && section.title.trim().toLowerCase() !== "carousel")}
              filterLandscape={false}
              onOpen={(photo, carouselPhotos) => onOpen(photoIndex(photos, photo), carouselPhotos)}
            />
          );
        }

        if (section.presentation === "squareRail") {
          const pinnedOnMobile = isQuietRail(section);
          const next = sections[index + 1];
          const followingBanner = pinnedOnMobile && next?.kind === "banner" && next.slotKey === "bannerOne"
            ? <HomepageBanner section={next} photos={photos} onOpen={onOpen} />
            : undefined;

          return (
            <GalleryRail
              key={section.id}
              group={{ id: section.id, title: section.title ?? "Gallery", photos: section.photos, variant: "square" }}
              allPhotos={photos}
              onOpen={onOpen}
              showTitle={false}
              scrollWithVerticalInput={pinnedOnMobile}
              followingBanner={followingBanner}
            />
          );
        }

        if (section.presentation === "stack") {
          return (
            <section className="plants-reference" id={section.id} key={section.id} aria-label={`${section.title ?? "Gallery"} stack`}>
              <SectionTitle title={section.title} />
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
                      allPhotos={photos}
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
            <SectionTitle title={section.title} />
            <div className="plants-reference-squares">
              {section.photos.map((photo) => (
                <ReferencePhoto
                  key={`${section.id}-${photo.id}`}
                  photo={photo}
                  allPhotos={photos}
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
  if (homepageLayout?.sections?.length) {
    return <OrderedHomepageSections sections={homepageLayout.sections} photos={photos} onOpen={onOpen} />;
  }

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
        onOpen={(photo, carouselPhotos) => onOpen(photoIndex(photos, photo), carouselPhotos)}
      />
      <GalleryRail
        group={groups[1]}
        allPhotos={photos}
        onOpen={onOpen}
        showTitle={false}
        scrollWithVerticalInput
        followingBanner={<BannerImage photo={bannerOne} allPhotos={photos} onOpen={onOpen} />}
      />
      <LandscapeSection
        id={groups[2].id}
        title={groups[2].title}
        photos={groups[2].photos}
        filterLandscape={false}
        onOpen={(photo, carouselPhotos) => onOpen(photoIndex(photos, photo), carouselPhotos)}
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
          allPhotos={photos}
          onOpen={onOpen}
        />
      ) : null}
    </section>
  );
}
