import type { Photo } from "../data/photos";

type SectionGridProps = {
  photos: Photo[];
  columns?: number;
  onOpen: (photo: Photo) => void;
};

export function SectionGrid({ photos, columns = 4, onOpen }: SectionGridProps) {
  if (photos.length === 0) return null;

  return (
    <div
      className="section-grid"
      style={{ "--section-grid-columns": columns } as React.CSSProperties}
      aria-label="Photo grid"
    >
      {photos.map((photo) => (
        <button
          type="button"
          className="section-grid-photo"
          key={photo.id}
          onClick={() => onOpen(photo)}
          aria-label={`Open ${photo.title}`}
        >
          <img
            src={photo.src}
            alt={`${photo.category} ${photo.title}`}
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