export const contentPages = {
  home: { path: "/", label: "首页 · 摄影" },
  photobalcony: { path: "/photobalcony", label: "影像阳台" },
  archive: { path: "/archive", label: "照片档案" },
  map: { path: "/map", label: "照片地图" },
  journal: { path: "/journal", label: "手记" },
  about: { path: "/about", label: "关于" },
} as const;

export type ContentPageKey = keyof typeof contentPages;
export const contentPageKeys = Object.keys(contentPages) as ContentPageKey[];

export function isContentPageKey(value: unknown): value is ContentPageKey {
  return typeof value === "string" && Object.hasOwn(contentPages, value);
}

export function contentPageKey(path: string) {
  return path === "/photography" ? "home" : contentPageKeys.find((key) => contentPages[key].path === path);
}

export function internalPageHref(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    return undefined;
  }
  return value;
}

export function contentLink(page: unknown, path: unknown) {
  return isContentPageKey(page) ? contentPages[page].path : internalPageHref(path);
}

export function usesPublishedPageContent(mode?: string, search = "") {
  const preview = new URLSearchParams(search).get("page-content-preview");
  return mode !== "stable" || preview === "1" || preview === "true";
}
