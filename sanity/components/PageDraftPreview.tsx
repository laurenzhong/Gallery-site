import { Box, Card, Flex, Text } from "@sanity/ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDocumentStore } from "sanity";
import type { UserViewComponent } from "sanity/structure";
import { pageDraftContent, pageDraftParameter, pageDraftReady, isPagePreviewOrigin } from "../../src/lib/pageDraftPreview";
import { cmsPageDraftQuery, type CmsPageDraft } from "../../src/lib/cmsQueries";
import { contentPages, type ContentPageKey } from "../../src/lib/pageContentPages";

export const PageDraftPreview: UserViewComponent<{ origin: string; pageKey: ContentPageKey }> = ({ documentId, options }) => {
  const store = useDocumentStore();
  const iframe = useRef<HTMLIFrameElement>(null);
  const [request, setRequest] = useState(0);
  const [draft, setDraft] = useState<CmsPageDraft>();
  const [error, setError] = useState(false);
  const target = contentPages[options.pageKey];
  const url = new URL(target.path, options.origin);
  url.searchParams.set(pageDraftParameter, "1");
  const { href, origin } = url;
  const trusted = isPagePreviewOrigin(new URL(window.location.href), url);

  useLayoutEffect(() => {
    if (!trusted) return;
    const receive = (event: MessageEvent<{ type?: string }>) => {
      if (event.origin !== origin || event.source !== iframe.current?.contentWindow || event.data?.type !== pageDraftReady) return;
      setRequest((count) => count + 1);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [origin, trusted]);

  useEffect(() => {
    if (!trusted) return;
    const subscription = store.listenQuery(
      { fetch: cmsPageDraftQuery, listen: '*[_id in [$id, "drafts." + $id] || _type in ["photo", "category"]]' },
      { id: documentId },
      { apiVersion: "2025-02-19", perspective: "drafts" },
    ).subscribe({ next: (result: CmsPageDraft) => setDraft(result), error: () => setError(true) });
    return () => subscription.unsubscribe();
  }, [documentId, store, trusted]);

  useEffect(() => {
    if (!request || !draft) return;
    iframe.current?.contentWindow?.postMessage({ type: pageDraftContent, draft }, origin);
  }, [origin, draft, request]);

  if (!trusted || error) {
    return <Card padding={4} tone="caution"><Text>{error ? "草稿读取失败，请重新打开预览。" : "草稿预览需要同源网站，或使用本机的 Studio 和网站。"}</Text></Card>;
  }

  return (
    <Flex direction="column" height="fill">
      <Card padding={3} borderBottom><Text size={1}>{target.label} · 草稿保存后自动更新</Text></Card>
      <Box flex={1}>
        <iframe ref={iframe} src={href} title={`${target.label}草稿预览`} referrerPolicy="origin" style={{ width: "100%", height: "100%", border: 0, display: "block" }} />
      </Box>
    </Flex>
  );
};
