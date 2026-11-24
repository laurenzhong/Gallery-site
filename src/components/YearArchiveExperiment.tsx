import { ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { photos as localPhotos, type Photo } from "../data/photos";
import type { PhotoMeta, PhotoStory } from "../data/stories";
import published from "../data/yearArchive.json";
import { imageSrcSet, sizedImageUrl } from "../lib/imageUrl";
import { AdvancedPhotoLightbox } from "./AdvancedPhotoLightbox";

type ArchivePhoto = Photo & { hash: string };
type Month = { key: string; label: string; photos: ArchivePhoto[] };
type Year = { label: string; count: number; months: Map<string, Month> };
type Props = { includeLocal: boolean; photoMeta: Record<string, PhotoMeta>; photoStories: Record<string, PhotoStory[]> };

const gridSizes = "(max-width: 640px) 54vw, (max-width: 1000px) 33vw, (max-width: 1680px) 22vw, 340px";
const singleSizes = "(max-width: 640px) 91vw, (max-width: 1000px) 52vw, (max-width: 1680px) 38vw, 620px";

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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const read = () => setSelection(readSelection());
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  useEffect(() => {
    const dismissPicker = (event: PointerEvent) => {
      const picker = pickerRef.current;
      if (picker?.open && !picker.contains(event.target as Node)) picker.open = false;
    };
    document.addEventListener("pointerdown", dismissPicker);
    return () => document.removeEventListener("pointerdown", dismissPicker);
  }, []);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const updateHeight = () => toolbar.parentElement?.style.setProperty("--chronicle-toolbar-height", `${toolbar.offsetHeight}px`);
    updateHeight();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateHeight);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const fragment = window.location.hash;
    if (!fragment.startsWith("#month-")) return;

    const month = document.getElementById(fragment.slice(1));
    if (!month) return;

    const scrollFrame = window.requestAnimationFrame(() => {
      if (window.location.hash === fragment) month.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(scrollFrame);
  }, [includeLocal, selection.year]);

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
  const fragment = window.location.hash;
  const entryMonth = fragment.startsWith("#month-")
    ? visibleYears.map((year) => year.months.get(fragment.slice(7))).find(Boolean)
    : undefined;
  const firstVisibleFrame = entryMonth ? frames.indexOf(entryMonth.photos[0]) : 0;
  const eagerPhotos = active ? [] : frames.slice(firstVisibleFrame, firstVisibleFrame + 5);
  const dated = archive.years.filter((year) => year.label !== "Undated");
  const monthYears = activeYear ? dated.filter((year) => year === activeYear) : dated;
  const span = dated.length > 1 ? dated[dated.length - 1].label + " — " + dated[0].label : dated[0]?.label;

  function closeMonthPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    picker.open = false;
    picker.querySelector("summary")?.focus({ preventScroll: true });
  }

  return (
    <article className="photo-chronicle">
      <div className="chronicle-summary"><strong>{archive.frames.length} photographs</strong>{span && <span>{span}</span>}</div>
      <div className="chronicle-toolbar" ref={toolbarRef}>
        <nav className="chronicle-filter" aria-label="Filter by capture year">
          {[null, ...archive.years.map((year) => year.label)].map((year) => (
            <button type="button" key={year ?? "all"} aria-pressed={(activeYear?.label ?? null) === year}
              aria-label={year === null ? "All years" : undefined}
              onClick={() => {
                select(year, null);
                const collection = document.getElementById("archive-years");
                if (collection && collection.getBoundingClientRect().top < 0) {
                  collection.scrollIntoView({ behavior: "instant" });
                }
              }}>{year ?? <>All<span className="chronicle-all-years"> years</span></>}</button>
          ))}
        </nav>
        {!!monthYears.length && (
          <details className="chronicle-month-picker" ref={pickerRef}
            onKeyDown={(event) => {
              if (event.key === "Escape" && event.currentTarget.open) {
                event.preventDefault();
                closeMonthPicker();
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
            }}>
            <summary aria-label="Jump to month">Month <ChevronDown size={14} aria-hidden="true" /></summary>
            <nav className="chronicle-month-menu" aria-label="Jump to month">
              {monthYears.map((year) => (
                <div className="chronicle-menu-year" key={year.label}>
                  <strong>{year.label}</strong>
                  <ul>
                    {[...year.months.values()].map((month) => (
                      <li key={month.key}>
                        <a href={"#month-" + month.key} aria-label={month.label + " " + year.label}
                          onClick={closeMonthPicker}>{month.label.slice(0, 3)}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </details>
        )}
      </div>
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
                <div className={month.photos.length === 1 ? "chronicle-grid chronicle-grid--single" : "chronicle-grid"}>
                  {month.photos.map((photo) => (
                    <button type="button" key={photo.hash} data-frame={photo.hash}
                      style={{ "--photo-ratio": photo.width / photo.height } as CSSProperties}
                      aria-label={"Open " + photo.title + (photo.capturedAt ? ", " + photo.capturedAt.slice(0, 10) : "")}
                      onClick={(event) => {
                        event.currentTarget.focus({ preventScroll: true });
                        select(activeYear?.label ?? null, photo.hash);
                      }}>
                      <img src={photo.previewSrc ?? sizedImageUrl(photo.src, 640)}
                        srcSet={photo.previewSrc ? undefined : imageSrcSet(photo.src, [320, 640, 960])}
                        sizes={(eagerPhotos.includes(photo) ? "" : "auto, ") + (month.photos.length === 1 ? singleSizes : gridSizes)}
                        width={photo.width} height={photo.height} loading={eagerPhotos.includes(photo) ? "eager" : "lazy"}
                        fetchPriority={eagerPhotos[0] === photo ? "high" : undefined} decoding="async" alt="" />
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
        }}
        photoMeta={{ [active.filename]: { ...photoMeta[active.filename], date: active.capturedAt?.replace("T", " ") } }}
        photoStories={photoStories} />}
    </article>
  );
}
