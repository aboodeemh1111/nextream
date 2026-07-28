/**
 * Helpers for the two shapes a media field can hold.
 *
 * The API stores storage *keys* in Mongo and signs them into URLs on the way
 * out, so a value loaded from a GET is a signed URL while a value produced by an
 * upload is a bare key. Writes accept either — the server normalises a signed
 * bucket URL back to its key — but the UI has to know which one it is holding,
 * because only one of them can go in an <img src>.
 */

export function isUrlLike(value?: string | null): boolean {
  return typeof value === "string" && value.includes("://");
}

/** A URL safe to render, or "" when the value is a bare key. */
export function previewFor(value?: string | null): string {
  return isUrlLike(value) ? (value as string) : "";
}

/** Last path segment, without the signature query string. */
export function mediaFileName(value?: string | null): string {
  if (!value) return "";
  const withoutQuery = value.split("?")[0];
  const segment = withoutQuery.split("/").filter(Boolean).pop() ?? "";
  return decodeURIComponent(segment);
}

export function hasMedia(value?: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
