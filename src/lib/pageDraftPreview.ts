import { useEffect, useState } from "react";
import type { CmsPageDraft } from "./cmsQueries";
import type { ContentPageKey } from "./pageContentPages";

export const pageDraftParameter = "page-draft";
export const pageDraftReady = "page-draft:ready";
export const pageDraftContent = "page-draft:content";

export function isPagePreviewOrigin(studio: URL, website: URL) {
  if (studio.origin === website.origin) return true;
  const isLoopback = (url: URL) => ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return isLoopback(studio) && isLoopback(website);
}

export function usePageDraftPreview(page: ContentPageKey | undefined) {
  const [result, setResult] = useState<{ page: ContentPageKey; draft: CmsPageDraft }>();

  useEffect(() => {
    if (!page || window.parent === window || !window.document.referrer) return;
    const studio = new URL(window.document.referrer);
    if (!isPagePreviewOrigin(studio, new URL(window.location.href))) return;

    const receive = (event: MessageEvent<{ type?: string; draft?: CmsPageDraft }>) => {
      if (event.source !== window.parent || event.origin !== studio.origin || event.data?.type !== pageDraftContent) return;
      const draft = event.data.draft;
      if (draft && (draft.document === null || draft.document?.pageKey === page)) setResult({ page, draft });
    };
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: pageDraftReady }, studio.origin);
    return () => window.removeEventListener("message", receive);
  }, [page]);

  return result?.page === page ? result?.draft : undefined;
}
