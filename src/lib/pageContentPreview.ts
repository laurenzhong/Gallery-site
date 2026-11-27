import { useEffect, useMemo, useState } from "react";
import type { Photo } from "../data/photos";
import { cmsPageContentQuery, type CmsPageContent } from "./cmsQueries";
import { adaptPageContent, type PageContentAdapterResult } from "./pageContentAdapter";
import { fetchPreloadedCms, isSanityConfigured } from "./sanity";

export type PageContentPreviewState = {
  pages: Partial<Record<"home" | "photobalcony", PageContentAdapterResult>>;
  publishedHomeHero?: Pick<Photo, "src" | "width" | "height"> | null;
  isLoading: boolean;
  error?: string;
};

const emptyState: PageContentPreviewState = {
  pages: {},
  publishedHomeHero: null,
  isLoading: false,
};

function getPublishedHomeHero(documents: CmsPageContent[]) {
  const home = documents.findLast((document) => document.pageKey === "home");
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

export function usePageContentPreview(enabled: boolean, photos: Photo[]): PageContentPreviewState {
  const shouldFetch = enabled && isSanityConfigured();
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

  const documents = result?.documents;
  const error = result?.error;
  return useMemo(() => {
    if (!shouldFetch) return emptyState;
    if (!documents) {
      return error === undefined ? { pages: {}, isLoading: true } : { ...emptyState, error };
    }

    const pages: PageContentPreviewState["pages"] = {};
    for (const document of documents) {
      pages[document.pageKey] = adaptPageContent(document, photos);
    }
    return { pages, publishedHomeHero: getPublishedHomeHero(documents), isLoading: false };
  }, [shouldFetch, documents, error, photos]);
}
