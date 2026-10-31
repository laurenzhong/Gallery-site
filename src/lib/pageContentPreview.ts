import { useEffect, useState } from "react";
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
  const [state, setState] = useState<PageContentPreviewState>(() => ({
    ...emptyState,
    isLoading: enabled && isSanityConfigured(),
  }));

  useEffect(() => {
    if (!enabled || !isSanityConfigured() || photos.length === 0) {
      setState(emptyState);
      return undefined;
    }

    let isMounted = true;
    setState({ ...emptyState, isLoading: true });

    fetchCms<CmsPageContent[]>(cmsPageContentQuery)
      .then((documents) => {
        if (!isMounted) return;
        const pages: PageContentPreviewState["pages"] = {};
        for (const document of documents) {
          pages[document.pageKey] = adaptPageContent(document, photos);
        }
        setState({ pages, isLoading: false });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setState({
          ...emptyState,
          error: error instanceof Error ? error.message : "Failed to load page content preview",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [enabled, photos]);

  return state;
}
