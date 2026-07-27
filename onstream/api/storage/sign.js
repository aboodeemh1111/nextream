const crypto = require("crypto");
const { config, assertCredentials, intFromEnv } = require("./config");
const { mediaTypeFor } = require("./keys");

// --- TTL policy -------------------------------------------------------------
//
// The gotcha that breaks production: a 15-minute signed URL expires *mid-movie*.
// Progressive MP4 playback re-requests byte ranges for the whole session using
// the same URL, so a 2-hour film on a short signature dies the first time the
// viewer seeks past the expiry. Video TTL is floored at 6h for that reason —
// a too-short value here fails silently and only in production.

const MIN_VIDEO_TTL = 6 * 3600;
const MAX_TTL = 7 * 24 * 3600; // hard S3/SigV4 ceiling for presigned URLs

function clamp(ttl, min) {
  return Math.min(MAX_TTL, Math.max(min, ttl));
}

function ttlPolicy() {
  return {
    video: clamp(intFromEnv("MEDIA_URL_TTL_VIDEO", 6 * 3600), MIN_VIDEO_TTL),
    image: clamp(intFromEnv("MEDIA_URL_TTL_IMAGE", 24 * 3600), 60),
    subtitle: clamp(intFromEnv("MEDIA_URL_TTL_SUBTITLE", 6 * 3600), 60),
  };
}

function ttlFor(key) {
  return ttlPolicy()[mediaTypeFor(key)];
}

// --- SigV4 query-string presigning (synchronous) ----------------------------
//
// Hand-rolled rather than using @aws-sdk/s3-request-presigner because that API
// is async, and the read middleware wraps the *synchronous* res.json(). It is
// pure HMAC, and sign.test.js asserts byte-identical output against the SDK.

const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

// encodeURIComponent leaves !'()* unescaped; RFC 3986 unreserved is A-Za-z0-9-_.~
function rfc3986(str) {
  return encodeURIComponent(String(str)).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function encodePath(key) {
  return String(key).split("/").map(rfc3986).join("/");
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key, value) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function amzDateOf(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function signGetUrl(key, ttl, options) {
  const opts = options || {};
  const cfg = config();
  assertCredentials(cfg);

  const url = new URL(cfg.publicEndpoint);
  const host = cfg.forcePathStyle ? url.host : `${cfg.bucket}.${url.host}`;
  const canonicalPath = cfg.forcePathStyle
    ? `/${rfc3986(cfg.bucket)}/${encodePath(key)}`
    : `/${encodePath(key)}`;

  const date = opts.date || new Date();
  const amzDate = amzDateOf(date);
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;

  // X-Amz-Content-Sha256 and x-id mirror exactly what
  // @aws-sdk/s3-request-presigner emits, so sign.test.js can assert byte-equal
  // output against it. S3 and MinIO both ignore x-id.
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Content-Sha256": UNSIGNED_PAYLOAD,
    "X-Amz-Credential": `${cfg.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(ttl),
    "X-Amz-SignedHeaders": "host",
    "x-id": "GetObject",
  };
  if (opts.download) {
    const filename = String(opts.download).replace(/["\\\r\n]/g, "");
    query["response-content-disposition"] = `attachment; filename="${filename}"`;
  }

  // Every parameter name here is unreserved, so sorting raw names matches
  // sorting their encoded form as SigV4 requires.
  const serialize = (params) =>
    Object.keys(params)
      .sort()
      .map((name) => `${rfc3986(name)}=${rfc3986(params[name])}`)
      .join("&");

  const canonicalQuery = serialize(query);

  const canonicalRequest = [
    "GET",
    canonicalPath,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    UNSIGNED_PAYLOAD,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, dateStamp), cfg.region), "s3"),
    "aws4_request"
  );
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  const finalQuery = serialize(
    Object.assign({}, query, { "X-Amz-Signature": signature })
  );
  return `${url.protocol}//${host}${canonicalPath}?${finalQuery}`;
}

// --- Memoisation ------------------------------------------------------------
//
// One movie-list response can hit this 150 times. Entries are handed out only
// while at least half their lifetime remains, so a cached URL is never close to
// expiring when the client receives it.

const CACHE_MAX = 5000;
const cache = new Map();

function cacheGet(cacheKey, now) {
  const hit = cache.get(cacheKey);
  if (!hit) return null;
  if (hit.usableUntil <= now) {
    cache.delete(cacheKey);
    return null;
  }
  return hit.url;
}

function cachePut(cacheKey, url, ttl, now) {
  if (cache.size >= CACHE_MAX) {
    // Map preserves insertion order — drop the oldest slice.
    let toDrop = Math.ceil(CACHE_MAX / 10);
    for (const k of cache.keys()) {
      cache.delete(k);
      if (--toDrop <= 0) break;
    }
  }
  cache.set(cacheKey, { url, usableUntil: now + (ttl * 1000) / 2 });
}

function presignGet(key, ttl, options) {
  const opts = options || {};
  const effectiveTtl = ttl || ttlFor(key);
  const cacheKey = `${key}|${effectiveTtl}|${opts.download || ""}`;
  const now = Date.now();

  const hit = cacheGet(cacheKey, now);
  if (hit) return hit;

  const url = signGetUrl(key, effectiveTtl, opts);
  cachePut(cacheKey, url, effectiveTtl, now);
  return url;
}

function clearCache() {
  cache.clear();
}

module.exports = {
  MIN_VIDEO_TTL,
  MAX_TTL,
  ttlPolicy,
  ttlFor,
  signGetUrl,
  presignGet,
  clearCache,
};
