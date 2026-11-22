import { useMemo } from "react";
import type { Photo } from "../data/photos";
import { maclehoseSection2 } from "../data/routes/maclehoseSection2";
import { useCmsMapRoutes } from "../lib/mapRoutes";
import { StoryRoutePage } from "./StoryRoutePage";

type TrailRouteExperimentProps = {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
};

export function TrailRouteExperiment({ photos, onOpen }: TrailRouteExperimentProps) {
  const cmsRoutes = useCmsMapRoutes();
  const requestedRouteId = useMemo(() => new URLSearchParams(window.location.search).get("route"), []);
  const route = cmsRoutes.find((candidate) => candidate.id === requestedRouteId) ?? maclehoseSection2;
  return <StoryRoutePage route={route} photos={photos} onOpen={onOpen} />;
}
