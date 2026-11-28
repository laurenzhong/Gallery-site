import { useEffect, useMemo, useState } from "react";
import type { Photo } from "../data/photos";
import { cmsPageContentQuery, type CmsPageContent, type CmsPageSection, type CmsStoryPhoto } from "./cmsQueries";
import { toReferencedPhoto } from "./galleryContent";
import type { HomepageLayout } from "./homepageLayout";
import { adaptPageContent, type PageContentAdapterResult } from "./pageContentAdapter";
import { fetchPreloadedCms, isSanityConfigured } from "./sanity";
import type { StudioPreview } from "./studioPreview";

export type PageContentPreviewState = {
  pages: Partial<Record<"home" | "photobalcony", PageContentAdapterResult>>;
  publishedHomeHero?: Pick<Photo, "src" | "width" | "height"> | null;
  publishedHomeGallery?: { photos: Photo[]; layout: HomepageLayout };
  isLoading: boolean;
  error?: string;
};

const emptyState: PageContentPreviewState = {
  pages: {},
  publishedHomeHero: null,
  isLoading: false,
};

function getPublishedHomeHero(home: CmsPageContent | undefined) {
  const slotPhotos = home?.sections?.flatMap((section) =>
    section.type === "heroSlot" && section.isVisible !== false ? [section.photo] : [],
  ) ?? [];
  const reference = [home?.heroPhoto, ...slotPhotos].find((photo) => photo?.id && !photo.isHidden);
  if (!reference) return null;

  // References outside the public photo catalog need the full gallery lookup.
  if (!reference.src || !reference.title || !reference.filename || reference.categoryIsVisible === false) {
    return undefined;
  }
  return { src: reference.src, width: reference.width || 1, height: reference.height || 1 };
}

function sectionPhotoReferences(section: CmsPageSection): (CmsStoryPhoto | undefined)[] {
  switch (section.type) {
    case "featureCardsSlot":
      return section.cards?.map((card) => card.photo) ?? [];
    case "gallerySlot":
      return section.photos ?? [];
    case "heroSlot":
    case "bannerSlot":
      return [section.photo];
    case "harborSlot":
      return [section.heroPhoto, section.featurePhoto, ...(section.carouselPhotos ?? []), ...(section.stackPhotos ?? []), ...(section.squarePhotos ?? [])];
    default:
      return [];
  }
}

function getPublishedHomeGallery(home: CmsPageContent) {
  const sections = home.sections?.filter((section) => section.isVisible !== false) ?? [];
  if (sections.some((section) => section.type === "gallerySlot" && section.sourceMode === "category")) return undefined;

  // Manual sections can render from their published references before the full catalog arrives.
  const galleryPhotos = new Map<string, Photo>();
  for (const reference of sections.flatMap(sectionPhotoReferences)) {
    if (!reference?.id || reference.isHidden || galleryPhotos.has(reference.id)) continue;
    if (!reference.src || reference.categoryIsVisible === false) return undefined;
    const photo = toReferencedPhoto(reference);
    if (!photo) return undefined;
    galleryPhotos.set(photo.id, photo);
  }

  const photos = [...galleryPhotos.values()];
  const layout = adaptPageContent(home, photos).homepageLayout;
  return layout?.sections?.length ? { photos, layout } : undefined;
}

export function usePageContentPreview(enabled: boolean, photos: Photo[], studioPreview?: StudioPreview): PageContentPreviewState {
  const shouldFetch = enabled && !studioPreview && isSanityConfigured();
  const [result, setResult] = useState<{ documents?: CmsPageContent[]; error?: string }>();

  useEffect(() => {
    if (!shouldFetch) {
      setResult(undefined);
      return;
    }

    let isMounted = true;

    fetchPreloadedCms<CmsPageContent[]>(cmsPageContentQuery)
      .then((documents) => {
        if (isMounted) setResult({ documents });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setResult({
          error: error instanceof Error ? error.message : "Failed to load page content preview",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [shouldFetch]);

  const documents = studioPreview ? studioPreview.documents?.pageContent : result?.documents;
  const error = studioPreview ? studioPreview.error : result?.error;
  return useMemo(() => {
    if (!enabled || !isSanityConfigured()) return emptyState;
    if (!documents) {
      return error === undefined ? { pages: {}, isLoading: true } : { ...emptyState, error };
    }

    const pages: PageContentPreviewState["pages"] = {};
    for (const document of documents) {
      pages[document.pageKey] = adaptPageContent(document, photos);
    }
    if (studioPreview) return { ...emptyState, pages };
    const home = documents.findLast((document) => document.pageKey === "home");
    return {
      pages,
      publishedHomeHero: getPublishedHomeHero(home),
      publishedHomeGallery: home ? getPublishedHomeGallery(home) : undefined,
      isLoading: false,
    };
  }, [enabled, documents, error, photos, studioPreview]);
}
