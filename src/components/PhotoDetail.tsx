import type { Photo } from "../data/photos";
import { photoStories as staticPhotoStories, type PhotoMeta, type PhotoStory } from "../data/stories";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { storyPath } from "../lib/routes";
import { useSiteCopy } from "../lib/siteCopyContext";

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
  const copy = useSiteCopy();
  const meta = photoMeta[photo.filename];
  const stories = photoStories[photo.id] ?? photoStories[photo.filename] ?? staticPhotoStories[photo.filename] ?? [];

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
          alt={photo.altText ?? `${photo.category} ${photo.title}`}
          width={photo.width}
          height={photo.height}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        {photo.caption || photo.credit ? (
          <figcaption>
            {photo.caption ? <span>{photo.caption}</span> : null}
            {photo.credit ? <small>{photo.credit}</small> : null}
          </figcaption>
        ) : null}
      </figure>

      <section className="detail-grid" aria-label={copy.sections.photoDetails}>
        <div className="detail-copy">
          <p>{stories[0]?.excerpt ?? `${photo.category} / ${photo.filename}`}</p>
        </div>

        {meta ? (
          <dl className="detail-meta-list">
            <DetailMetaRow label={copy.metadata.date} value={meta.date} />
            <DetailMetaRow label={copy.metadata.location} value={meta.location} />
            <DetailMetaRow label={copy.metadata.camera} value={meta.camera} />
            <DetailMetaRow label={copy.metadata.lens} value={meta.lens} />
            <DetailMetaRow label={copy.metadata.aperture} value={meta.aperture} />
            <DetailMetaRow label={copy.metadata.shutter} value={meta.shutter} />
            <DetailMetaRow label={copy.metadata.iso} value={meta.iso} />
            <DetailMetaRow label={copy.metadata.focalLength} value={meta.focalLength} />
          </dl>
        ) : null}
      </section>

      {stories.length ? (
        <section className="detail-related" aria-labelledby="photo-stories-title">
          <h2 id="photo-stories-title">{copy.sections.stories}</h2>
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
