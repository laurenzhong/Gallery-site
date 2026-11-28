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

export const balconyPresentations = {
  carousel: "横幅轮播",
  portraitRail: "竖幅横滑",
  grid: "双列网格",
  leadGrid: "主图＋网格",
  stack: "纵向堆叠",
} as const;

export type BalconyPresentation = keyof typeof balconyPresentations;

export type BalconyGallery<T> = {
  id: string;
  presentation: BalconyPresentation;
  photos: T[];
  isVisible?: boolean;
};

export type BalconyChapter<T> = {
  id: string;
  title: string;
  isVisible?: boolean;
  galleries: BalconyGallery<T>[];
};

export const legacyBalconyPresentations: Record<PhotobalconyPeriodKey, BalconyPresentation> = {
  may: "carousel",
  marchPortraits: "portraitRail",
  marchWide: "carousel",
  february: "carousel",
  january: "grid",
  winter: "leadGrid",
  summer: "leadGrid",
};

export function isBalconyPresentation(value: unknown): value is BalconyPresentation {
  return typeof value === "string" && Object.hasOwn(balconyPresentations, value);
}

export function chaptersFromLegacyBalcony<T>(periods: {
  id?: string;
  key: PhotobalconyPeriodKey;
  title: string;
  photos: T[];
  isVisible?: boolean;
}[]): BalconyChapter<T>[] {
  const chapters: BalconyChapter<T>[] = [];
  const july = new Map<string, BalconyChapter<T>>();

  for (const period of periods) {
    if (!Object.hasOwn(legacyBalconyPresentations, period.key)) continue;
    const id = period.id ?? period.key;
    const gallery = { id, presentation: legacyBalconyPresentations[period.key], photos: period.photos, isVisible: period.isVisible };
    const title = period.title.trim();
    const isYearSelection = period.key === "may" && title === "2026";
    const isJuly = period.key === "marchPortraits" || period.key === "marchWide";
    const existingJuly = isJuly ? july.get(title) : undefined;
    if (existingJuly) {
      existingJuly.galleries.push(gallery);
      continue;
    }

    const chapter = { id, title: isYearSelection ? "2026 Highlights" : title, galleries: [gallery] };
    if (isJuly) july.set(title, chapter);
    if (isYearSelection) chapters.unshift(chapter);
    else chapters.push(chapter);
  }

  return chapters;
}

export type PhotobalconyLayout = {
  title?: string;
  subtitle?: string;
  heroPhoto?: Photo;
  chapters?: BalconyChapter<Photo>[];
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
