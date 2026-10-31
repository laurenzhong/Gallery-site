import type { Photo } from "../data/photos";
import { useSiteCopy } from "../lib/siteCopyContext";

type SectionStackProps = {
  photos: Photo[];
  onOpen: (photo: Photo) => void;
};

export function SectionStack({ photos, onOpen }: SectionStackProps) {
  const copy = useSiteCopy();
  if (photos.length === 0) return null;

  return (
    <div className="section-stack" aria-label={copy.sections.photographyArchive}>
      {photos.map((photo) => (
        <button
          type="button"
          className="section-stack-photo"
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
