import { useEffect, useMemo, useRef, useState } from "react";
import L, { type LayerGroup, type Map as LeafletMap, type Marker, type Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Photo } from "../data/photos";
import type { ResolvedStoryRouteStop, RouteCoordinate, StoryRoute } from "../data/storyRoutes";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { resolveRouteStopPhotos } from "../lib/routePhotos";

type StoryRoutePageProps = {
  route: StoryRoute;
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
};

function resolvePhotos(photoIds: string[] | undefined, photos: Photo[]) {
  return (photoIds ?? [])
    .map((id) => photos.find((photo) => photo.id === id || photo.legacyId === id))
    .filter((photo): photo is Photo => Boolean(photo));
}

function resolveStops(route: StoryRoute, photos: Photo[]): ResolvedStoryRouteStop[] {
  const resolvedPhotos = resolveRouteStopPhotos(route, photos);
  return route.stops.map((stop, index) => ({ ...stop, photos: resolvedPhotos[index] ?? [] }));
}

function getVisitedTrack(
  track: RouteCoordinate[],
  breakpoints: number[],
  progress: number,
): RouteCoordinate[] {
  if (track.length < 2 || breakpoints.length < 2) return track;
  const safeProgress = Math.max(0, Math.min(progress, breakpoints.length - 1));
  const segment = Math.min(Math.floor(safeProgress), breakpoints.length - 2);
  const localProgress = safeProgress - segment;
  const start = Math.max(0, Math.min(track.length - 1, breakpoints[segment]));
  const end = Math.max(start, Math.min(track.length - 1, breakpoints[segment + 1]));
  const floatIndex = start + (end - start) * localProgress;
  const endIndex = Math.floor(floatIndex);
  const visited = track.slice(0, endIndex + 1);
  if (endIndex < track.length - 1 && floatIndex > endIndex) {
    const fraction = floatIndex - endIndex;
    const from = track[endIndex];
    const to = track[endIndex + 1];
    visited.push([from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction]);
  }
  return visited;
}

function markerHtml(index: number, active: boolean, past: boolean) {
  return `<span class="trail-route-marker${active ? " is-active" : past ? " is-past" : ""}"><b>${String(index + 1).padStart(2, "0")}</b></span>`;
}

function pointMarkerHtml(index: number, hasPhoto: boolean) {
  return `<span class="trail-route-point-marker${hasPhoto ? " has-photo" : ""}"><b>${String(index + 1).padStart(2, "0")}</b></span>`;
}

function photoMarkerHtml() {
  return "<span class=\"trail-route-photo-marker\">✦</span>";
}

function elevationPath(stops: ResolvedStoryRouteStop[]) {
  const values = stops.map((stop) => stop.elevationM ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  return values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
    const y = 23 - ((value - min) / (max - min)) * 17;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function elevationPoint(stops: ResolvedStoryRouteStop[], index: number): [number, number] {
  const values = stops.map((stop) => stop.elevationM ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const value = values[index] ?? min;
  const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
  const y = 23 - ((value - min) / (max - min)) * 17;
  return [x, y];
}

export function StoryRoutePage({ route, photos, onOpen }: StoryRoutePageProps) {
  const stops = useMemo(() => resolveStops(route, photos), [photos, route]);
  const mapElement = useRef<HTMLDivElement | null>(null);
  const storyElement = useRef<HTMLElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup<Marker> | null>(null);
  const visitedLineRef = useRef<Polyline | null>(null);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);
  const [routeProgress, setRouteProgress] = useState(0);
  const [mapZoom, setMapZoom] = useState(13);
  const activeIndex = Math.min(Math.max(0, stops.length - 1), Math.floor(routeProgress));
  const activeStop = stops[activeIndex] ?? stops[0];
  const breakpoints = useMemo(() => route.stops.map((stop) => stop.trackIndex), [route]);
  const profilePath = useMemo(() => elevationPath(stops), [stops]);
  const profilePoint = useMemo(() => elevationPoint(stops, activeIndex), [activeIndex, stops]);
  const mapPoints = useMemo(() => route.points ?? [], [route]);
  const visibleMapPoints = useMemo(() => (mapZoom >= 14 ? mapPoints : []), [mapPoints, mapZoom]);
  const photoPoints = useMemo(
    () => stops.flatMap((stop) => stop.photos.filter((photo) => Number.isFinite(photo.latitude) && Number.isFinite(photo.longitude)).map((photo) => ({ photo }))),
    [stops],
  );

  const scrollToStop = (index: number) => {
    setRouteProgress(index);
    chapterRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    const story = storyElement.current;
    const sections = story ? Array.from(story.querySelectorAll<HTMLElement>(".trail-route-chapter")) : [];
    if (!sections.length) return undefined;
    let frame = 0;
    let running = true;
    let lastProgress = -1;
    const measure = () => {
      const focusDocumentY = window.scrollY + window.innerHeight * 0.5;
      let nextProgress = 0;
      sections.forEach((section, index) => {
        const start = section.getBoundingClientRect().top + window.scrollY;
        const height = Math.max(1, section.getBoundingClientRect().height);
        const end = start + height;
        if (focusDocumentY >= start && focusDocumentY <= end) {
          nextProgress = index + Math.max(0, Math.min(1, (focusDocumentY - start) / height));
        } else if (focusDocumentY > end) {
          nextProgress = index + 1;
        }
      });
      if (Math.abs(lastProgress - nextProgress) >= 0.012) {
        lastProgress = nextProgress;
        setRouteProgress(Math.min(Math.max(0, nextProgress), Math.max(0, stops.length - 1)));
      }
    };
    const updateFromScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; measure(); });
    };
    const tick = () => {
      if (!running) return;
      measure();
      frame = window.requestAnimationFrame(tick);
    };
    measure();
    frame = window.requestAnimationFrame(tick);
    window.addEventListener("scroll", updateFromScroll, { passive: true });
    window.addEventListener("resize", updateFromScroll);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateFromScroll) : null;
    observer?.observe(document.body);
    return () => {
      running = false;
      window.removeEventListener("scroll", updateFromScroll);
      window.removeEventListener("resize", updateFromScroll);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [stops.length]);

  useEffect(() => {
    if (!mapElement.current || mapRef.current || !stops.length) return undefined;
    const map = L.map(mapElement.current, {
      zoomControl: false,
      minZoom: 8,
      maxZoom: 18,
      maxBounds: route.bounds,
      maxBoundsViscosity: 0.7,
    }).fitBounds(route.bounds, { padding: [28, 28] });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 0,
    }).addTo(map);
    visitedLineRef.current = L.polyline([], {
      color: "#b6424b",
      weight: 4,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);
    mapRef.current = map;
    markerLayerRef.current = L.layerGroup().addTo(map);
    const onZoomEnd = () => setMapZoom(map.getZoom());
    map.on("zoomend", onZoomEnd);
    setMapZoom(map.getZoom());
    window.requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.off("zoomend", onZoomEnd);
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      visitedLineRef.current = null;
    };
  }, [route, stops.length]);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    const visitedLine = visitedLineRef.current;
    if (!markerLayer || !visitedLine) return;
    markerLayer.clearLayers();
    stops.forEach((stop, index) => {
      const marker = L.marker(stop.coordinate, {
        icon: L.divIcon({
          className: "trail-route-marker-shell",
          html: markerHtml(index, index === activeIndex, index < activeIndex),
          iconSize: [44, 50],
          iconAnchor: [22, 42],
        }),
        keyboard: true,
        title: `${String(index + 1).padStart(2, "0")} ${stop.title}`,
      });
      marker.on("click", () => scrollToStop(index));
      markerLayer.addLayer(marker);
    });
    visibleMapPoints.forEach((point, index) => {
      const pointPhotos = resolvePhotos(point.photoIds, photos);
      const marker = L.marker(point.coordinate, {
        icon: L.divIcon({
          className: "trail-route-point-marker-shell",
          html: pointMarkerHtml(index, pointPhotos.length > 0),
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        keyboard: true,
        title: point.title,
      });
      marker.on("click", () => {
        if (pointPhotos.length) {
          onOpen(photos.indexOf(pointPhotos[0]), pointPhotos);
          return;
        }
        const nearestStop = stops.reduce((closest, stop, stopIndex) => (
          Math.abs(stop.trackIndex - point.trackIndex) < Math.abs(stops[closest].trackIndex - point.trackIndex)
            ? stopIndex
            : closest
        ), 0);
        scrollToStop(nearestStop);
      });
      markerLayer.addLayer(marker);
    });
    (mapZoom >= 14 ? photoPoints : []).forEach(({ photo }) => {
      const marker = L.marker([photo.latitude as number, photo.longitude as number], {
        icon: L.divIcon({
          className: "trail-route-photo-marker-shell",
          html: photoMarkerHtml(),
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        keyboard: true,
        title: photo.title,
      });
      marker.on("click", () => onOpen(photos.indexOf(photo), [photo]));
      markerLayer.addLayer(marker);
    });
    visitedLine.setLatLngs(getVisitedTrack(route.track, breakpoints, routeProgress));
  }, [activeIndex, breakpoints, mapZoom, onOpen, photoPoints, photos, route, routeProgress, stops, visibleMapPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeStop) return;
    const segment = Math.min(Math.floor(routeProgress), stops.length - 2);
    const localProgress = Math.max(0, Math.min(1, routeProgress - segment));
    const nextStop = stops[Math.min(segment + 1, stops.length - 1)] ?? activeStop;
    const center: RouteCoordinate = [
      activeStop.coordinate[0] + (nextStop.coordinate[0] - activeStop.coordinate[0]) * localProgress,
      activeStop.coordinate[1] + (nextStop.coordinate[1] - activeStop.coordinate[1]) * localProgress,
    ];
    map.setView(center, route.focusZoom ?? 13, { animate: false });
  }, [activeStop, route.focusZoom, routeProgress, stops]);

  if (!stops.length) return null;

  return (
    <article className="trail-route-experiment">
      <header className="trail-route-hero">
        <div className="trail-route-hero__inner">
          <p className="trail-route-kicker">{route.kicker}</p>
          <h1>{route.title}{route.titleEmphasis ? <><br /><em>{route.titleEmphasis}</em></> : null}</h1>
          <p className="trail-route-hero__dek">{route.subtitle}</p>
          <div className="trail-route-stats" aria-label="Route summary">
            <span><strong>{route.stats.distance}</strong> km</span>
            <span><strong>{route.stats.duration}</strong> {route.stats.durationLabel ?? "moving time"}</span>
            <span><strong>{route.stats.ascent}</strong> m ascent</span>
          </div>
        </div>
        <a className="trail-route-back" href="/experiments">Back to lab ↗</a>
      </header>

      <div className="trail-route-intro-line">
        <span>{route.introLabel}</span>
        <span>{route.sourceLabel ?? "Scroll to move the route"}</span>
      </div>

      <div className="trail-route-body">
        <main className="trail-route-story" ref={storyElement}>
          {stops.map((stop, index) => {
            const primaryPhoto = stop.photos[0];
            return (
              <section
                className={`trail-route-chapter${activeIndex === index ? " is-active" : ""}`}
                data-route-index={index}
                key={stop.id}
                ref={(element) => { chapterRefs.current[index] = element; }}
              >
                <div className="trail-route-chapter__eyebrow"><span>{String(index + 1).padStart(2, "0")}</span>{stop.time ?? "—"} / {stop.distanceKm?.toFixed(1) ?? "—"} km</div>
                <h2>{stop.localTitle ?? stop.title}</h2>
                <p className="trail-route-chapter__place">{stop.title}</p>
                <p className="trail-route-chapter__note">{stop.note ?? "A recorded point along this route."}</p>
                <p className="trail-route-chapter__meta">Elevation {stop.elevationM ?? "—"} m{primaryPhoto ? ` · ${primaryPhoto.title}` : ""}</p>
                {!primaryPhoto && route.photoSelection === "gps" ? (
                  <p className="trail-route-chapter__photo-note">No EXIF GPS photograph is assigned to this stop yet.</p>
                ) : null}
                {primaryPhoto ? (
                  <figure>
                    <button type="button" onClick={() => onOpen(photos.indexOf(primaryPhoto), stop.photos)}>
                      <img
                        src={primaryPhoto.previewSrc ?? sizedImageUrl(primaryPhoto.src, 1200, 84)}
                        {...(primaryPhoto.previewSrc ? {} : { srcSet: imageSrcSet(primaryPhoto.src, [640, 900, 1200], 84) })}
                        sizes="(max-width: 900px) 100vw, 42vw"
                        alt={primaryPhoto.altText ?? primaryPhoto.title}
                        width={primaryPhoto.width}
                        height={primaryPhoto.height}
                        loading="lazy"
                        decoding="async"
                      />
                      <span>Open photograph ↗</span>
                    </button>
                    <figcaption>{stop.title} / {primaryPhoto.caption ?? primaryPhoto.title}</figcaption>
                    {stop.photos.length > 1 ? (
                      <div className="trail-route-photo-strip" aria-label={`${stop.title} photographs`}>
                        {stop.photos.map((photo) => (
                          <button type="button" key={photo.id} onClick={() => onOpen(photos.indexOf(photo), stop.photos)} aria-label={`Open ${photo.title}`}>
                            <img src={sizedImageUrl(photo.src, 180, 76)} alt="" width={photo.width} height={photo.height} loading="lazy" decoding="async" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </figure>
                ) : null}
              </section>
            );
          })}
        </main>

        <aside className="trail-route-map-panel" aria-label="Route map">
          <div className="trail-route-map-panel__map-wrap">
            <div className="trail-route-map-panel__map" ref={mapElement} />
            <div className="trail-route-map-panel__topline"><span>{route.title}</span><span>{String(activeIndex + 1).padStart(2, "0")} — {String(stops.length).padStart(2, "0")}</span></div>
            <div className="trail-route-map-panel__controls" aria-label="Map controls">
              <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in">+</button>
              <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out">−</button>
              <button type="button" onClick={() => mapRef.current?.fitBounds(route.bounds, { padding: [28, 28] })} aria-label="Show the complete route">◎</button>
            </div>
            <div className="trail-route-map-panel__current">
              <span>Current stop</span>
              <strong>{activeStop.title}</strong>
              <small>{activeStop.time ?? "—"} · {activeStop.elevationM ?? "—"} m · {activeStop.distanceKm?.toFixed(1) ?? "—"} km</small>
            </div>
          </div>
          <div className="trail-route-elevation" aria-label="Route elevation profile">
            <div className="trail-route-elevation__head"><span>Elevation / m</span><span>Start → finish</span></div>
            <svg viewBox="0 0 100 28" role="img" aria-label="Route elevation profile">
              <path d={profilePath} />
              <circle cx={profilePoint[0]} cy={profilePoint[1]} r="1.8" />
            </svg>
          </div>
          <div className="trail-route-map-panel__list">
            {stops.map((stop, index) => (
              <button type="button" className={activeIndex === index ? "is-active" : ""} key={stop.id} onClick={() => scrollToStop(index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stop.title}</strong>
                <small>{stop.time ?? "—"}</small>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <footer className="trail-route-footer"><span>{route.sourceLabel ?? "End of route study"}</span><a href="/photography">Return to the archive ↗</a></footer>
    </article>
  );
}
