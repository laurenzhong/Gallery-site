import { useEffect, useMemo, useState } from "react";
import { storyRoutes } from "../data/routes";
import type { RouteCoordinate, StoryRoute, StoryRouteStop } from "../data/storyRoutes";
import { cmsMapRoutesQuery, type CmsMapRoute } from "./cmsQueries";
import { calculateMapRouteStats, formatRouteAscent, formatRouteDistance, formatRouteDuration, parseGpxTrack, resolveRouteStopPosition, trackPointsFromCoordinates, type MapRouteTrackPoint } from "./mapRouteStats";
import { fetchCms, isSanityConfigured } from "./sanity";

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

function boundsFor(track: RouteCoordinate[], stops: StoryRouteStop[]): [[number, number], [number, number]] {
  const coordinates = [...track, ...stops.map((stop) => stop.coordinate)];
  let [south, west] = coordinates[0] ?? [0, 0];
  let [north, east] = [south, west];
  for (const [latitude, longitude] of coordinates) {
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
  }
  return [[south, west], [north, east]];
}

async function toStoryRoute(route: CmsMapRoute): Promise<StoryRoute | null> {
  const editorialRoute = storyRoutes.find((candidate) => candidate.id === route.sourceRouteId);
  const loaded = await routeTrack(route);
  const track = loaded.coordinates;
  const namedStops = (route.stops ?? []).flatMap((stop, index): StoryRouteStop[] => {
    const title = stop.title?.trim();
    if (!title || title === "新标注点") return [];
    const position = resolveRouteStopPosition(track, stop.coordinate, stop.trackIndex);
    if (!position) return [];
    return [{
      id: stop.id ?? `${route.id}-stop-${index + 1}`,
      title,
      localTitle: stop.localTitle,
      ...position,
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
  if (track.length < 2) stops.forEach((stop, index) => { stop.trackIndex = index; });
  const calculated = loaded.points.length >= 2 ? calculateMapRouteStats(loaded.points) : undefined;
  const calculatedDuration = formatRouteDuration(calculated?.durationSeconds);
  const durationLabel = route.stats?.duration
    ? editorialRoute?.stats.durationLabel ?? "route time"
    : "recorded time";
  return {
    id: route.sourceRouteId ?? `cms-${route.id}`,
    kicker: "CMS map route",
    name: editorialRoute?.name,
    locationLabel: editorialRoute?.locationLabel,
    title: route.title,
    subtitle: route.subtitle === "A six-stop route narrative generated from the GPX track you provided."
      ? editorialRoute?.subtitle ?? route.subtitle
      : route.subtitle ?? editorialRoute?.subtitle ?? "A route from the map archive.",
    introLabel: `${stops.length.toString().padStart(2, "0")} map stops / CMS route`,
    stats: {
      distance: route.stats?.distance || (calculated ? formatRouteDistance(calculated.distanceKm) : "—"),
      duration: route.stats?.duration || calculatedDuration || "—",
      durationLabel,
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

type MapRoutesState = { routes: StoryRoute[]; status: "loading" | "ready" | "error" };

export function useCmsMapRoutes() {
  const [state, setState] = useState<MapRoutesState>(() => ({
    routes: [], status: isSanityConfigured() ? "loading" : "ready",
  }));
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    setState({ routes: [], status: "loading" });
    setAttempt((current) => current + 1);
  };
  useEffect(() => {
    if (!isSanityConfigured()) return undefined;
    let active = true;
    void fetchCms<CmsMapRoute[]>(cmsMapRoutesQuery)
      .then(async (records) => {
        const next = (await Promise.all(records.map(toStoryRoute))).filter((route): route is StoryRoute => Boolean(route));
        if (active) setState({ routes: next, status: "ready" });
      })
      .catch(() => {
        if (active) setState({ routes: [], status: "error" });
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return { ...state, retry };
}

export function useMapRoutes(atlas = false) {
  const { routes: cmsRoutes } = useCmsMapRoutes();
  return useMemo(() => {
    if (atlas && isSanityConfigured()) return cmsRoutes;
    const cmsRouteIds = new Set(cmsRoutes.map((route) => route.id));
    return [...storyRoutes.filter((route) => !cmsRouteIds.has(route.id)), ...cmsRoutes];
  }, [atlas, cmsRoutes]);
}

export function mapRouteHref(routeId?: string, stopId?: string) {
  const query = new URLSearchParams({ mode: "routes" });
  if (routeId) query.set("map-route", routeId);
  if (routeId && stopId) query.set("map-stop", stopId);
  return `/map?${query}#map-views`;
}

export function routeStoryHref(routeId: string, stopId?: string) {
  const query = new URLSearchParams({ route: routeId });
  if (stopId) query.set("stop", stopId);
  return `/map/route?${query}`;
}
