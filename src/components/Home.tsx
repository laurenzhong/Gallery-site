import type { Photo } from "../data/photos";
import type { AboutData, PhotoStory } from "../data/stories";
import type { HomepageLayout } from "../lib/homepageLayout";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { storyPath } from "../lib/routes";

type HomeProps = {
  photos: Photo[];
  heroPhoto?: Photo;
  homepageLayout?: HomepageLayout;
  photoStories?: Record<string, PhotoStory[]>;
  aboutData?: AboutData;
};

type HomeProject = {
  title: string;
  eyebrow: string;
  description: string;
  photo: Photo;
  href: string;
};

export function HomeLoading() {
  return (
    <article className="home-loading" aria-busy="true" aria-label="Loading photography archive">
      <div className="home-loading__content">
        <p className="home-kicker">Queenstown.top / Photography archive</p>
        <span>Loading the latest field notes…</span>
      </div>
    </article>
  );
}

function firstMatchingPhoto(photos: Photo[], categories: string[], fallback?: Photo) {
  return categories.map((category) => photos.find((photo) => photo.category === category)).find(Boolean) ?? fallback;
}

function normalizeProjectHref(href: string | undefined, fallback: string) {
  const value = href?.trim();
  return !value || value === "/#photography" || value === "#photography" ? fallback : value;
}

function findFirstStory(photos: Photo[], photoStories: Record<string, PhotoStory[]>) {
  for (const [filename, stories] of Object.entries(photoStories)) {
    const photo = photos.find((item) => item.filename === filename);
    const story = stories[0];
    if (photo && story) return { photo, story };
  }

  return undefined;
}

function ProjectCard({ project }: { project: HomeProject }) {
  return (
    <a className="home-project-card" href={project.href}>
      <div className="home-project-card__image">
        <img
          src={sizedImageUrl(project.photo.src, 1200, 84)}
          srcSet={imageSrcSet(project.photo.src, [640, 960, 1400], 84)}
          sizes="(max-width: 720px) 100vw, 33vw"
          alt={`${project.title}: ${project.photo.title}`}
          width={project.photo.width}
          height={project.photo.height}
          loading="eager"
          decoding="async"
        />
        <span className="home-project-card__action">Open series <span aria-hidden="true">↗</span></span>
      </div>
      <div className="home-project-card__body">
        <p className="home-project-card__eyebrow">{project.eyebrow}</p>
        <h3>{project.title}</h3>
        <p>{project.description}</p>
      </div>
    </a>
  );
}

export function Home({ photos, heroPhoto, homepageLayout, photoStories = {}, aboutData }: HomeProps) {
  const fallbackPhoto = heroPhoto ?? photos[0];
  const configuredCards = homepageLayout?.featureCards ?? [];
  const projects = [
    {
      title: configuredCards[0]?.title ?? "Landscape",
      eyebrow: "01 / Places",
      description: "Mountain air, open distance, and the weather between two frames.",
      photo: configuredCards[0]?.photo ?? firstMatchingPhoto(photos, ["山野", "日出日落", "河流"], fallbackPhoto),
      href: normalizeProjectHref(configuredCards[0]?.href, "/photography?collection=landscape"),
    },
    {
      title: configuredCards[1]?.title ?? "Harbor light",
      eyebrow: "02 / Tides",
      description: "Boats, shorelines, and the softer hours at the edge of the water.",
      photo: configuredCards[1]?.photo ?? firstMatchingPhoto(photos, ["harbor", "Harbor", "海洋", "石塘度假区"], fallbackPhoto),
      href: normalizeProjectHref(configuredCards[1]?.href, "/photography?collection=harbor"),
    },
    {
      title: configuredCards[2]?.title ?? "Balcony View",
      eyebrow: "03 / Everyday",
      description: "A small, ongoing study of the view that changes every month.",
      photo:
        configuredCards[2]?.photo ??
        photos.find((photo) => photo.filename === "DSC_0243.JPG") ??
        firstMatchingPhoto(photos, ["石塘度假区", "建筑"], fallbackPhoto),
      href: normalizeProjectHref(configuredCards[2]?.href, "/photobalcony"),
    },
  ].filter((project): project is typeof project & { photo: Photo } => Boolean(project.photo));

  const storyEntry = findFirstStory(photos, photoStories);
  const categoryCount = new Set(photos.map((photo) => photo.category).filter(Boolean)).size;

  return (
    <article className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        {fallbackPhoto ? (
          <img
            className="home-hero__image"
            src={sizedImageUrl(fallbackPhoto.src, 2400, 86)}
            srcSet={imageSrcSet(fallbackPhoto.src, [1200, 1800, 2400], 86)}
            sizes="100vw"
            alt={fallbackPhoto.title}
            width={fallbackPhoto.width}
            height={fallbackPhoto.height}
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
        ) : null}
        <div className="home-hero__scrim" aria-hidden="true" />
        <div className="home-hero__content">
          <p className="home-kicker">Queenstown.top / Photography archive</p>
          <h1 id="home-title">Light, weather, and the places in between.</h1>
          <p className="home-hero__intro">
            A quiet visual notebook by {aboutData?.name ?? "JiaKaiZhong"}, built from landscapes, harbor light, city edges, and small travel fragments.
          </p>
          <div className="home-hero__actions">
            <a className="home-button home-button--primary" href="/photography">
              View photography <span aria-hidden="true">↗</span>
            </a>
            <a className="home-button home-button--quiet" href="/journal">
              Read the journal
            </a>
          </div>
        </div>
        <a className="home-hero__scroll" href="#selected" aria-label="Scroll to selected projects">
          <span>Scroll to explore</span>
          <span aria-hidden="true">↓</span>
        </a>
      </section>

      <section className="home-intro" id="selected" aria-labelledby="selected-title">
        <div className="home-section-heading">
          <p className="home-kicker home-kicker--dark">Selected frames</p>
          <h2 id="selected-title">A few doors into the archive.</h2>
        </div>
        <div className="home-intro__aside">
          <p>Every image belongs to the larger archive. Start with a mood, then follow the photographs wherever they lead.</p>
          <a className="text-link" href="/photography">Browse all photographs <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <section className="home-projects" aria-label="Selected photography projects">
        {projects.map((project) => <ProjectCard key={project.title} project={project} />)}
      </section>

      {storyEntry ? (
        <section className="home-story" aria-labelledby="home-story-title">
          <div className="home-story__image-wrap">
            <img
              src={sizedImageUrl(storyEntry.photo.src, 1400, 84)}
              srcSet={imageSrcSet(storyEntry.photo.src, [720, 1100, 1600], 84)}
              sizes="(max-width: 800px) 100vw, 52vw"
              alt={storyEntry.photo.title}
              width={storyEntry.photo.width}
              height={storyEntry.photo.height}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="home-story__body">
            <p className="home-kicker home-kicker--dark">From the journal</p>
            <h2 id="home-story-title">{storyEntry.story.title}</h2>
            <p>{storyEntry.story.excerpt}</p>
            <a className="text-link" href={storyPath(storyEntry.story, storyEntry.photo.slug)}>
              Read the field note <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      ) : null}

      <section className="home-explore" aria-labelledby="home-explore-title">
        <div>
          <p className="home-kicker">Keep exploring</p>
          <h2 id="home-explore-title">The archive is larger than a homepage.</h2>
        </div>
        <div className="home-explore__links">
          <a href="/photography"><span>Photography</span><small>{photos.length} photographs</small><b aria-hidden="true">↗</b></a>
          <a href="/photobalcony"><span>Balcony View</span><small>An ongoing series</small><b aria-hidden="true">↗</b></a>
          <a href="/about"><span>About the photographer</span><small>{categoryCount} visual chapters</small><b aria-hidden="true">↗</b></a>
        </div>
      </section>
    </article>
  );
}
