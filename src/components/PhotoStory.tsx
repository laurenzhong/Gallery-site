import type { Photo } from "../data/photos";
import {
  aboutData as staticAboutData,
  photoMeta as staticPhotoMeta,
  photoStories as staticPhotoStories,
  type AboutData,
  type PhotoMeta,
  type PhotoStory as PhotoStoryData,
} from "../data/stories";
import { photoPath, storyPath } from "../lib/routes";
import { useSiteCopy } from "../lib/siteCopyContext";
import { PortableTextContent } from "./PortableTextContent";

type PhotoStoryProps = {
  photos: Photo[];
  photoMeta?: Record<string, PhotoMeta>;
  photoStories?: Record<string, PhotoStoryData[]>;
  aboutData?: AboutData;
};

function findPhoto(photos: Photo[], filename: string): Photo | undefined {
  return photos.find((photo) => photo.filename === filename);
}

function MetaRow({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === "") {
    return null;
  }

  return (
    <div className="story-meta-row">
      <span className="story-meta-label">{label}</span>
      <span className="story-meta-value">{value}</span>
    </div>
  );
}

function MetaCard({ photo, meta }: { photo: Photo; meta: PhotoMeta }) {
  const copy = useSiteCopy();
  return (
    <article className="story-meta-card">
      <div className="story-meta-photo">
        <img src={photo.src} alt={photo.altText ?? `${photo.category} ${photo.title}`} loading="lazy" decoding="async" />
      </div>
      <div className="story-meta-body">
        <h3 className="story-meta-title">{photo.title}</h3>
        <p className="story-meta-subtitle">{meta.location ?? photo.category}</p>
        <dl className="story-meta-list">
          <MetaRow label={copy.metadata.date} value={meta.date} />
          <MetaRow label={copy.metadata.camera} value={meta.camera} />
          <MetaRow label={copy.metadata.lens} value={meta.lens} />
          <MetaRow label={copy.metadata.aperture} value={meta.aperture} />
          <MetaRow label={copy.metadata.shutter} value={meta.shutter} />
          <MetaRow label={copy.metadata.iso} value={meta.iso} />
          <MetaRow label={copy.metadata.focalLength} value={meta.focalLength} />
        </dl>
      </div>
    </article>
  );
}

function StoryEntry({
  photo,
  story,
  align,
}: {
  photo: Photo;
  story: PhotoStoryData;
  align: "left" | "right";
}) {
  return (
    <article className={`story-entry story-entry--${align}`}>
      <div className="story-entry-photo">
        <img src={photo.src} alt={photo.altText ?? `${photo.category} ${photo.title}`} loading="lazy" decoding="async" />
      </div>
      <div className="story-entry-body">
        <p className="story-entry-kicker">{photo.category} · {photo.filename}</p>
        <h2 className="story-entry-title">
          <a href={storyPath(story, photo.slug)}>{story.title}</a>
        </h2>
        <p className="story-entry-excerpt">{story.excerpt}</p>
        <div className="story-entry-rich-body">
          <PortableTextContent blocks={story.bodyBlocks} fallback={story.body} />
        </div>
      </div>
    </article>
  );
}

function storyTime(story: PhotoStoryData) {
  const time = story.publishedAt ? Date.parse(story.publishedAt) : 0;
  return Number.isNaN(time) ? 0 : time;
}

function compareStories(a: PhotoStoryData, b: PhotoStoryData) {
  if (a.orderRank && b.orderRank && a.orderRank !== b.orderRank) {
    return a.orderRank.localeCompare(b.orderRank);
  }

  if (a.orderRank !== b.orderRank) {
    return a.orderRank ? -1 : 1;
  }

  if (a.isPinned !== b.isPinned) {
    return a.isPinned ? -1 : 1;
  }

  if (a.isPinned && b.isPinned) {
    return (a.pinOrder ?? 100) - (b.pinOrder ?? 100) || storyTime(b) - storyTime(a);
  }

  return storyTime(b) - storyTime(a);
}

export function AboutSection({ aboutData = staticAboutData }: { aboutData?: AboutData }) {
  const copy = useSiteCopy();
  return (
    <section className="story-section story-about" aria-labelledby="story-about-title">
      <div className="story-section-head">
        <span className="story-section-kicker">{copy.sections.about}</span>
        <h1 id="story-about-title">{copy.pages.photostoryAboutTitle}</h1>
      </div>

      <div className="story-about-grid">
        <div className="story-about-bio">
          <p className="story-about-name">{aboutData.name}</p>
          <p className="story-about-location">{aboutData.location}</p>
          {aboutData.bio.map((line, index) => (
            <p key={index} className="story-about-line">{line}</p>
          ))}
        </div>

        <aside className="story-about-side">
          <div className="story-about-block">
            <h2 className="story-about-block-title">{copy.sections.gear}</h2>
            <dl className="story-about-list">
              {aboutData.gear.map((item) => (
                <div key={item.name} className="story-about-list-row">
                  <dt>{item.name}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="story-about-block">
            <h2 className="story-about-block-title">{copy.sections.contactDetails}</h2>
            <dl className="story-about-list">
              {aboutData.contact.map((item) => (
                <div key={item.label} className="story-about-list-row">
                  <dt>{item.label}</dt>
                  <dd>
                    <a href={item.href}>{item.value}</a>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}

export function MetadataSection({ photos, photoMeta = staticPhotoMeta }: PhotoStoryProps) {
  const copy = useSiteCopy();
  const metaEntries = Object.entries(photoMeta)
    .map(([filename, meta]) => {
      const photo = findPhoto(photos, filename);
      return photo ? { photo, meta } : null;
    })
    .filter((entry): entry is { photo: Photo; meta: PhotoMeta } => entry !== null);

  return (
    <section className="story-section story-meta-section" aria-labelledby="story-meta-title">
      <div className="story-section-head">
          <span className="story-section-kicker">{copy.sections.metadata}</span>
        <h1 id="story-meta-title">{copy.pages.photostoryMetadataTitle}</h1>
        <p className="story-section-sub">{copy.pages.photostoryMetadataDescription}</p>
      </div>

      <div className="story-meta-grid">
        {metaEntries.map(({ photo, meta }) => (
          <a className="story-meta-card-link" key={photo.id} href={photoPath(photo)}>
            <MetaCard photo={photo} meta={meta} />
          </a>
        ))}
      </div>
    </section>
  );
}

export function JournalSection({ photos, photoStories = staticPhotoStories }: PhotoStoryProps) {
  const copy = useSiteCopy();
  const storyEntries = Object.entries(photoStories)
    .flatMap(([filename, storyList]) => {
      const photo = findPhoto(photos, filename);
      if (!photo) return [];
      return storyList.map((story) => ({ photo, story }));
    })
    .filter((entry): entry is { photo: Photo; story: PhotoStoryData } => entry !== null)
    .sort((a, b) => compareStories(a.story, b.story));

  return (
    <section className="story-section story-entries-section" aria-labelledby="story-entries-title">
      <div className="story-section-head">
        <span className="story-section-kicker">{copy.sections.stories}</span>
        <h1 id="story-entries-title">{copy.pages.photostoryJournalTitle}</h1>
        <p className="story-section-sub">{copy.pages.photostoryJournalDescription}</p>
      </div>

      <div className="story-entries">
        {storyEntries.map(({ photo, story }, index) => (
          <StoryEntry
            key={`${photo.id}-${story.title}`}
            photo={photo}
            story={story}
            align={index % 2 === 0 ? "left" : "right"}
          />
        ))}
      </div>
    </section>
  );
}

export function PhotoStory({
  photos,
  photoMeta = staticPhotoMeta,
  photoStories = staticPhotoStories,
  aboutData = staticAboutData,
}: PhotoStoryProps) {
  const showPreview = new URLSearchParams(window.location.search).has("preview");
  const copy = useSiteCopy();

  return (
    <article className="story-page">
      {showPreview && (
        <div className="story-banner" role="note">
          <span className="story-banner-tag">{copy.pages.previewBannerTag}</span>
          <p>{copy.pages.previewBannerText}</p>
        </div>
      )}

      <AboutSection aboutData={aboutData} />
      <MetadataSection photos={photos} photoMeta={photoMeta} />
      <JournalSection photos={photos} photoStories={photoStories} />
    </article>
  );
}
