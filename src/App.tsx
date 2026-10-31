import { useEffect, useMemo, useState } from "react";
import { About } from "./components/About";
import { AdvancedPhotoLightbox } from "./components/AdvancedPhotoLightbox";
import { BalconyView } from "./components/BalconyView";
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
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname.replace(/\/$/, "") || "/");
  const content = useGalleryContent();
  const { photos, photoMeta, photoStories, aboutData, homepageLayout, photobalconyLayout } = content;
  const pathname = currentPath;
  const isBalconyPage = pathname === "/photobalcony";
  const isStoryPage = pathname === "/photostory";
  const isAboutPage = pathname === "/about";
  const isJournalPage = pathname === "/journal";
  const isFooterPreviewPage = pathname === "/footer-preview";
  const photoRouteSlug = pathname.startsWith("/photos/") ? decodeURIComponent(pathname.slice("/photos/".length)) : "";
  const storyRouteSlug = pathname.startsWith("/stories/") ? decodeURIComponent(pathname.slice("/stories/".length)) : "";
  const showPreview = new URLSearchParams(window.location.search).has("preview");

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

    document.title = title ? `${title} | Queenstown.top` : SITE_TITLE;
    setMeta("description", description);
    setMeta("og:title", title ? `${title} | Queenstown.top` : SITE_TITLE, "property");
    setMeta("og:description", description, "property");
    if (image) setMeta("og:image", image, "property");
  }, [activePhoto, activeStory, heroPhoto]);

  return (
    <>
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

            <GallerySections photos={photos} homepageLayout={homepageLayout} onOpen={openPhoto} />
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
            layout={photobalconyLayout}
            photoMeta={photoMeta}
            photoStories={photoStories}
          />
        ) : isStoryPage ? (
          <PhotoStory photos={photos} photoMeta={photoMeta} photoStories={photoStories} aboutData={aboutData} />
        ) : isAboutPage ? (
          <About aboutData={aboutData} />
        ) : isJournalPage ? (
          <Journal photos={photos} photoStories={photoStories} />
        ) : isFooterPreviewPage ? (
          <section className="footer-preview-stage" aria-labelledby="footer-preview-title">
            <p className="footer-preview-kicker">Design study</p>
            <h1 id="footer-preview-title">Footer Background</h1>
          </section>
        ) : (
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

            <GallerySections photos={photos} homepageLayout={homepageLayout} onOpen={openPhoto} />
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
  );
}

export default App;
