import type { Photo } from "../data/photos";
import type { HomepageContentSection, HomepageFeatureCard, HomepageLayout } from "./homepageLayout";
import type { PhotobalconyLayout, PhotobalconyPeriod, PhotobalconyPeriodKey } from "./photobalconyLayout";
import type { CmsPageContent, CmsPageSection, CmsStoryPhoto } from "./cmsQueries";

export type PageContentAdapterResult = {
  pageKey: CmsPageContent["pageKey"];
  title: string;
  subtitle?: string;
  heroPhoto?: Photo;
  homepageLayout?: HomepageLayout;
  photobalconyLayout?: PhotobalconyLayout;
  warnings: string[];
};

type PhotoMap = Map<string, Photo>;

function uniquePhotos(photos: Photo[]) {
  const seen = new Set<string>();
  return photos.filter((photo) => {
    if (seen.has(photo.id)) return false;
    seen.add(photo.id);
    return true;
  });
}

function photoFromReference(reference: CmsStoryPhoto | undefined, photos: PhotoMap) {
  if (!reference?.id || reference.isHidden) return undefined;
  return photos.get(reference.id);
}

function photosFromReferences(references: CmsStoryPhoto[] | undefined, photos: PhotoMap) {
  return uniquePhotos(
    (references ?? []).flatMap((reference) => {
      const photo = photoFromReference(reference, photos);
      return photo ? [photo] : [];
    }),
  );
}

function internalHref(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

function categoryPhotos(section: Extract<CmsPageSection, { type: "gallerySlot" }>, photos: Photo[]) {
  const category = section.category?.title;
  if (!category) return [];
  const limit = Math.min(Math.max(section.limit ?? 18, 1), 48);
  return photos.filter((photo) => photo.category === category).slice(0, limit);
}

function sectionLabel(section: CmsPageSection, index: number) {
  return section.title || `${section.type} #${index + 1}`;
}

function addWarning(warnings: string[], section: CmsPageSection, index: number, message: string) {
  warnings.push(`${sectionLabel(section, index)}：${message}`);
}

function setOnce<T>(
  target: Record<string, T>,
  key: string,
  value: T | undefined,
  warnings: string[],
  section: CmsPageSection,
  index: number,
) {
  if (value === undefined) return;
  if (target[key] !== undefined) {
    addWarning(warnings, section, index, `重复配置槽位 ${key}，已保留第一次配置`);
    return;
  }
  target[key] = value;
}

function adaptFeatureCards(
  section: Extract<CmsPageSection, { type: "featureCardsSlot" }>,
  photos: PhotoMap,
  warnings: string[],
  index: number,
) {
  const cards: HomepageFeatureCard[] = [];

  for (const card of section.cards ?? []) {
    const photo = photoFromReference(card.photo, photos);
    if (!card.title || !photo) {
      addWarning(warnings, section, index, "卡片缺少标题或可用照片，已跳过");
      continue;
    }
    cards.push({ title: card.title, photo, href: internalHref(card.linkTarget) });
  }

  return cards.length ? cards.slice(0, 3) : undefined;
}

function adaptGalleryPhotos(
  section: Extract<CmsPageSection, { type: "gallerySlot" }>,
  allPhotos: Photo[],
  photos: PhotoMap,
  warnings: string[],
  index: number,
) {
  const resolved = section.sourceMode === "category" ? categoryPhotos(section, allPhotos) : photosFromReferences(section.photos, photos);
  const limit = Math.min(Math.max(section.limit ?? resolved.length, 1), 48);
  const result = resolved.slice(0, limit);

  if (!result.length) {
    addWarning(warnings, section, index, "没有可用照片，已跳过");
    return undefined;
  }

  return result;
}

function adaptHomeContent(content: CmsPageContent, allPhotos: Photo[], warnings: string[]) {
  const photos = new Map(allPhotos.map((photo) => [photo.id, photo]));
  const layout: HomepageLayout = {};
  const sections: HomepageContentSection[] = [];
  const slots: Record<string, unknown> = {};
  const heroPhoto = photoFromReference(content.heroPhoto, photos);

  for (const [index, section] of (content.sections ?? []).entries()) {
    if (section.isVisible === false) continue;

    if (section.type === "heroSlot") {
      const photo = photoFromReference(section.photo, photos);
      if (!photo) {
        addWarning(warnings, section, index, "主视觉缺少可用照片");
      } else if (!heroPhoto) {
        returnHomeHero(slots, photo);
      }
      continue;
    }

    if (section.type === "featureCardsSlot") {
      const cards = adaptFeatureCards(section, photos, warnings, index);
      const hadFeatureCards = layout.featureCards !== undefined;
      setOnce(layout as unknown as Record<string, HomepageFeatureCard[]>, "featureCards", cards, warnings, section, index);
      if (cards && !hadFeatureCards) {
        sections.push({ id: section.id ?? `feature-cards-${index}`, kind: "featureCards", title: section.title, cards });
      }
      continue;
    }

    if (section.type === "gallerySlot") {
      const slotKey = section.slotKey;
      if (!slotKey) {
        addWarning(warnings, section, index, "缺少页面槽位");
        continue;
      }
      const resolved = adaptGalleryPhotos(section, allPhotos, photos, warnings, index);
      const target = {
        landscape: "landscapePhotos",
        quiet: "quietPhotos",
        city: "cityPhotos",
        harborCarousel: "plantsCarouselPhotos",
        harborStack: "plantsStackPhotos",
        harborSquare: "plantsSquarePhotos",
      }[slotKey];
      if (resolved && target) {
        const layoutValues = layout as unknown as Record<string, unknown>;
        if (layoutValues[target] !== undefined) {
          addWarning(warnings, section, index, `重复配置槽位 ${target}，已保留第一次配置`);
        } else {
          layoutValues[target] = resolved;
          sections.push({
            id: section.id ?? `${slotKey}-${index}`,
            kind: "gallery",
            title: section.title,
            photos: resolved,
            presentation:
              section.presentation ??
              (slotKey === "harborStack" ? "stack" : slotKey === "harborSquare" ? "squareGrid" : "landscapeCarousel"),
          });
        }
      }
      continue;
    }

    if (section.type === "bannerSlot") {
      const photo = photoFromReference(section.photo, photos);
      if (!photo) {
        addWarning(warnings, section, index, "横幅缺少可用照片，已跳过");
      } else {
        const slotKey = section.slotKey ?? "bannerOne";
        const target = slotKey === "harbor" ? "plantsHeroPhoto" : "bannerOnePhoto";
        const layoutValues = layout as unknown as Record<string, unknown>;
        if (layoutValues[target] !== undefined) {
          addWarning(warnings, section, index, `重复配置槽位 ${target}，已保留第一次配置`);
        } else {
          layoutValues[target] = photo;
          sections.push({
            id: section.id ?? `${slotKey}-${index}`,
            kind: "banner",
            title: section.title,
            photo,
            slotKey,
          });
        }
      }
      continue;
    }

    if (section.type === "harborSlot") {
      setOnce(layout as unknown as Record<string, Photo>, "plantsHeroPhoto", photoFromReference(section.heroPhoto, photos), warnings, section, index);
      const carouselPhotos = photosFromReferences(section.carouselPhotos, photos);
      const stackPhotos = photosFromReferences(section.stackPhotos, photos);
      const squarePhotos = photosFromReferences(section.squarePhotos, photos);
      if (photoFromReference(section.heroPhoto, photos)) {
        sections.push({
          id: `${section.id ?? `harbor-${index}`}-hero`,
          kind: "banner",
          title: section.title,
          photo: photoFromReference(section.heroPhoto, photos)!,
          slotKey: "harbor",
        });
      }
      if (carouselPhotos.length) {
        setOnce(layout as unknown as Record<string, Photo[]>, "plantsCarouselPhotos", carouselPhotos, warnings, section, index);
        sections.push({ id: `${section.id ?? `harbor-${index}`}-carousel`, kind: "gallery", title: `${section.title ?? "Harbor"} carousel`, photos: carouselPhotos, presentation: "landscapeCarousel" });
      }
      setOnce(layout as unknown as Record<string, Photo>, "plantsFeaturePhoto", photoFromReference(section.featurePhoto, photos), warnings, section, index);
      if (stackPhotos.length) {
        setOnce(layout as unknown as Record<string, Photo[]>, "plantsStackPhotos", stackPhotos, warnings, section, index);
        sections.push({ id: `${section.id ?? `harbor-${index}`}-stack`, kind: "gallery", title: `${section.title ?? "Harbor"} stack`, photos: stackPhotos, presentation: "stack" });
      }
      if (squarePhotos.length) {
        setOnce(layout as unknown as Record<string, Photo[]>, "plantsSquarePhotos", squarePhotos, warnings, section, index);
        sections.push({ id: `${section.id ?? `harbor-${index}`}-square`, kind: "gallery", title: `${section.title ?? "Harbor"} squares`, photos: squarePhotos, presentation: "squareGrid" });
      }
      continue;
    }

    addWarning(warnings, section, index, "该模块不属于首页受控结构，已跳过");
  }

  if (sections.length) layout.sections = sections;
  return { heroPhoto: heroPhoto ?? (slots.heroPhoto as Photo | undefined), homepageLayout: layout };
}

function returnHomeHero(slots: Record<string, unknown>, photo: Photo) {
  if (!slots.heroPhoto) slots.heroPhoto = photo;
}

function adaptBalconyContent(content: CmsPageContent, allPhotos: Photo[], warnings: string[]) {
  const photos = new Map(allPhotos.map((photo) => [photo.id, photo]));
  const layout: PhotobalconyLayout = {};
  const periods: PhotobalconyPeriod[] = [];
  const heroPhoto = photoFromReference(content.heroPhoto, photos);
  const periodTargets: Record<PhotobalconyPeriodKey, readonly [string, string]> = {
    may: ["mayTitle", "mayPhotos"],
    marchPortraits: ["marchTitle", "marchPortraitPhotos"],
    marchWide: ["marchTitle", "marchWidePhotos"],
    february: ["februaryTitle", "februaryPhotos"],
    january: ["januaryTitle", "januaryPhotos"],
    winter: ["winterTitle", "winterPhotos"],
    summer: ["summerTitle", "summerPhotos"],
  } as const;

  for (const [index, section] of (content.sections ?? []).entries()) {
    if (section.isVisible === false) continue;

    if (section.type === "heroSlot") {
      if (!heroPhoto) {
        const photo = photoFromReference(section.photo, photos);
        if (photo) returnHomeHero(layout as unknown as Record<string, unknown>, photo);
      }
      continue;
    }

    if (section.type !== "balconyPeriodSlot") {
      addWarning(warnings, section, index, "该模块不属于 Photobalcony 受控结构，已跳过");
      continue;
    }

    const periodKey = section.periodKey;
    const target = periodKey ? periodTargets[periodKey] : undefined;
    if (!target) {
      addWarning(warnings, section, index, "缺少有效时间段");
      continue;
    }

    const [titleKey, photosKey] = target;
    const layoutValues = layout as Record<string, unknown>;
    if (layoutValues[photosKey] !== undefined) {
      addWarning(warnings, section, index, `重复配置时间段 ${periodKey}，已保留第一次配置`);
      continue;
    }

    const resolved = photosFromReferences(section.photos, photos);
    if (!resolved.length) {
      addWarning(warnings, section, index, "没有可用照片，已跳过");
      continue;
    }

    if (layoutValues[titleKey] === undefined) layoutValues[titleKey] = section.title;
    layoutValues[photosKey] = resolved;
    periods.push({ key: periodKey as PhotobalconyPeriodKey, title: section.title ?? "", photos: resolved });
  }

  if (heroPhoto) layout.heroPhoto = heroPhoto;
  if (periods.length) layout.periods = periods;
  return { heroPhoto: heroPhoto ?? (layout.heroPhoto as Photo | undefined), photobalconyLayout: layout };
}

export function adaptPageContent(content: CmsPageContent, allPhotos: Photo[]): PageContentAdapterResult {
  const warnings: string[] = [];
  const adapted = content.pageKey === "home" ? adaptHomeContent(content, allPhotos, warnings) : adaptBalconyContent(content, allPhotos, warnings);

  return {
    pageKey: content.pageKey,
    title: content.title,
    subtitle: content.subtitle,
    heroPhoto: adapted.heroPhoto,
    homepageLayout: "homepageLayout" in adapted ? adapted.homepageLayout : undefined,
    photobalconyLayout: "photobalconyLayout" in adapted ? adapted.photobalconyLayout : undefined,
    warnings,
  };
}
