import { useMemo, useState } from "react";
import type { Photo } from "../data/photos";
import { storyRoutes } from "../data/routes";
import type { StoryRoute } from "../data/storyRoutes";
import { useCmsMapRoutes } from "../lib/mapRoutes";
import { PhotoMapExperiment } from "./PhotoMapExperiment";

type MapHubDemoProps = {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
};

type MapMode = "photos" | "routes";

function routeLabel(route: StoryRoute) {
  return `${route.title}${route.titleEmphasis ? ` ${route.titleEmphasis}` : ""}`;
}

function routeHref(route: StoryRoute) {
  if (route.id === "maclehose-section-2") return "/experiments/trail-route";
  if (route.id === "gpx-trail-demo") return "/experiments/trail-route-gpx-demo";
  return "/experiments/trail-route";
}

export function MapHubDemo({ photos, onOpen }: MapHubDemoProps) {
  const cmsRoutes = useCmsMapRoutes();
  const [mode, setMode] = useState<MapMode>(() => (
    new URLSearchParams(window.location.search).get("mode") === "routes" ? "routes" : "photos"
  ));
  const routes = useMemo(() => {
    const cmsRouteIds = new Set(cmsRoutes.map((route) => route.id));
    return [...storyRoutes.filter((route) => !cmsRouteIds.has(route.id)), ...cmsRoutes];
  }, [cmsRoutes]);
  const gpsCount = photos.filter((photo) => Number.isFinite(photo.latitude) && Number.isFinite(photo.longitude)).length;
  const placeCount = new Set(photos.map((photo) => photo.category)).size;

  const changeMode = (nextMode: MapMode) => {
    setMode(nextMode);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("mode", nextMode);
    window.history.replaceState({}, "", `${nextUrl.pathname}?${nextUrl.searchParams.toString()}`);
  };

  return (
    <article className="map-hub-demo">
      <header className="map-hub-demo__hero">
        <div>
          <p className="map-hub-demo__eyebrow">Archive index / local demo</p>
          <h1>Every photograph<br /><em>has a place.</em></h1>
          <p className="map-hub-demo__dek">
            A shared map for the photo archive and the walks that connect it. Start with an image, or follow a route from one field note to the next.
          </p>
        </div>
        <div className="map-hub-demo__hero-meta" aria-label="Map archive summary">
          <span>Map index</span>
          <strong>{photos.length.toString().padStart(2, "0")}</strong>
          <small>field notes in the local archive</small>
        </div>
      </header>

      <nav className="map-hub-demo__tabs" aria-label="Map views" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "photos"} className={mode === "photos" ? "is-active" : ""} onClick={() => changeMode("photos")}>
          <span>01</span>
          <strong>Photo map</strong>
          <small>{placeCount} places · {gpsCount} GPS points</small>
        </button>
        <button type="button" role="tab" aria-selected={mode === "routes"} className={mode === "routes" ? "is-active" : ""} onClick={() => changeMode("routes")}>
          <span>02</span>
          <strong>Route stories</strong>
          <small>{routes.length} connected walks</small>
        </button>
      </nav>

      <section className="map-hub-demo__workspace" aria-label={mode === "photos" ? "Photo map" : "Route stories map"}>
        <div className="map-hub-demo__map-column">
          <div className="map-hub-demo__map-label">
            <span>{mode === "photos" ? "Archive / field map" : "Routes / field records"}</span>
            <small>Esri · CMS archive + walking routes</small>
          </div>
          <div className="map-hub-demo__map-frame">
            <PhotoMapExperiment photos={photos} onOpen={onOpen} compact />
          </div>
        </div>

        <aside className="map-hub-demo__sidebar">
          {mode === "photos" ? (
            <>
              <div className="map-hub-demo__sidebar-heading">
                <p className="map-hub-demo__eyebrow">Browse by place</p>
                <h2>Field notes<br /><em>in place.</em></h2>
              </div>
              <div className="map-hub-demo__stats">
                <div><strong>{photos.length}</strong><span>photos</span></div>
                <div><strong>{gpsCount}</strong><span>with GPS</span></div>
                <div><strong>{placeCount}</strong><span>places</span></div>
              </div>
              <p className="map-hub-demo__copy">Select a pin to open the photograph. Pins without GPS stay grouped as approximate locations until they are curated.</p>
              <a className="map-hub-demo__text-link" href="/photography">Open the full archive <span aria-hidden="true">↗</span></a>
            </>
          ) : (
            <>
              <div className="map-hub-demo__sidebar-heading">
                <p className="map-hub-demo__eyebrow">Follow a route</p>
                <h2>Walk the line<br /><em>between images.</em></h2>
              </div>
              <div className="map-hub-demo__route-list">
                {routes.map((route, index) => (
                  <a className="map-hub-demo__route-card" href={routeHref(route)} key={route.id}>
                    <span className="map-hub-demo__route-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="map-hub-demo__route-copy">
                      <strong>{routeLabel(route)}</strong>
                      <small>{route.stats.distance} km · {route.stops.length} stops</small>
                    </span>
                    <span className="map-hub-demo__route-arrow" aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
              <p className="map-hub-demo__copy">Each route keeps its own rhythm: a track, a sequence of stops, an elevation profile, and the photographs made along the way.</p>
            </>
          )}
        </aside>
      </section>

      <footer className="map-hub-demo__footer-note">
        <span>Local design demo · /map</span>
        <span>Map is an archive index, route pages remain editorial stories.</span>
      </footer>
    </article>
  );
}
