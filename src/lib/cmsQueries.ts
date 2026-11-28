import { contentPageKeys, type ContentPageKey } from "./pageContentPages.ts";
import type { GalleryPresentation } from "./homepageLayout.ts";

export type CmsPhoto = {
  id: string;
  updatedAt?: string;
  legacyId?: string;
  src: string;
  liveVideoUrl?: string | null;
  archiveHash?: string | null;
  legacyPublicPath?: string;
  title: string;
  slug?: string;
  category?: string;
  categoryId?: string;
  subjects?: string[];
  conditions?: string[];
  place?: { id?: string; title?: string };
  spot?: string;
  filename: string;
  width: number;
  height: number;
  isHero?: boolean;
  date?: string;
  location?: string;
  geo?: {
    latitude?: number;
    longitude?: number;
    source?: "exif" | "manual" | "estimated";
    accuracyM?: number;
    visibility?: "exact" | "approximate" | "private";
  };
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter?: string;
  iso?: number;
  focalLength?: string;
  altText?: string;
  caption?: string;
  credit?: string;
};

export type CmsMapRoute = {
  id: string;
  title: string;
  slug?: string;
  sourceRouteId?: string;
  subtitle?: string;
  sourceLabel?: string;
  color?: string;
  photoSelection?: "manual" | "gps";
  isVisible?: boolean;
  trackUrl?: string;
  trackPoints?: { latitude?: number; longitude?: number; elevationM?: number }[];
  stats?: { distance?: string; duration?: string; ascent?: string };
  stops?: {
    id?: string;
    title?: string;
    localTitle?: string;
    coordinate?: [number, number];
    trackIndex?: number;
    distanceKm?: number;
    time?: string;
    elevationM?: number;
    note?: string;
    photoIds?: string[];
  }[];
};

export type CmsStory = {
  id: string;
  title: string;
  slug?: string;
  excerpt?: string;
  publishedAt?: string;
  updatedAt?: string;
  orderRank?: string;
  isPinned?: boolean;
  pinOrder?: number;
  body?: PortableTextBlock[];
  coverPhoto?: CmsStoryPhoto;
  relatedPhotos?: CmsStoryPhoto[];
};

export type CmsSiteSettings = {
  siteTitle?: string;
  heroPhoto?: CmsStoryPhoto;
  heroSubtitle?: string;
  aboutName?: string;
  aboutLocation?: string;
  aboutBio?: PortableTextBlock[];
  aboutImage?: {
    src?: string;
    alt?: string;
    caption?: string;
    width?: number;
    height?: number;
  } | null;
  gear?: { name?: string; value?: string }[];
  socialLinks?: { label?: string; value?: string; href?: string }[];
};

export type CmsHomepageLayout = {
  featureCards?: { title?: string; href?: string; photoId?: string; photo?: CmsStoryPhoto }[];
  landscapePhotoIds?: string[];
  landscapePhotos?: CmsStoryPhoto[];
  quietPhotoIds?: string[];
  quietPhotos?: CmsStoryPhoto[];
  bannerOnePhotoId?: string;
  bannerOnePhoto?: CmsStoryPhoto;
  cityPhotoIds?: string[];
  cityPhotos?: CmsStoryPhoto[];
  plantsHeroPhotoId?: string;
  plantsHeroPhoto?: CmsStoryPhoto;
  plantsCarouselPhotoIds?: string[];
  plantsCarouselPhotos?: CmsStoryPhoto[];
  plantsFeaturePhotoId?: string;
  plantsFeaturePhoto?: CmsStoryPhoto;
  plantsStackPhotoIds?: string[];
  plantsStackPhotos?: CmsStoryPhoto[];
  plantsSquarePhotoIds?: string[];
  plantsSquarePhotos?: CmsStoryPhoto[];
};

export type CmsPhotobalconyLayout = {
  heroPhotoId?: string;
  heroPhoto?: CmsStoryPhoto;
  mayTitle?: string;
  marchTitle?: string;
  februaryTitle?: string;
  januaryTitle?: string;
  winterTitle?: string;
  summerTitle?: string;
  mayPhotoIds?: string[];
  mayPhotos?: CmsStoryPhoto[];
  marchPortraitPhotoIds?: string[];
  marchPortraitPhotos?: CmsStoryPhoto[];
  marchWidePhotoIds?: string[];
  marchWidePhotos?: CmsStoryPhoto[];
  februaryPhotoIds?: string[];
  februaryPhotos?: CmsStoryPhoto[];
  januaryPhotoIds?: string[];
  januaryPhotos?: CmsStoryPhoto[];
  winterPhotoIds?: string[];
  winterPhotos?: CmsStoryPhoto[];
  summerPhotoIds?: string[];
  summerPhotos?: CmsStoryPhoto[];
};

export type CmsBalconyChapter = {
  id: string;
  title?: string;
  isVisible?: boolean;
  galleries?: { id: string; presentation?: string; isVisible?: boolean; photos?: CmsStoryPhoto[] }[];
};

export type CmsPageContent = {
  id: string;
  pageKey: ContentPageKey;
  title: string;
  subtitle?: string;
  heroPhoto?: CmsStoryPhoto;
  modulesPosition?: "before" | "after";
  sections?: CmsPageSection[];
  extraSections?: CmsPageSection[];
  photoModules?: CmsPageSection[];
  balconyChapters?: CmsBalconyChapter[] | null;
};

type CmsPageSectionBase = {
  id?: string;
  title?: string;
  description?: string;
  isVisible?: boolean;
};

export type CmsPageSection =
  | (CmsPageSectionBase & {
      type: "heroSlot";
      photo?: CmsStoryPhoto;
      linkPage?: ContentPageKey;
      linkLabel?: string;
      linkTarget?: string;
    })
  | (CmsPageSectionBase & {
      type: "featureCardsSlot";
      cards?: { id?: string; title?: string; photo?: CmsStoryPhoto; linkPage?: ContentPageKey; linkLabel?: string; linkTarget?: string }[];
    })
  | (CmsPageSectionBase & {
      type: "gallerySlot";
      slotKey?: "landscape" | "quiet" | "city" | "harborCarousel" | "harborStack" | "harborSquare";
      presentation?: GalleryPresentation;
      sourceMode?: "manual" | "category";
      photos?: CmsStoryPhoto[];
      category?: { id?: string; title?: string; isVisible?: boolean };
      limit?: number;
    })
  | (CmsPageSectionBase & {
      type: "bannerSlot";
      slotKey?: "bannerOne" | "harbor";
      photo?: CmsStoryPhoto;
      linkPage?: ContentPageKey;
      linkLabel?: string;
      linkTarget?: string;
    })
  | (CmsPageSectionBase & {
      type: "harborSlot";
      heroPhoto?: CmsStoryPhoto;
      carouselPhotos?: CmsStoryPhoto[];
      featurePhoto?: CmsStoryPhoto;
      stackPhotos?: CmsStoryPhoto[];
      squarePhotos?: CmsStoryPhoto[];
    })
  | (CmsPageSectionBase & {
      type: "balconyPeriodSlot";
      periodKey?: "may" | "marchPortraits" | "marchWide" | "february" | "january" | "winter" | "summer";
      photos?: CmsStoryPhoto[];
    });

export type PortableTextBlock = {
  _type?: string;
  children?: { text?: string }[];
};

export type CmsStoryPhoto = {
  id?: string;
  title?: string;
  slug?: string;
  src?: string;
  liveVideoUrl?: string | null;
  isHidden?: boolean;
  categoryIsVisible?: boolean;
  legacyPublicPath?: string;
  filename?: string;
  category?: string;
  categoryId?: string;
  subjects?: string[];
  conditions?: string[];
  place?: { id?: string; title?: string };
  spot?: string;
  width?: number;
  height?: number;
  altText?: string;
  caption?: string;
  credit?: string;
};

const cmsReferencedPhotoFields = `
    "id": _id,
    "legacyId": legacyId,
    title,
    "slug": slug.current,
    "src": image.asset->url,
    "liveVideoUrl": liveVideo.asset->url,
    isHidden,
    "categoryIsVisible": category->isVisible,
    "legacyPublicPath": legacyPublicPath,
    "category": category->title,
    "categoryId": category._ref,
    altText,
    caption,
    credit,
    subjects,
    conditions,
    "place": place->{"id": _id, title},
    spot,
    "filename": coalesce(sourceFilename, image.asset->originalFilename),
    "width": coalesce(image.asset->metadata.dimensions.width, dimensions.width),
    "height": coalesce(image.asset->metadata.dimensions.height, dimensions.height)
`;

const cmsVisiblePhotos = `*[
  _type == "photo" &&
  isHidden != true &&
  defined(image.asset->url) &&
  category->isVisible != false
] | order(sortOrder asc, date desc, _id asc)`;

export const cmsPhotosQuery = `${cmsVisiblePhotos} {
  "id": _id,
  "updatedAt": _updatedAt,
  "legacyId": legacyId,
  "src": image.asset->url,
  "liveVideoUrl": liveVideo.asset->url,
  "archiveHash": select(defined(liveVideo.asset) => image.asset->sha1hash),
  "legacyPublicPath": legacyPublicPath,
  title,
  "slug": slug.current,
  "category": category->title,
  "categoryId": category._ref,
  altText,
  caption,
  credit,
  subjects,
  conditions,
  "place": place->{"id": _id, title},
  spot,
  "filename": coalesce(sourceFilename, image.asset->originalFilename),
  "width": coalesce(image.asset->metadata.dimensions.width, dimensions.width),
  "height": coalesce(image.asset->metadata.dimensions.height, dimensions.height),
  isHero,
  date,
  "location": select(geo.visibility in ["private", "approximate"] => null, location),
  "geo": geo {
    source,
    visibility,
    "latitude": select(visibility == "private" => null, visibility == "approximate" => round(latitude, 2), latitude),
    "longitude": select(visibility == "private" => null, visibility == "approximate" => round(longitude, 2), longitude)
  },
  camera,
  lens,
  aperture,
  shutter,
  iso,
  focalLength
}`;

export const cmsMapRoutesQuery = `*[_type == "mapRoute" && isVisible != false] | order(_updatedAt desc) {
  "id": _id,
  title,
  "slug": slug.current,
  sourceRouteId,
  subtitle,
  sourceLabel,
  color,
  photoSelection,
  isVisible,
  "trackUrl": trackFile.asset->url,
  "trackPoints": trackPoints[]{ latitude, longitude, elevationM },
  stats,
  "stops": stops[]{
    "id": coalesce(_key, title),
    title,
    localTitle,
    "coordinate": [coordinate.latitude, coordinate.longitude],
    trackIndex,
    distanceKm,
    time,
    elevationM,
    note,
    "photoIds": photos[]._ref
  }
}`;

export const cmsCategoriesQuery = `*[_type == "category" && isVisible != false] | order(sortOrder asc, title asc) {
  "id": _id,
  title,
  "slug": slug.current,
  description,
  "coverPhotoId": coverPhoto->_id
}`;

export const cmsStoryPublicationFilter = `
  _type == "story" &&
  isHidden != true &&
  (!defined(publishedAt) || dateTime(publishedAt) <= dateTime(now())) &&
  defined(coverPhoto->image.asset->url) &&
  coverPhoto->isHidden != true &&
  coverPhoto->category->isVisible != false`;

export const cmsStoriesQuery = `*[${cmsStoryPublicationFilter}] | order(coalesce(orderRank, "zzzzzz") asc, publishedAt desc) {
  "id": _id,
  "updatedAt": _updatedAt,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  orderRank,
  isPinned,
  pinOrder,
  body[] {
    ...,
    _type == "image" => {
      "src": asset->url,
      "width": asset->metadata.dimensions.width,
      "height": asset->metadata.dimensions.height
    }
  },
  "coverPhoto": coverPhoto->{${cmsReferencedPhotoFields}},
  "relatedPhotos": relatedPhotos[]->{${cmsReferencedPhotoFields}}
}`;

export const cmsSiteSettingsQuery = `*[_type == "siteSettings"] | order((_id == "siteSettings-main") desc, _id asc)[0] {
  siteTitle,
  "heroPhoto": heroPhoto->{${cmsReferencedPhotoFields}},
  heroSubtitle,
  aboutName,
  aboutLocation,
  aboutBio,
  aboutImage {
    "src": asset->url,
    alt,
    caption,
    "width": asset->metadata.dimensions.width,
    "height": asset->metadata.dimensions.height
  },
  gear,
  socialLinks
}`;

export const sanityApiVersion = "2025-02-19";

export function sanityReadQueryUrl(projectId: string, dataset: string, query: string) {
  const url = new URL(`/v${sanityApiVersion}/data/query/${encodeURIComponent(dataset)}`, `https://${projectId}.apicdn.sanity.io`);
  url.searchParams.set("query", query);
  url.searchParams.set("returnQuery", "false");
  return url.href;
}

export const cmsHomepageLayoutQuery = `*[_type == "homepageLayout"][0] {
  featureCards[]{
    title,
    href,
    "photoId": photo->_id,
    "photo": photo->{${cmsReferencedPhotoFields}}
  },
  "landscapePhotoIds": landscapePhotos[]->_id,
  "landscapePhotos": landscapePhotos[]->{${cmsReferencedPhotoFields}},
  "quietPhotoIds": quietPhotos[]->_id,
  "quietPhotos": quietPhotos[]->{${cmsReferencedPhotoFields}},
  "bannerOnePhotoId": bannerOnePhoto->_id,
  "bannerOnePhoto": bannerOnePhoto->{${cmsReferencedPhotoFields}},
  "cityPhotoIds": cityPhotos[]->_id,
  "cityPhotos": cityPhotos[]->{${cmsReferencedPhotoFields}},
  "plantsHeroPhotoId": plantsHeroPhoto->_id,
  "plantsHeroPhoto": plantsHeroPhoto->{${cmsReferencedPhotoFields}},
  "plantsCarouselPhotoIds": plantsCarouselPhotos[]->_id,
  "plantsCarouselPhotos": plantsCarouselPhotos[]->{${cmsReferencedPhotoFields}},
  "plantsFeaturePhotoId": plantsFeaturePhoto->_id,
  "plantsFeaturePhoto": plantsFeaturePhoto->{${cmsReferencedPhotoFields}},
  "plantsStackPhotoIds": plantsStackPhotos[]->_id,
  "plantsStackPhotos": plantsStackPhotos[]->{${cmsReferencedPhotoFields}},
  "plantsSquarePhotoIds": plantsSquarePhotos[]->_id,
  "plantsSquarePhotos": plantsSquarePhotos[]->{${cmsReferencedPhotoFields}}
}`;

export const cmsPhotobalconyLayoutQuery = `*[_type == "photobalconyLayout"][0] {
  "heroPhotoId": heroPhoto->_id,
  "heroPhoto": heroPhoto->{${cmsReferencedPhotoFields}},
  mayTitle,
  marchTitle,
  februaryTitle,
  januaryTitle,
  winterTitle,
  summerTitle,
  "mayPhotoIds": mayPhotos[]->_id,
  "mayPhotos": mayPhotos[]->{${cmsReferencedPhotoFields}},
  "marchPortraitPhotoIds": marchPortraitPhotos[]->_id,
  "marchPortraitPhotos": marchPortraitPhotos[]->{${cmsReferencedPhotoFields}},
  "marchWidePhotoIds": marchWidePhotos[]->_id,
  "marchWidePhotos": marchWidePhotos[]->{${cmsReferencedPhotoFields}},
  "februaryPhotoIds": februaryPhotos[]->_id,
  "februaryPhotos": februaryPhotos[]->{${cmsReferencedPhotoFields}},
  "januaryPhotoIds": januaryPhotos[]->_id,
  "januaryPhotos": januaryPhotos[]->{${cmsReferencedPhotoFields}},
  "winterPhotoIds": winterPhotos[]->_id,
  "winterPhotos": winterPhotos[]->{${cmsReferencedPhotoFields}},
  "summerPhotoIds": summerPhotos[]->_id,
  "summerPhotos": summerPhotos[]->{${cmsReferencedPhotoFields}}
}`;

const cmsPagePhotoFields = `
  "id": _id,
  title,
  "slug": slug.current,
  "src": image.asset->url,
  "liveVideoUrl": liveVideo.asset->url,
  isHidden,
  "categoryIsVisible": category->isVisible,
  "category": category->title,
  "categoryId": category._ref,
  "filename": coalesce(sourceFilename, image.asset->originalFilename),
  altText,
  caption,
  credit,
  "width": coalesce(image.asset->metadata.dimensions.width, dimensions.width),
  "height": coalesce(image.asset->metadata.dimensions.height, dimensions.height)
`;

const cmsPagePhotoRefFields = cmsPagePhotoFields;

const cmsPageSectionFields = `{
    "id": _key,
    "type": _type,
    title,
    description,
    isVisible,
    slotKey,
    presentation,
    sourceMode,
    limit,
    linkLabel,
    linkTarget,
    linkPage,
    periodKey,
    "photo": photo->{${cmsPagePhotoRefFields}},
    "photos": photos[]->{${cmsPagePhotoRefFields}},
    "category": category->{"id": _id, title, isVisible},
    _type == "harborSlot" => {
      "heroPhoto": heroPhoto->{${cmsPagePhotoRefFields}},
      "carouselPhotos": carouselPhotos[]->{${cmsPagePhotoRefFields}},
      "featurePhoto": featurePhoto->{${cmsPagePhotoRefFields}},
      "stackPhotos": stackPhotos[]->{${cmsPagePhotoRefFields}},
      "squarePhotos": squarePhotos[]->{${cmsPagePhotoRefFields}}
    },
    cards[] {
      "id": _key,
      title,
      linkLabel,
      linkTarget,
      linkPage,
      "photo": photo->{${cmsPagePhotoRefFields}}
    }
}`;

const cmsPageContentFields = `{
  "id": _id,
  pageKey,
  title,
  subtitle,
  modulesPosition,
  "heroPhoto": heroPhoto->{${cmsPagePhotoRefFields}},
  balconyChapters[] {
    "id": _key,
    title,
    isVisible,
    galleries[] {
      "id": _key,
      presentation,
      isVisible,
      "photos": photos[]->{${cmsPagePhotoRefFields}}
    }
  },
  "sections": select(pageKey == "photobalcony" => sections[]{
    "id": _key, "type": _type, title, isVisible, periodKey,
    "photo": photo->{${cmsPagePhotoRefFields}},
    "photos": photos[]->{${cmsPagePhotoRefFields}}
  }),
  "photoModules": select(pageKey == "photobalcony" => extraSections, sections)[] ${cmsPageSectionFields}
}`;

export const cmsPageContentQuery = `*[_type == "pageContent" && _id in ${JSON.stringify(contentPageKeys.map((key) => `pageContent-${key}`))}] ${cmsPageContentFields}`;

export const cmsPageDraftQuery = `{
  "document": *[_type == "pageContent" && _id == $id][0] ${cmsPageContentFields},
  "photos": ${cmsVisiblePhotos} {${cmsPagePhotoFields}}
}`;

export type CmsPageDraft = { document: CmsPageContent | null; photos: CmsPhoto[] };

export const cmsPlacementQueryFields = `
  "photos": ${cmsPhotosQuery},
  "pages": ${cmsPageContentQuery},
  "home": ${cmsHomepageLayoutQuery},
  "balcony": ${cmsPhotobalconyLayoutQuery},
  "settings": ${cmsSiteSettingsQuery}
`;

export type CmsPlacementSnapshot = {
  photos: CmsPhoto[];
  pages: CmsPageContent[];
  home: CmsHomepageLayout | null;
  balcony: CmsPhotobalconyLayout | null;
  settings: CmsSiteSettings | null;
};
