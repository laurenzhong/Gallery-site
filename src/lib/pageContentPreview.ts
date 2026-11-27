import { useEffect, useMemo, useState } from "react";
import type { Photo } from "../data/photos";
import { cmsPageContentQuery, type CmsPageContent } from "./cmsQueries";
import { adaptPageContent, type PageContentAdapterResult } from "./pageContentAdapter";
import { fetchCms, isSanityConfigured } from "./sanity";

export type PageContentPreviewState = {
  pages: Partial<Record<"home" | "photobalcony", PageContentAdapterResult>>;
  isLoading: boolean;
  error?: string;
};

const emptyState: PageContentPreviewState = {
  pages: {},
  isLoading: false,
};

export function usePageContentPreview(enabled: boolean, photos: Photo[]): PageContentPreviewState {
  const shouldFetch = enabled && isSanityConfigured();
  const [result, setResult] = useState<{ documents?: CmsPageContent[]; error?: string }>();

  useEffect(() => {
    if (!shouldFetch) {
      setResult(undefined);
      return;
    }

    let isMounted = true;

    fetchCms<CmsPageContent[]>(cmsPageContentQuery)
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
    if (!documents) return { ...emptyState, isLoading: error === undefined, error };

    const pages: PageContentPreviewState["pages"] = {};
    for (const document of documents) {
      pages[document.pageKey] = adaptPageContent(document, photos);
    }
    return { pages, isLoading: false };
  }, [shouldFetch, documents, error, photos]);
}
