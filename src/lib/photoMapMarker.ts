import type { Photo } from "../data/photos";

const PORTRAIT_PATH = "M 50 130 C 46 124 9 97 4 66 C 0 37 17 10 42 2 C 47 0 53 0 58 2 C 83 10 100 37 96 66 C 91 97 54 124 50 130 Z";
const LANDSCAPE_PATH = "M 70 120 C 65 114 8 91 4 61 C 0 31 26 7 57 2 C 62 1 78 1 83 2 C 114 7 140 31 136 61 C 132 91 75 114 70 120 Z";

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function photoMapMarkerMarkup(photo: Photo, active: boolean, imageSrc = photo.mapSrc ?? photo.src) {
  const isLandscape = photo.width > photo.height * 1.15;
  const viewBox = isLandscape ? "0 0 140 120" : "0 0 100 130";
  const path = isLandscape ? LANDSCAPE_PATH : PORTRAIT_PATH;
  const clipId = `photo-map-clip-${photo.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const orientation = isLandscape ? " is-landscape" : "";
  const width = isLandscape ? 140 : 100;
  const height = isLandscape ? 120 : 130;

  return `<span class="photo-map-marker${orientation}${active ? " is-active" : ""}"><svg viewBox="${viewBox}" aria-hidden="true" focusable="false"><defs><clipPath id="${clipId}"><path d="${path}" /></clipPath></defs><image href="${escapeAttribute(imageSrc)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" /></svg></span>`;
}
