import type { Photo } from "../data/photos";
import type { PhotoStory } from "../data/stories";
import { JournalSection } from "./PhotoStory";

type JournalProps = {
  photos: Photo[];
  photoStories?: Record<string, PhotoStory[]>;
};

export function Journal({ photos, photoStories }: JournalProps) {
  return (
    <article className="story-page journal-page">
      <JournalSection photos={photos} photoStories={photoStories} showHeading={false} />
    </article>
  );
}
