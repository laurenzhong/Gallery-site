import type { Photo } from "../data/photos";
import type { PhotoStory } from "../data/stories";
import { JournalSection } from "./PhotoStory";

type JournalProps = {
  loading: boolean;
  failed?: boolean;
  photos: Photo[];
  photoStories?: Record<string, PhotoStory[]>;
};

export function Journal({ photos, photoStories, loading, failed }: JournalProps) {
  return (
    <article className="story-page journal-page">
      {failed ? <p role="status">Stories could not be loaded. <a href="/journal">Try again</a></p> :
        loading ? <div className="journal-loading" role="status"><span className="sr-only">Loading stories…</span></div> :
        <JournalSection photos={photos} photoStories={photoStories} showHeading={false} directory />}
    </article>
  );
}
