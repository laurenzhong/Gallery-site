import type { Photo } from "../data/photos.ts";
import type { CmsPageSection } from "./cmsQueries.ts";

export const galleryPresentations = {
  landscapeCarousel: "横向轮播",
  squareRail: "方形横向滚动",
  portraitRail: "阳台竖幅照片行",
  stack: "纵向堆叠",
  squareGrid: "方格",
  grid: "阳台双列网格",
  leadGrid: "阳台首图通栏网格",
} as const;

export type GalleryPresentation = keyof typeof galleryPresentations;

export type HomepageFeatureCard = {
  id?: string;
  title: string;
  photo: Photo;
  href?: string;
  linkLabel?: string;
};

export type HomepageContentSection = { id: string; title?: string; description?: string } & (
  | {
      kind: "featureCards";
      cards: HomepageFeatureCard[];
    }
  | {
      kind: "gallery";
      photos: Photo[];
      presentation: GalleryPresentation;
      slotKey?: Extract<CmsPageSection, { type: "gallerySlot" }>["slotKey"];
    }
  | {
      kind: "banner";
      photo: Photo;
      slotKey?: "bannerOne" | "harbor";
      href?: string;
      linkLabel?: string;
    }
);

export type HomepageLayout = {
  featureCards?: HomepageFeatureCard[];
  landscapePhotos?: Photo[];
  quietPhotos?: Photo[];
  bannerOnePhoto?: Photo;
  cityPhotos?: Photo[];
  plantsHeroPhoto?: Photo;
  plantsCarouselPhotos?: Photo[];
  plantsFeaturePhoto?: Photo;
  plantsStackPhotos?: Photo[];
  plantsSquarePhotos?: Photo[];
};
