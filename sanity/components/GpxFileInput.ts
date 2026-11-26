import { useCallback, useRef } from "react";
import { PatchEvent, setIfMissing, type FileInputProps, type FormPatch } from "sanity";

const uploadPath = ["_upload"];

export function GpxFileInput(props: FileInputProps) {
  const { onChange } = props;
  const uploadStart = useRef<unknown>(undefined);

  const handleChange = useCallback<FileInputProps["onChange"]>((event) => {
    const patches: FormPatch[] = [];
    let uploadInitialized = false;

    for (const patch of PatchEvent.from(event).patches) {
      if (patch.path[0] === "_upload") {
        if (patch.path.length === 1) {
          if (patch.type === "set") {
            uploadStart.current = patch.value;
            uploadInitialized = true;
          } else if (patch.type === "unset") {
            uploadStart.current = undefined;
            uploadInitialized = false;
          }
        } else {
          if (uploadStart.current === undefined) continue;
          if (!uploadInitialized) {
            // Studio can refresh the draft without its transient upload state between events.
            patches.push(setIfMissing(uploadStart.current, uploadPath));
            uploadInitialized = true;
          }
        }
      }
      patches.push(patch);
    }

    if (patches.length > 0) onChange(PatchEvent.from(patches));
  }, [onChange]);

  return props.renderDefault({ ...props, onChange: handleChange });
}
