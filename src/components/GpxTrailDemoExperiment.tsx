import type { Photo } from "../data/photos";
import { gpxTrailDemo } from "../data/routes/gpxTrailDemo";
import { StoryRoutePage } from "./StoryRoutePage";

type GpxTrailDemoExperimentProps = {
  photos: Photo[];
  onOpen: (index: number, photos?: Photo[]) => void;
};

export function GpxTrailDemoExperiment({ photos, onOpen }: GpxTrailDemoExperimentProps) {
  return <StoryRoutePage route={gpxTrailDemo} photos={photos} onOpen={onOpen} />;
}
