const { isStorageKey } = require("../storage/keys");
const sign = require("../storage/sign");

// The client apps read movie.img, movie.video, episode.videoSources[].url and
// friends directly as URLs across ~20 render sites. Mongo now stores *keys*, so
// this wraps res.json once and signs them on the way out — every current and
// future endpoint is covered without editing movies.js (7 sites), tv.js (14),
// users.js, lists.js, reviews.js or comments.js.
//
// Dual-read falls out for free: anything that is not a storage key is returned
// untouched, so legacy Firebase URLs keep playing and there is no flag day.
// Unsplash demo data (movies.js:129 and :281), TMDB posters and YouTube
// trailers pass through the same way.

const MAX_DEPTH = 8;

// Never media, and skipping them avoids walking large ObjectId/Date graphs.
const SKIP_KEYS = new Set(["_id", "createdAt", "updatedAt", "__v"]);

// /api/uploads returns freshly minted *keys* for the admin app to submit back.
// Signing those would hand the admin a URL, which would then be written to
// Mongo and expire — so the upload API is exempt from the transform.
const SKIP_PREFIXES = ["/api/uploads", "/uploads"];

let signFailureLogged = false;

function signIfKey(value) {
  if (!isStorageKey(value)) return value;
  try {
    return sign.presignGet(value);
  } catch (err) {
    // Storage unconfigured or misconfigured: return the raw key rather than
    // 500 the whole API. Phase 3 is meant to be a no-op until keys exist.
    if (!signFailureLogged) {
      signFailureLogged = true;
      console.error("mediaUrls: could not sign storage keys:", err.message);
    }
    return value;
  }
}

function transform(value, depth) {
  if (typeof value === "string") return signIfKey(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return value;

  // Mongoose documents and subdocuments serialise through toJSON; walking them
  // raw would traverse $__, _doc and other internals.
  let plain = value;
  if (typeof value.toJSON === "function") {
    plain = value.toJSON();
    if (typeof plain === "string") return signIfKey(plain);
    if (plain === null || typeof plain !== "object") return plain;
  }

  if (Array.isArray(plain)) {
    return plain.map((item) => transform(item, depth + 1));
  }

  const out = {};
  for (const key of Object.keys(plain)) {
    out[key] = SKIP_KEYS.has(key)
      ? plain[key]
      : transform(plain[key], depth + 1);
  }
  return out;
}

function isExempt(path) {
  return SKIP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

module.exports = function mediaUrls(req, res, next) {
  if (isExempt(req.path)) return next();

  const orig = res.json.bind(res);
  res.json = (body) => orig(transform(body, 0));
  next();
};

module.exports.transform = (body) => transform(body, 0);
