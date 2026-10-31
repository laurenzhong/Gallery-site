import { useCallback, useEffect, useState } from "react";
import { useClient } from "sanity";

type ChecklistKey =
  | "hiddenHomepagePhotos"
  | "hiddenPhotobalconyPhotos"
  | "hiddenStoryPhotos"
  | "visibleStoriesMissingCover"
  | "hiddenStories"
  | "photosMissingImage"
  | "photosMissingCategory"
  | "photosMissingAltText"
  | "multipleHeroFlags"
  | "emptyHomepageModules"
  | "emptyPhotobalconyModules";

type ChecklistCounts = Record<ChecklistKey, number>;

type ChecklistItem = {
  key: ChecklistKey;
  title: string;
  severity: "blocking" | "warning";
  listTitle: string;
};

const checklistItems: ChecklistItem[] = [
  {
    key: "hiddenHomepagePhotos",
    title: "首页正在使用的隐藏照片",
    severity: "blocking",
    listTitle: "首页正在使用的隐藏照片",
  },
  {
    key: "hiddenPhotobalconyPhotos",
    title: "影像阳台正在使用的隐藏照片",
    severity: "blocking",
    listTitle: "影像阳台正在使用的隐藏照片",
  },
  {
    key: "hiddenStoryPhotos",
    title: "可见文章正在使用的隐藏照片",
    severity: "blocking",
    listTitle: "可见文章正在使用的隐藏照片",
  },
  {
    key: "visibleStoriesMissingCover",
    title: "缺少封面图的可见文章",
    severity: "blocking",
    listTitle: "缺少封面图的可见文章",
  },
  {
    key: "hiddenStories",
    title: "从网站隐藏的文章",
    severity: "warning",
    listTitle: "从网站隐藏的文章",
  },
  {
    key: "photosMissingImage",
    title: "缺少图片资源的照片",
    severity: "blocking",
    listTitle: "缺少图片资源的照片",
  },
  {
    key: "photosMissingCategory",
    title: "未设置分类的照片",
    severity: "blocking",
    listTitle: "未设置分类的照片",
  },
  {
    key: "photosMissingAltText",
    title: "缺少替代文本的照片",
    severity: "warning",
    listTitle: "缺少替代文本的照片",
  },
  {
    key: "multipleHeroFlags",
    title: "设置了多个首页主视觉标记的照片",
    severity: "blocking",
    listTitle: "设置了多个首页主视觉标记的照片",
  },
  {
    key: "emptyHomepageModules",
    title: "首页布局中未配置的模块",
    severity: "warning",
    listTitle: "首页布局中未配置的模块",
  },
  {
    key: "emptyPhotobalconyModules",
    title: "影像阳台布局中未配置的模块",
    severity: "warning",
    listTitle: "影像阳台布局中未配置的模块",
  },
];

const checklistQuery = `{
  "hiddenHomepagePhotos": count(*[
    _type == "photo" &&
    isHidden == true &&
    count(*[_type == "homepageLayout" && references(^._id)]) > 0
  ]),
  "hiddenPhotobalconyPhotos": count(*[
    _type == "photo" &&
    isHidden == true &&
    count(*[_type == "photobalconyLayout" && references(^._id)]) > 0
  ]),
  "hiddenStoryPhotos": count(*[
    _type == "photo" &&
    isHidden == true &&
    count(*[
      _type == "story" &&
      isHidden != true &&
      (!defined(publishedAt) || dateTime(publishedAt) <= dateTime(now())) &&
      references(^._id)
    ]) > 0
  ]),
  "visibleStoriesMissingCover": count(*[
    _type == "story" &&
    isHidden != true &&
    (!defined(publishedAt) || dateTime(publishedAt) <= dateTime(now())) &&
    !defined(coverPhoto._ref)
  ]),
  "hiddenStories": count(*[_type == "story" && isHidden == true]),
  "photosMissingImage": count(*[_type == "photo" && !defined(image.asset._ref)]),
  "photosMissingCategory": count(*[_type == "photo" && !defined(category._ref)]),
  "photosMissingAltText": count(*[_type == "photo" && isHidden != true && !defined(altText)]),
  "multipleHeroFlags": select(
    count(*[_type == "photo" && isHero == true]) > 1 => count(*[_type == "photo" && isHero == true]),
    0
  ),
  "emptyHomepageModules": count(*[
    _type == "homepageLayout" &&
    (
      !defined(featureCards[0]) ||
      !defined(landscapePhotos[0]) ||
      !defined(quietPhotos[0]) ||
      !defined(bannerOnePhoto._ref) ||
      !defined(cityPhotos[0]) ||
      !defined(plantsHeroPhoto._ref) ||
      !defined(plantsCarouselPhotos[0]) ||
      !defined(plantsStackPhotos[0]) ||
      !defined(plantsSquarePhotos[0])
    )
  ]),
  "emptyPhotobalconyModules": count(*[
    _type == "photobalconyLayout" &&
    (
      !defined(heroPhoto._ref) ||
      !defined(mayPhotos[0]) ||
      !defined(marchPortraitPhotos[0]) ||
      !defined(marchWidePhotos[0]) ||
      !defined(februaryPhotos[0]) ||
      !defined(januaryPhotos[0]) ||
      !defined(winterPhotos[0]) ||
      !defined(summerPhotos[0])
    )
  ])
}`;

const emptyCounts: ChecklistCounts = {
  hiddenHomepagePhotos: 0,
  hiddenPhotobalconyPhotos: 0,
  hiddenStoryPhotos: 0,
  visibleStoriesMissingCover: 0,
  hiddenStories: 0,
  photosMissingImage: 0,
  photosMissingCategory: 0,
  photosMissingAltText: 0,
  multipleHeroFlags: 0,
  emptyHomepageModules: 0,
  emptyPhotobalconyModules: 0,
};

function countSeverity(counts: ChecklistCounts, severity: ChecklistItem["severity"]) {
  return checklistItems
    .filter((item) => item.severity === severity)
    .reduce((total, item) => total + counts[item.key], 0);
}

function badgeStyle(count: number, severity: ChecklistItem["severity"]) {
  if (count === 0) return { background: "#e8f5ec", color: "#136c3a", borderColor: "#b7dfc5" };
  if (severity === "blocking") return { background: "#fdebea", color: "#a5281b", borderColor: "#f2b8b5" };
  return { background: "#fff4df", color: "#8a4b00", borderColor: "#f2cf8f" };
}

export function PublishingChecklistDashboard() {
  const client = useClient({ apiVersion: "2025-02-19" });
  const [counts, setCounts] = useState<ChecklistCounts>(emptyCounts);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadCounts = useCallback(() => {
    setIsLoading(true);
    client
      .fetch<ChecklistCounts>(checklistQuery)
      .then((result) => {
        setCounts({ ...emptyCounts, ...result });
        setError(undefined);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "无法加载发布检查统计数据。");
      })
      .finally(() => setIsLoading(false));
  }, [client]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const blockingCount = countSeverity(counts, "blocking");
  const warningCount = countSeverity(counts, "warning");

  return (
    <main style={{ padding: 24, maxWidth: 960 }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ margin: "0 0 6px", color: "#6b7280", fontSize: 13, fontWeight: 600 }}>发布检查</p>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2 }}>概览</h1>
        <p style={{ margin: "10px 0 0", color: "#4b5563", lineHeight: 1.5 }}>
          发布前请检查以下统计。打开下方对应列表即可查看受影响的内容。
        </p>
      </header>

      <section style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, minWidth: 160 }}>
          <strong style={{ display: "block", fontSize: 28, color: blockingCount ? "#a5281b" : "#136c3a" }}>{blockingCount}</strong>
          <span style={{ color: "#4b5563" }}>阻断问题</span>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, minWidth: 160 }}>
          <strong style={{ display: "block", fontSize: 28, color: warningCount ? "#8a4b00" : "#136c3a" }}>{warningCount}</strong>
          <span style={{ color: "#4b5563" }}>警告</span>
        </div>
        <button
          type="button"
          onClick={loadCounts}
          disabled={isLoading}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "0 16px",
            background: "#ffffff",
            color: "#111827",
            fontWeight: 600,
            cursor: isLoading ? "default" : "pointer",
          }}
        >
          {isLoading ? "正在刷新…" : "刷新"}
        </button>
      </section>

      {error ? (
        <div style={{ border: "1px solid #f2b8b5", borderRadius: 8, padding: 14, color: "#a5281b", marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      <section style={{ display: "grid", gap: 10 }}>
        {checklistItems.map((item) => {
          const count = counts[item.key];
          const badge = badgeStyle(count, item.severity);
          return (
            <article
              key={item.key}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 14,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 16 }}>{item.title}</h2>
                <p style={{ margin: "5px 0 0", color: "#6b7280", fontSize: 13 }}>列表：{item.listTitle}</p>
              </div>
              <span
                style={{
                  border: `1px solid ${badge.borderColor}`,
                  background: badge.background,
                  color: badge.color,
                  borderRadius: 999,
                  minWidth: 42,
                  padding: "6px 10px",
                  textAlign: "center",
                  fontWeight: 700,
                }}
              >
                {isLoading ? "..." : count}
              </span>
            </article>
          );
        })}
      </section>
    </main>
  );
}
