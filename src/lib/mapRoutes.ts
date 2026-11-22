import { useEffect, useMemo, useState } from "react";
import { storyRoutes } from "../data/routes";
import type { RouteCoordinate, StoryRoute, StoryRouteStop } from "../data/storyRoutes";
import { cmsMapRoutesQuery, type CmsMapRoute } from "./cmsQueries";
import { calculateMapRouteStats, formatRouteAscent, formatRouteDistance, formatRouteDuration, parseGpxTrack, trackPointsFromCoordinates, type MapRouteTrackPoint } from "./mapRouteStats";
import { fetchCms, isSanityConfigured } from "./sanity";

function validCoordinate(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90 && typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

type LoadedRouteTrack = { coordinates: RouteCoordinate[]; points: MapRouteTrackPoint[] };

function loadedTrack(points: MapRouteTrackPoint[]): LoadedRouteTrack {
  return { coordinates: points.map((point) => [point.latitude, point.longitude] as RouteCoordinate), points };
}

async function routeTrack(route: CmsMapRoute): Promise<LoadedRouteTrack> {
  if (route.trackUrl) {
    try {
      const trackUrl = typeof window !== "undefined" && new URL(route.trackUrl).origin !== window.location.origin
        ? `/api/gpx?url=${encodeURIComponent(route.trackUrl)}`
        : route.trackUrl;
      const response = await fetch(trackUrl);
      if (response.ok) {
        const points = parseGpxTrack(await response.text());
        if (points.length >= 2) return loadedTrack(points);
      }
    } catch {
      // Fall back to manually entered track points below.
    }
  }
  const manualPoints = trackPointsFromCoordinates(route.trackPoints ?? []);
  if (manualPoints.length >= 2) return loadedTrack(manualPoints);

  // Sanity's file CDN does not expose every GPX asset with browser CORS
  // headers. Keep the public map identical to the editorial route when the
  // GPX proxy is unavailable instead of reducing it to a few stop points.
  const fallbackTrack = storyRoutes.find((candidate) => candidate.id === route.sourceRouteId || candidate.id === route.id)?.track ?? [];
  return loadedTrack(fallbackTrack.map(([latitude, longitude]) => ({ latitude, longitude })));
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
  const loaded = await routeTrack(route);
  const track = loaded.coordinates;
  const rawStops = (route.stops ?? []).filter((stop) => stop.title && (
    (stop.coordinate?.length === 2 && validCoordinate(stop.coordinate[0], stop.coordinate[1])) ||
    (Number.isInteger(stop.trackIndex) && track.length > 0)
  ));
  const namedStops = rawStops.flatMap((stop, index): StoryRouteStop[] => {
    const explicitCoordinate = stop.coordinate?.length === 2 && validCoordinate(stop.coordinate[0], stop.coordinate[1])
      ? stop.coordinate as RouteCoordinate
      : undefined;
    const trackIndex = stop.trackIndex ?? -1;
    const indexedCoordinate = Number.isInteger(trackIndex) ? track[trackIndex] : undefined;
    const coordinate = indexedCoordinate ?? explicitCoordinate;
    if (!coordinate) return [];
    return [{
      id: stop.id ?? `${route.id}-stop-${index + 1}`,
      title: stop.title as string,
      localTitle: stop.localTitle,
      coordinate,
      trackIndex: indexedCoordinate ? trackIndex : nearestTrackIndex(track, coordinate),
      distanceKm: stop.distanceKm,
      time: stop.time,
      elevationM: stop.elevationM,
      note: stop.note,
      photoIds: stop.photoIds,
    }];
  });
  if (track.length < 2 && namedStops.length < 2) return null;
  const stops = namedStops.length ? namedStops : [0, track.length - 1].map((trackIndex, index): StoryRouteStop => ({
    id: `${route.id}-${index === 0 ? "start" : "finish"}`,
    title: index === 0 ? "Start" : "Finish",
    coordinate: track[trackIndex],
    trackIndex,
    elevationM: loaded.points[trackIndex].elevationM,
  }));
  const safeTrack = track.length >= 2 ? track : stops.map((stop) => stop.coordinate);
  const calculated = loaded.points.length >= 2 ? calculateMapRouteStats(loaded.points) : undefined;
  const calculatedDuration = formatRouteDuration(calculated?.durationSeconds);
  return {
    id: route.sourceRouteId ?? `cms-${route.id}`,
    kicker: "CMS map route",
    title: route.title,
    subtitle: route.subtitle ?? "A route from the map archive.",
    introLabel: `${stops.length.toString().padStart(2, "0")} map stops / CMS route`,
    stats: {
      distance: route.stats?.distance || (calculated ? formatRouteDistance(calculated.distanceKm) : "—"),
      duration: route.stats?.duration || calculatedDuration || "—",
      ascent: route.stats?.ascent || (calculated?.ascentM === undefined ? "—" : formatRouteAscent(calculated.ascentM)),
    },
    track: safeTrack,
    stops,
    bounds: boundsFor(safeTrack, stops),
    sourceLabel: route.sourceLabel ?? "CMS map route",
    color: route.color,
    photoSelection: route.photoSelection ?? (route.sourceRouteId === "gpx-trail-demo" ? "gps" : "manual"),
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

export function useMapRoutes(atlas = false) {
  const cmsRoutes = useCmsMapRoutes();
  return useMemo(() => {
    if (atlas && isSanityConfigured()) return cmsRoutes;
    const cmsRouteIds = new Set(cmsRoutes.map((route) => route.id));
    return [...storyRoutes.filter((route) => !cmsRouteIds.has(route.id)), ...cmsRoutes];
  }, [atlas, cmsRoutes]);
}
