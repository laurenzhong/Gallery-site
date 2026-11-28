import type { Photo } from "../data/photos";
import type { CmsHomepageLayout, CmsPageContent, CmsPageSection, CmsPhoto, CmsPhotobalconyLayout, CmsPlacementSnapshot, CmsStoryPhoto } from "./cmsQueries";
import { galleryPresentations, type HomepageContentSection } from "./homepageLayout";
import { contentLink, isContentPageKey, type ContentPageKey } from "./pageContentPages";
import { chaptersFromLegacyBalcony, isBalconyPresentation, type BalconyChapter, type PhotobalconyLayout, type PhotobalconyPeriod } from "./photobalconyLayout";

export type PageContentAdapterResult = {
  pageKey: CmsPageContent["pageKey"];
  title?: string;
  subtitle?: string;
  heroPhoto?: Photo;
  modulesPosition: "before" | "after";
  sections?: HomepageContentSection[];
  photobalconyLayout?: PhotobalconyLayout;
  warnings: string[];
};

function photoResolver(allPhotos: Photo[], draft: boolean) {
  const photosById = new Map(allPhotos.map((photo) => [photo.id, photo]));

  const one = (reference?: CmsStoryPhoto | null): Photo | undefined => {
    if (!reference?.id || reference.isHidden || reference.categoryIsVisible === false) return undefined;
    const existing = photosById.get(reference.id);
    if (!reference.src || !reference.title || (!draft && existing)) return existing;
    return {
      ...existing,
      id: reference.id,
      src: reference.src,
      title: reference.title,
      filename: reference.filename || existing?.filename || reference.id,
      category: reference.category ?? "",
      categoryId: reference.categoryId ?? undefined,
      slug: reference.slug,
      liveVideoUrl: reference.liveVideoUrl ?? undefined,
      width: reference.width || 1,
      height: reference.height || 1,
      altText: reference.altText,
      caption: reference.caption,
      credit: reference.credit,
    };
  };

  const many = (references?: CmsStoryPhoto[]) => {
    const seen = new Set<string>();
    return (references ?? []).flatMap((reference) => {
      const photo = one(reference);
      if (!photo || seen.has(photo.id)) return [];
      seen.add(photo.id);
      return [photo];
    });
  };

  return { one, many };
}

type PhotoResolver = ReturnType<typeof photoResolver>;

function defaultPresentation(slot: Extract<CmsPageSection, { type: "gallerySlot" }>["slotKey"]) {
  if (slot === "quiet") return "squareRail";
  if (slot === "harborStack") return "stack";
  if (slot === "harborSquare") return "squareGrid";
  return "landscapeCarousel";
}

function adaptSections(
  input: CmsPageSection[] | undefined,
  resolve: PhotoResolver,
  allPhotos: Photo[],
  warnings: string[],
) {
  const sections: HomepageContentSection[] = [];

  for (const [index, section] of (input ?? []).entries()) {
    if (section.isVisible === false) continue;
    const id = section.id ?? `${section.type}-${index}`;
    const title = section.title?.trim() || undefined;
    const description = section.description?.trim() || undefined;
    const base = { id, title, description };

    if (section.type === "featureCardsSlot") {
      const cards = (section.cards ?? []).flatMap((card, cardIndex) => {
        const photo = resolve.one(card.photo);
        const title = card.title?.trim();
        if (!title || !photo) {
          warnings.push(`${section.title || "特色卡片"}：第 ${cardIndex + 1} 张卡片缺少标题或可用照片。`);
          return [];
        }
        return [{ id: card.id ?? String(cardIndex), title, photo, href: contentLink(card.linkPage, card.linkTarget), linkLabel: card.linkLabel?.trim() }];
      }).slice(0, 3);
      if (cards.length) sections.push({ ...base, kind: "featureCards", cards });
      else if (!section.cards?.length) warnings.push(`${title || "特色卡片"}：至少需要一张卡片。`);
      continue;
    }

    if (section.type === "gallerySlot") {
      const category = section.category;
      const useCategory = section.sourceMode === "category";
      const limit = Number.isInteger(section.limit) ? Math.min(Math.max(section.limit!, 1), 48) : useCategory ? 18 : 48;
      const selected = useCategory
        ? allPhotos.filter((photo) => category?.isVisible !== false && (category?.id ? photo.categoryId === category.id : category?.title === photo.category)).slice(0, limit)
        : resolve.many(section.photos);
      const photos = selected.slice(0, limit);
      const presentation = section.presentation ?? defaultPresentation(section.slotKey);
      if (!photos.length || !Object.hasOwn(galleryPresentations, presentation)) {
        warnings.push(`${title || "照片画廊"}：没有可用照片或版式无效。`);
        continue;
      }
      if (!useCategory && (section.photos?.length ?? 0) > selected.length) {
        warnings.push(`${title || "照片画廊"}：已跳过重复或不可用的照片。`);
      }
      sections.push({ ...base, kind: "gallery", slotKey: section.slotKey, presentation, photos });
      continue;
    }

    if (section.type === "bannerSlot" || section.type === "heroSlot") {
      const photo = resolve.one(section.photo);
      if (!photo) {
        warnings.push(`${title || "横幅"}：缺少可用照片。`);
        continue;
      }
      sections.push({
        ...base,
        kind: "banner",
        photo,
        slotKey: section.type === "heroSlot" ? "harbor" : section.slotKey,
        href: contentLink(section.linkPage, section.linkTarget),
        linkLabel: section.linkLabel?.trim(),
      });
      continue;
    }

    if (section.type === "harborSlot") {
      const hero = resolve.one(section.heroPhoto);
      const feature = resolve.one(section.featurePhoto);
      const carousel = resolve.many(section.carouselPhotos);
      const stack = resolve.many(section.stackPhotos);
      const squares = resolve.many(section.squarePhotos);
      if (hero) sections.push({ ...base, id: `${id}-hero`, kind: "banner", photo: hero, slotKey: "harbor" });
      if (carousel.length) sections.push({ id: `${id}-carousel`, kind: "gallery", photos: carousel, presentation: "landscapeCarousel" });
      if (feature) sections.push({ id: `${id}-feature`, kind: "banner", photo: feature });
      if (stack.length) sections.push({ id: `${id}-stack`, kind: "gallery", photos: stack, presentation: "stack" });
      if (squares.length) sections.push({ id: `${id}-square`, kind: "gallery", photos: squares, presentation: "squareGrid" });
      continue;
    }

    warnings.push(`${title || id}：此页面不支持这个模块。`);
  }

  return sections;
}

function adaptBalcony(content: CmsPageContent, resolve: PhotoResolver, warnings: string[]): PhotobalconyLayout {
  let heroPhoto = resolve.one(content.heroPhoto);
  const periods: (PhotobalconyPeriod & { id?: string })[] = [];
  const seen = new Set<string>();

  for (const section of content.sections ?? []) {
    if (section.isVisible === false) continue;
    if (section.type === "heroSlot") {
      heroPhoto ??= resolve.one(section.photo);
      continue;
    }
    if (content.balconyChapters || section.type !== "balconyPeriodSlot" || !section.periodKey || seen.has(section.periodKey)) continue;
    const photos = resolve.many(section.photos);
    if (photos.length) {
      periods.push({ id: section.id, key: section.periodKey, title: section.title || section.periodKey, photos });
      seen.add(section.periodKey);
    }
  }

  const chapters = content.balconyChapters?.flatMap((chapter): BalconyChapter<Photo>[] => {
    if (chapter.isVisible === false) return [];
    const galleries = (chapter.galleries ?? []).flatMap((gallery) => {
      if (gallery.isVisible === false) return [];
      const photos = resolve.many(gallery.photos);
      if (!isBalconyPresentation(gallery.presentation) || !photos.length) {
        warnings.push(`${chapter.title || "未命名章节"}：照片组缺少版式或可用照片。`);
        return [];
      }
      return [{ id: gallery.id, presentation: gallery.presentation, photos }];
    });
    return galleries.length ? [{ id: chapter.id, title: chapter.title?.trim() || "Untitled", galleries }] : [];
  }) ?? (Array.isArray(content.sections) ? chaptersFromLegacyBalcony(periods) : undefined);

  return { title: content.title, subtitle: content.subtitle, heroPhoto, chapters };
}

export function adaptPageContent(content: CmsPageContent, allPhotos: Photo[], { draft = false } = {}): PageContentAdapterResult {
  const warnings: string[] = [];
  const resolve = photoResolver(allPhotos, draft);
  const isBalcony = content.pageKey === "photobalcony";
  const hasPageHero = isBalcony || content.pageKey === "home";
  const input = content.photoModules ?? (isBalcony ? content.extraSections : content.sections);
  const sections = content.pageKey === "home" || Array.isArray(input) ? adaptSections(input, resolve, allPhotos, warnings) : undefined;
  const heroPhoto = hasPageHero ? resolve.one(content.heroPhoto) : undefined;
  if (hasPageHero && content.heroPhoto?.id && !heroPhoto) warnings.push("页面主视觉照片不可用。");
  const photobalconyLayout = isBalcony ? adaptBalcony(content, resolve, warnings) : undefined;

  return {
    pageKey: content.pageKey,
    title: hasPageHero ? content.title?.trim() : undefined,
    subtitle: hasPageHero ? content.subtitle?.trim() : undefined,
    heroPhoto: photobalconyLayout?.heroPhoto ?? heroPhoto,
    modulesPosition: content.modulesPosition === "before" ? "before" : "after",
    sections,
    photobalconyLayout,
    warnings,
  };
}

export type AdaptedPages = Partial<Record<ContentPageKey, PageContentAdapterResult>>;

export function adaptPublishedPages(documents: CmsPageContent[], photos: Photo[]): AdaptedPages {
  const pages: AdaptedPages = {};
  for (const document of documents) {
    if (isContentPageKey(document.pageKey) && document.id === `pageContent-${document.pageKey}`) {
      pages[document.pageKey] = adaptPageContent(document, photos);
    }
  }
  return pages;
}

export function pagePhotoPlacements(
  pages: AdaptedPages,
  photos: Photo[],
  fallback: { home?: CmsHomepageLayout | null; balcony?: CmsPhotobalconyLayout | null; hero?: CmsStoryPhoto | null },
) {
  const placements = new Map<string, Set<ContentPageKey>>();
  const publicIds = new Set(photos.map(({ id }) => id));
  const add = (key: ContentPageKey, id?: string) => {
    if (!id || !publicIds.has(id)) return;
    const pagesForPhoto = placements.get(id) ?? new Set<ContentPageKey>();
    pagesForPhoto.add(key);
    placements.set(id, pagesForPhoto);
  };

  for (const page of Object.values(pages)) {
    if (!page) continue;
    add(page.pageKey, page.heroPhoto?.id);
    for (const section of page.sections ?? []) {
      if (section.kind === "banner") add(page.pageKey, section.photo.id);
      if (section.kind === "featureCards") section.cards.forEach(({ photo }) => add(page.pageKey, photo.id));
      if (section.kind === "gallery") section.photos.forEach(({ id }) => add(page.pageKey, id));
    }
    for (const chapter of page.photobalconyLayout?.chapters ?? []) {
      for (const gallery of chapter.galleries) gallery.photos.forEach(({ id }) => add(page.pageKey, id));
    }
  }

  const home = fallback.home;
  const balcony = fallback.balcony;
  if (!pages.home?.heroPhoto) add("home", fallback.hero?.id);
  if (!pages.home?.sections && home) {
    const photos = [...(home.featureCards?.map(({ photoId }) => photoId) ?? []), home.bannerOnePhotoId, home.plantsHeroPhotoId, home.plantsFeaturePhotoId,
      ...[home.landscapePhotoIds, home.quietPhotoIds, home.cityPhotoIds, home.plantsCarouselPhotoIds, home.plantsStackPhotoIds, home.plantsSquarePhotoIds].flatMap((ids) => ids ?? [])];
    photos.forEach((id) => add("home", id));
  }
  if (!pages.photobalcony?.heroPhoto) add("photobalcony", balcony?.heroPhotoId);
  if (!pages.photobalcony?.photobalconyLayout?.chapters && balcony) {
    [balcony.mayPhotoIds, balcony.marchPortraitPhotoIds, balcony.marchWidePhotoIds, balcony.februaryPhotoIds, balcony.januaryPhotoIds, balcony.winterPhotoIds, balcony.summerPhotoIds]
      .flatMap((ids) => ids ?? []).forEach((id) => add("photobalcony", id));
  }
  return placements;
}

export function photosForPlacement(photos: CmsPhoto[]): Photo[] {
  return photos.flatMap((photo) => {
    const src = photo.src || photo.legacyPublicPath;
    return photo.filename && photo.title && src ? [{
      id: photo.id, title: photo.title, filename: photo.filename, src,
      width: photo.width || 1, height: photo.height || 1, category: photo.category ?? "未分类", categoryId: photo.categoryId,
      slug: photo.slug, altText: photo.altText, caption: photo.caption, credit: photo.credit, liveVideoUrl: photo.liveVideoUrl ?? undefined,
    }] : [];
  });
}

export function resolveCmsPlacements(snapshot: CmsPlacementSnapshot, readPages = true) {
  const photos = photosForPlacement(snapshot.photos);
  return pagePhotoPlacements(adaptPublishedPages(readPages ? snapshot.pages : [], photos), photos, {
    home: snapshot.home,
    balcony: snapshot.balcony,
    hero: snapshot.settings?.heroPhoto,
  });
}
