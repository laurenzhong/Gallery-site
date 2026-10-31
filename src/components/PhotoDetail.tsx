import type { Photo } from "../data/photos";
import type { PhotoMeta, PhotoStory } from "../data/stories";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { storyPath } from "../lib/routes";

type PhotoDetailProps = {
  photo: Photo;
  photoMeta?: Record<string, PhotoMeta>;
  photoStories?: Record<string, PhotoStory[]>;
};

function DetailMetaRow({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === "") {
    return null;
  }

  return (
    <div className="detail-meta-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function PhotoDetail({ photo, photoMeta = {}, photoStories = {} }: PhotoDetailProps) {
  const meta = photoMeta[photo.filename];
  const stories = photoStories[photo.filename] ?? [];

  return (
    <article className="detail-page photo-detail-page">
      <header className="detail-hero">
        <p className="detail-kicker">{photo.category}</p>
        <h1>{photo.title}</h1>
      </header>

      <figure className="photo-detail-image">
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

      <section className="detail-grid" aria-label="Photo details">
        <div className="detail-copy">
          <p>{stories[0]?.excerpt ?? `${photo.category} / ${photo.filename}`}</p>
        </div>

        {meta ? (
          <dl className="detail-meta-list">
            <DetailMetaRow label="Date" value={meta.date} />
            <DetailMetaRow label="Location" value={meta.location} />
            <DetailMetaRow label="Camera" value={meta.camera} />
            <DetailMetaRow label="Lens" value={meta.lens} />
            <DetailMetaRow label="Aperture" value={meta.aperture} />
            <DetailMetaRow label="Shutter" value={meta.shutter} />
            <DetailMetaRow label="ISO" value={meta.iso} />
            <DetailMetaRow label="Focal Length" value={meta.focalLength} />
          </dl>
        ) : null}
      </section>

      {stories.length ? (
        <section className="detail-related" aria-labelledby="photo-stories-title">
          <h2 id="photo-stories-title">Stories</h2>
          <div className="detail-related-list">
            {stories.map((story, index) => (
              <a className="detail-related-link" key={`${story.title}-${index}`} href={storyPath(story, photo.slug)}>
                <span>{story.title}</span>
                <small>{story.excerpt}</small>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
