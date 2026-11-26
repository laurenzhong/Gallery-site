import { useEffect, useRef } from "react";
import { setIfMissing, useClient, useFormValue, type StringInputProps } from "sanity";

export function MapRouteTitleInput(props: StringInputProps) {
  const { value, readOnly, onChange } = props;
  const assetId = useFormValue(["trackFile", "asset", "_ref"]);
  const client = useClient({ apiVersion: "2025-02-19" });
  const initializedForAsset = useRef<string>(undefined);

  useEffect(() => {
    if (readOnly || typeof assetId !== "string" || initializedForAsset.current === assetId) return;
    if (value !== undefined) {
      initializedForAsset.current = assetId;
      return;
    }

    const request = new AbortController();
    void client.fetch<string | null>(
      `*[_type == "sanity.fileAsset" && _id == $assetId][0].originalFilename`,
      { assetId },
      { signal: request.signal },
    ).then((filename) => {
      if (request.signal.aborted || !filename) return;
      const title = filename.trim().replace(/\.(?:gpx|xml)$/i, "").trim();
      if (title) {
        initializedForAsset.current = assetId;
        onChange(setIfMissing(title));
      }
    }).catch(() => {
      // The editor can still enter a title if the asset metadata is unavailable.
    });

    return () => request.abort();
  }, [assetId, client, onChange, readOnly, value]);

  return props.renderDefault(props);
}
