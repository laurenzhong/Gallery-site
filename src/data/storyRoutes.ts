import type { Photo } from "./photos";

export type RouteCoordinate = [number, number];

export type StoryRouteStop = {
  id: string;
  title: string;
  localTitle?: string;
  coordinate: RouteCoordinate;
  trackIndex: number;
  distanceKm?: number;
  time?: string;
  elevationM?: number;
  note?: string;
  photoIds?: string[];
};

export type StoryRoutePoint = {
  id: string;
  title: string;
  coordinate: RouteCoordinate;
  trackIndex: number;
  photoIds?: string[];
};

export type StoryRouteStats = {
  distance: string;
  duration: string;
  durationLabel?: string;
  ascent: string;
};

export type StoryRoute = {
  id: string;
  kicker: string;
  title: string;
  titleEmphasis?: string;
  subtitle: string;
  introLabel: string;
  stats: StoryRouteStats;
  track: RouteCoordinate[];
  stops: StoryRouteStop[];
  points?: StoryRoutePoint[];
  bounds: [[number, number], [number, number]];
  focusZoom?: number;
  sourceLabel?: string;
  color?: string;
  /** Use EXIF GPS to place photos at the nearest route stop. */
  photoSelection?: "manual" | "gps";
  photoRadiusKm?: number;
};

export type ResolvedStoryRouteStop = StoryRouteStop & {
  photos: Photo[];
};
