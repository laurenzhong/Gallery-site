import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AdvancedPhotoLightbox } from "./components/AdvancedPhotoLightbox";
import { CmsSourceBadge } from "./components/CmsSourceBadge";
import { Footer } from "./components/Footer";
import { GallerySections, PageSections } from "./components/GallerySections";
import { Header } from "./components/Header";
import "./components/YearArchive.css";
import "./components/pageModules.css";
import type { Photo } from "./data/photos";
import { useGalleryContent } from "./lib/galleryContent";
import { imageSrcSet, sizedImageUrl } from "./lib/imageUrl";
import { adaptPageContent, photosForPlacement } from "./lib/pageContentAdapter";
import { contentPageKey, usesPublishedPageContent } from "./lib/pageContentPages";
import { pageDraftParameter, usePageDraftPreview } from "./lib/pageDraftPreview";
import { usePageContentPreview } from "./lib/pageContentPreview";
import { matchesPhotoSlug, matchesStorySlug, photoPath } from "./lib/routes";
import { isStudioPreview, useStudioPreview } from "./lib/studioPreview";

const About = lazy(() => import("./components/About").then((module) => ({ default: module.About })));
const AgarunAtlasExperiment = lazy(() => import("./components/AgarunAtlasExperiment").then((module) => ({ default: module.AgarunAtlasExperiment })));
const BalconyView = lazy(() => import("./components/BalconyView").then((module) => ({ default: module.BalconyView })));
const GpxTrailDemoExperiment = lazy(() => import("./components/GpxTrailDemoExperiment").then((module) => ({ default: module.GpxTrailDemoExperiment })));
const ExperimentIndex = lazy(() => import("./components/ExperimentIndex").then((module) => ({ default: module.ExperimentIndex })));
const JourneyMapExperiment = lazy(() => import("./components/JourneyMapExperiment").then((module) => ({ default: module.JourneyMapExperiment })));
const LookButNoStoppingExperiment = lazy(() => import("./components/LookButNoStoppingExperiment").then((module) => ({ default: module.LookButNoStoppingExperiment })));
const Journal = lazy(() => import("./components/Journal").then((module) => ({ default: module.Journal })));
const MetroExperiment = lazy(() => import("./components/MetroExperiment").then((module) => ({ default: module.MetroExperiment })));
const MapHubDemo = lazy(() => import("./components/MapHubDemo").then((module) => ({ default: module.MapHubDemo })));
const PhotoMapExperiment = lazy(() => import("./components/PhotoMapExperiment").then((module) => ({ default: module.PhotoMapExperiment })));
const PhotographyArchiveExperiment = lazy(() => import("./components/PhotographyArchiveExperiment").then((module) => ({ default: module.PhotographyArchiveExperiment })));
const ReferenceArchiveExperiment = lazy(() => import("./components/ReferenceArchiveExperiment").then((module) => ({ default: module.ReferenceArchiveExperiment })));
const SashaKurmazExperiment = lazy(() => import("./components/SashaKurmazExperiment").then((module) => ({ default: module.SashaKurmazExperiment })));
const PhotoStory = lazy(() => import("./components/PhotoStory").then((module) => ({ default: module.PhotoStory })));
const StoryDetail = lazy(() => import("./components/StoryDetail").then((module) => ({ default: module.StoryDetail })));
const TrailRouteExperiment = lazy(() => import("./components/TrailRouteExperiment").then((module) => ({ default: module.TrailRouteExperiment })));
const VisualEditingBridge = lazy(() => import("./components/VisualEditingBridge").then((module) => ({ default: module.VisualEditingBridge })));

const PhotoMapMapLibreExperiment = lazy(() =>
  import("./components/PhotoMapMapLibreExperiment").then((module) => ({ default: module.PhotoMapMapLibreExperiment })),
);
const YearArchiveExperiment = lazy(() => import("./components/YearArchiveExperiment"));

const SITE_TITLE = "Queenstown.top | Photography";
const PHOTOGRAPHY_HERO_WIDTHS = [640, 960, 1400, 2000, 2800];
const DEFAULT_DESCRIPTION =
  "Queenstown.top 是 JiaKaiZhong 的摄影档案，记录山野、海港、森林、城市边缘与旅行片段。";

type GalleryHistory = { returnPath: string; photoIds: string[] };

function lightboxFromHistory(photos: Photo[], slug: string, entry?: GalleryHistory) {
  if (!Array.isArray(entry?.photoIds)) {
    const index = photos.findIndex((photo) => matchesPhotoSlug(photo, slug));
    return index >= 0 ? { photos, index } : null;
  }

  const photosById = new Map(photos.map((photo) => [photo.id, photo]));
  const group = entry.photoIds.flatMap((id) => photosById.get(id) ?? []);
  const index = group.findIndex((item) => matchesPhotoSlug(item, slug));
  if (index >= 0) return { photos: group, index };

  const photo = photos.find((item) => matchesPhotoSlug(item, slug));
  return photo ? { photos: [photo], index: 0 } : null;
}

function setMeta(name: string, content: string, attribute: "name" | "property" = "name") {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, name);
    document.head.append(tag);
  }
  tag.content = content;
}

function detailSlug(path: string, prefix: string) {
  if (!path.startsWith(prefix)) return "";
  const slug = path.slice(prefix.length);
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function App() {
  const [lightboxState, setLightboxState] = useState<{ photos: Photo[]; index: number } | null>(null);
  const lightboxReturnPath = useRef<string | null>(null);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname.replace(/\/$/, "") || "/");
  const pathname = currentPath;
  const pageKey = contentPageKey(pathname);
  const isBalconyPage = pageKey === "photobalcony";
  const isPhotographyPage = pageKey === "home";
  const searchParams = new URLSearchParams(window.location.search);
  const showPreview = !isStudioPreview && searchParams.has("preview");
  const draftPageKey = window.parent !== window && searchParams.get(pageDraftParameter) === "1" ? pageKey : undefined;
  const draft = usePageDraftPreview(draftPageKey);
  const draftPage = draft?.document;
  const adaptedDraft = useMemo(() => draft?.document && adaptPageContent(draft.document, photosForPlacement(draft.photos), { draft: true }), [draft]);
  const showPageContentPreview = usesPublishedPageContent(import.meta.env.VITE_PAGE_CONTENT_MODE, window.location.search);
  const studioPreview = useStudioPreview(showPageContentPreview);
  const { content, publishedHeroPhoto, isPublishedHeroLoading } = useGalleryContent({
    useCacheInDevelopment: pathname === "/about",
    loadPublishedHeroEarly: isPhotographyPage,
    studioPreview,
  });
  const { photos, photoMeta, photoStories, aboutData, homepageLayout, photobalconyLayout } = content;
  const isLongGalleryPage = isPhotographyPage || isBalconyPage;
  const isStoryPage = pathname === "/photostory";
  const isAboutPage = pathname === "/about";
  const isJournalPage = pathname === "/journal";
  const isMapPage = pathname === "/map";
  const isMapRoutePage = pathname === "/map/route";
  const isFooterPreviewPage = pathname === "/footer-preview";
  const isExperimentsPage = pathname === "/experiments";
  const isJourneyExperimentPage = pathname === "/experiments/journey-map";
  const isLookButExperimentPage = pathname === "/experiments/look-but-no-stopping";
  const isLookButFvmExperimentPage = pathname === "/experiments/look-but-no-stopping-fvm";
  const isMetroExperimentPage = pathname === "/experiments/metro";
  const isReferenceArchivePage = pathname === "/experiments/reference-archive";
  const isPhotographyArchivePage = pathname === "/experiments/photography-archive";
  const isSashaKurmazPage = pathname === "/experiments/sasha-kurmaz";
  const isLocalArchivePreview = pathname === "/experiments/year-archive";
  const isArchivePage = pathname === "/archive";
  const isYearArchivePage = isArchivePage || isLocalArchivePreview;
  const isAgarunAtlasPage = pathname === "/experiments/agarun-atlas";
  const isPhotoMapExperimentPage = pathname === "/experiments/photo-map";
  const isPhotoMapMapLibrePage = pathname === "/experiments/photo-map-maplibre";
  const isTrailRoutePage = pathname === "/experiments/trail-route";
  const isGpxTrailDemoPage = pathname === "/experiments/trail-route-gpx-demo";
  const photoRouteSlug = detailSlug(pathname, "/photos/");
  const storyRouteSlug = detailSlug(pathname, "/stories/");
  const pageContentPreview = usePageContentPreview(showPageContentPreview, photos, studioPreview);
  const activePageContent = draftPageKey && draftPage !== null ? adaptedDraft : pageKey ? pageContentPreview.pages[pageKey] : undefined;
  const previewHome = draftPageKey === "home" && draftPage !== null ? adaptedDraft : pageContentPreview.pages.home;
  const controlledBalcony = activePageContent?.photobalconyLayout;
  const balconyLayout = useMemo(() => controlledBalcony ? {
    ...photobalconyLayout,
    ...controlledBalcony,
    heroPhoto: controlledBalcony.heroPhoto ?? photobalconyLayout?.heroPhoto,
  } : photobalconyLayout, [controlledBalcony, photobalconyLayout]);
  const homeSubtitle = previewHome?.subtitle || content.heroSubtitle;
  const siteTitle = content.siteTitle || "Queenstown.top";
  const isPhotographyLoading = draftPageKey ? draftPage === undefined : content.isLoading || pageContentPreview.isLoading;
  const publishedGallery = isPhotographyPage && !draftPageKey && (content.isLoading || content.error)
    ? pageContentPreview.publishedHomeGallery
    : undefined;
  const isPhotographyGalleryLoading = isPhotographyLoading && !publishedGallery;
  const heroPhoto = useMemo(() => {
    if (content.isLoading && content.source === "static" && !previewHome?.heroPhoto) {
      return content.heroPhoto;
    }

    return previewHome?.heroPhoto
      ?? content.heroPhoto
      ?? photos.find((photo) => photo.filename === "DSC_0638.JPG")
      ?? photos.find((photo) => photo.isHero)
      ?? photos.find((photo) => photo.filename === "DSC_0257.JPG")
      ?? photos[0];
  }, [content.heroPhoto, content.isLoading, content.source, photos, previewHome?.heroPhoto]);

  const useSiteSettingsHero = pageContentPreview.publishedHomeHero === null;
  const earlyPhotographyHero = isPhotographyPage && !draftPageKey
    ? useSiteSettingsHero ? publishedHeroPhoto : pageContentPreview.publishedHomeHero
    : undefined;
  const isPhotographyHeroLoading = !earlyPhotographyHero && (
    isPhotographyLoading || (isPhotographyPage && useSiteSettingsHero && isPublishedHeroLoading)
  );
  const photographyHero = earlyPhotographyHero ?? (isPhotographyHeroLoading ? undefined : heroPhoto);

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

  useEffect(() => {
    if (!photoRouteSlug || !activePhoto) return;

    const canonicalPath = photoPath(activePhoto);
    if (pathname !== canonicalPath) {
      setBrowserPath(canonicalPath, "replace");
    }
  }, [activePhoto, photoRouteSlug, pathname]);

  const openModulePhoto = (photo: Photo, lightboxPhotos: Photo[]) => {
    const lightboxIndex = lightboxPhotos.findIndex((item) => item.id === photo.id);
    if (lightboxIndex < 0) return;

    lightboxReturnPath.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    setLightboxState({ photos: lightboxPhotos, index: lightboxIndex });
    if (!draftPageKey) {
      const galleryLightbox: GalleryHistory = { returnPath: lightboxReturnPath.current, photoIds: lightboxPhotos.map((item) => item.id) };
      window.history.pushState({ galleryLightbox }, "", photoPath(photo));
    }
  };

  const openPhoto = (index: number, lightboxPhotos = photos) => {
    const photo = photos[index];
    if (photo) openModulePhoto(photo, lightboxPhotos);
  };

  const navigatePhoto = (index: number) => {
    if (!activeLightbox) return;
    const photo = activeLightbox.photos[index];
    if (!photo) return;

    setLightboxState({ photos: activeLightbox.photos, index });
    if (!draftPageKey) window.history.replaceState(window.history.state, "", photoPath(photo));
  };

  const closePhoto = () => {
    setLightboxState(null);
    const browserPath = window.location.pathname.replace(/\/$/, "") || "/";
    if (browserPath.startsWith("/photos/")) {
      if (window.history.state?.galleryLightbox) {
        window.history.back();
        return;
      }
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
    const onPopState = (event: PopStateEvent) => {
      const nextPath = window.location.pathname.replace(/\/$/, "") || "/";
      const entry = event.state?.galleryLightbox as GalleryHistory | undefined;
      if (!nextPath.startsWith("/photos/")) {
        setCurrentPath(nextPath);
        setLightboxState(null);
        lightboxReturnPath.current = null;
      } else {
        const slug = detailSlug(nextPath, "/photos/");
        const lightbox = lightboxFromHistory(photos, slug, entry);
        setCurrentPath(entry && lightbox ? new URL(entry.returnPath, window.location.origin).pathname.replace(/\/$/, "") || "/" : nextPath);
        setLightboxState(lightbox);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [photos]);

  const displayedPhoto = activeLightbox?.photos[activeLightbox.index] ?? activePhoto;
  useEffect(() => {
    const title = displayedPhoto?.title ?? activeStory?.story.title ?? (isAboutPage ? "About" : isJournalPage ? "Stories" : isBalconyPage ? balconyLayout?.title : isPhotographyPage ? previewHome?.title : undefined);
    const description =
      (displayedPhoto ? displayedPhoto.caption || displayedPhoto.altText || displayedPhoto.title : activeStory?.story.excerpt) ??
      (isPhotographyPage && homeSubtitle ? homeSubtitle
        : isBalconyPage && balconyLayout?.subtitle ? balconyLayout.subtitle
        : isYearArchivePage ? "Browse the Queenstown.top photo archive by capture year and month." : DEFAULT_DESCRIPTION);
    const image = displayedPhoto?.src ?? activeStory?.photo.src ?? (isBalconyPage ? balconyLayout?.heroPhoto?.src : undefined) ?? heroPhoto?.src;

    const pageTitle = title
      ? `${title} | ${siteTitle}`
      : isPhotographyPage
        ? "Photography | Queenstown.top"
        : isMapPage
          ? "Map | Queenstown.top"
        : isMapRoutePage
          ? "Route story | Queenstown.top"
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
              ? "Photo archive | Queenstown.top"
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
              : SITE_TITLE;
    document.title = pageTitle;
    setMeta("description", description);
    setMeta("og:title", pageTitle, "property");
    setMeta("og:description", description, "property");
    if (image) setMeta("og:image", image, "property");
  }, [
    displayedPhoto,
    isAboutPage,
    activeStory,
    balconyLayout,
    heroPhoto,
    homeSubtitle,
    isBalconyPage,
    previewHome?.title,
    siteTitle,
    isAgarunAtlasPage,
    isExperimentsPage,
    isJournalPage,
    isJourneyExperimentPage,
    isMapPage,
    isMapRoutePage,
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

  const homeSections = publishedGallery ?? previewHome?.sections;
  const supplementalModules = pageKey && pageKey !== "home" && activePageContent?.sections
    ? <PageSections sections={activePageContent.sections} onOpen={openModulePhoto} />
    : null;

  return (
    <>
      {(showPreview || isStudioPreview) && (
        <Suspense fallback={null}>
          <VisualEditingBridge enabled />
        </Suspense>
      )}
      <Header
        currentSection={pageKey ?? (isMapRoutePage ? "map" : storyRouteSlug ? "journal" : photoRouteSlug ? "home" : undefined)}
        pageTitle={isAboutPage ? "About" : isJournalPage ? "Stories" : isYearArchivePage ? <>Photo <em>archive</em></> : undefined}
        pageTitleClassName={isAboutPage || isJournalPage ? "site-header-page-title" : undefined}
        scrollWithPage={isJournalPage || isArchivePage ? "always" : isLongGalleryPage ? "mobile" : undefined}
      />

      {!isAboutPage && !isStudioPreview && <CmsSourceBadge content={content} />}

      <main className={isPhotographyPage && isPhotographyGalleryLoading ? "photography-loading" : undefined}>
        {draftPageKey && draftPage === undefined && <p className="page-draft-status" role="status">正在连接 Studio 草稿预览…</p>}
        {draftPageKey && draftPage === null && <p className="page-draft-status" role="status">尚未保存页面草稿。下方显示当前页面。</p>}
        {draftPageKey && !!adaptedDraft?.warnings.length && (
          <ul className="page-draft-status" aria-label="草稿内容提示">{adaptedDraft.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
        )}
        {activePageContent?.modulesPosition === "before" && supplementalModules}
        <Suspense fallback={isJournalPage ? <div className="journal-loading" role="status"><span className="sr-only">Loading stories…</span></div> : <p className="site-route-loading" role="status">Loading…</p>}>
          {studioPreview && !studioPreview.documents ? (
            <p className="site-route-loading" role={studioPreview.error ? "alert" : "status"}>
              {studioPreview.error ?? "正在读取 CMS 预览…"}
            </p>
          ) : activeStory ? (
            <StoryDetail photo={activeStory.photo} story={activeStory.story} onOpen={openModulePhoto} />
          ) : photoRouteSlug && activePhoto ? (
            <>
              <section className="page-title-band" id="top" aria-labelledby="page-title">
                <h1 id="page-title">{previewHome?.title || "Photography"}</h1>
                {homeSubtitle && <p className="page-title-subtitle">{homeSubtitle}</p>}
              </section>

              <section className="hero" aria-label="Featured photograph">
                {heroPhoto ? (
                  <img
                    className="hero-image"
                    src={sizedImageUrl(heroPhoto.src, 2400, 88)}
                    srcSet={imageSrcSet(heroPhoto.src, [1400, 2000, 2800], 88)}
                    sizes="100vw"
                    width={heroPhoto.width}
                    height={heroPhoto.height}
                    alt=""
                    aria-hidden="true"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                ) : null}
              </section>

              {previewHome?.sections ? <PageSections sections={previewHome.sections} onOpen={openModulePhoto} home /> : (
                <GallerySections photos={photos} homepageLayout={homepageLayout} onOpen={openModulePhoto} />
              )}
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
            !draftPageKey && !controlledBalcony?.heroPhoto && (content.isLoading || pageContentPreview.isLoading) ? (
              <div className="balcony-hero" role="status"><span className="sr-only">Loading Balcony View…</span></div>
            ) : <BalconyView
              photos={photos}
              layout={balconyLayout}
              photoMeta={photoMeta}
              photoStories={photoStories}
            />
          ) : isStoryPage ? (
            <PhotoStory photos={photos} photoMeta={photoMeta} photoStories={photoStories} aboutData={aboutData} />
          ) : isAboutPage ? (
            <About aboutData={aboutData} />
          ) : isJournalPage ? (
            <Journal photos={photos} photoStories={photoStories}
              loading={content.isLoading && content.source !== "cms"}
              failed={Boolean(content.error) && content.source !== "cms"} />
          ) : isMapPage ? (
            <MapHubDemo photos={photos} onOpen={openPhoto}
              publishedDataStatus={content.source === "static" && (content.isLoading || content.error)
                ? (content.isLoading ? "loading" : "error") : undefined}
            />
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
            <Suspense fallback={<p className="chronicle-loading" role="status">Loading photo archive…</p>}>
              <YearArchiveExperiment
                includeLocal={isLocalArchivePreview}
                justifyRows={isArchivePage}
                cmsPhotos={content.source === "cms" ? photos : undefined}
                photoMeta={photoMeta}
                photoStories={photoStories}
                showBackToTop={isArchivePage}
              />
            </Suspense>
          ) : isAgarunAtlasPage ? (
            <AgarunAtlasExperiment photos={photos} onOpen={openPhoto} />
          ) : isPhotoMapExperimentPage ? (
            <PhotoMapExperiment photos={photos} onOpen={openPhoto} />
          ) : isPhotoMapMapLibrePage ? (
            <Suspense fallback={<section className="photo-map-experiment-loading" aria-label="Loading MapLibre experiment">Loading MapLibre…</section>}>
              <PhotoMapMapLibreExperiment photos={photos} onOpen={openPhoto} />
            </Suspense>
          ) : isMapRoutePage || isTrailRoutePage ? (
            <TrailRouteExperiment photos={photos} onOpen={openPhoto} publicStory={isMapRoutePage} />
          ) : isGpxTrailDemoPage ? (
            <GpxTrailDemoExperiment photos={photos} onOpen={openPhoto} />
          ) : isFooterPreviewPage ? (
            <section className="footer-preview-stage" aria-labelledby="footer-preview-title">
              <p className="footer-preview-kicker">Design study</p>
              <h1 id="footer-preview-title">Footer Background</h1>
            </section>
          ) : (
            <>
              <section className="page-title-band" id="top" aria-labelledby="page-title">
                <h1 id="page-title">{previewHome?.title || "Photography"}</h1>
                {homeSubtitle && <p className="page-title-subtitle">{homeSubtitle}</p>}
              </section>

              <section className="hero" aria-label="Featured photograph" aria-busy={isPhotographyHeroLoading}>
                {isPhotographyHeroLoading ? (
                  <div className="hero-image hero-placeholder" aria-hidden="true" />
                ) : photographyHero ? (
                  <img
                    className="hero-image"
                    src={sizedImageUrl(photographyHero.src, 2400, 88)}
                    srcSet={imageSrcSet(photographyHero.src, PHOTOGRAPHY_HERO_WIDTHS, 88)}
                    sizes="100vw"
                    width={photographyHero.width}
                    height={photographyHero.height}
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

              {isPhotographyGalleryLoading ? (
                <p className="sr-only" role="status">Loading photographs…</p>
              ) : homeSections ? (
                <PageSections sections={homeSections} onOpen={openModulePhoto} home />
              ) : (
                <GallerySections photos={photos} homepageLayout={homepageLayout} onOpen={openModulePhoto} />
              )}
            </>
          )}
        </Suspense>
        {activePageContent?.modulesPosition !== "before" && supplementalModules}
      </main>

      <Footer
        aboutData={aboutData}
        showPreview={showPreview}
        variant="photo"
        deferPhoto={isPhotographyPage || isYearArchivePage}
        photoPreloadDistance={isPhotographyPage ? (isPhotographyGalleryLoading ? null : 1500) : 0}
        backToTop={isJournalPage ? "floating" : isArchivePage ? "hidden" : "footer"}
      />

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
