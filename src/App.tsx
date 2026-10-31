import { useEffect, useMemo, useState } from "react";
import { About } from "./components/About";
import { AdvancedPhotoLightbox } from "./components/AdvancedPhotoLightbox";
import { BalconyView } from "./components/BalconyView";
import { CmsPageSections } from "./components/CmsPageSections";
import { CmsBalconyView } from "./components/CmsBalconyView";
import { CmsSourceBadge } from "./components/CmsSourceBadge";
import { Footer } from "./components/Footer";
import { GallerySections } from "./components/GallerySections";
import { Header } from "./components/Header";
import { Journal } from "./components/Journal";
import { PhotoStory } from "./components/PhotoStory";
import { StoryDetail } from "./components/StoryDetail";
import type { Photo } from "./data/photos";
import { useGalleryContent } from "./lib/galleryContent";
import { imageSrcSet, sizedImageUrl } from "./lib/imageUrl";
import { matchesPhotoSlug, matchesStorySlug, photoPath } from "./lib/routes";
import { SiteCopyProvider } from "./components/SiteCopyProvider";

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

function setLink(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.rel = rel;
    document.head.append(tag);
  }
  tag.href = href;
}

function App() {
  const [lightboxState, setLightboxState] = useState<{ photos: Photo[]; index: number } | null>(null);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname.replace(/\/$/, "") || "/");
  const content = useGalleryContent();
  const {
    photos,
    categories,
    pageLayouts,
    copy,
    photoMeta,
    photoStories,
    aboutData,
    homepageLayout,
    photobalconyLayout,
    siteTitle,
    heroSubtitle,
  } = content;
  const pathname = currentPath;
  const isBalconyPage = pathname === "/photobalcony";
  const isStoryPage = pathname === "/photostory";
  const isAboutPage = pathname === "/about";
  const isJournalPage = pathname === "/journal";
  const isFooterPreviewPage = pathname === "/footer-preview";
  const photoRouteSlug = pathname.startsWith("/photos/") ? decodeURIComponent(pathname.slice("/photos/".length)) : "";
  const storyRouteSlug = pathname.startsWith("/stories/") ? decodeURIComponent(pathname.slice("/stories/".length)) : "";
  const showPreview = new URLSearchParams(window.location.search).has("preview");
  const cmsHomeLayout = pageLayouts.home;
  const cmsBalconyLayout = pageLayouts.photobalcony;

  const heroPhoto = useMemo(() => {
    if (content.isLoading && content.source === "static") {
      return content.heroPhoto;
    }

    return content.heroPhoto
      ?? photos.find((photo) => photo.isHero)
      ?? photos.find((photo) => photo.filename === "DSC_0257.JPG")
      ?? photos[0];
  }, [content.heroPhoto, content.isLoading, content.source, photos]);

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

    setLightboxState({ photos: lightboxPhotos, index: lightboxIndex });
    setLightboxPath(photoPath(photo), "push");
  };

  const openPhotoItem = (photo: Photo, lightboxPhotos = photos) => {
    const index = photos.findIndex((item) => item.id === photo.id);
    if (index < 0) return;
    openPhoto(index, lightboxPhotos);
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
      const returnPath = currentPath.startsWith("/photos/") ? "/" : currentPath;
      window.history.replaceState({}, "", returnPath || "/");
      if (currentPath.startsWith("/photos/")) {
        setCurrentPath("/");
      }
    }
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

    document.title = title ? `${title} | Queenstown.top` : siteTitle || SITE_TITLE;
    setMeta("description", description);
    setMeta("og:title", title ? `${title} | Queenstown.top` : SITE_TITLE, "property");
    setMeta("og:description", description, "property");
    setMeta("og:image", image || "/brand-mark.svg", "property");
    setMeta("twitter:image", image || "/brand-mark.svg");
    setLink("canonical", `${window.location.origin}${window.location.pathname}`);
  }, [activePhoto, activeStory, heroPhoto, siteTitle]);

  return (
    <SiteCopyProvider copy={copy}>
      <>
      <Header />

      <CmsSourceBadge content={content} />

      <main>
        {activeStory ? (
          <StoryDetail photo={activeStory.photo} story={activeStory.story} />
        ) : photoRouteSlug && activePhoto ? (
          <>
            <section className="page-title-band" id="top" aria-labelledby="page-title">
              <h1 id="page-title">{copy.pages.photography}</h1>
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
              {heroSubtitle ? <p className="hero-subtitle">{heroSubtitle}</p> : null}
            </section>

            <GallerySections photos={photos} categories={categories} homepageLayout={homepageLayout} onOpen={openPhoto} />
          </>
        ) : (photoRouteSlug || storyRouteSlug) && content.isLoading ? (
          <section className="detail-page detail-empty" aria-labelledby="detail-loading-title">
            <p className="detail-kicker">{copy.pages.loading}</p>
            <h1 id="detail-loading-title">{copy.pages.loading}</h1>
          </section>
        ) : photoRouteSlug || storyRouteSlug ? (
          <section className="detail-page detail-empty" aria-labelledby="detail-empty-title">
            <p className="detail-kicker">{copy.pages.notFound}</p>
            <h1 id="detail-empty-title">{copy.pages.notFound}</h1>
            <a className="detail-related-link" href="/">
              <span>{copy.pages.backHome}</span>
              <small>{copy.pages.returnToArchive}</small>
            </a>
        </section>
        ) : isBalconyPage ? (
          cmsBalconyLayout ? (
            <CmsBalconyView layout={cmsBalconyLayout} photoMeta={photoMeta} photoStories={photoStories} />
          ) : (
            <BalconyView
              photos={photos}
              layout={photobalconyLayout}
              photoMeta={photoMeta}
              photoStories={photoStories}
            />
          )
        ) : isStoryPage ? (
          <PhotoStory photos={photos} photoMeta={photoMeta} photoStories={photoStories} aboutData={aboutData} />
        ) : isAboutPage ? (
          <About aboutData={aboutData} />
        ) : isJournalPage ? (
          <Journal photos={photos} photoStories={photoStories} />
        ) : isFooterPreviewPage ? (
          <section className="footer-preview-stage" aria-labelledby="footer-preview-title">
            <p className="footer-preview-kicker">{copy.pages.footerPreviewKicker}</p>
            <h1 id="footer-preview-title">{copy.pages.footerPreviewTitle}</h1>
          </section>
        ) : cmsHomeLayout ? (
          <>
            <section className="page-title-band" id="top" aria-labelledby="page-title">
              <h1 id="page-title">{cmsHomeLayout.title ?? copy.pages.photography}</h1>
              {cmsHomeLayout.subtitle ? <p className="page-subtitle">{cmsHomeLayout.subtitle}</p> : null}
            </section>
            {cmsHomeLayout.heroPhoto ? (
              <section className="hero" aria-label={cmsHomeLayout.title ?? copy.pages.photography}>
                <img
                  className="hero-image"
                  src={sizedImageUrl(cmsHomeLayout.heroPhoto.src, 2400, 88)}
                  srcSet={imageSrcSet(cmsHomeLayout.heroPhoto.src, [1400, 2000, 2800], 88)}
                  sizes="100vw"
                  alt={cmsHomeLayout.heroPhoto.altText ?? cmsHomeLayout.heroPhoto.title}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </section>
            ) : null}
            <CmsPageSections layout={cmsHomeLayout} onOpen={openPhotoItem} />
          </>
        ) : (
          <>
            <section className="page-title-band" id="top" aria-labelledby="page-title">
              <h1 id="page-title">{copy.pages.photography}</h1>
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
              {heroSubtitle ? <p className="hero-subtitle">{heroSubtitle}</p> : null}
            </section>

            {showPreview && (
              <a className="story-test-cta" href="/photostory" aria-label={copy.controls.openStories}>
                <span className="story-test-cta-tag">{copy.pages.photoNotesKicker}</span>
                <span className="story-test-cta-text">
                  {copy.controls.readFieldNotes}
                </span>
                <span className="story-test-cta-arrow" aria-hidden="true">-&gt;</span>
              </a>
            )}

            <GallerySections photos={photos} categories={categories} homepageLayout={homepageLayout} onOpen={openPhoto} />
          </>
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
    </SiteCopyProvider>
  );
}

export default App;
