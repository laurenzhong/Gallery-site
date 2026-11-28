import { useEffect, useState } from "react";
import { useClient, useFormValue } from "sanity";
import { useRouter } from "sanity/router";
import { cmsPlacementQueryFields, cmsStoryPublicationFilter, type CmsPlacementSnapshot } from "../../src/lib/cmsQueries";
import { resolveCmsPlacements } from "../../src/lib/pageContentAdapter";
import { contentPages, isContentPageKey } from "../../src/lib/pageContentPages";

const photoUsageQuery = `{
  ${cmsPlacementQueryFields},
  "stories": *[_type == "story" && references($id)]{title, "coverId": coverPhoto._ref, "ready": ${cmsStoryPublicationFilter}},
  "routes": *[_type == "mapRoute" && isVisible != false && references($id)].title
}`;

type Usage = CmsPlacementSnapshot & {
  stories: { title: string; coverId: string; ready: boolean }[];
  routes: string[];
};

export function PhotoUsageInput() {
  const client = useClient({ apiVersion: "2025-02-19" });
  const documentId = useFormValue(["_id"]);
  const id = typeof documentId === "string" ? documentId.replace(/^drafts\./, "") : "";
  const [result, setResult] = useState<{ id: string; usage?: Usage }>();

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    client.fetch<Usage>(photoUsageQuery, { id }, { perspective: "published", signal: controller.signal })
      .then((usage) => { if (!controller.signal.aborted) setResult({ id, usage }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ id }); });
    return () => controller.abort();
  }, [client, id]);

  if (!id) return <p>保存照片后可查看引用。</p>;
  if (result?.id !== id) return <p role="status">正在查询公开页面和手记…</p>;
  if (!result.usage) return <p role="status">暂时无法读取照片使用情况。</p>;

  const usage = result.usage;
  const placements = resolveCmsPlacements(usage);
  const pages = [...(placements.get(id) ?? [])].map((key) => contentPages[key].label);
  const visibleStories = usage.stories.filter(({ coverId, ready }) => ready && placements.has(coverId)).map(({ title }) => title);
  return (
    <div>
      <p><strong>页面内容</strong> · {pages.length ? pages.join("、") : "未用于已发布的页面模块"}</p>
      {usage.routes.length > 0 && <p><strong>地图路线引用</strong> · {usage.routes.join("、")}</p>}
      {visibleStories.length > 0 && <p><strong>已公开手记</strong> · {visibleStories.join("、")}</p>}
      {usage.stories.length > visibleStories.length && <p>另有 {usage.stories.length - visibleStories.length} 篇未公开手记引用此照片。</p>}
    </div>
  );
}

export function PagePhotoUsage({ options }: { options?: Record<string, unknown> }) {
  const client = useClient({ apiVersion: "2025-02-19" });
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CmsPlacementSnapshot | null>();
  const pageKey = options?.pageKey;

  useEffect(() => {
    const controller = new AbortController();
    client.fetch<CmsPlacementSnapshot>(`{${cmsPlacementQueryFields}}`, {}, { perspective: "published", signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setSnapshot(data); })
      .catch(() => { if (!controller.signal.aborted) setSnapshot(null); });
    return () => controller.abort();
  }, [client]);

  if (!isContentPageKey(pageKey)) return null;
  if (snapshot === undefined) return <p role="status" style={{ padding: 16 }}>正在读取页面照片…</p>;
  if (snapshot === null) return <p role="status" style={{ padding: 16 }}>读取失败，请重新打开此面板。</p>;
  const placements = resolveCmsPlacements(snapshot);
  const items = snapshot.photos.filter(({ id }) => placements.get(id)?.has(pageKey));
  return (
    <section aria-label={contentPages[pageKey].label} style={{ padding: 16 }}>
      <p>{items.length ? `${items.length} 张照片用于已发布的页面模块` : "此页还没有通过内容模块选入照片。"}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
        {items.map(({ id, src, title }) => (
          <button key={id} type="button" onClick={() => router.navigateIntent("edit", { id, type: "photo" })} style={{ padding: 6, cursor: "pointer" }}>
            {src && <img src={`${src}?w=300&h=180&fit=max&auto=format`} alt="" loading="lazy" style={{ width: "100%", height: 100, objectFit: "contain" }} />}
            <span>{title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
