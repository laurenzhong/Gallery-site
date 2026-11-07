import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { About } from "./components/About";
import { AdvancedPhotoLightbox } from "./components/AdvancedPhotoLightbox";
import { AgarunAtlasExperiment } from "./components/AgarunAtlasExperiment";
import { BalconyView } from "./components/BalconyView";
import { CmsSourceBadge } from "./components/CmsSourceBadge";
import { Footer } from "./components/Footer";
import { GpxTrailDemoExperiment } from "./components/GpxTrailDemoExperiment";
import { GallerySections } from "./components/GallerySections";
import { Header } from "./components/Header";
import { Home } from "./components/Home";
import { ExperimentIndex } from "./components/ExperimentIndex";
import { JourneyMapExperiment } from "./components/JourneyMapExperiment";
import { LookButNoStoppingExperiment } from "./components/LookButNoStoppingExperiment";
import { Journal } from "./components/Journal";
import { MetroExperiment } from "./components/MetroExperiment";
import { MapHubDemo } from "./components/MapHubDemo";
import { PhotoMapExperiment } from "./components/PhotoMapExperiment";
import { PhotographyArchiveExperiment } from "./components/PhotographyArchiveExperiment";
import { ReferenceArchiveExperiment } from "./components/ReferenceArchiveExperiment";
import { SashaKurmazExperiment } from "./components/SashaKurmazExperiment";
import { YearArchiveExperiment } from "./components/YearArchiveExperiment";
import { PhotoStory } from "./components/PhotoStory";
import { StoryDetail } from "./components/StoryDetail";
import { TrailRouteExperiment } from "./components/TrailRouteExperiment";
import { VisualEditingBridge } from "./components/VisualEditingBridge";
import type { Photo } from "./data/photos";
import { useGalleryContent } from "./lib/galleryContent";
import { imageSrcSet, sizedImageUrl } from "./lib/imageUrl";
import { usePageContentPreview } from "./lib/pageContentPreview";
import { matchesPhotoSlug, matchesStorySlug, photoPath } from "./lib/routes";

const PhotoMapMapLibreExperiment = lazy(() =>
  import("./components/PhotoMapMapLibreExperiment").then((module) => ({ default: module.PhotoMapMapLibreExperiment })),
);

const SITE_TITLE = "Queenstown.top | Photography";
const DEFAULT_DESCRIPTION =
  "Queenstown.top 是 JiaKaiZhong 的摄影档案，记录山野、海港、森林、城市边缘与旅行片段。";

function setMeta(name: string, content: string, attribute: "name" | "property" = "name") {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, name);
    document.head.append(tag);
  }
  tag.content = content;
}

function App() {
  const [lightboxState, setLightboxState] = useState<{ photos: Photo[]; index: number } | null>(null);
  const lightboxReturnPath = useRef<string | null>(null);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname.replace(/\/$/, "") || "/");
  const content = useGalleryContent();
  const { photos, photoMeta, photoStories, aboutData, homepageLayout, photobalconyLayout } = content;
  const pathname = currentPath;
  const isBalconyPage = pathname === "/photobalcony";
  const isPhotographyPage = pathname === "/photography";
  const isStoryPage = pathname === "/photostory";
  const isAboutPage = pathname === "/about";
  const isJournalPage = pathname === "/journal";
  const isMapPage = pathname === "/map";
  const isFooterPreviewPage = pathname === "/footer-preview";
  const isExperimentsPage = pathname === "/experiments";
  const isJourneyExperimentPage = pathname === "/experiments/journey-map";
  const isLookButExperimentPage = pathname === "/experiments/look-but-no-stopping";
  const isLookButFvmExperimentPage = pathname === "/experiments/look-but-no-stopping-fvm";
  const isMetroExperimentPage = pathname === "/experiments/metro";
  const isReferenceArchivePage = pathname === "/experiments/reference-archive";
  const isPhotographyArchivePage = pathname === "/experiments/photography-archive";
  const isSashaKurmazPage = pathname === "/experiments/sasha-kurmaz";
  const isYearArchivePage = pathname === "/experiments/year-archive";
  const isAgarunAtlasPage = pathname === "/experiments/agarun-atlas";
  const isPhotoMapExperimentPage = pathname === "/experiments/photo-map";
  const isPhotoMapMapLibrePage = pathname === "/experiments/photo-map-maplibre";
  const isTrailRoutePage = pathname === "/experiments/trail-route";
  const isGpxTrailDemoPage = pathname === "/experiments/trail-route-gpx-demo";
  const photoRouteSlug = pathname.startsWith("/photos/") ? decodeURIComponent(pathname.slice("/photos/".length)) : "";
  const storyRouteSlug = pathname.startsWith("/stories/") ? decodeURIComponent(pathname.slice("/stories/".length)) : "";
  const showPreview = new URLSearchParams(window.location.search).has("preview");
  const pageContentMode = import.meta.env.VITE_PAGE_CONTENT_MODE ?? "stable";
  const pageContentQuery = new URLSearchParams(window.location.search).get("page-content-preview");
  const showPageContentPreview =
    pageContentMode === "preview" ||
    pageContentMode === "production" ||
    pageContentQuery === "1" ||
    pageContentQuery === "true";
  const pageContentPreview = usePageContentPreview(showPageContentPreview, photos);
  const previewHome = pageContentPreview.pages.home;
  const previewBalcony = pageContentPreview.pages.photobalcony;

  const heroPhoto = useMemo(() => {
    if (content.isLoading && content.source === "static") {
      return content.heroPhoto;
    }

    return previewHome?.heroPhoto
      ?? content.heroPhoto
      ?? photos.find((photo) => photo.filename === "DSC_0638.JPG")
      ?? photos.find((photo) => photo.isHero)
      ?? photos.find((photo) => photo.filename === "DSC_0257.JPG")
      ?? photos[0];
  }, [content.heroPhoto, content.isLoading, content.source, photos, previewHome?.heroPhoto]);

  const activePhoto = useMemo(() => {
    if (!photoRouteSlug) return undefined;
    return photos.find((photo) => matchesPhotoSlug(photo, photoRouteSlug));
  }, [photoRouteSlug, photos]);

  const activePhotoIndex = useMemo(() => {
    if (!photoRouteSlug) return -1;
    return photos.findIndex((photo) => matchesPhotoSlug(photo, photoRouteSlug));
  }, [photoRouteSlug, photos]);

  const activeStory = useMemo(() => {
    if (!storyRouteSlug) return undefined;

    for (const [filename, stories] of Object.entries(photoStories)) {
      const photo = photos.find((item) => item.filename === filename);
      if (!photo) continue;

      const story = stories.find((item) => matchesStorySlug(item, storyRouteSlug, photo));
      if (story) {
        return { photo, story };
      }
    }

    return undefined;
  }, [photoStories, photos, storyRouteSlug]);

  const activeLightbox =
    lightboxState ??
    (activePhotoIndex >= 0 ? { photos, index: activePhotoIndex } : null);

  const setBrowserPath = (path: string, mode: "push" | "replace" = "push") => {
    if (window.location.pathname === path) {
      setCurrentPath(path.replace(/\/$/, "") || "/");
      return;
    }

    window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", path);
    setCurrentPath(path.replace(/\/$/, "") || "/");
  };

  const setLightboxPath = (path: string, mode: "push" | "replace") => {
    window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", path);
  };

  useEffect(() => {
    if (!photoRouteSlug || !activePhoto) return;

    const canonicalPath = photoPath(activePhoto);
    if (pathname !== canonicalPath) {
      setBrowserPath(canonicalPath, "replace");
    }
  }, [activePhoto, photoRouteSlug, pathname]);

  const openPhoto = (index: number, lightboxPhotos = photos) => {
    const photo = photos[index];
    if (!photo) return;

    const lightboxIndex = lightboxPhotos.findIndex((item) => item.id === photo.id);
    if (lightboxIndex < 0) return;

    lightboxReturnPath.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    setLightboxState({ photos: lightboxPhotos, index: lightboxIndex });
    setLightboxPath(photoPath(photo), "push");
  };

  const navigatePhoto = (index: number) => {
    if (!activeLightbox) return;
    const photo = activeLightbox.photos[index];
    if (!photo) return;

    setLightboxState({ photos: activeLightbox.photos, index });
    setLightboxPath(photoPath(photo), "replace");
  };

  const closePhoto = () => {
    setLightboxState(null);
    const browserPath = window.location.pathname.replace(/\/$/, "") || "/";
    if (browserPath.startsWith("/photos/")) {
      const rememberedPath = lightboxReturnPath.current;
      const returnPath = rememberedPath && !rememberedPath.startsWith("/photos/")
        ? rememberedPath
        : currentPath.startsWith("/photos/")
          ? "/"
          : currentPath;
      const returnUrl = returnPath || "/";
      window.history.replaceState({}, "", returnUrl);
      setCurrentPath(new URL(returnUrl, window.location.origin).pathname.replace(/\/$/, "") || "/");
    }
    lightboxReturnPath.current = null;
  };

  useEffect(() => {
    const onPopState = () => {
      const nextPath = window.location.pathname.replace(/\/$/, "") || "/";
      setCurrentPath(nextPath);
      if (!nextPath.startsWith("/photos/")) {
        setLightboxState(null);
      } else {
        const slug = decodeURIComponent(nextPath.slice("/photos/".length));
        const index = photos.findIndex((photo) => matchesPhotoSlug(photo, slug));
        setLightboxState(index >= 0 ? { photos, index } : null);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [photos]);

  useEffect(() => {
    const title = activePhoto?.title ?? activeStory?.story.title;
    const description =
      activeStory?.story.excerpt ??
      (activePhoto ? `${activePhoto.category} / ${activePhoto.filename}` : DEFAULT_DESCRIPTION);
    const image = activePhoto?.src ?? activeStory?.photo.src ?? heroPhoto?.src;

    const pageTitle = title
      ? `${title} | Queenstown.top`
      : isPhotographyPage
        ? "Photography | Queenstown.top"
        : isMapPage
          ? "Map demo | Queenstown.top"
        : isJourneyExperimentPage
          ? "Journey map experiment | Queenstown.top"
          : isLookButExperimentPage
            ? "Look but no stopping experiment | Queenstown.top"
          : isLookButFvmExperimentPage
            ? "Look but no stopping / FreeVectorMaps study | Queenstown.top"
          : isMetroExperimentPage
            ? "Archive in motion experiment | Queenstown.top"
            : isReferenceArchivePage
              ? "Reference archive experiment | Queenstown.top"
            : isPhotographyArchivePage
              ? "Photography archive study | Queenstown.top"
            : isSashaKurmazPage
              ? "Sasha Kurmaz index study | Queenstown.top"
            : isYearArchivePage
              ? "Year archive study | Queenstown.top"
            : isAgarunAtlasPage
              ? "Atlas archive experiment | Queenstown.top"
            : isPhotoMapExperimentPage
              ? "Photo map experiment | Queenstown.top"
            : isPhotoMapMapLibrePage
              ? "Photo map / MapLibre experiment | Queenstown.top"
            : isTrailRoutePage
              ? "Trail route experiment | Queenstown.top"
            : isGpxTrailDemoPage
              ? "GPX trail route demo | Queenstown.top"
            : isExperimentsPage
              ? "Interaction lab | Queenstown.top"
        : pathname === "/"
          ? "Queenstown.top | Photography archive"
          : SITE_TITLE;
    document.title = pageTitle;
    setMeta("description", description);
    setMeta("og:title", pageTitle, "property");
    setMeta("og:description", description, "property");
    if (image) setMeta("og:image", image, "property");
  }, [
    activePhoto,
    activeStory,
    heroPhoto,
    isAgarunAtlasPage,
    isExperimentsPage,
    isJourneyExperimentPage,
    isMapPage,
    isLookButExperimentPage,
    isLookButFvmExperimentPage,
    isMetroExperimentPage,
    isPhotoMapExperimentPage,
    isPhotoMapMapLibrePage,
    isPhotographyPage,
    isReferenceArchivePage,
    isPhotographyArchivePage,
    isSashaKurmazPage,
    isYearArchivePage,
    isTrailRoutePage,
    isGpxTrailDemoPage,
    pathname,
  ]);

  return (
    <>
      <VisualEditingBridge enabled={showPreview} />
      <Header />

      <CmsSourceBadge content={content} />

      <main>
        {activeStory ? (
          <StoryDetail photo={activeStory.photo} story={activeStory.story} />
        ) : photoRouteSlug && activePhoto ? (
          <>
            <section className="page-title-band" id="top" aria-labelledby="page-title">
              <h1 id="page-title">Photography</h1>
            </section>

            <section className="hero" aria-label="Featured photograph">
              {heroPhoto ? (
                <img
                  className="hero-image"
                  src={sizedImageUrl(heroPhoto.src, 2400, 88)}
                  srcSet={imageSrcSet(heroPhoto.src, [1400, 2000, 2800], 88)}
                  sizes="100vw"
                  alt=""
                  aria-hidden="true"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              ) : null}
            </section>

            <GallerySections
              photos={photos}
              homepageLayout={previewHome?.homepageLayout ?? homepageLayout}
              onOpen={openPhoto}
            />
          </>
        ) : (photoRouteSlug || storyRouteSlug) && content.isLoading ? (
          <section className="detail-page detail-empty" aria-labelledby="detail-loading-title">
            <p className="detail-kicker">Loading</p>
            <h1 id="detail-loading-title">Loading this entry.</h1>
          </section>
        ) : photoRouteSlug || storyRouteSlug ? (
          <section className="detail-page detail-empty" aria-labelledby="detail-empty-title">
            <p className="detail-kicker">Not Found</p>
            <h1 id="detail-empty-title">This entry is not available.</h1>
            <a className="detail-related-link" href="/">
              <span>Back to Queenstown.top</span>
              <small>Return to the photography archive</small>
            </a>
          </section>
        ) : isBalconyPage ? (
          <BalconyView
            photos={photos}
            layout={previewBalcony?.photobalconyLayout ?? photobalconyLayout}
            photoMeta={photoMeta}
            photoStories={photoStories}
          />
        ) : isStoryPage ? (
          <PhotoStory photos={photos} photoMeta={photoMeta} photoStories={photoStories} aboutData={aboutData} />
        ) : isAboutPage ? (
          <About aboutData={aboutData} />
        ) : isJournalPage ? (
          <Journal photos={photos} photoStories={photoStories} />
        ) : isMapPage ? (
          <MapHubDemo photos={photos} onOpen={openPhoto} />
        ) : isPhotographyPage ? (
          <>
            <section className="page-title-band" id="top" aria-labelledby="page-title">
              <h1 id="page-title">Photography</h1>
            </section>

            <section className="hero" aria-label="Featured photograph">
              {heroPhoto ? (
                <img
                  className="hero-image"
                  src={sizedImageUrl(heroPhoto.src, 2400, 88)}
                  srcSet={imageSrcSet(heroPhoto.src, [1400, 2000, 2800], 88)}
                  sizes="100vw"
                  alt=""
                  aria-hidden="true"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              ) : null}
            </section>

            {showPreview && (
              <a className="story-test-cta" href="/photostory" aria-label="Open photo notes and stories">
                <span className="story-test-cta-tag">Photo Notes</span>
                <span className="story-test-cta-text">
                  Read locations, camera settings, and field notes behind selected photographs.
                </span>
                <span className="story-test-cta-arrow" aria-hidden="true">-&gt;</span>
              </a>
            )}

            <GallerySections
              photos={photos}
              homepageLayout={previewHome?.homepageLayout ?? homepageLayout}
              onOpen={openPhoto}
            />
          </>
        ) : isExperimentsPage ? (
          <ExperimentIndex />
        ) : isJourneyExperimentPage ? (
          <JourneyMapExperiment photos={photos} onOpen={openPhoto} />
        ) : isLookButExperimentPage ? (
          <LookButNoStoppingExperiment photos={photos} onOpen={openPhoto} />
        ) : isLookButFvmExperimentPage ? (
          <LookButNoStoppingExperiment
            photos={photos}
            onOpen={openPhoto}
            mapSrc="/lookbut-map-fvm.svg"
            mapCredit={{ label: "Map by FreeVectorMaps.com", href: "https://freevectormaps.com/hong-kong/HK-EPS-02-0003" }}
          />
        ) : isMetroExperimentPage ? (
          <MetroExperiment photos={photos} onOpen={openPhoto} />
        ) : isReferenceArchivePage ? (
          <ReferenceArchiveExperiment photos={photos} photoStories={photoStories} onOpen={openPhoto} />
        ) : isPhotographyArchivePage ? (
          <PhotographyArchiveExperiment photos={photos} photoStories={photoStories} onOpen={openPhoto} />
        ) : isSashaKurmazPage ? (
          <SashaKurmazExperiment photos={photos} onOpen={openPhoto} />
        ) : isYearArchivePage ? (
          <YearArchiveExperiment photos={photos} photoMeta={photoMeta} onOpen={openPhoto} />
        ) : isAgarunAtlasPage ? (
          <AgarunAtlasExperiment photos={photos} onOpen={openPhoto} />
        ) : isPhotoMapExperimentPage ? (
          <PhotoMapExperiment photos={photos} onOpen={openPhoto} />
        ) : isPhotoMapMapLibrePage ? (
          <Suspense fallback={<section className="photo-map-experiment-loading" aria-label="Loading MapLibre experiment">Loading MapLibre…</section>}>
            <PhotoMapMapLibreExperiment photos={photos} onOpen={openPhoto} />
          </Suspense>
        ) : isTrailRoutePage ? (
          <TrailRouteExperiment photos={photos} onOpen={openPhoto} />
        ) : isGpxTrailDemoPage ? (
          <GpxTrailDemoExperiment photos={photos} onOpen={openPhoto} />
        ) : isFooterPreviewPage ? (
          <section className="footer-preview-stage" aria-labelledby="footer-preview-title">
            <p className="footer-preview-kicker">Design study</p>
            <h1 id="footer-preview-title">Footer Background</h1>
          </section>
        ) : (
          <Home
            photos={photos}
            heroPhoto={heroPhoto}
            homepageLayout={previewHome?.homepageLayout ?? homepageLayout}
            photoStories={photoStories}
            aboutData={aboutData}
            onOpen={openPhoto}
          />
        )}
      </main>

      <Footer aboutData={aboutData} showPreview={showPreview} variant="photo" />

      {activeLightbox && (
        <AdvancedPhotoLightbox
          photos={activeLightbox.photos}
          index={activeLightbox.index}
          onClose={closePhoto}
          onNavigate={navigatePhoto}
          photoMeta={photoMeta}
          photoStories={photoStories}
        />
      )}
    </>
  );
}

export default App;
