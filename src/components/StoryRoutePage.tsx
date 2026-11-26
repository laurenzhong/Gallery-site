import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import L, { type LayerGroup, type Map as LeafletMap, type Marker, type Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Photo } from "../data/photos";
import type { ResolvedStoryRouteStop, RouteCoordinate, StoryRoute } from "../data/storyRoutes";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { getRouteStopPhotoCoordinate, resolveRouteStopPhotos } from "../lib/routePhotos";
import { addMapBasemap } from "../lib/mapBasemap";
import { mapRouteHref } from "../lib/mapRoutes";
import { RouteStoryMinimap } from "./RouteStoryMinimap";

type StoryRoutePageProps = {
  route: StoryRoute;
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
  publicStory?: boolean;
  initialStopIndex?: number;
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
  if (breakpoints.length < 2) return track.slice(0, (breakpoints[0] ?? 0) + 1);
  const safeProgress = Math.max(0, Math.min(progress, breakpoints.length - 1));
  const segment = Math.min(Math.floor(safeProgress), breakpoints.length - 2);
  const localProgress = safeProgress - segment;
  const start = Math.max(0, Math.min(track.length - 1, breakpoints[segment]));
  const end = Math.max(0, Math.min(track.length - 1, breakpoints[segment + 1]));
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

export function StoryRoutePage({ route, photos, onOpen, publicStory = false, initialStopIndex = -1 }: StoryRoutePageProps) {
  const stops = useMemo(() => resolveStops(route, photos), [photos, route]);
  const mapElement = useRef<HTMLDivElement | null>(null);
  const storyElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup<Marker> | null>(null);
  const visitedLineRef = useRef<Polyline | null>(null);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);
  const anchoredChapter = useRef(initialStopIndex);
  const [routeProgress, setRouteProgress] = useState(Math.max(0, initialStopIndex));
  const [mapZoom, setMapZoom] = useState(13);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const activeIndex = Math.min(Math.max(0, stops.length - 1), Math.floor(routeProgress));
  const activeStop = stops[activeIndex] ?? stops[0];
  const mapReturnHref = publicStory ? mapRouteHref(route.id, activeStop?.id) : undefined;
  const breakpoints = useMemo(() => route.stops.map((stop) => stop.trackIndex), [route]);
  const visitedTrack = useMemo(() => getVisitedTrack(route.track, breakpoints, routeProgress), [breakpoints, route.track, routeProgress]);
  const profilePath = useMemo(() => elevationPath(stops), [stops]);
  const profilePoint = useMemo(() => elevationPoint(stops, activeIndex), [activeIndex, stops]);
  const mapPoints = useMemo(() => route.points ?? [], [route]);
  const visibleMapPoints = useMemo(() => (mapZoom >= 14 ? mapPoints : []), [mapPoints, mapZoom]);
  const photoPoints = useMemo(
    () => stops.flatMap((stop) => stop.photos.filter((photo) => Number.isFinite(photo.latitude) && Number.isFinite(photo.longitude)).map((photo) => ({ photo }))),
    [stops],
  );
  const hasElevationProfile = stops.length > 1 && stops.every((stop) => stop.elevationM !== undefined);

  const scrollToStop = useCallback((index: number) => {
    const chapter = chapterRefs.current[index];
    if (!chapter) return;
    anchoredChapter.current = index;
    setRouteProgress(index);
    if (publicStory) {
      const url = new URL(window.location.href);
      url.searchParams.set("stop", route.stops[index].id);
      window.history.replaceState(window.history.state, "", url);
    }
    chapter.focus({ preventScroll: true });
    chapter.scrollIntoView({ behavior: "instant", block: "start" });
  }, [publicStory, route.stops]);

  useLayoutEffect(() => {
    if (initialStopIndex < 0) return;
    anchoredChapter.current = initialStopIndex;
    const chapter = chapterRefs.current[initialStopIndex];
    chapter?.focus({ preventScroll: true });
  }, [initialStopIndex]);

  useLayoutEffect(() => {
    // Gallery photos can arrive after the route and change the heights of earlier chapters.
    chapterRefs.current[anchoredChapter.current]?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [initialStopIndex, photos, route]);

  useEffect(() => {
    const releaseChapter = () => { anchoredChapter.current = -1; };
    const events = ["pointerdown", "touchmove", "wheel", "keydown"];
    for (const event of events) window.addEventListener(event, releaseChapter, { capture: true, passive: true });
    return () => {
      for (const event of events) window.removeEventListener(event, releaseChapter, true);
    };
  }, []);

  const fitRoute = useCallback(() => {
    mapRef.current?.fitBounds(route.bounds, { padding: [28, 28], animate: false });
  }, [route.bounds]);

  useEffect(() => {
    const story = storyElement.current;
    const sections = story ? Array.from(story.querySelectorAll<HTMLElement>(".trail-route-chapter")) : [];
    if (!sections.length) return undefined;
    const mobile = window.matchMedia("(max-width: 980px)");
    let frame = 0;
    let lastProgress = -1;
    const measure = () => {
      const compact = publicStory && mobile.matches;
      const focusY = compact ? window.innerHeight * 0.36 : 56;
      const anchor = compact ? sections[anchoredChapter.current] : undefined;
      const atAnchor = anchor && Math.abs(anchor.getBoundingClientRect().top - parseFloat(getComputedStyle(anchor).scrollMarginTop)) < 2;
      let nextProgress = 0;
      if (atAnchor) {
        nextProgress = anchoredChapter.current;
      } else {
        for (const [index, section] of sections.entries()) {
          const rect = section.getBoundingClientRect();
          if (rect.top > focusY) break;
          nextProgress = index + Math.min(0.999, (focusY - rect.top) / Math.max(1, rect.height));
        }
      }
      nextProgress = Math.min(nextProgress, sections.length - 1);
      if (Math.floor(lastProgress) !== Math.floor(nextProgress) || Math.abs(lastProgress - nextProgress) >= 0.012) {
        lastProgress = nextProgress;
        setRouteProgress(nextProgress);
      }
    };
    const updateFromScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; measure(); });
    };
    const updateCompactLayout = () => {
      setShowMinimap(publicStory && mobile.matches);
      updateFromScroll();
    };
    setShowMinimap(publicStory && mobile.matches);
    measure();
    window.addEventListener("scroll", updateFromScroll, { passive: true });
    window.addEventListener("resize", updateFromScroll);
    mobile.addEventListener("change", updateCompactLayout);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateFromScroll) : null;
    observer?.observe(document.body);
    return () => {
      window.removeEventListener("scroll", updateFromScroll);
      window.removeEventListener("resize", updateFromScroll);
      mobile.removeEventListener("change", updateCompactLayout);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [publicStory, route.stops]);

  useEffect(() => {
    const element = mapElement.current;
    if (!element || mapRef.current || !route.stops.length) return undefined;
    const map = L.map(element, {
      zoomControl: false,
      scrollWheelZoom: false,
      minZoom: 8,
      maxZoom: 18,
      maxBounds: route.bounds,
      maxBoundsViscosity: 0.7,
    });
    mapRef.current = map;
    let wasVisible = element.clientWidth > 0 && element.clientHeight > 0;
    if (wasVisible) fitRoute();
    else map.setView(route.stops[0].coordinate, route.focusZoom ?? 13, { animate: false });
    addMapBasemap(map);
    L.polyline(route.track, {
      className: "trail-route-track",
      color: "#37564f",
      weight: 4,
      opacity: 0.85,
      interactive: false,
    }).addTo(map);
    visitedLineRef.current = L.polyline([], {
      className: "trail-route-track--visited",
      color: "#b6424b",
      weight: 4,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    const onZoomEnd = () => setMapZoom(map.getZoom());
    map.on("zoomend", onZoomEnd);
    setMapZoom(map.getZoom());
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      const visible = element.clientWidth > 0 && element.clientHeight > 0;
      if (visible) {
        map.invalidateSize({ pan: false });
        if (!wasVisible) fitRoute();
      }
      wasVisible = visible;
    });
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      map.off("zoomend", onZoomEnd);
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      visitedLineRef.current = null;
    };
  }, [fitRoute, route]);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    if (!markerLayer) return;
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
      marker.getElement()?.setAttribute("aria-label", `${String(index + 1).padStart(2, "0")} ${stop.title}`);
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
  }, [activeIndex, mapZoom, onOpen, photoPoints, photos, scrollToStop, stops, visibleMapPoints]);

  useEffect(() => {
    visitedLineRef.current?.setLatLngs(visitedTrack);
  }, [route, visitedTrack]);

  if (!stops.length) return null;

  const activePhoto = activeStop.photos[0];
  const photoCoordinate = showMinimap ? getRouteStopPhotoCoordinate(route, activeIndex, activePhoto) : undefined;
  const currentStop = (
    <div className="trail-route-map-panel__current">
      <span>Stop {activeIndex + 1} of {stops.length}</span>
      <strong>{activeStop.title}</strong>
      <small>{[
        activeStop.time,
        activeStop.elevationM === undefined ? undefined : `${activeStop.elevationM} m`,
        activeStop.distanceKm === undefined ? undefined : `${activeStop.distanceKm.toFixed(1)} km`,
      ].filter(Boolean).join(" · ")}</small>
    </div>
  );

  return (
    <article className={`trail-route-experiment${publicStory ? " trail-route-experiment--public" : ""}`}>
      <header className="trail-route-summary">
        <div>
          {route.locationLabel && <p className="trail-route-summary__location">{route.locationLabel}</p>}
          <h1>{route.name ?? [route.title, route.titleEmphasis].filter(Boolean).join(" ")}</h1>
          <div className="trail-route-stats" aria-label="Route summary">
            {route.stats.distance !== "—" && <span><strong>{route.stats.distance}</strong> km</span>}
            {route.stats.duration !== "—" && <span><strong>{route.stats.duration}</strong> {route.stats.durationLabel ?? "moving time"}</span>}
            {route.stats.ascent !== "—" && <span><strong>{route.stats.ascent}</strong> m ascent</span>}
          </div>
        </div>
        <nav className="trail-route-toolbar" aria-label="Route story navigation">
          <a href={mapReturnHref ?? "/experiments"}>{publicStory ? "← Back to map" : "← Back to lab"}</a>
          <button type="button" className="trail-route-map-toggle" aria-expanded={mapExpanded} aria-controls="walking-route-map"
            onClick={() => setMapExpanded((open) => !open)}>{mapExpanded ? "Hide map & stops" : "Map & stops"}</button>
        </nav>
      </header>

      <div className="trail-route-body">
        <aside id="walking-route-map" className={`trail-route-map-panel${mapExpanded ? " is-expanded" : ""}`} aria-label="Route map and stops">
          <div className="trail-route-map-panel__map-wrap">
            <div className="trail-route-map-panel__map" ref={mapElement} />
            <div className="trail-route-map-panel__controls" aria-label="Map controls">
              <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in">+</button>
              <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out">−</button>
              <button type="button" onClick={fitRoute} aria-label="Show the complete route">◎</button>
            </div>
          </div>
          {currentStop}
          {hasElevationProfile && <div className="trail-route-elevation">
            <div className="trail-route-elevation__head"><span>Elevation / m</span><span>Start → finish</span></div>
            <svg viewBox="0 0 100 28" role="img" aria-label="Route elevation profile">
              <path d={profilePath} />
              <circle cx={profilePoint[0]} cy={profilePoint[1]} r="1.8" />
            </svg>
          </div>}
          <nav className="trail-route-map-panel__list" aria-label="Route stops">
            {stops.map((stop, index) => (
              <button type="button" className={activeIndex === index ? "is-active" : ""} key={stop.id} onClick={() => scrollToStop(index)}
                aria-current={activeIndex === index ? "location" : undefined}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stop.title}</strong>
                <small>{stop.time}</small>
              </button>
            ))}
          </nav>
        </aside>

        <div className="trail-route-story" ref={storyElement}>
          {stops.map((stop, index) => {
            const primaryPhoto = stop.photos[0];
            const stationMetrics = [stop.time, stop.distanceKm === undefined ? undefined : `${stop.distanceKm.toFixed(1)} km`].filter(Boolean);
            return (
              <section
                className={`trail-route-chapter${activeIndex === index ? " is-active" : ""}`}
                data-route-index={index}
                key={stop.id}
                ref={(element) => { chapterRefs.current[index] = element; }}
                tabIndex={-1}
                aria-labelledby={`route-stop-${index}`}
              >
                <div className="trail-route-chapter__eyebrow"><span>{String(index + 1).padStart(2, "0")}</span>{stationMetrics.join(" / ")}</div>
                <h2 id={`route-stop-${index}`}>{stop.localTitle ?? stop.title}</h2>
                {stop.localTitle && stop.localTitle !== stop.title && <p className="trail-route-chapter__place">{stop.title}</p>}
                {stop.note && <p className="trail-route-chapter__note">{stop.note}</p>}
                {(stop.elevationM !== undefined || primaryPhoto) && <p className="trail-route-chapter__meta">
                  {[stop.elevationM === undefined ? undefined : `Elevation ${stop.elevationM} m`, primaryPhoto?.title].filter(Boolean).join(" · ")}
                </p>}
                {primaryPhoto ? (
                  <figure>
                    <button type="button" onClick={() => onOpen(photos.indexOf(primaryPhoto), stop.photos)}>
                      <img
                        src={primaryPhoto.previewSrc ?? sizedImageUrl(primaryPhoto.src, 1200, 84)}
                        {...(primaryPhoto.previewSrc ? {} : { srcSet: imageSrcSet(primaryPhoto.src, [640, 900, 1200], 84) })}
                        sizes="(max-width: 980px) 100vw, 42vw"
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
        </div>
        {showMinimap && (
          <RouteStoryMinimap
            route={route}
            visitedTrack={visitedTrack}
            coordinate={photoCoordinate ?? activeStop.coordinate}
            locationLabel={photoCoordinate ? activePhoto.title : activeStop.title}
          />
        )}
      </div>

      <footer className="trail-route-footer">
        <a href={mapReturnHref ?? "/photography"}>{mapReturnHref ? "← Back to map" : "Return to the archive ↗"}</a>
      </footer>
    </article>
  );
}
