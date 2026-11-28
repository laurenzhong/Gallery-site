import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { Photo } from "../data/photos";
import type { PhotoStory } from "../data/stories";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { photoPath } from "../lib/routes";
import { internalPageHref } from "../lib/pageContentPages";

type StoryDetailProps = {
  photo: Photo;
  story: PhotoStory;
  onOpen: (photo: Photo, group: Photo[]) => void;
};

const storyComponents: PortableTextComponents = {
  types: {
    image: ({ value }) => value.src ? (
      <figure className="story-detail-inline-image">
        <img src={sizedImageUrl(value.src, 1400)} alt={value.alt ?? ""} width={value.width} height={value.height} loading="lazy" decoding="async" />
      </figure>
    ) : null,
  },
  marks: {
    link: ({ children, value }) => {
      const raw = typeof value?.href === "string" ? value.href : "";
      const href = internalPageHref(raw) ?? (/^(https?:\/\/|mailto:)/i.test(raw) ? raw : undefined);
      return href ? <a href={href}>{children}</a> : children;
    },
  },
};

export function StoryDetail({ photo, story, onOpen }: StoryDetailProps) {
  const relatedPhotos = [photo, ...(story.relatedPhotos ?? [])];
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
          alt={photo.altText || `${photo.category} ${photo.title}`}
          width={photo.width}
          height={photo.height}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </figure>

      <div className="story-detail-body">
        {story.richBody?.length ? <PortableText value={story.richBody} components={storyComponents} /> : story.body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      <footer className="detail-related">
        <h2>{relatedPhotos.length > 1 ? "Related Photos" : "Related Photo"}</h2>
        <div className="detail-related-list">
          {relatedPhotos.map((item) => (
            <a className="detail-related-link" href={photoPath(item)} key={item.id}
              onClick={(event) => {
                if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                event.currentTarget.focus({ preventScroll: true });
                onOpen(item, relatedPhotos);
              }}>
              <span>{item.title}</span>
              <small>{item.category} / {item.filename}</small>
            </a>
          ))}
        </div>
      </footer>
    </article>
  );
}
