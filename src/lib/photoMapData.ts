import type { Photo } from "../data/photos";
import type { StoryRoute } from "../data/storyRoutes";

export type PhotoStop = {
  photo: Photo;
  lat: number;
  lng: number;
  area: string;
  note: string;
  coordinateSource: "gps" | "fallback" | "route";
};

export const HONG_KONG_VIEW: [number, number] = [22.31, 114.17];
export const HONG_KONG_BOUNDS: [[number, number], [number, number]] = [[22.12, 113.82], [22.57, 114.51]];
// A known land position in the Shitang archive area. Photos without a GPS
// value are grouped here until their location is curated; they are never
// scattered around an average point that may fall offshore.
export const PHOTO_MAP_FALLBACK_ANCHOR: [number, number] = [28.282375, 121.62319];
export const DEMO_COORDINATES: Array<Pick<PhotoStop, "lat" | "lng" | "area" | "note">> = [
  { lat: 22.276, lng: 114.145, area: "The Peak", note: "Above the harbour" },
  { lat: 22.282, lng: 114.158, area: "Central", note: "A city edge" },
  { lat: 22.337, lng: 114.137, area: "Lion Rock", note: "Weather over the ridge" },
  { lat: 22.386, lng: 114.272, area: "Sai Kung", note: "Waterline / low tide" },
  { lat: 22.303, lng: 114.174, area: "Kowloon", note: "Light between towers" },
  { lat: 22.252, lng: 113.862, area: "Tai O", note: "A slower shoreline" },
  { lat: 22.261, lng: 113.946, area: "Lantau", note: "After the weather turns" },
  { lat: 22.419, lng: 114.112, area: "Tai Mo Shan", note: "Above the line" },
  { lat: 22.279, lng: 114.171, area: "Wan Chai", note: "A familiar view" },
  { lat: 22.373, lng: 114.114, area: "Shing Mun", note: "The long turn" },
  { lat: 22.294, lng: 114.172, area: "Tsim Sha Tsui", note: "A room with a view" },
  { lat: 22.429, lng: 114.237, area: "Plover Cove", note: "Return route" },
];

export function getPhotoMapBounds(stops: PhotoStop[]): [[number, number], [number, number]] {
  if (!stops.length) return HONG_KONG_BOUNDS;

  const latitudes = stops.map((stop) => stop.lat);
  const longitudes = stops.map((stop) => stop.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latPad = Math.max(0.08, (maxLat - minLat) * 0.18);
  const lngPad = Math.max(0.08, (maxLng - minLng) * 0.18);

  return [
    [Math.max(-85, minLat - latPad), Math.max(-180, minLng - lngPad)],
    [Math.min(85, maxLat + latPad), Math.min(180, maxLng + lngPad)],
  ];
}

export function getPhotoMapInteractionBounds(stops: PhotoStop[]): [[number, number], [number, number]] {
  return getPhotoMapInteractionBoundsFromBounds(getPhotoMapBounds(stops));
}

export function getPhotoMapInteractionBoundsFromBounds(bounds: [[number, number], [number, number]]): [[number, number], [number, number]] {
  const latSpan = bounds[1][0] - bounds[0][0];
  const lngSpan = bounds[1][1] - bounds[0][1];
  const latPad = Math.max(0.16, latSpan * 0.2);
  const lngPad = Math.max(0.2, lngSpan * 0.2);

  return [
    [Math.max(-85, bounds[0][0] - latPad), Math.max(-180, bounds[0][1] - lngPad)],
    [Math.min(85, bounds[1][0] + latPad), Math.min(180, bounds[1][1] + lngPad)],
  ];
}

export function getPhotoMapRouteBounds(routes: StoryRoute[]): [[number, number], [number, number]] {
  if (!routes.length) return HONG_KONG_BOUNDS;

  const coordinates = routes.flatMap((route) => route.track.length ? route.track : [route.bounds[0], route.bounds[1]]);
  const latitudes = coordinates.map(([lat]) => lat);
  const longitudes = coordinates.map(([, lng]) => lng);
  return [
    [Math.min(...latitudes), Math.min(...longitudes)],
    [Math.max(...latitudes), Math.max(...longitudes)],
  ];
}

export function mergePhotoMapBounds(
  photoBounds: [[number, number], [number, number]],
  routeBounds: [[number, number], [number, number]],
): [[number, number], [number, number]] {
  return [
    [Math.min(photoBounds[0][0], routeBounds[0][0]), Math.min(photoBounds[0][1], routeBounds[0][1])],
    [Math.max(photoBounds[1][0], routeBounds[1][0]), Math.max(photoBounds[1][1], routeBounds[1][1])],
  ];
}

export function buildPhotoStops(photos: Photo[]): PhotoStop[] {
  return photos.map((photo) => {
    if (Number.isFinite(photo.latitude) && Number.isFinite(photo.longitude)) {
      return {
        photo,
        lat: photo.latitude as number,
        lng: photo.longitude as number,
        area: photo.category,
        note: "GPS coordinates from EXIF",
        coordinateSource: "gps",
      };
    }

    return {
      photo,
      area: photo.category,
      note: "Fallback coordinate · no GPS in EXIF",
      lat: PHOTO_MAP_FALLBACK_ANCHOR[0],
      lng: PHOTO_MAP_FALLBACK_ANCHOR[1],
      coordinateSource: "fallback",
    };
  });
}
