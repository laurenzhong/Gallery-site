import { useState } from "react";
import type { Photo } from "../data/photos";
import { storyRoutes } from "../data/routes";
import { maclehoseSection2 } from "../data/routes/maclehoseSection2";
import { mapRouteHref, useCmsMapRoutes } from "../lib/mapRoutes";
import { isSanityConfigured } from "../lib/sanity";
import { StoryRoutePage } from "./StoryRoutePage";

type TrailRouteExperimentProps = {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
  publicStory?: boolean;
};

export function TrailRouteExperiment({ photos, onOpen, publicStory = false }: TrailRouteExperimentProps) {
  const { routes, status, retry } = useCmsMapRoutes();
  const [query] = useState(() => new URLSearchParams(window.location.search));
  const requestedRouteId = query.get("route");
  const requestedStopId = query.get("stop");
  const availableRoutes = publicStory && !isSanityConfigured() ? storyRoutes : routes;
  const publishedRoute = availableRoutes.find((candidate) => candidate.id === requestedRouteId);
  const route = publishedRoute ?? (publicStory ? undefined : maclehoseSection2);
  if (!route) {
    return <article className="trail-route-experiment">
      <header className="trail-route-summary trail-route-summary--status">
        <div className="trail-route-status">
          <h1>Route story</h1>
          <p role="status">{status === "loading" ? "Loading route story…" : status === "error" ? "This route story could not be loaded." : "That route story is unavailable."}</p>
          {status === "error" && <button type="button" onClick={retry}>Retry</button>}
        </div>
        <nav className="trail-route-toolbar" aria-label="Route story navigation">
          <a href={mapRouteHref(requestedRouteId ?? undefined, requestedStopId ?? undefined)}>← Back to map</a>
        </nav>
      </header>
    </article>;
  }
  const initialStopIndex = requestedStopId ? route.stops.findIndex((stop) => stop.id === requestedStopId) : -1;
  return <StoryRoutePage key={route.id} route={route} photos={photos} onOpen={onOpen}
    publicStory={publicStory} initialStopIndex={initialStopIndex} />;
}
