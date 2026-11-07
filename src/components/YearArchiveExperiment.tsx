import { ArrowUpRight } from "lucide-react";
import { useMemo } from "react";
import type { Photo } from "../data/photos";
import type { PhotoMeta } from "../data/stories";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";

type YearArchiveExperimentProps = {
  photos: Photo[];
  photoMeta: Record<string, PhotoMeta>;
  onOpen: (index: number, photos?: Photo[]) => void;
};

type YearGroup = {
  year: string;
  photos: Photo[];
};

function photoYear(photo: Photo, photoMeta: Record<string, PhotoMeta>) {
  const date = photoMeta[photo.filename]?.date;
  const year = date?.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? year : "pending";
}

function yearLabel(year: string) {
  return year === "pending" ? "Undated" : year;
}

export function YearArchiveExperiment({ photos, photoMeta, onOpen }: YearArchiveExperimentProps) {
  const groups = useMemo<YearGroup[]>(() => {
    const grouped = new Map<string, Photo[]>();
    photos.forEach((photo) => {
      const year = photoYear(photo, photoMeta);
      grouped.set(year, [...(grouped.get(year) ?? []), photo]);
    });

    return [...grouped.entries()]
      .sort(([a], [b]) => {
        if (a === "pending") return 1;
        if (b === "pending") return -1;
        return b.localeCompare(a);
      })
      .map(([year, yearPhotos]) => ({ year, photos: yearPhotos }));
  }, [photoMeta, photos]);

  const datedYears = groups.filter((group) => group.year !== "pending").map((group) => group.year);
  const yearRange = datedYears.length > 1
    ? `${datedYears[datedYears.length - 1]}–${datedYears[0]}`
    : datedYears[0] ?? "—";

  const openPhoto = (photo: Photo, yearPhotos: Photo[]) => {
    const index = photos.findIndex((item) => item.id === photo.id);
    if (index >= 0) onOpen(index, yearPhotos);
  };

  return (
    <article className="year-archive-demo">
      <header className="year-archive-demo__hero">
        <div className="year-archive-demo__topline">
          <a className="year-archive-demo__brand" href="/" aria-label="Queenstown home">Queenstown.top</a>
          <nav aria-label="Archive navigation">
            <a href="/">Home</a>
            <a href="/photography" aria-current="page">Photography</a>
            <a href="/journal">Journal</a>
            <a href="/about">About</a>
          </nav>
        </div>

        <div className="year-archive-demo__hero-copy">
          <p className="year-archive-demo__eyebrow">The archive</p>
          <h1>Contact sheets</h1>
          <p className="year-archive-demo__meta">{photos.length.toLocaleString()} frames · {yearRange}</p>
          <p className="year-archive-demo__lede">Every frame in the archive, arranged by year and kept close to the order it was made. The homepage is an edit; this is the whole roll.</p>
        </div>
      </header>

      <ol className="year-archive-demo__years" aria-label="Photographs by year">
        {groups.map((group) => (
          <li className="year-archive-demo__year" id={`year-${group.year}`} key={group.year}>
            <div className="year-archive-demo__year-meta">
              <a href={`#year-${group.year}`} aria-label={`Jump to ${yearLabel(group.year)}`}>
                <h2>{yearLabel(group.year)}</h2>
                <span>{group.photos.length} frames <ArrowUpRight aria-hidden="true" size={15} /></span>
              </a>
            </div>
            <div className="year-archive-demo__strip" aria-label={`${yearLabel(group.year)} contact sheet`}>
              {group.photos.map((photo) => (
                <button type="button" onClick={() => openPhoto(photo, group.photos)} aria-label={`Open ${photo.title}`} key={photo.id}>
                  <img
                    src={sizedImageUrl(photo.src, 640, 82)}
                    srcSet={imageSrcSet(photo.src, [320, 480, 640], 82)}
                    sizes="(min-width: 1200px) 11vw, (min-width: 720px) 16vw, 24vw"
                    alt=""
                    aria-hidden="true"
                    width={photo.width}
                    height={photo.height}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
