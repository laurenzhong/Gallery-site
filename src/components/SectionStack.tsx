import type { Photo } from "../data/photos";

type SectionStackProps = {
  photos: Photo[];
  onOpen: (photo: Photo) => void;
};

export function SectionStack({ photos, onOpen }: SectionStackProps) {
  if (photos.length === 0) return null;

  return (
    <div className="section-stack" aria-label="Stacked photos">
      {photos.map((photo) => (
        <button
          type="button"
          className="section-stack-photo"
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