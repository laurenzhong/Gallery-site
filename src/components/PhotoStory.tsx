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
  return (
    <article className="story-meta-card">
      <div className="story-meta-photo">
        <img src={photo.src} alt={`${photo.category} ${photo.title}`} loading="lazy" decoding="async" />
      </div>
      <div className="story-meta-body">
        <h3 className="story-meta-title">{photo.title}</h3>
        <p className="story-meta-subtitle">{meta.location ?? photo.category}</p>
        <dl className="story-meta-list">
          <MetaRow label="日期" value={meta.date} />
          <MetaRow label="相机" value={meta.camera} />
          <MetaRow label="镜头" value={meta.lens} />
          <MetaRow label="光圈" value={meta.aperture} />
          <MetaRow label="快门" value={meta.shutter} />
          <MetaRow label="ISO" value={meta.iso} />
          <MetaRow label="焦距" value={meta.focalLength} />
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
        <img src={photo.src} alt={`${photo.category} ${photo.title}`} loading="lazy" decoding="async" />
      </div>
      <div className="story-entry-body">
        <p className="story-entry-kicker">{photo.category} · {photo.filename}</p>
        <h2 className="story-entry-title">
          <a href={storyPath(story, photo.slug)}>{story.title}</a>
        </h2>
        <p className="story-entry-excerpt">{story.excerpt}</p>
        {story.body.map((paragraph, index) => (
          <p key={index} className="story-entry-paragraph">{paragraph}</p>
        ))}
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
  return (
    <section className="story-section story-about" aria-labelledby="story-about-title">
      <div className="story-section-head">
        <span className="story-section-kicker">About</span>
        <h1 id="story-about-title">关于摄影师</h1>
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
            <h2 className="story-about-block-title">器材</h2>
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
            <h2 className="story-about-block-title">联系</h2>
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
  const metaEntries = Object.entries(photoMeta)
    .map(([filename, meta]) => {
      const photo = findPhoto(photos, filename);
      return photo ? { photo, meta } : null;
    })
    .filter((entry): entry is { photo: Photo; meta: PhotoMeta } => entry !== null);

  return (
    <section className="story-section story-meta-section" aria-labelledby="story-meta-title">
      <div className="story-section-head">
        <span className="story-section-kicker">Metadata</span>
        <h1 id="story-meta-title">照片参数</h1>
        <p className="story-section-sub">
          点击任意照片可以查看完整的 EXIF 信息——拍摄日期、地点、器材和参数。
        </p>
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
        <span className="story-section-kicker">Stories</span>
        <h1 id="story-entries-title">创作手记</h1>
        <p className="story-section-sub">
          每张照片背后都有当时的场景、天气、心情。下面是几篇示例。
        </p>
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

  return (
    <article className="story-page">
      {showPreview && (
        <div className="story-banner" role="note">
          <span className="story-banner-tag">测试模块</span>
          <p>
            这是一个内容侧功能的预览版,用于评估效果。所有文字和参数都是基于现有照片的填充示例,
            可以稍后替换成真实内容或删除。访问 <code>/photostory</code> 查看。
          </p>
        </div>
      )}

      <AboutSection aboutData={aboutData} />
      <MetadataSection photos={photos} photoMeta={photoMeta} />
      <JournalSection photos={photos} photoStories={photoStories} />
    </article>
  );
}
