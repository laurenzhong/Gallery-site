import type { Photo } from "../data/photos";
import { maclehoseSection2 } from "../data/routes/maclehoseSection2";
import { StoryRoutePage } from "./StoryRoutePage";

type TrailRouteExperimentProps = {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
};

export function TrailRouteExperiment({ photos, onOpen }: TrailRouteExperimentProps) {
  return <StoryRoutePage route={maclehoseSection2} photos={photos} onOpen={onOpen} />;
}
