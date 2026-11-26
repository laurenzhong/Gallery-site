import type { RouteCoordinate } from "../data/storyRoutes";

export type MapRouteTrackPoint = {
  latitude: number;
  longitude: number;
  elevationM?: number;
  timeMs?: number;
};

export type MapRouteStats = {
  pointCount: number;
  distanceKm: number;
  ascentM?: number;
  durationSeconds?: number;
};

function validCoordinate(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90 && typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

export function nearestTrackIndex(track: RouteCoordinate[], coordinate: RouteCoordinate, preferredIndex = 0) {
  let nearest = preferredIndex;
  let distance = Number.POSITIVE_INFINITY;
  track.forEach(([latitude, longitude], index) => {
    const next = (latitude - coordinate[0]) ** 2 + (longitude - coordinate[1]) ** 2;
    if (next < distance || (next === distance && index === preferredIndex)) {
      nearest = index;
      distance = next;
    }
  });
  return nearest;
}

export function resolveRouteStopPosition(track: RouteCoordinate[], coordinates?: readonly unknown[], savedIndex?: number) {
  const index = Number.isInteger(savedIndex) && track.length
    ? Math.min(track.length - 1, Math.max(0, savedIndex as number))
    : 0;
  const [latitude, longitude] = coordinates ?? [];
  if (validCoordinate(latitude, longitude)) {
    const coordinate: RouteCoordinate = [latitude, longitude as number];
    return { coordinate, trackIndex: nearestTrackIndex(track, coordinate, index) };
  }
  const coordinate = Number.isInteger(savedIndex) ? track[index] : undefined;
  return coordinate ? { coordinate, trackIndex: index } : undefined;
}

export function parseGpxTrack(xml: string): MapRouteTrackPoint[] {
  if (typeof DOMParser === "undefined") return [];
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) return [];
  const trackPoints = Array.from(document.getElementsByTagNameNS("*", "trkpt"));
  const points = trackPoints.length ? trackPoints : Array.from(document.getElementsByTagName("trkpt"));
  return points.flatMap((point) => {
    const latitudeText = point.getAttribute("lat")?.trim();
    const longitudeText = point.getAttribute("lon")?.trim();
    if (!latitudeText || !longitudeText) return [];
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
    if (!validCoordinate(latitude, longitude)) return [];
    const elevationNodes = Array.from(point.getElementsByTagNameNS("*", "ele"));
    const timeNodes = Array.from(point.getElementsByTagNameNS("*", "time"));
    const elevationText = (elevationNodes.length ? elevationNodes : Array.from(point.getElementsByTagName("ele")))[0]?.textContent?.trim();
    const timeText = (timeNodes.length ? timeNodes : Array.from(point.getElementsByTagName("time")))[0]?.textContent?.trim();
    const elevationM = elevationText ? Number(elevationText) : undefined;
    const timeMs = timeText ? Date.parse(timeText) : NaN;
    return [{
      latitude,
      longitude,
      ...(Number.isFinite(elevationM) ? { elevationM } : {}),
      ...(Number.isFinite(timeMs) ? { timeMs } : {}),
    }];
  });
}

export function trackPointsFromCoordinates(points: Array<{ latitude?: number; longitude?: number; elevationM?: number }>): MapRouteTrackPoint[] {
  return points.flatMap((point) => {
    if (!validCoordinate(point.latitude, point.longitude)) return [];
    const latitude = point.latitude;
    const longitude = point.longitude as number;
    return [{ latitude, longitude, ...(Number.isFinite(point.elevationM) ? { elevationM: point.elevationM } : {}) }];
  });
}

function distanceKm(a: MapRouteTrackPoint, b: MapRouteTrackPoint) {
  const radians = Math.PI / 180;
  const lat1 = a.latitude * radians;
  const lat2 = b.latitude * radians;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLon = (b.longitude - a.longitude) * radians;
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function calculateMapRouteStats(points: MapRouteTrackPoint[]): MapRouteStats {
  let distance = 0;
  let ascent = 0;
  let elevationPairs = 0;
  for (let index = 1; index < points.length; index += 1) {
    distance += distanceKm(points[index - 1], points[index]);
    const previousElevation = points[index - 1].elevationM;
    const elevation = points[index].elevationM;
    if (typeof previousElevation === "number" && typeof elevation === "number") {
      elevationPairs += 1;
      const delta = elevation - previousElevation;
      // Ignore sub-metre GPS noise while retaining meaningful short climbs.
      if (delta > 1) ascent += delta;
    }
  }
  const timed = points.filter((point): point is MapRouteTrackPoint & { timeMs: number } => typeof point.timeMs === "number");
  const durationSeconds = timed.length >= 2 ? Math.max(0, Math.round((timed[timed.length - 1].timeMs - timed[0].timeMs) / 1000)) : undefined;
  return { pointCount: points.length, distanceKm: distance, ...(elevationPairs ? { ascentM: ascent } : {}), ...(durationSeconds === undefined ? {} : { durationSeconds }) };
}

export function formatRouteDistance(distanceKm: number) {
  return distanceKm < 10 ? distanceKm.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") : distanceKm.toFixed(1).replace(/\.0$/, "");
}

export function formatRouteAscent(ascentM: number) {
  return `+${Math.round(ascentM).toLocaleString("en-US")}`;
}

export function formatRouteDuration(durationSeconds?: number) {
  if (durationSeconds === undefined) return undefined;
  const totalMinutes = Math.round(durationSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
