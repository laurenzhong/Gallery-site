import exifr from "exifr";

// Keep the camera's calendar date, even when the computer uses another zone.
export function normalizeCaptureTime(raw) {
  const match = typeof raw === "string" && /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(raw.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const value = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const utc = new Date(value + "Z");
  return !Number.isNaN(utc.getTime()) && utc.toISOString().startsWith(value) && year !== "0000" ? value : null;
}

export async function captureTime(input) {
  const fields = await exifr.parse(input, { pick: ["DateTimeOriginal"], reviveValues: false });
  return normalizeCaptureTime(fields?.DateTimeOriginal);
}
