import { useEffect, useMemo, useRef, useState } from "react";
import L, { type Map as LeafletMap, type Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { Photo } from "../data/photos";
import { storyRoutes } from "../data/routes";
import type { StoryRoute } from "../data/storyRoutes";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { useCmsMapRoutes } from "../lib/mapRoutes";
import { buildPhotoStops, getPhotoMapBounds, getPhotoMapInteractionBoundsFromBounds, getPhotoMapRouteBounds, mergePhotoMapBounds } from "../lib/photoMapData";
import { photoMapMarkerMarkup } from "../lib/photoMapMarker";

type PhotoMapExperimentProps = {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
};

function routeLabel(route: StoryRoute) {
  return `${route.title}${route.titleEmphasis ? ` ${route.titleEmphasis}` : ""}`;
}

export function PhotoMapExperiment({ photos, onOpen }: PhotoMapExperimentProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedArea, setSelectedArea] = useState("All places");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const cmsRoutes = useCmsMapRoutes();
  const routes = useMemo(() => {
    const cmsRouteIds = new Set(cmsRoutes.map((route) => route.id));
    return [...storyRoutes.filter((route) => !cmsRouteIds.has(route.id)), ...cmsRoutes];
  }, [cmsRoutes]);
  const routePhotoStops = useMemo(() => {
    const photoById = new Map<string, Photo>();
    photos.forEach((photo) => {
      photoById.set(photo.id, photo);
      if (photo.legacyId) photoById.set(photo.legacyId, photo);
    });
    const attached = new Map<string, { lat: number; lng: number; note: string }>();
    routes.forEach((route) => route.stops.forEach((stop) => {
      stop.photoIds?.forEach((photoId) => {
        if (attached.has(photoId)) return;
        attached.set(photoId, { lat: stop.coordinate[0], lng: stop.coordinate[1], note: `${routeLabel(route)} · ${stop.title}` });
      });
    }));
    return new Map(Array.from(attached.entries()).flatMap(([photoId, position]) => {
      const photo = photoById.get(photoId);
      return photo ? [[photo.id, { photo, ...position, area: photo.category, coordinateSource: "route" as const }]] : [];
    }));
  }, [photos, routes]);
  const stops = useMemo(() => buildPhotoStops(photos).map((stop) => routePhotoStops.get(stop.photo.id) ?? stop), [photos, routePhotoStops]);
  const photoBounds = useMemo(() => getPhotoMapBounds(stops), [stops]);
  const routeBounds = useMemo(() => getPhotoMapRouteBounds(routes), [routes]);
  const allBounds = useMemo(() => mergePhotoMapBounds(photoBounds, routeBounds), [photoBounds, routeBounds]);
  const interactionBounds = useMemo(() => getPhotoMapInteractionBoundsFromBounds(allBounds), [allBounds]);
  const areas = useMemo(() => ["All places", ...Array.from(new Set(stops.map((stop) => stop.area)))], [stops]);
  const filteredStops = useMemo(
    () => stops.filter((stop) => selectedArea === "All places" || stop.area === selectedArea),
    [selectedArea, stops],
  );
  const activeStop = stops[activeIndex] ?? stops[0];
  const previousActiveIdRef = useRef<string | undefined>(activeStop?.photo.id);
  const previousStopsRef = useRef(stops);
  const gpsCount = useMemo(() => stops.filter((stop) => stop.coordinateSource === "gps").length, [stops]);

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

    L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 0,
    }).addTo(map);

    mapRef.current = map;
    markerLayerRef.current = L.markerClusterGroup({
      maxClusterRadius: (zoom) => (zoom < 11 ? 72 : 48),
      spiderfyOnMaxZoom: true,
      spiderfyDistanceMultiplier: 1.35,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      iconCreateFunction: (cluster) => L.divIcon({
        className: "photo-map-cluster",
        html: `<span>${cluster.getChildCount()}</span>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      }),
    }).addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resizeObserver?.observe(mapNode);
    requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    const markers = markersRef.current;

    return () => {
      resizeObserver?.disconnect();
      markers.clear();
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize({ pan: false });
    map.setMaxBounds(interactionBounds);
    map.fitBounds(allBounds, { padding: [40, 40], maxZoom: 11, animate: false });
  }, [allBounds, interactionBounds]);

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
      line.on("click", () => {
        setSelectedRouteId(route.id);
        mapRef.current?.fitBounds(route.bounds, { padding: [40, 40], maxZoom: 14, animate: true });
      });
      line.addTo(routeLayer);

      const start = L.circleMarker(route.track[0] ?? route.bounds[0], { radius: 5, color, fillColor: "#f3eee4", fillOpacity: 1, weight: 2 });
      const finish = L.circleMarker(route.track[route.track.length - 1] ?? route.bounds[1], { radius: 5, color, fillColor: color, fillOpacity: 1, weight: 2 });
      start.bindTooltip(`${routeLabel(route)} · start`);
      finish.bindTooltip(`${routeLabel(route)} · finish`);
      start.addTo(routeLayer);
      finish.addTo(routeLayer);
      route.stops.forEach((stop, stopIndex) => {
        const stopMarker = L.circleMarker(stop.coordinate, {
          radius: 3.5,
          color,
          fillColor: "#f3eee4",
          fillOpacity: 1,
          weight: 1.5,
        });
        stopMarker.bindTooltip(`${routeLabel(route)} · ${String(stopIndex + 1).padStart(2, "0")} ${stop.title}`, { direction: "top" });
        stopMarker.on("click", () => {
          setSelectedRouteId(route.id);
          mapRef.current?.fitBounds(route.bounds, { padding: [40, 40], maxZoom: 14, animate: true });
        });
        stopMarker.addTo(routeLayer);
      });
    });
  }, [routes, selectedRouteId]);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    if (!markerLayer) return;

    markerLayer.clearLayers();
    markersRef.current.clear();
    const nextMarkers: Marker[] = [];
    filteredStops.forEach((stop) => {
      const index = stops.findIndex((item) => item.photo.id === stop.photo.id);
      const isLandscape = stop.photo.width > stop.photo.height * 1.15;
      const iconWidth = isLandscape ? 78 : 52;
      const marker = L.marker([stop.lat, stop.lng], {
        icon: L.divIcon({
          className: "photo-map-marker-shell",
          html: photoMapMarkerMarkup(stop.photo, false, stop.photo.mapSrc ?? sizedImageUrl(stop.photo.src, 180, 72)),
          iconSize: [iconWidth, 70],
          iconAnchor: [iconWidth / 2, 64],
        }),
        keyboard: true,
        title: `${stop.area} / ${stop.photo.title}`,
      });
      marker.on("click", () => setActiveIndex(index));
      marker.on("keydown", (event) => {
        if (event.originalEvent.key === "Enter" || event.originalEvent.key === " ") {
          event.originalEvent.preventDefault();
          setActiveIndex(index);
        }
      });
      nextMarkers.push(marker);
      markersRef.current.set(stop.photo.id, marker);
    });
    markerLayer.addLayers(nextMarkers);
  }, [filteredStops, stops]);

  useEffect(() => {
    markersRef.current.forEach((marker, photoId) => {
      const markerElement = marker.getElement();
      markerElement?.querySelector(".photo-map-marker")?.classList.toggle(
        "is-active",
        stops[activeIndex]?.photo.id === photoId,
      );
    });
  }, [activeIndex, stops]);

  useEffect(() => {
    if (selectedArea === "All places" || !activeStop || filteredStops.some((stop) => stop.photo.id === activeStop.photo.id)) return;
    const nextIndex = stops.findIndex((stop) => stop.photo.id === filteredStops[0]?.photo.id);
    setActiveIndex(nextIndex >= 0 ? nextIndex : 0);
  }, [activeStop, filteredStops, selectedArea, stops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeStop) return;
    const dataChanged = previousStopsRef.current !== stops;
    previousStopsRef.current = stops;
    if (dataChanged) {
      previousActiveIdRef.current = activeStop.photo.id;
      return;
    }
    if (previousActiveIdRef.current === activeStop.photo.id) return;
    previousActiveIdRef.current = activeStop.photo.id;
    map.flyTo([activeStop.lat, activeStop.lng], Math.max(map.getZoom(), 10.5), { duration: 0.65 });
  }, [activeStop, stops]);

  const selectStop = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <article className="photo-map-experiment">
      <header className="photo-map-experiment__intro">
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
          <small>{gpsCount} GPS points from EXIF · {stops.length - gpsCount} fallback points · {routes.length} walking routes</small>
        </div>
      </header>

      <section className="photo-map-experiment__stage" aria-label="Photo map prototype">
        <div className="photo-map-experiment__map-wrap">
          <div className="photo-map-experiment__map" ref={mapElement} />
          <div className="photo-map-experiment__map-label photo-map-experiment__map-label--top">Archive / field map</div>
          <div className="photo-map-experiment__map-label photo-map-experiment__map-label--bottom">OpenStreetMap · archive + walking routes</div>
          <div className="photo-map-experiment__controls" aria-label="Map controls">
            <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in">+</button>
            <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out">−</button>
            <button type="button" onClick={() => mapRef.current?.fitBounds(allBounds, { padding: [40, 40], maxZoom: 11 })} aria-label="Show all photos and routes">◎</button>
          </div>
        </div>

        <aside className="photo-map-experiment__panel" aria-label="Photo map index">
          <div className="photo-map-experiment__panel-head">
            <div>
              <p className="experiment-kicker">Map index</p>
              <h2>{selectedArea === "All places" ? "All field notes" : selectedArea}</h2>
            </div>
            <span>{filteredStops.length.toString().padStart(2, "0")}</span>
          </div>

          <div className="photo-map-experiment__filters" aria-label="Filter by place">
            {areas.map((area) => (
              <button key={area} type="button" className={selectedArea === area ? "is-active" : ""} onClick={() => setSelectedArea(area)}>
                {area}
              </button>
            ))}
          </div>

          <div className="photo-map-experiment__routes" aria-label="Walking routes">
            <div className="photo-map-experiment__routes-head">
              <span>Walking routes</span>
              <small>{routes.length.toString().padStart(2, "0")} connected</small>
            </div>
            <button type="button" className={selectedRouteId === null ? "is-active" : ""} onClick={() => { setSelectedRouteId(null); mapRef.current?.fitBounds(allBounds, { padding: [40, 40], maxZoom: 11 }); }}>
              <span className="photo-map-experiment__route-swatch photo-map-experiment__route-swatch--all" />
              <strong>All routes</strong>
              <small>Show the connected archive</small>
            </button>
            {routes.map((route, routeIndex) => (
              <button type="button" key={route.id} className={selectedRouteId === route.id ? "is-active" : ""} onClick={() => { setSelectedRouteId(route.id); mapRef.current?.fitBounds(route.bounds, { padding: [40, 40], maxZoom: 14 }); }}>
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

          <p className="photo-map-experiment__note">同一位置的照片会聚合显示数量，点击聚合点可展开。GPS markers come from the original image EXIF or a curated CMS location. Photos without GPS are grouped at a known land anchor until their location is curated.</p>
        </aside>
      </section>
    </article>
  );
}
