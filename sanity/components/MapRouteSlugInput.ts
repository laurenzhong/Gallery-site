import { pinyin } from "pinyin-pro";
import { useEffect, useRef } from "react";
import { getPublishedId, setIfMissing, useFormValue, type SlugInputProps } from "sanity";
import { slugify } from "../../src/lib/routes";

export const mapRouteSlugMaxLength = 96;

export function routeSlugFromTitle(title: string, documentId: unknown) {
  const shortTitle = title.replace(/\s*(?:\([^()]*\)|（[^（）]*）)\s*$/, "").trim();
  const romanized = pinyin(shortTitle || title, { toneType: "none", nonZh: "consecutive" });
  const base = slugify(romanized.normalize("NFKD").replace(/\p{M}/gu, "")) || "route";
  const routeId = typeof documentId === "string" ? slugify(getPublishedId(documentId)).slice(-12) : "";
  const suffix = routeId ? `-${routeId}` : "";
  return `${base.slice(0, mapRouteSlugMaxLength - suffix.length).replace(/-+$/, "")}${suffix}`;
}

export function MapRouteSlugInput(props: SlugInputProps) {
  const { value, onChange, readOnly } = props;
  const title = useFormValue(["title"]);
  const documentId = useFormValue(["_id"]);
  const trackAssetId = useFormValue(["trackFile", "asset", "_ref"]);
  const initialized = useRef(false);

  useEffect(() => {
    if (readOnly || initialized.current) return;
    if (value?.current) {
      initialized.current = true;
      return;
    }
    if (typeof title !== "string" || !title.trim() || typeof documentId !== "string" || typeof trackAssetId !== "string") return;

    initialized.current = true;
    onChange([
      setIfMissing({ _type: "slug" }),
      setIfMissing(routeSlugFromTitle(title, documentId), ["current"]),
    ]);
  }, [documentId, onChange, readOnly, title, trackAssetId, value]);

  return props.renderDefault(props);
}
