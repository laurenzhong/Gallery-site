import { useEffect, useMemo, useState } from "react";
import { useClient, useFormValue } from "sanity";

type ReadinessResult = {
  homepageLayoutCount: number;
  siteHeroCount: number;
  photobalconyLayoutCount: number;
  storyCount: number;
  visibleStoryCount: number;
  hasImage: boolean;
  hasCategory: boolean;
  hasSlug: boolean;
  hasSortOrder: boolean;
  hasAltText: boolean;
  isHidden: boolean;
};

const readinessQuery = `*[_id == $publishedId || _id == $draftId][0]{
  "homepageLayoutCount": count(*[
    _type == "homepageLayout" &&
    (references($publishedId) || references($draftId))
  ]),
  "siteHeroCount": count(*[
    _type == "siteSettings" &&
    (heroPhoto._ref == $publishedId || heroPhoto._ref == $draftId)
  ]),
  "photobalconyLayoutCount": count(*[
    _type == "photobalconyLayout" &&
    (references($publishedId) || references($draftId))
  ]),
  "storyCount": count(*[
    _type == "story" &&
    (references($publishedId) || references($draftId))
  ]),
  "visibleStoryCount": count(*[
    _type == "story" &&
    isHidden != true &&
    (references($publishedId) || references($draftId))
  ]),
  "hasImage": defined(image.asset._ref),
  "hasCategory": defined(category._ref),
  "hasSlug": defined(slug.current),
  "hasSortOrder": defined(sortOrder),
  "hasAltText": defined(altText),
  "isHidden": isHidden == true
}`;

function normalizeIds(id: unknown) {
  if (typeof id !== "string" || !id) {
    return undefined;
  }

  const publishedId = id.replace(/^drafts\./, "");
  return {
    publishedId,
    draftId: `drafts.${publishedId}`,
  };
}

function statusStyle(tone: "ready" | "warning" | "blocked") {
  if (tone === "ready") {
    return { border: "#b7dfc5", background: "#e8f5ec", color: "#136c3a" };
  }
  if (tone === "blocked") {
    return { border: "#f2b8b5", background: "#fdebea", color: "#a5281b" };
  }
  return { border: "#f2cf8f", background: "#fff4df", color: "#8a4b00" };
}

function buildReadiness(result: ReadinessResult) {
  const blocking = [
    !result.hasImage ? "缺少图片资源" : undefined,
    !result.hasCategory ? "未设置分类" : undefined,
    !result.hasSlug ? "缺少 URL 标识" : undefined,
  ].filter(Boolean);

  const warnings = [
    !result.hasSortOrder ? "未设置排序" : undefined,
    !result.hasAltText ? "未设置替代文本" : undefined,
    result.isHidden ? "已从网站隐藏" : undefined,
    result.homepageLayoutCount === 0 &&
    result.siteHeroCount === 0 &&
    result.photobalconyLayoutCount === 0 &&
    result.storyCount === 0
      ? "未被首页、影像阳台或日志引用"
      : undefined,
  ].filter(Boolean);

  if (blocking.length) {
    return { label: "无法发布", tone: "blocked" as const, blocking, warnings };
  }

  if (warnings.length) {
    return { label: "需要检查", tone: "warning" as const, blocking, warnings };
  }

  return { label: "准备就绪", tone: "ready" as const, blocking, warnings };
}

export function PhotoReadinessInput() {
  const client = useClient({ apiVersion: "2025-02-19" });
  const documentId = useFormValue(["_id"]);
  const ids = useMemo(() => normalizeIds(documentId), [documentId]);
  const [readiness, setReadiness] = useState<ReadinessResult>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!ids) return;

    let cancelled = false;

    client
      .fetch<ReadinessResult | null>(readinessQuery, ids)
      .then((result) => {
        if (!cancelled) {
          setReadiness(result ?? undefined);
          setError(undefined);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "无法加载照片就绪状态。");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, ids]);

  if (!ids) {
    return (
      <div style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: 12 }}>
        请先保存照片，再检查就绪状态。
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ border: "1px solid #f2b8b5", borderRadius: 6, padding: 12, color: "#a5281b" }}>
        无法加载照片就绪状态：{error}
      </div>
    );
  }

  if (!readiness) {
    return <div style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: 12 }}>正在加载就绪状态…</div>;
  }

  const summary = buildReadiness(readiness);
  const style = statusStyle(summary.tone);

  return (
    <div
      style={{
        border: `1px solid ${style.border}`,
        borderRadius: 6,
        padding: 12,
        background: style.background,
        color: style.color,
      }}
    >
      <strong style={{ display: "block", marginBottom: 8 }}>照片就绪状态：{summary.label}</strong>

      {summary.blocking.length ? (
        <section style={{ marginBottom: 8 }}>
          <strong style={{ display: "block", marginBottom: 4 }}>必须修复</strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summary.blocking.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.warnings.length ? (
        <section style={{ marginBottom: 8 }}>
          <strong style={{ display: "block", marginBottom: 4 }}>请检查</strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summary.warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <strong style={{ display: "block", marginBottom: 4 }}>当前使用位置</strong>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>首页引用：{readiness.homepageLayoutCount + readiness.siteHeroCount}</li>
          <li>影像阳台引用：{readiness.photobalconyLayoutCount}</li>
          <li>可见文章引用：{readiness.visibleStoryCount}</li>
          <li>文章引用总数：{readiness.storyCount}</li>
        </ul>
      </section>
    </div>
  );
}
