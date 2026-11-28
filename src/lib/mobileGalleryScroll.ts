export const mobileGalleryScrollQuery = "(max-width: 960px) and (pointer: coarse) and (prefers-reduced-motion: no-preference)";

const clampProgress = (progress: number) => Math.max(0, Math.min(1, progress));

export function enableMobileGalleryScroll(stage: HTMLElement, frame: HTMLElement, rail: HTMLElement, preloadPhotos: () => void) {
  let rangeStart = 0;
  let rangeEnd = 1;
  let horizontalDistance = 0;
  let verticalDistance = 0;
  let inset = 0;
  let frameRequest = 0;
  let writtenLeft: number | undefined;
  let writtenPageY: number | undefined;

  function pinStart() {
    return window.scrollY + stage.getBoundingClientRect().top - inset;
  }

  function setRange(start: number, end: number) {
    rangeStart = start;
    rangeEnd = end;
    stage.style.setProperty("--gallery-scroll-range", String(end - start));
    verticalDistance = Math.max(0, stage.offsetHeight - frame.offsetHeight);
  }

  function updateRail() {
    frameRequest = 0;
    if (!horizontalDistance || !verticalDistance) return;

    const pageProgress = clampProgress((window.scrollY - pinStart()) / verticalDistance);
    const left = horizontalDistance * (rangeStart + pageProgress * (rangeEnd - rangeStart));
    if (Math.abs(rail.scrollLeft - left) < 1.5) return;

    rail.scrollLeft = left;
    writtenLeft = rail.scrollLeft;
  }

  function scheduleRailUpdate() {
    if (!frameRequest) frameRequest = requestAnimationFrame(updateRail);
  }

  function onPageScroll() {
    const wasWritten = window.scrollY === writtenPageY;
    writtenPageY = undefined;
    if (!wasWritten) scheduleRailUpdate();
  }

  function movePageTo(top: number) {
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    window.scrollTo({ top, behavior: "instant" });
    writtenPageY = window.scrollY;
  }

  function measure() {
    horizontalDistance = Math.max(0, rail.scrollWidth - rail.clientWidth);
    stage.classList.toggle("gallery-rail-stage--active", horizontalDistance > 0);
    stage.style.setProperty("--gallery-horizontal-distance", `${horizontalDistance}px`);
    stage.style.setProperty("--gallery-frame-height", `${frame.offsetHeight}px`);
    inset = Number.parseFloat(getComputedStyle(frame).top) || 0;
    setRange(rangeStart, rangeEnd);
    scheduleRailUpdate();
  }

  function onRailScroll() {
    const left = rail.scrollLeft;
    const wasWritten = left === writtenLeft;
    writtenLeft = undefined;
    if (wasWritten || !horizontalDistance) return;

    const progress = clampProgress(left / horizontalDistance);
    const start = pinStart();
    const pageY = window.scrollY;

    if (pageY < start - 1) {
      // A swipe before the pin enters the viewport shortens the remaining sequence.
      setRange(progress, 1);
      return;
    }

    if (pageY > start + verticalDistance + 1) {
      const previousDistance = verticalDistance;
      setRange(0, progress);
      movePageTo(pageY + verticalDistance - previousDistance);
      return;
    }

    if (progress < rangeStart || progress > rangeEnd) {
      setRange(Math.min(progress, rangeStart), Math.max(progress, rangeEnd));
    }

    if (rangeEnd > rangeStart) {
      const pageProgress = (progress - rangeStart) / (rangeEnd - rangeStart);
      movePageTo(start + pageProgress * verticalDistance);
    }
  }

  const observer = new ResizeObserver(measure);
  observer.observe(frame);
  observer.observe(rail);

  const preloadObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    preloadObserver.disconnect();
    preloadPhotos();
  }, { rootMargin: `${Math.round(window.innerHeight * 1.25)}px 0px` });
  preloadObserver.observe(rail);

  window.addEventListener("resize", measure);
  window.addEventListener("scroll", onPageScroll, { passive: true });
  rail.addEventListener("scroll", onRailScroll, { passive: true });
  measure();

  return () => {
    observer.disconnect();
    preloadObserver.disconnect();
    window.removeEventListener("resize", measure);
    window.removeEventListener("scroll", onPageScroll);
    rail.removeEventListener("scroll", onRailScroll);
    cancelAnimationFrame(frameRequest);
    stage.classList.remove("gallery-rail-stage--active");
    stage.style.removeProperty("--gallery-horizontal-distance");
    stage.style.removeProperty("--gallery-frame-height");
    stage.style.removeProperty("--gallery-scroll-range");
  };
}
