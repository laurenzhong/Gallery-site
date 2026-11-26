import type { Photo } from "../data/photos";
import type { RouteCoordinate, StoryRoute, StoryRouteStop } from "../data/storyRoutes";

const EARTH_RADIUS_KM = 6371;
const DEFAULT_PHOTO_RADIUS_KM = 0.5;

function hasGps(photo: Photo): photo is Photo & { latitude: number; longitude: number } {
  return Number.isFinite(photo.latitude) && Number.isFinite(photo.longitude);
}

function distanceKm(a: RouteCoordinate, b: RouteCoordinate) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b[0] - a[0]);
  const dLng = toRadians(b[1] - a[1]);
  const lat1 = toRadians(a[0]);
  const lat2 = toRadians(b[0]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function resolveManualPhotos(stop: StoryRouteStop, photos: Photo[]) {
  return (stop.photoIds ?? [])
    .map((id) => photos.find((photo) => photo.id === id || photo.legacyId === id))
    .filter((photo): photo is Photo => Boolean(photo));
}

/** A manually selected illustration may have been taken at a different stop. */
export function getRouteStopPhotoCoordinate(route: StoryRoute, stopIndex: number, photo?: Photo): RouteCoordinate | undefined {
  const stop = route.stops[stopIndex];
  if (!stop || !photo || !hasGps(photo)) return undefined;

  const coordinate: RouteCoordinate = [photo.latitude, photo.longitude];
  const distance = distanceKm(coordinate, stop.coordinate);
  if (distance > (route.photoRadiusKm ?? DEFAULT_PHOTO_RADIUS_KM)) return undefined;

  const belongsAtStop = route.stops.every((candidate, index) => (
    index === stopIndex || distanceKm(coordinate, candidate.coordinate) >= distance
  ));
  return belongsAtStop ? coordinate : undefined;
}

/** Resolve manual references or assign EXIF-located photos to their nearest stop. */
export function resolveRouteStopPhotos(route: StoryRoute, photos: Photo[]) {
  if (route.photoSelection !== "gps") {
    return route.stops.map((stop) => resolveManualPhotos(stop, photos));
  }

  const radiusKm = route.photoRadiusKm ?? DEFAULT_PHOTO_RADIUS_KM;
  const buckets = route.stops.map(() => [] as Array<{ photo: Photo; distance: number }>);
  photos.filter(hasGps).forEach((photo) => {
    const coordinate: RouteCoordinate = [photo.latitude, photo.longitude];
    let closestIndex = -1;
    let closestDistance = Number.POSITIVE_INFINITY;
    route.stops.forEach((stop, index) => {
      const distance = distanceKm(coordinate, stop.coordinate);
      if (distance < closestDistance) {
        closestIndex = index;
        closestDistance = distance;
      }
    });
    if (closestIndex >= 0 && closestDistance <= radiusKm) {
      buckets[closestIndex].push({ photo, distance: closestDistance });
    }
  });

  return buckets.map((bucket) => bucket
    .sort((a, b) => a.distance - b.distance)
    .map(({ photo }) => photo));
}
