import { useEffect, useRef } from "react";
import L, { type CircleMarker, type Map as LeafletMap, type Polyline } from "leaflet";
import type { RouteCoordinate, StoryRoute } from "../data/storyRoutes";
import { addMapBasemap } from "../lib/mapBasemap";

type RouteStoryMinimapProps = {
  route: StoryRoute;
  visitedTrack: RouteCoordinate[];
  coordinate: RouteCoordinate;
  locationLabel: string;
};

export function RouteStoryMinimap({ route, visitedTrack, coordinate, locationLabel }: RouteStoryMinimapProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<{ map: LeafletMap; visited: Polyline; marker: CircleMarker } | null>(null);
  const [latitude, longitude] = coordinate;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const map = L.map(element, {
      zoomControl: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomSnap: 0.25,
      maxZoom: 18,
    });
    map.attributionControl?.setPrefix(false);
    map.fitBounds(route.bounds, { padding: [12, 16], animate: false });
    addMapBasemap(map);

    L.polyline(route.track, { color: "#37564f", weight: 3, interactive: false }).addTo(map);
    const visited = L.polyline([], { color: "#b6424b", weight: 3, interactive: false }).addTo(map);
    const marker = L.circleMarker(route.stops[0].coordinate, {
      radius: 5,
      color: "#fff",
      weight: 2,
      fillColor: "#b6424b",
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);
    layersRef.current = { map, visited, marker };

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      if (!element.clientWidth || !element.clientHeight) return;
      map.invalidateSize({ pan: false });
      map.fitBounds(route.bounds, { padding: [12, 16], animate: false });
      map.panInside(marker.getLatLng(), { padding: [12, 16], animate: false });
    });
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      map.remove();
      layersRef.current = null;
    };
  }, [route]);

  useEffect(() => {
    layersRef.current?.visited.setLatLngs(visitedTrack);
  }, [route, visitedTrack]);

  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;
    const position = L.latLng(latitude, longitude);
    layers.marker.setLatLng(position);
    layers.map.panInside(position, { padding: [12, 16], animate: false });
  }, [latitude, longitude, route]);

  return (
    <div className="trail-route-minimap" role="region" aria-label={`Route map. ${locationLabel}`}>
      <div className="trail-route-minimap__map" ref={elementRef} />
    </div>
  );
}
