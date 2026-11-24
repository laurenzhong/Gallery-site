import { MapPin, Route } from "lucide-react";
import { useCallback, useState } from "react";
import type { Photo } from "../data/photos";
import { useMapRoutes } from "../lib/mapRoutes";
import { PhotoMapCanvas } from "./PhotoMapExperiment";
import "./fieldAtlas.css";

type MapMode = "photos" | "routes";

export function MapHubDemo({ photos, onOpen, publishedDataStatus }: {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
  publishedDataStatus?: "loading" | "error";
}) {
  const [mode, setMode] = useState<MapMode>(() => {
    const query = new URLSearchParams(window.location.search);
    return query.get("mode") === "routes" || (!query.has("mode") && query.has("map-route")) ? "routes" : "photos";
  });

  const routes = useMapRoutes(true);
  const changeMode = useCallback((next: MapMode) => {
    setMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    window.history.replaceState({}, "", url);
  }, []);
  const focusRoutes = useCallback(() => changeMode("routes"), [changeMode]);

  return (
    <article className="map-hub-demo">
      <header className="map-hub-demo__hero">
        <h1>Field atlas</h1>
        <nav id="map-views" className="map-hub-demo__tabs" aria-label="Map views">
          <button type="button" aria-pressed={mode === "photos"} onClick={() => changeMode("photos")}>
            <MapPin size={16} aria-hidden="true" />
            Photo map
          </button>
          <button type="button" aria-pressed={mode === "routes"} onClick={() => changeMode("routes")}>
            <Route size={16} aria-hidden="true" />
            Route stories
          </button>
        </nav>
      </header>

      {publishedDataStatus ? <section className="atlas-card" aria-live="polite">
        <p>{publishedDataStatus === "loading" ? "Loading the published map…" : "The published map could not be loaded."}</p>
        {publishedDataStatus === "error" && <a href={window.location.href}>Reload map</a>}
      </section> : <PhotoMapCanvas routes={routes} onRouteFocus={focusRoutes} photos={photos} onOpen={onOpen} compact atlas showRoutesOnly={mode === "routes"} />}

    </article>
  );
}
