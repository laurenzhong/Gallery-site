import { useEffect, useState } from "react";
import {
  cmsHomepageLayoutQuery,
  cmsPageContentQuery,
  cmsPhotobalconyLayoutQuery,
  cmsPhotosQuery,
  cmsSiteSettingsQuery,
  cmsStoriesQuery,
  type CmsPageContent,
} from "./cmsQueries";
import type { CmsGalleryDocuments } from "./galleryContent";
import { pageDraftParameter } from "./pageDraftPreview";

type PreviewDocuments = CmsGalleryDocuments & { pageContent: CmsPageContent[] | null };

export type StudioPreview = {
  documents?: PreviewDocuments;
  error?: string;
};

const connecting: StudioPreview = {};

function openedFromStudio() {
  if (typeof window === "undefined" || new URLSearchParams(window.location.search).get(pageDraftParameter) === "1") return false;
  const studio = window.parent === window ? window.opener as Window | null : window.parent;
  if (!studio) return false;

  try {
    const path = studio.location.pathname;
    if (path === "/studio/presentation" || path.startsWith("/studio/presentation/")) return true;
  } catch {
    // A separately hosted Studio starts the preview with the URL marker.
  }

  const marker = "studio-preview";
  const marked = new URLSearchParams(window.location.search).get(marker) === "1";
  try {
    if (marked) window.sessionStorage.setItem(marker, "1");
    return marked || window.sessionStorage.getItem(marker) === "1";
  } catch {
    return marked;
  }
}

export const isStudioPreview = openedFromStudio();

// Keep the catalog and the page references on the same draft snapshot.
const previewQuery = `{
  "photos": ${cmsPhotosQuery},
  "stories": ${cmsStoriesQuery},
  "siteSettings": ${cmsSiteSettingsQuery},
  "homepageLayout": ${cmsHomepageLayoutQuery},
  "photobalconyLayout": ${cmsPhotobalconyLayoutQuery},
  "pageContent": select($usePageContent => ${cmsPageContentQuery})
}`;

export function useStudioPreview(usePageContent: boolean): StudioPreview | undefined {
  const [preview, setPreview] = useState<StudioPreview>(connecting);

  useEffect(() => {
    if (!isStudioPreview) return;

    let active = true;
    let disconnect: (() => void) | undefined;
    const projectId = import.meta.env.VITE_SANITY_PROJECT_ID;
    const dataset = import.meta.env.VITE_SANITY_DATASET ?? "production";
    if (!projectId) {
      setPreview({ error: "网站未配置 Sanity，无法读取草稿。" });
      return;
    }

    setPreview(connecting);
    const timeout = window.setTimeout(() => {
      setPreview({ error: "无法读取 CMS 草稿，请在「网站预览」中点击刷新重试。" });
    }, 15_000);

    void import("./studioPreviewConnection").then(({ connectStudioPreview }) => {
      if (!active) return;
      disconnect = connectStudioPreview<PreviewDocuments>(
        {
          projectId,
          dataset,
          query: previewQuery,
          // Presentation deduplicates subscriptions by query and params. A new
          // frame or popup needs its own initial result even after a reload.
          params: { usePageContent, previewSession: crypto.randomUUID() },
        },
        (documents) => {
          window.clearTimeout(timeout);
          setPreview({ documents });
        },
      );
    }).catch(() => {
      if (!active) return;
      window.clearTimeout(timeout);
      setPreview({ error: "无法连接 CMS，请刷新网站预览后重试。" });
    });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      disconnect?.();
    };
  }, [usePageContent]);

  return isStudioPreview ? preview : undefined;
}
