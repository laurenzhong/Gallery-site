import type { Photo } from "../data/photos";

export type PageSectionStyle =
  | "hero"
  | "featureCards"
  | "landscapeCarousel"
  | "banner"
  | "grid"
  | "stack"
  | "split"
  | "carousel";

export type PageSection = {
  id: string;
  title?: string;
  eyebrow?: string;
  description?: string;
  isVisible: boolean;
  style: PageSectionStyle;
  photos: Photo[];
  coverPhoto?: Photo;
  linkLabel?: string;
  linkTarget?: string;
  theme?: "light" | "dark" | "paper";
  showTitle: boolean;
  columns?: number;
};

export type PageLayout = {
  id: string;
  pageKey: "home" | "photobalcony" | string;
  title?: string;
  subtitle?: string;
  seoTitle?: string;
  seoDescription?: string;
  heroPhoto?: Photo;
  sections: PageSection[];
};
