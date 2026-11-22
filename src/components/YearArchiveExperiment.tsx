import { useEffect, useMemo, useState } from "react";
import { photos as localPhotos, type Photo } from "../data/photos";
import type { PhotoMeta, PhotoStory } from "../data/stories";
import published from "../data/yearArchive.json";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { AdvancedPhotoLightbox } from "./AdvancedPhotoLightbox";

type ArchivePhoto = Photo & { hash: string };
type Month = { key: string; label: string; photos: ArchivePhoto[] };
type Year = { label: string; count: number; months: Map<string, Month> };
type Props = { includeLocal: boolean; photoMeta: Record<string, PhotoMeta>; photoStories: Record<string, PhotoStory[]> };

function collectArchive(includeLocal: boolean) {
  const originals = new Map<string, ArchivePhoto>();
  for (const photo of published) originals.set(photo.hash, photo);
  // Private migration folders are available only in the local preview.
  if (includeLocal && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) {
    for (const photo of localPhotos) {
      if (!photo.hash) continue;
      const catalogEntry = originals.get(photo.hash);
      originals.set(photo.hash, {
        ...photo, ...catalogEntry, hash: photo.hash, src: photo.src,
        previewSrc: photo.previewSrc, capturedAt: photo.capturedAt ?? catalogEntry?.capturedAt,
      });
    }
  }
  const frames = [...originals.values()].sort((a, b) =>
    (b.capturedAt ?? "").localeCompare(a.capturedAt ?? "") || a.filename.localeCompare(b.filename) || a.hash.localeCompare(b.hash)
  );
  const years = new Map<string, Year>();
  const monthName = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });
  for (const photo of frames) {
    const date = photo.capturedAt;
    const label = date?.slice(0, 4) ?? "Undated";
    const key = date?.slice(0, 7) ?? "undated";
    const year = years.get(label) ?? { label, count: 0, months: new Map<string, Month>() };
    const month = year.months.get(key) ?? { key, label: date ? monthName.format(new Date(date + "Z")) : "", photos: [] };
    month.photos.push(photo);
    year.months.set(key, month);
    year.count++;
    years.set(label, year);
  }
  return { frames, years: [...years.values()] };
}

function readSelection() {
  const params = new URLSearchParams(window.location.search);
  return { year: params.get("year"), frame: params.get("frame") };
}

export default function YearArchiveExperiment({ includeLocal, photoMeta, photoStories }: Props) {
  const archive = useMemo(() => collectArchive(includeLocal), [includeLocal]);
  const [selection, setSelection] = useState(readSelection);
  useEffect(() => {
    const read = () => setSelection(readSelection());
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  function select(year: string | null, frame: string | null, replace = false) {
    const url = new URL(window.location.href);
    if (year !== selection.year) url.hash = "";
    if (year) url.searchParams.set("year", year);
    else url.searchParams.delete("year");
    if (frame) url.searchParams.set("frame", frame);
    else url.searchParams.delete("frame");
    if (url.href === window.location.href) return;
    const state = frame ? { archiveFrameOpened: replace ? window.history.state?.archiveFrameOpened : true } : {};
    window.history[replace ? "replaceState" : "pushState"](state, "", url);
    setSelection({ year, frame });
  }

  const activeYear = archive.years.find((year) => year.label === selection.year);
  const visibleYears = activeYear ? [activeYear] : archive.years;
  const frames = activeYear ? [...activeYear.months.values()].flatMap((month) => month.photos) : archive.frames;
  const index = selection.frame ? frames.findIndex((photo) => photo.hash === selection.frame) : -1;
  const active = frames[index];
  const dated = archive.years.filter((year) => year.label !== "Undated");
  const span = dated.length > 1 ? dated[dated.length - 1].label + " — " + dated[0].label : dated[0]?.label;

  return (
    <article className="photo-chronicle">
      <div className="chronicle-summary"><strong>{archive.frames.length} photographs</strong>{span && <span>{span}</span>}</div>
      <nav className="chronicle-filter" aria-label="Filter by capture year">
        {[null, ...archive.years.map((year) => year.label)].map((year) => (
          <button type="button" key={year ?? "all"} aria-pressed={(activeYear?.label ?? null) === year}
            onClick={() => {
              select(year, null);
              const collection = document.getElementById("archive-years");
              if (collection && collection.getBoundingClientRect().top < 0) {
                collection.scrollIntoView({ behavior: "instant" });
              }
            }}>{year ?? "All years"}</button>
        ))}
      </nav>
      <div className="chronicle-collection" id="archive-years">
        {visibleYears.map((year) => (
          <section className="chronicle-year" key={year.label} aria-label={year.label}>
            <div className="chronicle-year-label">
              <h2>{year.label}</h2><span>{year.count} {year.count === 1 ? "photograph" : "photographs"}</span>
              {year.months.size > 1 && <nav className="chronicle-month-links" aria-label={year.label + " months"}>
                {[...year.months.values()].map((month) => <a key={month.key} href={"#month-" + month.key}
                  aria-label={month.label + " " + year.label}>{month.label.slice(0, 3)}</a>)}
              </nav>}
            </div>
            <div>{[...year.months.values()].map((month) => (
              <div className="chronicle-month" key={month.key} id={"month-" + month.key}>
                {month.label && <h3>{month.label}<span>{month.photos.length}</span></h3>}
                <div className="chronicle-grid">
                  {month.photos.map((photo) => (
                    <button type="button" key={photo.hash} data-frame={photo.hash}
                      aria-label={"Open " + photo.title + (photo.capturedAt ? ", " + photo.capturedAt.slice(0, 10) : "")}
                      onClick={() => select(activeYear?.label ?? null, photo.hash)}>
                      <img src={photo.previewSrc ?? sizedImageUrl(photo.src, 640)}
                        srcSet={photo.previewSrc ? undefined : imageSrcSet(photo.src, [320, 640, 960])}
                        sizes="(max-width: 640px) 46vw, (max-width: 1000px) 28vw, 22vw"
                        width={photo.width} height={photo.height} loading="lazy" decoding="async" alt="" />
                    </button>
                  ))}
                </div>
              </div>
            ))}</div>
          </section>
        ))}
        {!archive.frames.length && <p>No photographs in the archive yet.</p>}
      </div>
      {active && <AdvancedPhotoLightbox photos={frames} index={index}
        onNavigate={(next) => select(activeYear?.label ?? null, frames[next].hash, true)}
        onClose={() => {
          if (window.history.state?.archiveFrameOpened) window.history.back();
          else select(activeYear?.label ?? null, null, true);
          document.querySelector<HTMLButtonElement>('[data-frame="' + active.hash + '"]')?.focus({ preventScroll: true });
        }}
        photoMeta={{ [active.filename]: { ...photoMeta[active.filename], date: active.capturedAt?.replace("T", " ") } }}
        photoStories={photoStories} />}
    </article>
  );
}
