import { useEffect, useState } from "react";
import { initialHeroPhoto as staticHeroPhoto, photos as staticPhotos, type Photo } from "../data/photos";
import {
  aboutData as staticAboutData,
  photoMeta as staticPhotoMeta,
  photoStories as staticPhotoStories,
  type AboutData,
  type PhotoMeta,
  type PhotoStory,
} from "../data/stories";
import {
  cmsHomepageLayoutQuery,
  cmsPhotobalconyLayoutQuery,
  cmsPhotosQuery,
  cmsSiteSettingsQuery,
  cmsStoriesQuery,
  type CmsHomepageLayout,
  type CmsPhotobalconyLayout,
  type CmsPhoto,
  type CmsSiteSettings,
  type CmsStory,
  type PortableTextBlock,
} from "./cmsQueries";
import type { HomepageLayout } from "./homepageLayout";
import type { PhotobalconyLayout } from "./photobalconyLayout";
import { fetchCms, isSanityConfigured } from "./sanity";

export type GalleryContent = {
  photos: Photo[];
  photoMeta: Record<string, PhotoMeta>;
  photoStories: Record<string, PhotoStory[]>;
  aboutData: AboutData;
  heroPhoto?: Photo;
  homepageLayout?: HomepageLayout;
  photobalconyLayout?: PhotobalconyLayout;
  source: "static" | "cms";
  isLoading: boolean;
  error?: string;
};

const staticContent: GalleryContent = {
  photos: staticPhotos,
  photoMeta: staticPhotoMeta,
  photoStories: staticPhotoStories,
  aboutData: staticAboutData,
  heroPhoto: staticHeroPhoto,
  source: "static",
  isLoading: false,
};

const CMS_CONTENT_CACHE_KEY = "queenstown.cmsContent.v4";

function blockToText(block: PortableTextBlock) {
  return block.children?.map((child) => child.text ?? "").join("") ?? "";
}

function blocksToLines(blocks: PortableTextBlock[] | undefined) {
  return blocks?.map(blockToText).filter(Boolean) ?? [];
}

function hasMeta(photo: CmsPhoto) {
  return Boolean(
    photo.date ||
      photo.location ||
      photo.camera ||
      photo.lens ||
      photo.aperture ||
      photo.shutter ||
      typeof photo.iso === "number" ||
      photo.focalLength,
  );
}

function toPhoto(photo: CmsPhoto): Photo | null {
  const src = resolvePhotoSrc(photo.src, photo.legacyPublicPath);
  if (!src || !photo.title || !photo.category || !photo.filename) {
    return null;
  }

  return {
    id: photo.id,
    src,
    title: photo.title,
    slug: photo.slug,
    category: photo.category,
    filename: photo.filename,
    width: photo.width || 1,
    height: photo.height || 1,
    isHero: photo.isHero,
  };
}

const IMAGE_CDN_PARAMS = "?w=2560&q=90&auto=format&fit=max";

function resolvePhotoSrc(sanityUrl: string | undefined, legacyPublicPath: string | undefined): string | undefined {
  if (import.meta.env.DEV && legacyPublicPath) {
    return legacyPublicPath;
  }
  if (sanityUrl) {
    return `${sanityUrl}${IMAGE_CDN_PARAMS}`;
  }
  return legacyPublicPath;
}

function toPhotoMeta(photos: CmsPhoto[]) {
  return photos.reduce<Record<string, PhotoMeta>>((metaByFilename, photo) => {
    if (!hasMeta(photo)) return metaByFilename;

    metaByFilename[photo.filename] = {
      date: photo.date,
      location: photo.location,
      camera: photo.camera,
      lens: photo.lens,
      aperture: photo.aperture,
      shutter: photo.shutter,
      iso: photo.iso,
      focalLength: photo.focalLength,
    };

    return metaByFilename;
  }, {});
}

function toReferencedPhoto(photo: CmsSiteSettings["heroPhoto"], options: { allowHidden?: boolean } = {}): Photo | undefined {
  const src = resolvePhotoSrc(photo?.src, photo?.legacyPublicPath);
  if ((!options.allowHidden && photo?.isHidden) || !photo?.id || !src || !photo.title || !photo.filename) {
    return undefined;
  }

  return {
    id: photo.id,
    src,
    title: photo.title,
    slug: photo.slug,
    category: photo.category ?? "",
    filename: photo.filename,
    width: photo.width || 1,
    height: photo.height || 1,
  };
}

function uniquePhotosById(...groups: Photo[][]) {
  const seen = new Set<string>();

  return groups.flat().filter((photo) => {
    if (seen.has(photo.id)) return false;
    seen.add(photo.id);
    return true;
  });
}

function collectHomepageReferencedPhotos(layout: CmsHomepageLayout | null | undefined) {
  if (!layout) {
    return [];
  }

  const referenced = [
    ...(layout.featureCards?.map((card) => card.photo) ?? []),
    ...(layout.landscapePhotos ?? []),
    ...(layout.quietPhotos ?? []),
    layout.bannerOnePhoto,
    ...(layout.cityPhotos ?? []),
    layout.plantsHeroPhoto,
    ...(layout.plantsCarouselPhotos ?? []),
    layout.plantsFeaturePhoto,
    ...(layout.plantsStackPhotos ?? []),
    ...(layout.plantsSquarePhotos ?? []),
  ];

  return referenced.flatMap((photo) => {
    const resolved = toReferencedPhoto(photo, { allowHidden: true });
    return resolved ? [resolved] : [];
  });
}

function collectPhotobalconyReferencedPhotos(layout: CmsPhotobalconyLayout | null | undefined) {
  if (!layout) {
    return [];
  }

  const referenced = [
    layout.heroPhoto,
    ...(layout.mayPhotos ?? []),
    ...(layout.marchPortraitPhotos ?? []),
    ...(layout.marchWidePhotos ?? []),
    ...(layout.februaryPhotos ?? []),
    ...(layout.januaryPhotos ?? []),
    ...(layout.winterPhotos ?? []),
    ...(layout.summerPhotos ?? []),
  ];

  return referenced.flatMap((photo) => {
    const resolved = toReferencedPhoto(photo, { allowHidden: true });
    return resolved ? [resolved] : [];
  });
}

function toPhotoStories(stories: CmsStory[]) {
  return stories.reduce<Record<string, PhotoStory[]>>((storiesByFilename, story) => {
    const filename = story.coverPhoto?.filename ?? story.relatedPhotos?.find((photo) => photo?.filename)?.filename;
    if (!filename || !story.title) return storiesByFilename;

    const entry: PhotoStory = {
      title: story.title,
      slug: story.slug,
      publishedAt: story.publishedAt,
      orderRank: story.orderRank,
      isPinned: story.isPinned,
      pinOrder: story.pinOrder,
      excerpt: story.excerpt ?? "",
      body: blocksToLines(story.body),
    };

    if (!storiesByFilename[filename]) {
      storiesByFilename[filename] = [];
    }
    storiesByFilename[filename].push(entry);

    return storiesByFilename;
  }, {});
}

function toAboutData(settings: CmsSiteSettings | null | undefined): AboutData {
  if (!settings) {
    return staticAboutData;
  }

  return {
    name: settings.aboutName || staticAboutData.name,
    location: settings.aboutLocation || staticAboutData.location,
    bio: blocksToLines(settings.aboutBio).length ? blocksToLines(settings.aboutBio) : staticAboutData.bio,
    gear: settings.gear?.flatMap((item) => (item.name && item.value ? [{ name: item.name, value: item.value }] : [])) ?? staticAboutData.gear,
    contact:
      settings.socialLinks?.flatMap((item) =>
        item.label && item.value && item.href ? [{ label: item.label, value: item.value, href: item.href }] : [],
      ) ?? staticAboutData.contact,
  };
}

function photosById(photos: Photo[]) {
  return new Map(photos.map((photo) => [photo.id, photo]));
}

function resolvePhotoIds(photoMap: Map<string, Photo>, ids: string[] | undefined) {
  const resolved = ids?.flatMap((id) => {
    const photo = photoMap.get(id);
    return photo ? [photo] : [];
  });

  return resolved?.length ? resolved : undefined;
}

function resolvePhotoId(photoMap: Map<string, Photo>, id: string | undefined) {
  return id ? photoMap.get(id) : undefined;
}

function resolveLayoutPhotos(
  photoMap: Map<string, Photo>,
  ids: string[] | undefined,
  referencedPhotos: CmsPhotobalconyLayout["summerPhotos"],
) {
  const maxLength = Math.max(ids?.length ?? 0, referencedPhotos?.length ?? 0);
  const seen = new Set<string>();
  const resolved: Photo[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const photo =
      resolvePhotoId(photoMap, ids?.[index]) ??
      toReferencedPhoto(referencedPhotos?.[index], { allowHidden: true });

    if (!photo || seen.has(photo.id)) {
      continue;
    }

    seen.add(photo.id);
    resolved.push(photo);
  }

  return resolved;
}

function toHomepageLayout(layout: CmsHomepageLayout | null | undefined, photos: Photo[]): HomepageLayout | undefined {
  if (!layout) {
    return undefined;
  }

  const photoMap = photosById(photos);
  const featureCards = layout.featureCards
    ?.flatMap((card) => {
      const photo = resolvePhotoId(photoMap, card.photoId);
      if (!card.title || !photo) return [];

      return [
        {
          title: card.title,
          href: card.href || undefined,
          photo,
        },
      ];
    })
    .slice(0, 3);

  return {
    featureCards: featureCards?.length ? featureCards : undefined,
    landscapePhotos: resolvePhotoIds(photoMap, layout.landscapePhotoIds),
    quietPhotos: resolvePhotoIds(photoMap, layout.quietPhotoIds),
    bannerOnePhoto: resolvePhotoId(photoMap, layout.bannerOnePhotoId),
    cityPhotos: resolvePhotoIds(photoMap, layout.cityPhotoIds),
    plantsHeroPhoto: resolvePhotoId(photoMap, layout.plantsHeroPhotoId),
    plantsCarouselPhotos: resolvePhotoIds(photoMap, layout.plantsCarouselPhotoIds),
    plantsFeaturePhoto: resolvePhotoId(photoMap, layout.plantsFeaturePhotoId),
    plantsStackPhotos: resolvePhotoIds(photoMap, layout.plantsStackPhotoIds),
    plantsSquarePhotos: resolvePhotoIds(photoMap, layout.plantsSquarePhotoIds),
  };
}

function toPhotobalconyLayout(
  layout: CmsPhotobalconyLayout | null | undefined,
  photos: Photo[],
): PhotobalconyLayout | undefined {
  if (!layout) {
    return undefined;
  }

  const photoMap = photosById(photos);

  return {
    heroPhoto: resolvePhotoId(photoMap, layout.heroPhotoId) ?? toReferencedPhoto(layout.heroPhoto, { allowHidden: true }),
    mayTitle: layout.mayTitle,
    marchTitle: layout.marchTitle,
    februaryTitle: layout.februaryTitle,
    januaryTitle: layout.januaryTitle,
    winterTitle: layout.winterTitle,
    summerTitle: layout.summerTitle,
    mayPhotos: resolveLayoutPhotos(photoMap, layout.mayPhotoIds, layout.mayPhotos),
    marchPortraitPhotos: resolveLayoutPhotos(photoMap, layout.marchPortraitPhotoIds, layout.marchPortraitPhotos),
    marchWidePhotos: resolveLayoutPhotos(photoMap, layout.marchWidePhotoIds, layout.marchWidePhotos),
    februaryPhotos: resolveLayoutPhotos(photoMap, layout.februaryPhotoIds, layout.februaryPhotos),
    januaryPhotos: resolveLayoutPhotos(photoMap, layout.januaryPhotoIds, layout.januaryPhotos),
    winterPhotos: resolveLayoutPhotos(photoMap, layout.winterPhotoIds, layout.winterPhotos),
    summerPhotos: resolveLayoutPhotos(photoMap, layout.summerPhotoIds, layout.summerPhotos),
  };
}

async function loadCmsContent(): Promise<GalleryContent> {
  const [cmsPhotos, cmsStories, cmsSiteSettings, cmsHomepageLayout, cmsPhotobalconyLayout] = await Promise.all([
    fetchCms<CmsPhoto[]>(cmsPhotosQuery),
    fetchCms<CmsStory[]>(cmsStoriesQuery),
    fetchCms<CmsSiteSettings | null>(cmsSiteSettingsQuery),
    fetchCms<CmsHomepageLayout | null>(cmsHomepageLayoutQuery),
    fetchCms<CmsPhotobalconyLayout | null>(cmsPhotobalconyLayoutQuery),
  ]);

  const cmsPhotoEntries = cmsPhotos.map(toPhoto).filter((photo): photo is Photo => photo !== null);
  const harborFallbackPhoto = staticPhotos.find((photo) => photo.filename === "DSC_5026.JPG");
  const needsHarborFallback =
    harborFallbackPhoto && !cmsPhotoEntries.some((photo) => photo.filename === harborFallbackPhoto.filename);
  const photos = uniquePhotosById(
    cmsPhotoEntries,
    collectHomepageReferencedPhotos(cmsHomepageLayout),
    collectPhotobalconyReferencedPhotos(cmsPhotobalconyLayout),
    needsHarborFallback ? [harborFallbackPhoto] : [],
  );
  const heroPhoto =
    photos.find((photo) => photo.id === cmsSiteSettings?.heroPhoto?.id) ??
    toReferencedPhoto(cmsSiteSettings?.heroPhoto) ??
    photos.find((photo) => photo.isHero);

  if (photos.length === 0) {
    throw new Error("Sanity returned no publishable photos");
  }

  return {
    photos,
    photoMeta: toPhotoMeta(cmsPhotos),
    photoStories: toPhotoStories(cmsStories),
    aboutData: toAboutData(cmsSiteSettings),
    heroPhoto,
    homepageLayout: toHomepageLayout(cmsHomepageLayout, photos),
    photobalconyLayout: toPhotobalconyLayout(cmsPhotobalconyLayout, photos),
    source: "cms",
    isLoading: false,
  };
}

function readCachedCmsContent(): GalleryContent | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const cached = window.localStorage.getItem(CMS_CONTENT_CACHE_KEY);
    if (!cached) {
      return undefined;
    }

    const content = JSON.parse(cached) as GalleryContent;
    if (content.source !== "cms" || content.photos.length === 0) {
      return undefined;
    }

    return {
      ...content,
      isLoading: true,
      error: undefined,
    };
  } catch {
    window.localStorage.removeItem(CMS_CONTENT_CACHE_KEY);
    return undefined;
  }
}

function writeCachedCmsContent(content: GalleryContent) {
  if (typeof window === "undefined" || content.source !== "cms") {
    return;
  }

  try {
    window.localStorage.setItem(
      CMS_CONTENT_CACHE_KEY,
      JSON.stringify({
        ...content,
        isLoading: false,
        error: undefined,
      }),
    );
  } catch {
    window.localStorage.removeItem(CMS_CONTENT_CACHE_KEY);
  }
}

export function useGalleryContent() {
  const [content, setContent] = useState<GalleryContent>(() => ({
    ...(isSanityConfigured() ? (readCachedCmsContent() ?? staticContent) : staticContent),
    isLoading: isSanityConfigured(),
  }));

  useEffect(() => {
    if (!isSanityConfigured()) {
      return;
    }

    let isMounted = true;

    loadCmsContent()
      .then((cmsContent) => {
        if (isMounted) {
          writeCachedCmsContent(cmsContent);
          setContent(cmsContent);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          const message = error instanceof Error ? error.message : "Failed to load Sanity content";
          setContent((currentContent) => ({
            ...(currentContent.source === "cms" ? currentContent : staticContent),
            isLoading: false,
            error: message,
          }));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return content;
}
