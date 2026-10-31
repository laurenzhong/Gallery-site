import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Photo } from "../data/photos";

type SectionCarouselProps = {
  photos: Photo[];
  onOpen: (photo: Photo) => void;
};

export function SectionCarousel({ photos, onOpen }: SectionCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (photos.length === 0) return null;

  const active = photos[activeIndex];
  const goPrev = () => setActiveIndex((index) => (index - 1 + photos.length) % photos.length);
  const goNext = () => setActiveIndex((index) => (index + 1) % photos.length);

  return (
    <div className="section-carousel">
      <button
        type="button"
        className="featured-arrow featured-arrow--prev"
        aria-label="Previous photo"
        onClick={goPrev}
      >
        <ChevronLeft size={36} strokeWidth={1.5} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="section-carousel-main"
        onClick={() => onOpen(active)}
        aria-label={`Open ${active.title}`}
      >
        <img
          src={active.src}
          alt={`${active.category} ${active.title}`}
          width={active.width}
          height={active.height}
          decoding="async"
        />
      </button>

      <button
        type="button"
        className="featured-arrow featured-arrow--next"
        aria-label="Next photo"
        onClick={goNext}
      >
        <ChevronRight size={36} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}