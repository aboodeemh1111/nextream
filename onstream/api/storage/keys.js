const crypto = require("crypto");

// Folder layout mirrors what the admin app already used on Firebase Storage, so
// nothing about the content model changes.
const PREFIXES = [
  "images",
  "trailers",
  "videos",
  "shows",
  "episodes",
  "subs",
  "avatars",
];

// A stored key looks like "videos/2026/07/<uuid>-some-name.mp4".
// Deliberately strict: the read middleware signs anything matching this, so a
// loose pattern would turn unrelated strings into broken signed URLs.
const STORAGE_KEY_RE = new RegExp(
  "^(" + PREFIXES.join("|") + ")\\/[A-Za-z0-9][A-Za-z0-9._\\-\\/]*$"
);

const FIREBASE_URL_PREFIX = "https://firebasestorage.googleapis.com/";

const VIDEO_EXT = ["mp4", "mov", "mkv", "webm", "m4v", "avi", "ts", "m3u8"];
const IMAGE_EXT = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "bmp",
  "svg",
  "tif",
  "tiff",
  "ico",
  "heic",
  "heif",
  "jfif",
  "pjpeg",
  "pjp",
];
const SUBTITLE_EXT = ["vtt", "srt", "ass", "ssa"];

// Fallback when the extension is missing or unrecognised.
const PREFIX_MEDIA_TYPE = {
  images: "image",
  avatars: "image",
  shows: "image",
  trailers: "video",
  videos: "video",
  episodes: "video",
  subs: "subtitle",
};

function isPrefix(value) {
  return typeof value === "string" && PREFIXES.indexOf(value) !== -1;
}

function extensionOf(name) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  const ext = name.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

function slugify(name) {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "file";
}

// Generates the key server-side from a UUID. The client never supplies a path:
// an admin token must not become an arbitrary-write primitive over the bucket.
function buildKey(prefix, originalName) {
  if (!isPrefix(prefix)) {
    throw new Error(
      `Invalid prefix "${prefix}". Allowed: ${PREFIXES.join(", ")}`
    );
  }
  if (typeof originalName !== "string" || originalName.length === 0) {
    throw new Error("filename is required");
  }
  if (originalName.length > 255) {
    throw new Error("filename is too long");
  }
  if (originalName.indexOf("\0") !== -1) {
    throw new Error("filename contains a null byte");
  }
  if (/(^|[\\/])\.\.([\\/]|$)/.test(originalName)) {
    throw new Error("filename contains a path traversal segment");
  }
  if (/^([\\/]|[A-Za-z]:)/.test(originalName)) {
    throw new Error("filename must not be an absolute path");
  }

  // Defence in depth: even after the checks above, only the basename is used.
  const base = originalName.split(/[\\/]/).pop();
  const ext = extensionOf(base);
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");

  // Date-shard so no single prefix accumulates unbounded objects.
  return `${prefix}/${yyyy}/${mm}/${crypto.randomUUID()}-${slugify(base)}${
    ext ? "." + ext : ""
  }`;
}

function isStorageKey(value) {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 1024) return false;
  if (value.indexOf("..") !== -1) return false;
  if (value.indexOf("//") !== -1) return false;
  return STORAGE_KEY_RE.test(value);
}

function isLegacyFirebaseUrl(value) {
  return typeof value === "string" && value.startsWith(FIREBASE_URL_PREFIX);
}

// Drives TTL selection. Extension wins over prefix because "episodes/" holds
// both episode video and stillPath images, and "shows/" holds posters.
function mediaTypeFor(key) {
  if (typeof key !== "string") return "image";
  const ext = extensionOf(key);
  if (VIDEO_EXT.indexOf(ext) !== -1) return "video";
  if (SUBTITLE_EXT.indexOf(ext) !== -1) return "subtitle";
  if (IMAGE_EXT.indexOf(ext) !== -1) return "image";
  const prefix = key.split("/")[0];
  return PREFIX_MEDIA_TYPE[prefix] || "image";
}

module.exports = {
  PREFIXES,
  FIREBASE_URL_PREFIX,
  buildKey,
  isPrefix,
  isStorageKey,
  isLegacyFirebaseUrl,
  mediaTypeFor,
  extensionOf,
};
