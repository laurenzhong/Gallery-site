import { useEffect, useState } from "react";
import type { RouteCoordinate, StoryRoute } from "../data/storyRoutes";
import { cmsMapRoutesQuery, type CmsMapRoute } from "./cmsQueries";
import { fetchCms, isSanityConfigured } from "./sanity";

function validCoordinate(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90 && typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

function parseGpx(xml: string): RouteCoordinate[] {
  if (typeof DOMParser === "undefined") return [];
  const document = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(document.querySelectorAll("trkpt")).flatMap((point) => {
    const latitude = Number(point.getAttribute("lat"));
    const longitude = Number(point.getAttribute("lon"));
    return validCoordinate(latitude, longitude) ? [[latitude, longitude] as RouteCoordinate] : [];
  });
}

async function routeTrack(route: CmsMapRoute): Promise<RouteCoordinate[]> {
  if (route.trackUrl) {
    try {
      const response = await fetch(route.trackUrl);
      if (response.ok) {
        const track = parseGpx(await response.text());
        if (track.length >= 2) return track;
      }
    } catch {
      // Fall back to manually entered track points below.
    }
  }
  return (route.trackPoints ?? []).flatMap((point) => validCoordinate(point.latitude, point.longitude) ? [[point.latitude, point.longitude] as RouteCoordinate] : []);
}

function boundsFor(track: RouteCoordinate[], stops: NonNullable<CmsMapRoute["stops"]>): [[number, number], [number, number]] {
  const stopCoordinates = stops.flatMap((stop) => stop.coordinate ? [stop.coordinate] : []) as RouteCoordinate[];
  const coordinates = [...track, ...stopCoordinates];
  if (!coordinates.length) return [[0, 0], [0, 0]];
  const latitudes = coordinates.map(([latitude]) => latitude);
  const longitudes = coordinates.map(([, longitude]) => longitude);
  return [[Math.min(...latitudes), Math.min(...longitudes)], [Math.max(...latitudes), Math.max(...longitudes)]];
}

function nearestTrackIndex(track: RouteCoordinate[], coordinate: RouteCoordinate) {
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  track.forEach(([latitude, longitude], index) => {
    const next = (latitude - coordinate[0]) ** 2 + (longitude - coordinate[1]) ** 2;
    if (next < distance) {
      nearest = index;
      distance = next;
    }
  });
  return nearest;
}

async function toStoryRoute(route: CmsMapRoute): Promise<StoryRoute | null> {
  const track = await routeTrack(route);
  const rawStops = (route.stops ?? []).filter((stop) => stop.title && stop.coordinate?.length === 2);
  if (track.length < 2 && rawStops.length < 2) return null;
  const stops = rawStops.map((stop, index) => {
    const coordinate = stop.coordinate as RouteCoordinate;
    return {
      id: stop.id ?? `${route.id}-stop-${index + 1}`,
      title: stop.title as string,
      localTitle: stop.localTitle,
      coordinate,
      trackIndex: stop.trackIndex ?? nearestTrackIndex(track, coordinate),
      distanceKm: stop.distanceKm,
      time: stop.time,
      elevationM: stop.elevationM,
      note: stop.note,
      photoIds: stop.photoIds,
    };
  });
  const safeTrack = track.length >= 2 ? track : stops.map((stop) => stop.coordinate);
  return {
    id: route.sourceRouteId ?? `cms-${route.id}`,
    kicker: "CMS map route",
    title: route.title,
    subtitle: route.subtitle ?? "A route from the map archive.",
    introLabel: `${stops.length.toString().padStart(2, "0")} map stops / CMS route`,
    stats: { distance: route.stats?.distance ?? "—", duration: route.stats?.duration ?? "—", ascent: route.stats?.ascent ?? "—" },
    track: safeTrack,
    stops,
    bounds: boundsFor(safeTrack, rawStops),
    sourceLabel: route.sourceLabel ?? "CMS map route",
    color: route.color,
  };
}

export function useCmsMapRoutes() {
  const [routes, setRoutes] = useState<StoryRoute[]>([]);
  useEffect(() => {
    if (!isSanityConfigured()) return undefined;
    let active = true;
    void fetchCms<CmsMapRoute[]>(cmsMapRoutesQuery)
      .then(async (records) => {
        const next = (await Promise.all(records.map(toStoryRoute))).filter((route): route is StoryRoute => Boolean(route));
        if (active) setRoutes(next);
      })
      .catch(() => {
        if (active) setRoutes([]);
      });
    return () => {
      active = false;
    };
  }, []);
  return routes;
}
