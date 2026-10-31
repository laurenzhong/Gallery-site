import type { Photo } from "../data/photos";
import type { HomepageFeatureCard, HomepageLayout } from "./homepageLayout";
import type { PhotobalconyLayout } from "./photobalconyLayout";
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
      setOnce(layout as unknown as Record<string, HomepageFeatureCard[]>, "featureCards", adaptFeatureCards(section, photos, warnings, index), warnings, section, index);
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
      }[slotKey];
      if (resolved && target) {
        setOnce(layout as unknown as Record<string, Photo[]>, target, resolved, warnings, section, index);
      }
      continue;
    }

    if (section.type === "bannerSlot") {
      const photo = photoFromReference(section.photo, photos);
      if (!photo) {
        addWarning(warnings, section, index, "横幅缺少可用照片，已跳过");
      } else {
        setOnce(layout as unknown as Record<string, Photo>, "bannerOnePhoto", photo, warnings, section, index);
      }
      continue;
    }

    if (section.type === "harborSlot") {
      setOnce(layout as unknown as Record<string, Photo>, "plantsHeroPhoto", photoFromReference(section.heroPhoto, photos), warnings, section, index);
      const carouselPhotos = photosFromReferences(section.carouselPhotos, photos);
      const stackPhotos = photosFromReferences(section.stackPhotos, photos);
      const squarePhotos = photosFromReferences(section.squarePhotos, photos);
      if (carouselPhotos.length) {
        setOnce(layout as unknown as Record<string, Photo[]>, "plantsCarouselPhotos", carouselPhotos, warnings, section, index);
      }
      setOnce(layout as unknown as Record<string, Photo>, "plantsFeaturePhoto", photoFromReference(section.featurePhoto, photos), warnings, section, index);
      if (stackPhotos.length) {
        setOnce(layout as unknown as Record<string, Photo[]>, "plantsStackPhotos", stackPhotos, warnings, section, index);
      }
      if (squarePhotos.length) {
        setOnce(layout as unknown as Record<string, Photo[]>, "plantsSquarePhotos", squarePhotos, warnings, section, index);
      }
      continue;
    }

    addWarning(warnings, section, index, "该模块不属于首页受控结构，已跳过");
  }

  return { heroPhoto: heroPhoto ?? (slots.heroPhoto as Photo | undefined), homepageLayout: layout };
}

function returnHomeHero(slots: Record<string, unknown>, photo: Photo) {
  if (!slots.heroPhoto) slots.heroPhoto = photo;
}

function adaptBalconyContent(content: CmsPageContent, allPhotos: Photo[], warnings: string[]) {
  const photos = new Map(allPhotos.map((photo) => [photo.id, photo]));
  const layout: PhotobalconyLayout = {};
  const heroPhoto = photoFromReference(content.heroPhoto, photos);
  const periodTargets = {
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
    if (layout[photosKey] !== undefined) {
      addWarning(warnings, section, index, `重复配置时间段 ${periodKey}，已保留第一次配置`);
      continue;
    }

    const resolved = photosFromReferences(section.photos, photos);
    if (!resolved.length) {
      addWarning(warnings, section, index, "没有可用照片，已跳过");
      continue;
    }

    if (layout[titleKey] === undefined) layout[titleKey] = section.title;
    layout[photosKey] = resolved;
  }

  if (heroPhoto) layout.heroPhoto = heroPhoto;
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
