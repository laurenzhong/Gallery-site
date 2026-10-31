export type CmsPhoto = {
  id: string;
  src: string;
  legacyPublicPath?: string;
  title: string;
  slug?: string;
  category: string;
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
  altText?: string;
  caption?: string;
  credit?: string;
};

export type CmsCategory = {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  coverPhotoId?: string;
};

export type CmsPageSection = {
  id?: string;
  title?: string;
  eyebrow?: string;
  description?: string;
  isVisible?: boolean;
  style?: string;
  photos?: CmsStoryPhoto[];
  coverPhoto?: CmsStoryPhoto;
  category?: { id?: string; title?: string; slug?: string };
  limit?: number;
  showTitle?: boolean;
  columns?: number;
  theme?: "light" | "dark" | "paper";
  linkLabel?: string;
  linkTarget?: string;
};

export type CmsPageLayout = {
  id: string;
  pageKey: string;
  title?: string;
  subtitle?: string;
  seoTitle?: string;
  seoDescription?: string;
  heroPhoto?: CmsStoryPhoto;
  sections?: CmsPageSection[];
};

export type CmsSiteCopy = {
  navigation?: Record<string, string>;
  pages?: Record<string, string>;
  sections?: Record<string, string>;
  controls?: Record<string, string>;
  metadata?: Record<string, string>;
  footer?: Record<string, string>;
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

export type PortableTextBlock = {
  _type?: string;
  _key?: string;
  assetUrl?: string;
  alt?: string;
  markDefs?: { _key?: string; _type?: string; href?: string }[];
  children?: { _key?: string; text?: string; marks?: string[] }[];
};

type CmsStoryPhoto = {
  id?: string;
  title?: string;
  slug?: string;
  src?: string;
  isHidden?: boolean;
  legacyPublicPath?: string;
  filename?: string;
  category?: string;
  width?: number;
  height?: number;
  altText?: string;
  caption?: string;
  credit?: string;
};

const cmsReferencedPhotoFields = `
    "id": _id,
    title,
    "slug": slug.current,
    "src": image.asset->url,
    isHidden,
    "legacyPublicPath": legacyPublicPath,
    "category": category->title,
    "filename": sourceFilename,
    "width": coalesce(image.asset->metadata.dimensions.width, dimensions.width),
    "height": coalesce(image.asset->metadata.dimensions.height, dimensions.height),
    altText,
    caption,
    credit
`;

export const cmsPhotosQuery = `*[_type == "photo" && isHidden != true && category->isVisible != false] | order(sortOrder asc, date desc) {
  "id": _id,
  "src": image.asset->url,
  "legacyPublicPath": legacyPublicPath,
  title,
  "slug": slug.current,
  "category": category->title,
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
  focalLength,
  altText,
  caption,
  credit
}`;

export const cmsCategoriesQuery = `*[_type == "category" && isVisible != false] | order(sortOrder asc, title asc) {
  "id": _id,
  title,
  "slug": slug.current,
  description,
  "coverPhotoId": coverPhoto->_id
}`;

export const cmsPageLayoutsQuery = `*[_type == "pageLayout"] | order(pageKey asc) {
  "id": _id,
  pageKey,
  title,
  subtitle,
  seoTitle,
  seoDescription,
  "heroPhoto": heroPhoto->{${cmsReferencedPhotoFields}},
  "sections": sections[] {
    "id": _key,
    title,
    eyebrow,
    description,
    isVisible,
    style,
    limit,
    showTitle,
    columns,
    theme,
    linkLabel,
    linkTarget,
    "photos": photos[]->{${cmsReferencedPhotoFields}},
    "coverPhoto": coverPhoto->{${cmsReferencedPhotoFields}},
    "category": category->{"id": _id, title, "slug": slug.current}
  }
}`;

export const cmsSiteCopyQuery = `*[_type == "siteCopy"][0] {
  navigation,
  pages,
  sections,
  controls,
  metadata,
  footer
}`;

export const cmsStoriesQuery = `*[
  _type == "story" &&
  isHidden != true &&
  (!defined(publishedAt) || dateTime(publishedAt) <= dateTime(now()))
] | order(coalesce(orderRank, "zzzzzz") asc, publishedAt desc) {
  "id": _id,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  orderRank,
  isPinned,
  pinOrder,
  "body": body[]{..., "assetUrl": asset->url},
  "coverPhoto": coverPhoto->{
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
  "relatedPhotos": relatedPhotos[]->{
    "id": _id,
    title,
    "slug": slug.current,
    "src": image.asset->url,
    "legacyPublicPath": legacyPublicPath,
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
