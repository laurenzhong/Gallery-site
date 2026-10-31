import type { Photo } from "../data/photos";
import type { PhotoStory } from "../data/stories";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { photoPath } from "../lib/routes";

type StoryDetailProps = {
  photo: Photo;
  story: PhotoStory;
};

export function StoryDetail({ photo, story }: StoryDetailProps) {
  return (
    <article className="detail-page story-detail-page">
      <header className="detail-hero">
        <p className="detail-kicker">{photo.category} / {photo.filename}</p>
        <h1>{story.title}</h1>
        {story.excerpt ? <p className="detail-lede">{story.excerpt}</p> : null}
      </header>

      <figure className="story-detail-cover">
        <img
          src={sizedImageUrl(photo.src, 2200, 88)}
          srcSet={imageSrcSet(photo.src, [1000, 1600, 2400], 88)}
          sizes="100vw"
          alt={`${photo.category} ${photo.title}`}
          width={photo.width}
          height={photo.height}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </figure>

      <div className="story-detail-body">
        {story.body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      <footer className="detail-related">
        <h2>Related Photo</h2>
        <a className="detail-related-link" href={photoPath(photo)}>
          <span>{photo.title}</span>
          <small>{photo.category} / {photo.filename}</small>
        </a>
      </footer>
    </article>
  );
}
