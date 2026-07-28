/** File-picker accept string covering common image formats. */
export const IMAGE_ACCEPT =
  "image/*,.jpg,.jpeg,.jfif,.pjpeg,.pjp,.png,.webp,.gif,.avif,.bmp,.svg,.tif,.tiff,.ico,.heic,.heif";

/** File-picker accept string covering common video formats. */
export const VIDEO_ACCEPT =
  "video/*,.mp4,.mov,.mkv,.webm,.m4v,.avi,.ts";

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  pjpeg: "image/jpeg",
  pjp: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  ico: "image/x-icon",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  webm: "video/webm",
  m4v: "video/x-m4v",
  avi: "video/x-msvideo",
  ts: "video/mp2t",
  vtt: "text/vtt",
  srt: "application/x-subrip",
};

/**
 * Browsers often leave File.type empty (or wrong) for .webp/.heic/.jfif.
 * Infer a MIME the upload API will accept from the filename when needed.
 */
export function resolveContentType(file: File, fallback?: string): string {
  if (fallback?.trim()) return fallback.trim();
  if (file.type && file.type !== "application/octet-stream") return file.type;

  const dot = file.name.lastIndexOf(".");
  if (dot <= 0) return file.type || "application/octet-stream";
  const ext = file.name.slice(dot + 1).toLowerCase();
  return EXT_TO_MIME[ext] || file.type || "application/octet-stream";
}

export function isImageAccept(accept: string): boolean {
  return (
    accept.includes("image/") ||
    accept.includes(".jpg") ||
    accept.includes(".png") ||
    accept.includes(".webp") ||
    accept.includes(".gif") ||
    accept.includes(".avif") ||
    accept.includes(".bmp") ||
    accept.includes(".svg") ||
    accept.includes(".tif") ||
    accept.includes(".heic") ||
    accept.includes(".ico")
  );
}
