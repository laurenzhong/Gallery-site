import type { Photo } from "../data/photos";

export type HomepageFeatureCard = {
  title: string;
  photo: Photo;
  href?: string;
};

export type HomepageContentSection =
  | {
      id: string;
      kind: "featureCards";
      title?: string;
      cards: HomepageFeatureCard[];
    }
  | {
      id: string;
      kind: "gallery";
      title?: string;
      photos: Photo[];
      presentation: "landscapeCarousel" | "squareRail" | "stack" | "squareGrid";
    }
  | {
      id: string;
      kind: "banner";
      title?: string;
      photo: Photo;
      slotKey: "bannerOne" | "harbor";
    };

export type HomepageLayout = {
  sections?: HomepageContentSection[];
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
