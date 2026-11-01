import type { Photo } from "../data/photos";

export type PhotobalconyPeriodKey =
  | "may"
  | "marchPortraits"
  | "marchWide"
  | "february"
  | "january"
  | "winter"
  | "summer";

export type PhotobalconyPeriod = {
  key: PhotobalconyPeriodKey;
  title: string;
  photos: Photo[];
};

export type PhotobalconyLayout = {
  heroPhoto?: Photo;
  periods?: PhotobalconyPeriod[];
  mayTitle?: string;
  marchTitle?: string;
  februaryTitle?: string;
  januaryTitle?: string;
  winterTitle?: string;
  summerTitle?: string;
  mayPhotos?: Photo[];
  marchPortraitPhotos?: Photo[];
  marchWidePhotos?: Photo[];
  februaryPhotos?: Photo[];
  januaryPhotos?: Photo[];
  winterPhotos?: Photo[];
  summerPhotos?: Photo[];
};
