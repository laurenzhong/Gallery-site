import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Photo } from "../data/photos";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { buildPhotoStops, getPhotoMapBounds, getPhotoMapInteractionBounds, type PhotoStop } from "../lib/photoMapData";
import { photoMapMarkerMarkup } from "../lib/photoMapMarker";

type PhotoMapMapLibreExperimentProps = {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
};

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.de/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
      paint: {
        "raster-saturation": -0.64,
        "raster-contrast": 0.12,
        "raster-brightness-min": 0.08,
        "raster-brightness-max": 0.96,
        "raster-opacity": 0.92,
        "raster-fade-duration": 0,
      },
    },
  ],
};

function createMarkerElement(stop: PhotoStop, active: boolean) {
  const button = document.createElement("button");
  button.type = "button";
  const isLandscape = stop.photo.width > stop.photo.height * 1.15;
  button.className = `photo-map-marker-button${isLandscape ? " is-landscape" : ""}`;
  button.setAttribute("aria-label", `${stop.area} / ${stop.photo.title}`);
  button.innerHTML = photoMapMarkerMarkup(stop.photo, active, stop.photo.mapSrc ?? sizedImageUrl(stop.photo.src, 180, 72));
  return button;
}

function createClusterElement(count: number, area: string) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "photo-map-marker-cluster-button";
  button.setAttribute("aria-label", `${area}，${count} 张照片`);
  button.innerHTML = `<span>${count}</span>`;
  return button;
}

export function PhotoMapMapLibreExperiment({ photos, onOpen }: PhotoMapMapLibreExperimentProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const markersByIdRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedArea, setSelectedArea] = useState("All places");
  const stops = useMemo(() => buildPhotoStops(photos), [photos]);
  const areas = useMemo(() => ["All places", ...Array.from(new Set(stops.map((stop) => stop.area)))], [stops]);
  const filteredStops = useMemo(
    () => stops.filter((stop) => selectedArea === "All places" || stop.area === selectedArea),
    [selectedArea, stops],
  );
  const activeStop = stops[activeIndex] ?? stops[0];
  const photoBounds = useMemo(() => getPhotoMapBounds(stops), [stops]);
  const interactionBounds = useMemo(() => getPhotoMapInteractionBounds(stops), [stops]);
  const gpsCount = useMemo(() => stops.filter((stop) => stop.coordinateSource === "gps").length, [stops]);
  const previousActiveIdRef = useRef<string | undefined>(activeStop?.photo.id);
  const previousStopsRef = useRef(stops);

  useEffect(() => {
    const mapNode = mapElement.current;
    if (!mapNode || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: mapNode,
      style: MAP_STYLE,
      center: [121.62319, 28.282375],
      zoom: 10,
      minZoom: 3,
      maxZoom: 16,
      pitch: 12,
      bearing: -8,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => setMapReady(true));
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => map.resize());
    resizeObserver?.observe(mapNode);
    mapRef.current = map;
    const markers = markersRef.current;
    const markersById = markersByIdRef.current;

    return () => {
      resizeObserver?.disconnect();
      markers.forEach((marker) => marker.remove());
      markers.length = 0;
      markersById.clear();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.resize();
    map.setMaxBounds([[interactionBounds[0][1], interactionBounds[0][0]], [interactionBounds[1][1], interactionBounds[1][0]]]);
    map.fitBounds([[photoBounds[0][1], photoBounds[0][0]], [photoBounds[1][1], photoBounds[1][0]]], { padding: 40, maxZoom: 11, duration: 0 });
  }, [interactionBounds, mapReady, photoBounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersByIdRef.current.clear();
    const groupedStops = Array.from(
      filteredStops.reduce<Map<string, PhotoStop[]>>((groups, stop) => {
        const key = `${stop.lat.toFixed(5)}:${stop.lng.toFixed(5)}`;
        const group = groups.get(key) ?? [];
        group.push(stop);
        groups.set(key, group);
        return groups;
      }, new Map()).values(),
    );
    markersRef.current = groupedStops.map((group) => {
      const first = group[0];
      const firstIndex = stops.findIndex((item) => item.photo.id === first.photo.id);
      const element = group.length === 1
        ? createMarkerElement(first, false)
        : createClusterElement(group.length, first.area);
      element.addEventListener("click", () => {
        setActiveIndex(firstIndex);
        if (group.length > 1) {
          map.flyTo({
            center: [first.lng, first.lat],
            zoom: Math.min(map.getZoom() + 2, 16),
            speed: 0.8,
            essential: true,
          });
        }
      });
      const marker = new maplibregl.Marker({ element, anchor: group.length === 1 ? "bottom" : "center" })
        .setLngLat([first.lng, first.lat])
        .addTo(map);
      if (group.length === 1) markersByIdRef.current.set(first.photo.id, marker);
      return marker;
    });
  }, [filteredStops, mapReady, stops]);

  useEffect(() => {
    markersByIdRef.current.forEach((marker, photoId) => {
      marker.getElement()?.querySelector(".photo-map-marker")?.classList.toggle(
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
    if (!map || !mapReady || !activeStop) return;
    const dataChanged = previousStopsRef.current !== stops;
    previousStopsRef.current = stops;
    if (dataChanged) {
      previousActiveIdRef.current = activeStop.photo.id;
      return;
    }
    if (previousActiveIdRef.current === activeStop.photo.id) return;
    previousActiveIdRef.current = activeStop.photo.id;
    map.flyTo({ center: [activeStop.lng, activeStop.lat], zoom: Math.max(map.getZoom(), 10.5), speed: 0.8, essential: true });
  }, [activeStop, mapReady, stops]);

  const selectStop = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <article className="photo-map-experiment photo-map-experiment--maplibre">
      <header className="photo-map-experiment__intro">
        <div>
          <p className="experiment-kicker">Interaction lab / 07</p>
          <h1>Photographs in place.</h1>
          <p className="photo-map-experiment__dek">
            The same archive, rendered as a styled vector map layer with photo markers that stay close to the image.
          </p>
        </div>
        <div className="photo-map-experiment__meta">
          <span>MapLibre comparison</span>
          <strong>{stops.length.toString().padStart(2, "0")} field notes</strong>
          <small>{gpsCount} GPS points from EXIF · {stops.length - gpsCount} fallback points</small>
        </div>
      </header>

      <section className="photo-map-experiment__stage" aria-label="MapLibre photo map prototype">
        <div className="photo-map-experiment__map-wrap">
          <div className="photo-map-experiment__map photo-map-experiment__map--maplibre" ref={mapElement} />
          <div className="photo-map-experiment__map-label photo-map-experiment__map-label--top">Archive / MapLibre layer</div>
          <div className="photo-map-experiment__map-label photo-map-experiment__map-label--bottom">MapLibre GL JS · EXIF GPS + fallback layer</div>
          <div className="photo-map-experiment__controls" aria-label="Map controls">
            <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in">+</button>
            <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out">−</button>
            <button type="button" onClick={() => mapRef.current?.fitBounds([[photoBounds[0][1], photoBounds[0][0]], [photoBounds[1][1], photoBounds[1][0]]], { padding: 40, maxZoom: 11 })} aria-label="Show all photo areas">◎</button>
          </div>
        </div>

        <aside className="photo-map-experiment__panel" aria-label="MapLibre photo map index">
          <div className="photo-map-experiment__panel-head">
            <div>
              <p className="experiment-kicker">Map index / MapLibre</p>
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

          <p className="photo-map-experiment__note">同一位置的照片会聚合显示数量，点击数量点可聚焦该位置。GPS markers come from the original image EXIF or a curated CMS location. Photos without GPS are grouped at a known land anchor until their location is curated.</p>
        </aside>
      </section>
    </article>
  );
}
