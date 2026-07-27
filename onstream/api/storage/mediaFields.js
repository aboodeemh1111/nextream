const { isStorageKey, isLegacyFirebaseUrl } = require("./keys");

// Every field in Mongo that holds a media URL or key. Shared by the write
// validator, the delete path (Phase 5) and the backfill script (Phase 6) so
// they can never drift apart.
//
// "field[]"      -> an array of strings
// "field[].sub"  -> an array of objects, each with a media value at .sub
const MEDIA_MANIFEST = [
  { model: "Movie", fields: ["img", "imgSm", "imgTitle", "trailer", "video"] },
  { model: "TVShow", fields: ["poster", "backdrop", "trailerUrl"] },
  { model: "Season", fields: ["poster", "backdrop"] },
  {
    model: "Episode",
    fields: [
      "stillPath",
      "videoSources[].url",
      "subtitles[].url",
      "thumbnails[]",
    ],
  },
  { model: "User", fields: ["profilePic"] },
];

function fieldsFor(model) {
  const entry = MEDIA_MANIFEST.find((m) => m.model === model);
  return entry ? entry.fields : [];
}

// Returns [{ spec, path, value, set(newValue) }] for every media value present.
// `path` is the Mongo dotted path (e.g. "videoSources.0.url"), so the backfill
// can $set exactly one field instead of rewriting the whole document.
function resolveMediaValues(doc, specs) {
  const out = [];
  if (!doc || typeof doc !== "object") return out;

  for (const spec of specs) {
    const arrayAt = spec.indexOf("[]");
    if (arrayAt === -1) {
      const value = doc[spec];
      if (typeof value === "string" && value) {
        out.push({ spec, path: spec, value, set: (v) => { doc[spec] = v; } });
      }
      continue;
    }

    const arrayField = spec.slice(0, arrayAt);
    const subField = spec.slice(arrayAt + 2).replace(/^\./, "");
    const list = doc[arrayField];
    if (!Array.isArray(list)) continue;

    list.forEach((item, index) => {
      if (!subField) {
        if (typeof item === "string" && item) {
          out.push({
            spec,
            path: `${arrayField}.${index}`,
            value: item,
            set: (v) => { list[index] = v; },
          });
        }
        return;
      }
      if (item && typeof item === "object" && typeof item[subField] === "string" && item[subField]) {
        out.push({
          spec,
          path: `${arrayField}.${index}.${subField}`,
          value: item[subField],
          set: (v) => { item[subField] = v; },
        });
      }
    });
  }

  return out;
}

// Hosts a media field is allowed to point at, beyond the bucket itself.
//
// STORAGE_MIGRATION.md §5 says to reject anything that is not a storage key or
// a legacy Firebase URL. Taken literally that breaks editing existing content:
// seeded movies carry YouTube trailers and Unsplash posters, and re-saving such
// a doc unchanged would 400. The allowlist keeps the actual goal — a compromised
// admin session cannot repoint `video` at an arbitrary host — without that
// regression. Override with MEDIA_ALLOWED_URL_HOSTS (comma-separated).
const DEFAULT_ALLOWED_HOSTS = [
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
  "image.tmdb.org",
  "images.unsplash.com",
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
];

function allowedHosts() {
  const raw = process.env.MEDIA_ALLOWED_URL_HOSTS;
  if (!raw || !raw.trim()) return DEFAULT_ALLOWED_HOSTS;
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function isAllowedMediaValue(value) {
  if (typeof value !== "string" || value === "") return true; // clearing a field
  if (isStorageKey(value)) return true;
  if (isLegacyFirebaseUrl(value)) return true;

  let url;
  try {
    url = new URL(value);
  } catch (_) {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  return allowedHosts().indexOf(url.hostname.toLowerCase()) !== -1;
}

// Turns one of our own signed URLs back into the key it points at.
//
// The read middleware signs keys into URLs, so an admin edit form loads
// `video` as a signed URL and submits that same string back untouched when only
// the title changed. Without this the API would store an expiring URL in Mongo.
// Signing on read and normalising on write makes the round trip idempotent.
function toStorageKeyIfSigned(value) {
  if (typeof value !== "string" || !value.includes("://")) return value;

  let url;
  try {
    url = new URL(value);
  } catch (_) {
    return value;
  }

  let bucketHost;
  let bucket;
  try {
    const { config } = require("./config");
    const cfg = config();
    bucketHost = new URL(cfg.publicEndpoint).host;
    bucket = cfg.bucket;
  } catch (_) {
    return value; // storage unconfigured — nothing to normalise against
  }

  const path = decodeURIComponent(url.pathname.replace(/^\//, ""));

  // Path style: {host}/{bucket}/{key}
  if (url.host === bucketHost && path.startsWith(`${bucket}/`)) {
    const key = path.slice(bucket.length + 1);
    return isStorageKey(key) ? key : value;
  }
  // Virtual-host style: {bucket}.{host}/{key}
  if (url.host === `${bucket}.${bucketHost}`) {
    return isStorageKey(path) ? path : value;
  }
  return value;
}

// Rewrites any signed bucket URL in the body back to its bare key, in place.
function normalizeMediaFields(body, model) {
  for (const entry of resolveMediaValues(body, fieldsFor(model))) {
    const normalized = toStorageKeyIfSigned(entry.value);
    if (normalized !== entry.value) entry.set(normalized);
  }
  return body;
}

// Returns an error message, or null when every media field is acceptable.
// Normalises first, so a resubmitted signed URL validates as the key it is.
function validateMediaFields(body, model) {
  normalizeMediaFields(body, model);
  for (const entry of resolveMediaValues(body, fieldsFor(model))) {
    if (!isAllowedMediaValue(entry.value)) {
      return `"${entry.spec}" must be an uploaded storage key or a URL on an allowed media host`;
    }
  }
  return null;
}

// Storage keys only — legacy Firebase URLs are reported, not deleted, because
// the backend has no Firebase Storage credentials and should not get any.
function collectStorageKeys(doc, model) {
  return resolveMediaValues(doc, fieldsFor(model))
    .map((e) => e.value)
    .filter(isStorageKey);
}

function collectLegacyUrls(doc, model) {
  return resolveMediaValues(doc, fieldsFor(model))
    .map((e) => e.value)
    .filter(isLegacyFirebaseUrl);
}

module.exports = {
  MEDIA_MANIFEST,
  DEFAULT_ALLOWED_HOSTS,
  fieldsFor,
  resolveMediaValues,
  isAllowedMediaValue,
  toStorageKeyIfSigned,
  normalizeMediaFields,
  validateMediaFields,
  collectStorageKeys,
  collectLegacyUrls,
};
