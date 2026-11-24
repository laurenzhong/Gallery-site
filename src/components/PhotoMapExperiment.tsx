import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L, { type Map as LeafletMap, type Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { Photo } from "../data/photos";
import type { StoryRoute } from "../data/storyRoutes";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { useMapRoutes } from "../lib/mapRoutes";
import { buildPhotoStops, getPhotoMapBounds, getPhotoMapInteractionBoundsFromBounds, getPhotoMapRouteBounds, mergePhotoMapBounds } from "../lib/photoMapData";
import { photoMapMarkerMarkup } from "../lib/photoMapMarker";
import { addMapBasemap } from "../lib/mapBasemap";

import { AtlasPhotoCard, AtlasRouteCard, AtlasOverview } from "./AtlasCards";
import { resolveRouteStopPhotos } from "../lib/routePhotos";

function printIcon(photo: Photo, count?: number) {
  const frame = document.createElement("span");
  frame.className = "atlas-pin__frame";
  const img = document.createElement("img");
  img.src = photo.mapSrc ?? sizedImageUrl(photo.src, 160);
  img.alt = "";
  const scale = Math.min(50 / Math.max(1, photo.width), 40 / Math.max(1, photo.height));
  img.style.width = `${Math.max(1, Math.round(photo.width * scale))}px`;
  img.style.height = `${Math.max(1, Math.round(photo.height * scale))}px`;
  frame.append(img);
  if (count) {
    const badge = document.createElement("b");
    badge.textContent = String(count);
    frame.append(badge);
  }
  return L.divIcon({
    className: `atlas-pin${count ? " atlas-pin--stack" : ""}${photo.coordinateVisibility === "approximate" ? " atlas-pin--area" : ""}`,
    html: frame, iconSize: [54, 55], iconAnchor: [27, 55],
  });
}

type PhotoMapExperimentProps = {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
  compact?: boolean;
  atlas?: boolean;
  showRoutesOnly?: boolean;
};

function routeLabel(route: StoryRoute) {
  return `${route.title}${route.titleEmphasis ? ` ${route.titleEmphasis}` : ""}`;
}

function updateMapQuery(values: Record<string, string | null>) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(values)) {
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
  }
  window.history.replaceState(window.history.state, "", url);
}

export function PhotoMapExperiment(props: PhotoMapExperimentProps) {
  const routes = useMapRoutes(props.atlas);
  return <PhotoMapCanvas {...props} routes={routes} />;
}

export function PhotoMapCanvas({ photos, onOpen, compact = false, atlas = false, showRoutesOnly = false, routes, onRouteFocus }: PhotoMapExperimentProps & {
  routes: StoryRoute[];
  onRouteFocus?: () => void;
}) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const userLocationLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const [activeIndex, setActiveIndex] = useState(0);
  const [atlasPhotoId, setAtlasPhotoId] = useState<string | null>(null);
  const [visiblePhotoCount, setVisiblePhotoCount] = useState(0);
  const markerPhotos = useRef(new WeakMap<Marker, Photo>());
  const selectedAtlasMarker = useRef<Marker | null>(null);
  const [requestedArea, setRequestedArea] = useState(() => new URLSearchParams(window.location.search).get("place"));
  const [requestedRouteId, setRequestedRouteId] = useState(() => new URLSearchParams(window.location.search).get("map-route"));
  const [requestedStopId, setRequestedStopId] = useState(() => new URLSearchParams(window.location.search).get("map-stop"));
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "found" | "error">("idle");
  const selectedRoute = routes.find((route) => route.id === requestedRouteId);
  const selectedRouteId = selectedRoute?.id ?? null;
  const routeStopIndex = selectedRoute?.stops.findIndex((stop) => stop.id === requestedStopId) ?? -1;
  const baseStops = useMemo(() => buildPhotoStops(photos), [photos]);
  const routePhotoStops = useMemo(() => {
    const photoById = new Map<string, Photo>();
    const baseStopById = new Map(baseStops.map((stop) => [stop.photo.id, stop]));
    photos.forEach((photo) => {
      photoById.set(photo.id, photo);
      if (photo.legacyId) photoById.set(photo.legacyId, photo);
    });
    const attached = new Map<string, { lat: number; lng: number; note: string }>();
    routes.forEach((route) => route.stops.forEach((stop) => {
      if (route.photoSelection === "gps") return;
      stop.photoIds?.forEach((photoId) => {
        if (attached.has(photoId)) return;
        const photo = photoById.get(photoId);
        // A route attachment must not move a photo that already has EXIF or
        // CMS coordinates. Route stops only provide a position for otherwise
        // unlocated photos.
        if (!photo || (photo.coordinateVisibility && photo.coordinateVisibility !== "exact") || baseStopById.get(photo.id)?.coordinateSource === "gps") return;
        attached.set(photoId, { lat: stop.coordinate[0], lng: stop.coordinate[1], note: `${routeLabel(route)} · ${stop.title}` });
      });
    }));
    return new Map(Array.from(attached.entries()).flatMap(([photoId, position]) => {
      const photo = photoById.get(photoId);
      return photo ? [[photo.id, { photo, ...position, area: photo.category, coordinateSource: "route" as const }]] : [];
    }));
  }, [baseStops, photos, routes]);
  const stops = useMemo(() => baseStops.map((stop) => routePhotoStops.get(stop.photo.id) ?? stop), [baseStops, routePhotoStops]);
  const photoBounds = useMemo(() => getPhotoMapBounds(stops), [stops]);
  const routeBounds = useMemo(() => getPhotoMapRouteBounds(routes), [routes]);
  const allBounds = useMemo(() => mergePhotoMapBounds(photoBounds, routeBounds), [photoBounds, routeBounds]);
  const visibleBounds = showRoutesOnly ? routeBounds : allBounds;
  const interactionBounds = useMemo(() => getPhotoMapInteractionBoundsFromBounds(visibleBounds), [visibleBounds]);
  const areas = useMemo(() => ["All places", ...Array.from(new Set(stops.map((stop) => stop.area)))], [stops]);
  const selectedArea = requestedArea && areas.includes(requestedArea) ? requestedArea : "All places";
  const filteredStops = useMemo(
    () => stops.filter((stop) => selectedArea === "All places" || stop.area === selectedArea),
    [selectedArea, stops],
  );
  const atlasStops = useMemo(() => filteredStops.filter(stop => stop.coordinateSource !== "fallback"), [filteredStops]);
  const atlasStop = atlasStops.find(stop => stop.photo.id === atlasPhotoId)
    ?? atlasStops.find(stop => atlasPhotoId !== null && stop.photo.legacyId === atlasPhotoId);
  const printIndex = atlasStop ? atlasStops.indexOf(atlasStop) : -1;
  const routePhotos = useMemo(() => atlas && showRoutesOnly && selectedRoute
    ? resolveRouteStopPhotos(selectedRoute, photos) : [], [atlas, showRoutesOnly, selectedRoute, photos]);
  const activeStop = stops[activeIndex] ?? stops[0];
  const lastAtlasView = useRef<{ center: L.LatLng; zoom: number } | null>(null);
  const previousActiveIdRef = useRef<string | undefined>(activeStop?.photo.id);
  const previousStopsRef = useRef(stops);
  const gpsCount = useMemo(() => stops.filter((stop) => stop.coordinateSource === "gps").length, [stops]);
  const unlocatedCount = useMemo(() => stops.filter((stop) => stop.coordinateSource === "fallback").length, [stops]);

  const selectArea = useCallback((area: string) => {
    const place = area === "All places" ? null : area;
    setRequestedArea(place);
    updateMapQuery({ place });
  }, []);

  const selectRoute = useCallback((routeId: string | null, stopId: string | null = null) => {
    if (routeId) onRouteFocus?.();
    setRequestedRouteId(routeId);
    setRequestedStopId(stopId);
    updateMapQuery({ "map-route": routeId, "map-stop": stopId });
  }, [onRouteFocus]);

  useEffect(() => {
    const mapNode = mapElement.current;
    if (!mapNode || mapRef.current) return undefined;

    const map = L.map(mapNode, {
      zoomControl: false,
      attributionControl: true,
      center: [28.282375, 121.62319],
      zoom: 9,
      minZoom: 3,
      maxZoom: 16,
      zoomSnap: 0.5,
      maxBoundsViscosity: 0.75,
    });

    addMapBasemap(map, { interactiveAtlas: atlas });

    mapRef.current = map;
    function clusterCover(cluster: L.MarkerCluster) {
      const members = cluster.getAllChildMarkers();
      const selected = selectedAtlasMarker.current;
      const cover = selected && members.includes(selected) ? selected : members[0];
      return markerPhotos.current.get(cover);
    }
    markerLayerRef.current = L.markerClusterGroup({
      maxClusterRadius: (zoom) => (zoom < 11 ? 72 : 48),
      spiderfyOnMaxZoom: true,
      spiderfyDistanceMultiplier: 1.35,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      iconCreateFunction: (cluster) => {
        if (atlas) {
          const cover = clusterCover(cluster);
          if (cover) return printIcon(cover, cluster.getChildCount());
        }
        return L.divIcon({
          className: "photo-map-cluster",
          html: `<span>${cluster.getChildCount()}</span>`,
          iconSize: [42, 42],
          iconAnchor: [21, 21],
        });
      },
    }).addTo(map);
    if (atlas) {
      markerLayerRef.current.on("clusterclick clusterkeypress", event => {
        if (event.type === "clusterkeypress" && (event as L.LeafletKeyboardEvent).originalEvent.key !== "Enter") return;
        const cover = clusterCover(event.layer);
        if (cover) setAtlasPhotoId(cover.id);
      });
    }
    if (atlas) map.attributionControl.setPrefix(false);
    if (atlas) L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    userLocationLayerRef.current = L.layerGroup().addTo(map);
    const mapFrame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resizeObserver?.observe(mapNode);
    const markers = markersRef.current;

    return () => {
      resizeObserver?.disconnect();
      cancelAnimationFrame(mapFrame);
      markers.clear();
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      routeLayerRef.current = null;
      userLocationLayerRef.current = null;
    };
  }, [atlas]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const handleFound = (event: L.LocationEvent) => {
      const layer = userLocationLayerRef.current;
      if (!layer) return;
      layer.clearLayers();
      L.circleMarker(event.latlng, { radius: 7, color: "#fff8eb", weight: 2, fillColor: "#315d5a", fillOpacity: 1 }).addTo(layer);
      if (event.accuracy > 0) L.circle(event.latlng, { radius: event.accuracy, color: "#315d5a", weight: 1, fillColor: "#315d5a", fillOpacity: 0.12 }).addTo(layer);
      map.setMaxBounds(L.latLngBounds([-85, -180], [85, 180]));
      map.flyTo(event.latlng, Math.max(map.getZoom(), 12), { duration: 0.65 });
      setLocationStatus("found");
    };
    const handleError = () => setLocationStatus("error");
    map.on("locationfound", handleFound);
    map.on("locationerror", handleError);
    return () => { map.off("locationfound", handleFound); map.off("locationerror", handleError); };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize({ pan: false });
    map.setMaxBounds(interactionBounds);
    if (atlas && !showRoutesOnly) {
      const previous = lastAtlasView.current;
      if (previous) map.setView(previous.center, previous.zoom, { animate: false });
      else map.fitBounds(visibleBounds, { padding: [40, 40], maxZoom: 11, animate: false });
      return () => {
        if (mapRef.current === map) lastAtlasView.current = { center: map.getCenter(), zoom: map.getZoom() };
      };
    }
    map.fitBounds(selectedRoute?.bounds ?? visibleBounds, { padding: [40, 40], maxZoom: selectedRoute ? 14 : 11, animate: false });
  }, [atlas, interactionBounds, selectedRoute, showRoutesOnly, visibleBounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!atlas || showRoutesOnly || !map) return;
    const updateVisibleCount = () => {
      const bounds = map.getBounds();
      setVisiblePhotoCount(atlasStops.filter(({ lat, lng }) => bounds.contains([lat, lng])).length);
    };
    updateVisibleCount();
    map.on("moveend resize", updateVisibleCount);
    return () => { map.off("moveend resize", updateVisibleCount); };
  }, [atlas, atlasStops, showRoutesOnly]);

  useEffect(() => {
    const routeLayer = routeLayerRef.current;
    if (!routeLayer) return;

    routeLayer.clearLayers();
    routes.forEach((route, routeIndex) => {
      const color = route.color ?? ["#a1493e", "#315d5a", "#78613d", "#5d4e78", "#3f6880", "#8b5e54"][routeIndex % 6];
      const line = L.polyline(route.track, {
        color,
        weight: selectedRouteId === route.id ? 5 : 3,
        opacity: selectedRouteId && selectedRouteId !== route.id ? 0.36 : 0.88,
        lineCap: "round",
        lineJoin: "round",
      });
      line.bindTooltip(routeLabel(route), { sticky: true, direction: "top", className: "photo-map-route-tooltip" });
      line.on("click", () => selectRoute(route.id));
      line.addTo(routeLayer);

      const start = L.circleMarker(route.track[0] ?? route.bounds[0], { radius: 5, color, fillColor: "#f3eee4", fillOpacity: 1, weight: 2 });
      const finish = L.circleMarker(route.track[route.track.length - 1] ?? route.bounds[1], { radius: 5, color, fillColor: color, fillOpacity: 1, weight: 2 });
      start.bindTooltip(`${routeLabel(route)} · start`);
      finish.bindTooltip(`${routeLabel(route)} · finish`);
      start.addTo(routeLayer);
      finish.addTo(routeLayer);
      route.stops.forEach((stop, stopIndex) => {
        if (atlas && showRoutesOnly && route.id === selectedRouteId) {
          const marker = L.marker(stop.coordinate, {
            icon: L.divIcon({ className: `atlas-station${stopIndex === routeStopIndex ? " is-selected" : ""}`, html: String(stopIndex + 1), iconSize: [28, 28], iconAnchor: [14, 14] }),
            title: stop.title,
          });
          marker.on("click", () => selectRoute(route.id, stop.id)).addTo(routeLayer);
          return;
        }
        const stopMarker = L.circleMarker(stop.coordinate, {
          radius: 3.5,
          color,
          fillColor: "#f3eee4",
          fillOpacity: 1,
          weight: 1.5,
        });
        stopMarker.bindTooltip(`${routeLabel(route)} · ${String(stopIndex + 1).padStart(2, "0")} ${stop.title}`, { direction: "top" });
        stopMarker.on("click", () => selectRoute(route.id, atlas ? stop.id : null));
        stopMarker.addTo(routeLayer);
      });
    });
  }, [atlas, routeStopIndex, routes, selectRoute, selectedRouteId, showRoutesOnly]);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    if (!markerLayer) return;

    markerLayer.clearLayers();
    markersRef.current.clear();
    const nextMarkers: Marker[] = [];
    filteredStops.filter((stop) => !showRoutesOnly && stop.coordinateSource !== "fallback").forEach((stop) => {
      const index = stops.findIndex((item) => item.photo.id === stop.photo.id);
      const isLandscape = stop.photo.width > stop.photo.height * 1.15;
      const iconWidth = isLandscape ? 78 : 52;
      const marker = L.marker([stop.lat, stop.lng], {
        icon: atlas ? printIcon(stop.photo) : L.divIcon({
          className: "photo-map-marker-shell",
          html: photoMapMarkerMarkup(stop.photo, false, stop.photo.mapSrc ?? sizedImageUrl(stop.photo.src, 180, 72)),
          iconSize: [iconWidth, 70],
          iconAnchor: [iconWidth / 2, 64],
        }),
        keyboard: true,
        title: [stop.photo.spot || stop.photo.place, stop.photo.title].filter(Boolean).join(" / "),
      });
      const pick = () => atlas ? setAtlasPhotoId(stop.photo.id) : setActiveIndex(index);
      markerPhotos.current.set(marker, stop.photo);
      marker.on("click", pick);
      marker.on("keydown", (event) => {
        if (event.originalEvent.key === "Enter" || event.originalEvent.key === " ") {
          event.originalEvent.preventDefault();
          pick();
        }
      });
      nextMarkers.push(marker);
      markersRef.current.set(stop.photo.id, marker);
    });
    markerLayer.addLayers(nextMarkers);
  }, [atlas, filteredStops, showRoutesOnly, stops]);

  useEffect(() => {
    if (atlas) {
      const marker = atlasStop && markersRef.current.get(atlasStop.photo.id);
      const layer = markerLayerRef.current;
      const map = mapRef.current;
      if (!layer || !map) return;
      const previous = selectedAtlasMarker.current;
      selectedAtlasMarker.current = marker ?? null;
      const changed = [previous, marker].filter((m): m is Marker => !!m && layer.hasLayer(m));
      if (changed.length) layer.refreshClusters(changed);
      if (!marker) return;
      let element: HTMLElement | undefined;
      const highlight = () => {
        element?.classList.remove("is-selected");
        element = layer.getVisibleParent(marker)?.getElement() ?? undefined;
        element?.classList.add("is-selected");
      };
      highlight();
      map.on("zoomend moveend", highlight);
      layer.on("animationend spiderfied unspiderfied", highlight);
      return () => {
        element?.classList.remove("is-selected");
        map.off("zoomend moveend", highlight);
        layer.off("animationend spiderfied unspiderfied", highlight);
      };
    }
    markersRef.current.forEach((marker, photoId) => {
      const markerElement = marker.getElement();
      markerElement?.querySelector(".photo-map-marker")?.classList.toggle(
        "is-active",
        stops[activeIndex]?.photo.id === photoId,
      );
    });
  }, [activeIndex, atlas, atlasStop, showRoutesOnly, stops]);

  useEffect(() => {
    if (selectedArea === "All places" || !activeStop || filteredStops.some((stop) => stop.photo.id === activeStop.photo.id)) return;
    const nextIndex = stops.findIndex((stop) => stop.photo.id === filteredStops[0]?.photo.id);
    setActiveIndex(nextIndex >= 0 ? nextIndex : 0);
  }, [activeStop, filteredStops, selectedArea, stops]);

  useEffect(() => {
    const map = mapRef.current;
    if (atlas || showRoutesOnly || !map || !activeStop || activeStop.coordinateSource === "fallback") return;
    const dataChanged = previousStopsRef.current !== stops;
    previousStopsRef.current = stops;
    if (dataChanged) {
      previousActiveIdRef.current = activeStop.photo.id;
      return;
    }
    if (previousActiveIdRef.current === activeStop.photo.id) return;
    previousActiveIdRef.current = activeStop.photo.id;
    map.flyTo([activeStop.lat, activeStop.lng], Math.max(map.getZoom(), 10.5), { duration: 0.65 });
  }, [activeStop, atlas, showRoutesOnly, stops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!atlas || showRoutesOnly || !map || atlasStop?.photo.coordinateVisibility !== "approximate") return;
    // Public coordinates are rounded to hundredths of a degree. Show their rounding cell.
    const { lat, lng } = atlasStop;
    const region = L.rectangle([[lat - 0.005, lng - 0.005], [lat + 0.005, lng + 0.005]], {
      interactive: false, color: "#97442e", dashArray: "4 4", weight: 1, fillOpacity: 0.09,
    }).addTo(map);
    return () => { region.remove(); };
  }, [atlas, atlasStop, showRoutesOnly]);

  const selectStop = (index: number) => {
    setActiveIndex(index);
  };
  const locateUser = () => {
    if (!navigator.geolocation || !mapRef.current) { setLocationStatus("error"); return; }
    setLocationStatus("locating");
    mapRef.current.locate({ enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
  };
  const locationLabel = locationStatus === "locating" ? "正在请求位置…" : locationStatus === "found" ? "已显示当前位置" : locationStatus === "error" ? "无法获取位置，请检查浏览器权限" : "地图已就绪";

  const mapCanvas = (
    <div className="photo-map-experiment__map-wrap">
      <div className="photo-map-experiment__map" ref={mapElement} />
      {atlas && !showRoutesOnly && <output className="atlas-visible-count">
        {visiblePhotoCount} {visiblePhotoCount === 1 ? "photograph" : "photographs"} in view
      </output>}
      {!atlas && <><div className="photo-map-experiment__map-label photo-map-experiment__map-label--top">{showRoutesOnly ? "Routes / field records" : "Archive / field map"}</div>
      <div className="photo-map-experiment__map-label photo-map-experiment__map-label--bottom">{showRoutesOnly ? "Walking routes + route stops" : "Photo archive + walking routes"}</div></>}
      <div className="photo-map-experiment__controls" aria-label="Map controls">
        <button type="button" onClick={() => mapRef.current?.zoomIn(1, { animate: !atlas })} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => mapRef.current?.zoomOut(1, { animate: !atlas })} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => mapRef.current?.fitBounds(visibleBounds, { padding: [40, 40], maxZoom: 11 })} aria-label={showRoutesOnly ? "Show all routes" : "Show all photos and routes"}>◎</button>
        <button type="button" onClick={locateUser} aria-label="定位到我的位置" aria-busy={locationStatus === "locating"}>⌖</button>
      </div>
      {(!atlas || locationStatus !== "idle") && <p className="photo-map-experiment__status" role="status" aria-live="polite">{locationLabel}</p>}
    </div>
  );

  return (
    <article className={`photo-map-experiment${compact ? " photo-map-experiment--compact" : ""}`}>
      {!compact ? <header className="photo-map-experiment__intro">
        <div>
          <p className="experiment-kicker">Interaction lab / 06</p>
          <h1>Photographs in place.</h1>
          <p className="photo-map-experiment__dek">
            A map can be a second index for the archive: each pin is a photograph, each line a recorded walk.
          </p>
        </div>
        <div className="photo-map-experiment__meta">
          <span>Prototype</span>
          <strong>{stops.length.toString().padStart(2, "0")} field notes</strong>
          <small>{gpsCount} located points · {unlocatedCount} photos without a location · {routes.length} walking routes</small>
        </div>
      </header> : null}

      <section className={atlas ? "map-hub-demo__workspace" : "photo-map-experiment__stage"} aria-label={showRoutesOnly ? "Route map" : "Photo map"}>
        {atlas ? <div className="map-hub-demo__map-column">
          <div className="map-hub-demo__map-label">
            <span>{showRoutesOnly ? "Routes / field records" : "Archive / field map"}</span>
            <small>OpenStreetMap</small>
          </div>
          <div className="map-hub-demo__map-frame"><div className="photo-map-experiment__stage">{mapCanvas}</div></div>
        </div> : mapCanvas}

        {atlas && (showRoutesOnly ? <AtlasRouteCard routes={routes} route={selectedRoute} stopIndex={routeStopIndex}
          stopPhotos={routePhotos[routeStopIndex] ?? []} onRoute={selectRoute}
          onStop={(i) => {
            const stop = selectedRoute?.stops[i];
            if (!selectedRoute || !stop) return;
            selectRoute(selectedRoute.id, stop.id);
            mapRef.current?.panInside(stop.coordinate, { padding: [48, 48], animate: false });
          }}
          onOpen={photo => onOpen(photos.findIndex(p => p.id === photo.id), routePhotos[routeStopIndex])}
        /> : atlasStop ? <AtlasPhotoCard onClose={() => setAtlasPhotoId(null)} stop={atlasStop} index={printIndex} count={atlasStops.length}
          onMove={delta => {
            const next = atlasStops[(printIndex + delta + atlasStops.length) % atlasStops.length];
            setAtlasPhotoId(next.photo.id);
            mapRef.current?.setView([next.lat, next.lng], Math.max(mapRef.current.getZoom(), 13), { animate: false });
          }}
          onOpen={() => atlasStop && onOpen(photos.findIndex(p => p.id === atlasStop.photo.id), atlasStops.map(s => s.photo))}
        /> : <AtlasOverview photos={photos} locatedCount={atlasStops.length} />)}
        {!compact ? <aside className="photo-map-experiment__panel" aria-label="Photo map index">
          <div className="photo-map-experiment__panel-head">
            <div>
              <p className="experiment-kicker">Map index</p>
              <h2>{selectedArea === "All places" ? "All field notes" : selectedArea}</h2>
            </div>
            <span>{filteredStops.length.toString().padStart(2, "0")}</span>
          </div>

          <div className="photo-map-experiment__filters" aria-label="Filter by place">
            {areas.map((area) => (
              <button key={area} type="button" className={selectedArea === area ? "is-active" : ""} onClick={() => selectArea(area)}>
                {area}
              </button>
            ))}
          </div>

          <div className="photo-map-experiment__routes" aria-label="Walking routes">
            <div className="photo-map-experiment__routes-head">
              <span>Walking routes</span>
              <small>{routes.length.toString().padStart(2, "0")} connected</small>
            </div>
            <button type="button" className={selectedRouteId === null ? "is-active" : ""} onClick={() => { selectRoute(null); mapRef.current?.fitBounds(allBounds, { padding: [40, 40], maxZoom: 11 }); }}>
              <span className="photo-map-experiment__route-swatch photo-map-experiment__route-swatch--all" />
              <strong>All routes</strong>
              <small>Show the connected archive</small>
            </button>
            {routes.map((route, routeIndex) => (
              <button type="button" key={route.id} className={selectedRouteId === route.id ? "is-active" : ""} onClick={() => { selectRoute(route.id); mapRef.current?.fitBounds(route.bounds, { padding: [40, 40], maxZoom: 14 }); }}>
                <span className={`photo-map-experiment__route-swatch photo-map-experiment__route-swatch--${routeIndex % 6}`} style={route.color ? { background: route.color } : undefined} />
                <strong>{routeLabel(route)}</strong>
                <small>{route.stats.distance} km · {route.stops.length} stops</small>
              </button>
            ))}
          </div>

          {activeStop ? (
            <button type="button" className="photo-map-experiment__active" onClick={() => onOpen(photos.findIndex((photo) => photo.id === activeStop.photo.id), photos)}>
              <img
                src={activeStop.photo.mapSrc ?? sizedImageUrl(activeStop.photo.src, 720, 82)}
                {...(activeStop.photo.mapSrc ? {} : { srcSet: imageSrcSet(activeStop.photo.src, [360, 720], 82) })}
                sizes="(max-width: 900px) 100vw, 360px"
                alt={activeStop.photo.altText ?? activeStop.photo.title}
                decoding="async"
              />
              <span>
                <small>{activeStop.area} / {activeStop.note}</small>
                <strong>{activeStop.photo.title}</strong>
                <em>Open photograph ↗</em>
              </span>
            </button>
          ) : null}

          <div className="photo-map-experiment__list" role="list">
            {filteredStops.map((stop) => {
              const index = stops.findIndex((item) => item.photo.id === stop.photo.id);
              return (
                <button type="button" role="listitem" key={stop.photo.id} className={`photo-map-experiment__list-item${index === activeIndex ? " is-active" : ""}`} onClick={() => selectStop(index)}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{stop.area}</strong>
                  <small>{stop.photo.title}</small>
                </button>
              );
            })}
          </div>

          <p className="photo-map-experiment__note">同一位置的照片会聚合显示数量，点击聚合点可展开。已有 EXIF 或 CMS 坐标的照片保留自己的位置；路线点只为没有位置的路线照片提供坐标。没有位置的照片不会被放到地图上的虚假地点。</p>
        </aside> : null}
      </section>
    </article>
  );
}
