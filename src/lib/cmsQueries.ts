export type CmsPhoto = {
  id: string;
  legacyId?: string;
  src: string;
  legacyPublicPath?: string;
  title: string;
  slug?: string;
  category?: string;
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
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter?: string;
  iso?: number;
  focalLength?: string;
};

export type CmsMapRoute = {
  id: string;
  title: string;
  slug?: string;
  sourceRouteId?: string;
  subtitle?: string;
  sourceLabel?: string;
  color?: string;
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

export type CmsPageContent = {
  id: string;
  pageKey: "home" | "photobalcony";
  title: string;
  subtitle?: string;
  heroPhoto?: CmsStoryPhoto;
  sections?: CmsPageSection[];
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
      linkLabel?: string;
      linkTarget?: string;
    })
  | (CmsPageSectionBase & {
      type: "featureCardsSlot";
      cards?: { title?: string; photo?: CmsStoryPhoto; linkLabel?: string; linkTarget?: string }[];
    })
  | (CmsPageSectionBase & {
      type: "gallerySlot";
      slotKey?: "landscape" | "quiet" | "city" | "harborCarousel" | "harborStack" | "harborSquare";
      presentation?: "landscapeCarousel" | "squareRail" | "stack" | "squareGrid";
      sourceMode?: "manual" | "category";
      photos?: CmsStoryPhoto[];
      category?: { id?: string; title?: string };
      limit?: number;
    })
  | (CmsPageSectionBase & {
      type: "bannerSlot";
      slotKey?: "bannerOne" | "harbor";
      photo?: CmsStoryPhoto;
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
  isHidden?: boolean;
  legacyPublicPath?: string;
  filename?: string;
  category?: string;
  subjects?: string[];
  conditions?: string[];
  place?: { id?: string; title?: string };
  spot?: string;
  width?: number;
  height?: number;
};

const cmsReferencedPhotoFields = `
    "id": _id,
    "legacyId": legacyId,
    title,
    "slug": slug.current,
    "src": image.asset->url,
    isHidden,
    "legacyPublicPath": legacyPublicPath,
    "category": category->title,
    subjects,
    conditions,
    "place": place->{"id": _id, title},
    spot,
    "filename": sourceFilename,
    "width": coalesce(image.asset->metadata.dimensions.width, dimensions.width),
    "height": coalesce(image.asset->metadata.dimensions.height, dimensions.height)
`;

export const cmsPhotosQuery = `*[
  _type == "photo" &&
  isHidden != true &&
  (
    count(*[
      (_type == "pageContent" || _type == "homepageLayout" || _type == "photobalconyLayout" || _type == "siteSettings" || _type == "mapRoute") &&
      references(^._id)
    ]) > 0 ||
    defined(location) ||
    defined(place)
  )
] | order(sortOrder asc, date desc) {
  "id": _id,
  "legacyId": legacyId,
  "src": image.asset->url,
  "legacyPublicPath": legacyPublicPath,
  title,
  "slug": slug.current,
  "category": category->title,
  subjects,
  conditions,
  "place": place->{"id": _id, title},
  spot,
  "filename": sourceFilename,
  "width": coalesce(image.asset->metadata.dimensions.width, dimensions.width),
  "height": coalesce(image.asset->metadata.dimensions.height, dimensions.height),
  isHero,
  date,
  location,
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

export const cmsStoriesQuery = `*[
  _type == "story" &&
  isHidden != true &&
  (!defined(publishedAt) || dateTime(publishedAt) <= dateTime(now())) &&
  defined(coverPhoto._ref) &&
  coverPhoto->isHidden != true &&
  count(*[
    (_type == "pageContent" || _type == "homepageLayout" || _type == "photobalconyLayout" || _type == "siteSettings") &&
    references(^.coverPhoto._ref)
  ]) > 0
] | order(coalesce(orderRank, "zzzzzz") asc, publishedAt desc) {
  "id": _id,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  orderRank,
  isPinned,
  pinOrder,
  body,
  "coverPhoto": coverPhoto->{
    "id": _id,
    title,
    "slug": slug.current,
    "src": image.asset->url,
    isHidden,
    "legacyPublicPath": legacyPublicPath,
    "place": place->{"id": _id, title},
    spot,
    "filename": sourceFilename,
    "width": coalesce(image.asset->metadata.dimensions.width, dimensions.width),
    "height": coalesce(image.asset->metadata.dimensions.height, dimensions.height)
  },
  "relatedPhotos": relatedPhotos[]->{
    "id": _id,
    title,
    "slug": slug.current,
    "src": image.asset->url,
    "legacyPublicPath": legacyPublicPath,
    "place": place->{"id": _id, title},
    spot,
    "filename": sourceFilename,
    "width": coalesce(image.asset->metadata.dimensions.width, dimensions.width),
    "height": coalesce(image.asset->metadata.dimensions.height, dimensions.height)
  }
}`;

export const cmsSiteSettingsQuery = `*[_type == "siteSettings"][0] {
  siteTitle,
  "heroPhoto": heroPhoto->{
    "id": _id,
    title,
    "slug": slug.current,
    "src": image.asset->url,
    isHidden,
    "legacyPublicPath": legacyPublicPath,
    "filename": sourceFilename,
    "width": coalesce(image.asset->metadata.dimensions.width, dimensions.width),
    "height": coalesce(image.asset->metadata.dimensions.height, dimensions.height)
  },
  heroSubtitle,
  aboutName,
  aboutLocation,
  aboutBio,
  gear,
  socialLinks
}`;

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

export const cmsPageContentQuery = `*[_type == "pageContent" && pageKey in ["home", "photobalcony"]] | order(pageKey asc) {
  "id": _id,
  pageKey,
  title,
  subtitle,
  "heroPhoto": heroPhoto->{${cmsReferencedPhotoFields}},
  "sections": sections[] {
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
    periodKey,
    "photo": photo->{${cmsReferencedPhotoFields}},
    "photos": photos[]->{${cmsReferencedPhotoFields}},
    "category": category->{"id": _id, title},
    "heroPhoto": heroPhoto->{${cmsReferencedPhotoFields}},
    "carouselPhotos": carouselPhotos[]->{${cmsReferencedPhotoFields}},
    "featurePhoto": featurePhoto->{${cmsReferencedPhotoFields}},
    "stackPhotos": stackPhotos[]->{${cmsReferencedPhotoFields}},
    "squarePhotos": squarePhotos[]->{${cmsReferencedPhotoFields}},
    cards[] {
      title,
      linkLabel,
      linkTarget,
      "photo": photo->{${cmsReferencedPhotoFields}}
    }
  }
}`;
