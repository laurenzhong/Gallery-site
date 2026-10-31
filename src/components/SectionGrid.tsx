import type { Photo } from "../data/photos";
import { useSiteCopy } from "../lib/siteCopyContext";

type SectionGridProps = {
  photos: Photo[];
  columns?: number;
  onOpen: (photo: Photo) => void;
};

export function SectionGrid({ photos, columns = 4, onOpen }: SectionGridProps) {
  const copy = useSiteCopy();
  if (photos.length === 0) return null;

  return (
    <div
      className="section-grid"
      style={{ "--section-grid-columns": columns } as React.CSSProperties}
      aria-label={copy.sections.photographyArchive}
    >
      {photos.map((photo) => (
        <button
          type="button"
          className="section-grid-photo"
          key={photo.id}
          onClick={() => onOpen(photo)}
          aria-label={`${copy.controls.openPhoto} ${photo.title}`}
        >
          <img
            src={photo.src}
            alt={photo.altText ?? `${photo.category} ${photo.title}`}
            width={photo.width}
            height={photo.height}
            loading="lazy"
            decoding="async"
          />
        </button>
      ))}
    </div>
  );
}
