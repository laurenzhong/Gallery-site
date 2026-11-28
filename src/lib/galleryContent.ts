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
import { fetchCms, fetchPreloadedCms, isSanityConfigured } from "./sanity";

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

// The previous page-layout rollout stored a different content shape under v4.
// Never reuse those entries after restoring the native gallery renderer.
const CMS_CONTENT_CACHE_KEY = "queenstown.cmsContent.v10";
const ABOUT_DATA_CACHE_VERSION = 1;
const LEGACY_CMS_CONTENT_CACHE_KEYS = [
  "queenstown.cmsContent.v9",
  "queenstown.cmsContent.v8",
  "queenstown.cmsContent.v7",
  "queenstown.cmsContent.v6",
  "queenstown.cmsContent.v5",
  "queenstown.cmsContent.v4",
];

function shouldUseRemoteImages() {
  return (
    import.meta.env.PROD ||
    import.meta.env.VITE_SANITY_REMOTE_ONLY === "true" ||
    (typeof window !== "undefined" && (() => {
      const params = new URLSearchParams(window.location.search);
      const mode = import.meta.env.VITE_PAGE_CONTENT_MODE ?? "stable";
      const query = params.get("page-content-preview");
      return mode === "preview" || mode === "production" || query === "1" || query === "true";
    })())
  );
}

function blockToText(block: PortableTextBlock) {
  return block.children?.map((child) => child.text ?? "").join("") ?? "";
}

function blocksToLines(blocks: PortableTextBlock[] | undefined) {
  return blocks?.map(blockToText).filter(Boolean) ?? [];
}

function coordinatesFromLocation(value: string | undefined) {
  const match = value?.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return undefined;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return undefined;

  // Accept both common notations: latitude,longitude and longitude,latitude.
  // Values above 90 degrees can only be longitudes, so this also repairs old
  // CMS records that were entered in the reverse order.
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
    return { latitude: first, longitude: second };
  }
  if (Math.abs(second) <= 90 && Math.abs(first) <= 180) {
    return { latitude: second, longitude: first };
  }
  return undefined;
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
  const src = resolvePhotoSrc(photo.src, photo.legacyPublicPath, photo.filename);
  if (!src || !photo.title || !photo.filename) {
    return null;
  }

  const staticMatch = staticPhotos.find((item) => item.filename === photo.filename);
  const staticLatitude = staticMatch?.latitude;
  const staticLongitude = staticMatch?.longitude;
  const visibility = photo.geo?.visibility ?? "exact";
  const latitude = photo.geo?.latitude;
  const longitude = photo.geo?.longitude;
  const geoCoordinates = typeof latitude === "number" && Math.abs(latitude) <= 90 && typeof longitude === "number" && Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : undefined;
  const manualCoordinates = coordinatesFromLocation(photo.location);
  // A CMS value always wins. If it is a named place rather than coordinates,
  // leave the photo unlocated instead of silently replacing the editor's value
  // with an older static EXIF coordinate.
  const rawCoordinates = geoCoordinates ?? manualCoordinates ?? (visibility === "exact" && !photo.location?.trim() && Number.isFinite(staticLatitude) && Number.isFinite(staticLongitude)
    ? { latitude: staticLatitude as number, longitude: staticLongitude as number }
    : undefined);
  const coordinates = visibility === "private" || !rawCoordinates
    ? undefined
    : visibility === "approximate"
      ? { latitude: Number(rawCoordinates.latitude.toFixed(2)), longitude: Number(rawCoordinates.longitude.toFixed(2)) }
      : rawCoordinates;
  return {
    id: photo.id,
    ...(photo.legacyId ? { legacyId: photo.legacyId } : {}),
    src,
    liveVideoUrl: photo.liveVideoUrl ?? undefined,
    ...(photo.archiveHash ? { hash: photo.archiveHash } : {}),
    ...(photo.liveVideoUrl && photo.date ? { capturedAt: `${photo.date}T00:00:00` } : {}),
    title: photo.title,
    slug: photo.slug,
    category: photo.category ?? "未分类",
    filename: photo.filename,
    width: photo.width || 1,
    height: photo.height || 1,
    ...(!shouldUseRemoteImages() && staticMatch?.mapSrc ? { mapSrc: staticMatch.mapSrc } : {}),
    ...coordinates,
    place: visibility !== "private" ? photo.place?.title : undefined,
    spot: visibility === "exact" ? photo.spot : undefined,
    ...(!shouldUseRemoteImages() && staticMatch?.previewSrc ? { previewSrc: staticMatch.previewSrc } : {}),
    coordinateVisibility: visibility,
    ...(coordinates ? { coordinateSource: photo.geo?.source ?? (manualCoordinates ? "manual" : "exif") } : {}),
    isHero: photo.isHero,
  };
}

const IMAGE_CDN_PARAMS = "?w=2560&q=90&auto=format&fit=max";

function resolvePhotoSrc(
  sanityUrl: string | undefined,
  legacyPublicPath: string | undefined,
  filename?: string,
): string | undefined {
  if (!shouldUseRemoteImages() && import.meta.env.DEV && filename) {
    const localPhoto = staticPhotos.find((photo) => photo.filename === filename);
    if (localPhoto) {
      return localPhoto.src;
    }

    // A CMS record with no asset and no matching local file cannot produce a
    // usable image in the local app. Skip it instead of rendering a dead path.
    if (!sanityUrl) {
      return undefined;
    }
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

export function toReferencedPhoto(photo: CmsSiteSettings["heroPhoto"], options: { allowHidden?: boolean } = {}): Photo | undefined {
  const src = resolvePhotoSrc(photo?.src, photo?.legacyPublicPath, photo?.filename);
  if ((!options.allowHidden && photo?.isHidden) || !photo?.id || !src || !photo.title || !photo.filename) {
    return undefined;
  }

  return {
    id: photo.id,
    src,
    liveVideoUrl: photo.liveVideoUrl ?? undefined,
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

  const image = settings.aboutImage;
  return {
    name: settings.aboutName || staticAboutData.name,
    location: settings.aboutLocation || staticAboutData.location,
    bio: blocksToLines(settings.aboutBio).length ? blocksToLines(settings.aboutBio) : staticAboutData.bio,
    image: image?.src && image.width && image.height
      ? {
          src: `${image.src}?w=1600&q=85&auto=format&fit=max`,
          width: image.width,
          height: image.height,
          alt: image.alt ?? "",
          caption: image.caption,
        }
      : staticAboutData.image,
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

async function loadCmsContent(onPublishedHero?: (photo: Photo | undefined) => void): Promise<GalleryContent> {
  const siteSettings = onPublishedHero
    ? fetchPreloadedCms<CmsSiteSettings | null>(cmsSiteSettingsQuery).then(
        (settings) => {
          onPublishedHero(toReferencedPhoto(settings?.heroPhoto));
          return settings;
        },
        (error: unknown) => {
          onPublishedHero(undefined);
          throw error;
        },
      )
    : fetchCms<CmsSiteSettings | null>(cmsSiteSettingsQuery);
  const [cmsPhotos, cmsStories, cmsSiteSettings, cmsHomepageLayout, cmsPhotobalconyLayout] = await Promise.all([
    fetchCms<CmsPhoto[]>(cmsPhotosQuery),
    fetchCms<CmsStory[]>(cmsStoriesQuery),
    siteSettings,
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

function readCachedCmsContent(useCacheInDevelopment: boolean): GalleryContent | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    // About can render the last CMS response while fetching fresh content.
    if (import.meta.env.DEV && !useCacheInDevelopment) {
      window.localStorage.removeItem(CMS_CONTENT_CACHE_KEY);
      return undefined;
    }

    for (const key of LEGACY_CMS_CONTENT_CACHE_KEYS) {
      window.localStorage.removeItem(key);
    }

    const cached = window.localStorage.getItem(CMS_CONTENT_CACHE_KEY);
    if (!cached) {
      return undefined;
    }

    const content = JSON.parse(cached) as GalleryContent & { aboutDataVersion?: number };
    if (content.source !== "cms" || content.photos.length === 0) {
      return undefined;
    }

    return {
      ...content,
      // Older sessions can keep their gallery data while using the current profile.
      aboutData: content.aboutDataVersion === ABOUT_DATA_CACHE_VERSION ? content.aboutData : staticAboutData,
      isLoading: true,
      error: undefined,
    };
  } catch {
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
        aboutDataVersion: ABOUT_DATA_CACHE_VERSION,
        isLoading: false,
        error: undefined,
      }),
    );
  } catch {
    window.localStorage.removeItem(CMS_CONTENT_CACHE_KEY);
  }
}

export function useGalleryContent({ useCacheInDevelopment = false, loadPublishedHeroEarly = false } = {}) {
  const [loadHeroOnMount] = useState(loadPublishedHeroEarly);
  const [content, setContent] = useState<GalleryContent>(() => ({
    ...(isSanityConfigured() ? (readCachedCmsContent(useCacheInDevelopment) ?? staticContent) : staticContent),
    isLoading: isSanityConfigured(),
  }));
  const [publishedHero, setPublishedHero] = useState<{ photo?: Photo }>();

  useEffect(() => {
    if (!isSanityConfigured()) {
      return;
    }

    let isMounted = true;
    const onPublishedHero = loadHeroOnMount ? (photo: Photo | undefined) => {
      if (isMounted) setPublishedHero({ photo });
    } : undefined;

    loadCmsContent(onPublishedHero)
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
  }, [loadHeroOnMount]);

  return {
    content,
    publishedHeroPhoto: publishedHero?.photo,
    isPublishedHeroLoading: loadHeroOnMount && isSanityConfigured() && publishedHero === undefined,
  };
}
