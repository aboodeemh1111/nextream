const router = require("express").Router();
const verify = require("../verifyToken");
const storage = require("../storage");
const { buildKey, isStorageKey, isPrefix, PREFIXES } = require("../storage/keys");
const sign = require("../storage/sign");
const { config } = require("../storage/config");

// Uploads previously went browser -> Firebase Storage directly, guarded by
// Storage rules alone: verifyToken.js was never involved. Every route here is
// behind verify + an explicit isAdmin check, matching movies.js:10.

const SUBTITLE_TYPES = [
  "text/vtt",
  "text/plain",
  "application/x-subrip",
  "application/octet-stream",
];

// What each prefix is allowed to hold. Derived from the actual admin call
// sites: shows/ only ever receives posters and backdrops, while episodes/ holds
// both episode video and stillPath/thumbnail images.
const POLICY = {
  images: { types: ["image/"], maxMb: 25 },
  avatars: { types: ["image/"], maxMb: 10 },
  shows: { types: ["image/"], maxMb: 25 },
  trailers: { types: ["video/"], maxMb: null },
  videos: { types: ["video/"], maxMb: null },
  episodes: { types: ["video/", "image/"], maxMb: null },
  subs: { types: SUBTITLE_TYPES, maxMb: 5 },
};

// Images are keyed by UUID, so they can never be stale — cache them forever.
const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

const PUT_TTL = 900;
const PART_TTL = 3600;
const MIN_PART_SIZE = 5 * 1024 * 1024; // S3 floor for every part but the last
const DEFAULT_PART_SIZE = 16 * 1024 * 1024;
const MAX_PARTS = 10000;

function typeAllowed(prefix, contentType) {
  const allowed = POLICY[prefix].types;
  return allowed.some((t) =>
    t.endsWith("/") ? contentType.startsWith(t) : contentType === t
  );
}

function maxBytesFor(prefix) {
  const perPrefix = POLICY[prefix].maxMb;
  const mb = perPrefix === null ? config().maxUploadMb : perPrefix;
  return mb * 1024 * 1024;
}

// Throws a message suitable for a 400. Never trusts prefix, filename or type.
function validateRequest(body) {
  const prefix = body && body.prefix;
  const filename = body && body.filename;
  const contentType = body && body.contentType;
  const size = body && body.size;

  if (!isPrefix(prefix)) {
    throw new Error(
      `Invalid prefix. Allowed: ${PREFIXES.join(", ")}`
    );
  }
  if (typeof filename !== "string" || !filename.trim()) {
    throw new Error("filename is required");
  }
  if (typeof contentType !== "string" || !contentType.trim()) {
    throw new Error("contentType is required");
  }
  if (!typeAllowed(prefix, contentType)) {
    throw new Error(
      `contentType "${contentType}" is not allowed for prefix "${prefix}"`
    );
  }
  if (size !== undefined && size !== null) {
    const bytes = Number(size);
    if (!Number.isFinite(bytes) || bytes < 0) {
      throw new Error("size must be a positive number");
    }
    // Advisory only: a presigned PUT carries no server-side size limit, so a
    // hostile client can still exceed this. Real enforcement belongs in nginx.
    if (bytes > maxBytesFor(prefix)) {
      throw new Error(
        `File is too large for "${prefix}". Max ${Math.floor(
          maxBytesFor(prefix) / (1024 * 1024)
        )} MB`
      );
    }
  }

  // buildKey does the traversal / absolute-path / null-byte rejection.
  return { prefix, contentType, key: buildKey(prefix, filename.trim()) };
}

function cacheControlFor(contentType) {
  return contentType.startsWith("image/") ? IMAGE_CACHE_CONTROL : undefined;
}

function partSizeFor(size) {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return DEFAULT_PART_SIZE;
  // Stay under the 10k part ceiling for very large files.
  return Math.max(DEFAULT_PART_SIZE, Math.ceil(bytes / MAX_PARTS));
}

function badRequest(res, err) {
  return res.status(400).json({ error: "UPLOAD_BAD_REQUEST", message: err.message });
}

function serverError(res, code, err) {
  console.error(`${code}:`, err);
  return res.status(500).json({ error: code, message: err.message });
}

// --- Simple upload: images, subtitles, small video --------------------------

router.post("/presign", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  let parsed;
  try {
    parsed = validateRequest(req.body);
  } catch (err) {
    return badRequest(res, err);
  }

  try {
    const cacheControl = cacheControlFor(parsed.contentType);
    const uploadUrl = await storage.presignPut(
      parsed.key,
      parsed.contentType,
      PUT_TTL,
      { cacheControl }
    );
    // The signature pins these headers — the client must send them verbatim.
    const headers = { "Content-Type": parsed.contentType };
    if (cacheControl) headers["Cache-Control"] = cacheControl;

    res.status(200).json({
      key: parsed.key,
      uploadUrl,
      headers,
      expiresIn: PUT_TTL,
    });
  } catch (err) {
    return serverError(res, "UPLOAD_PRESIGN_FAILED", err);
  }
});

// --- Multipart: large video -------------------------------------------------
//
// VideoUploader has pause / resume / cancel / ETA today on 2 GB files. A single
// presigned PUT cannot resume, so dropping to one would be a visible UX
// regression. With multipart, pause is "stop requesting new part URLs" and
// cancel maps to abort.

router.post("/multipart/create", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  let parsed;
  try {
    parsed = validateRequest(req.body);
  } catch (err) {
    return badRequest(res, err);
  }

  try {
    const { uploadId } = await storage.createMultipart(
      parsed.key,
      parsed.contentType,
      { cacheControl: cacheControlFor(parsed.contentType) }
    );
    res.status(200).json({
      key: parsed.key,
      uploadId,
      partSize: partSizeFor(req.body && req.body.size),
      minPartSize: MIN_PART_SIZE,
    });
  } catch (err) {
    return serverError(res, "MULTIPART_CREATE_FAILED", err);
  }
});

router.post("/multipart/part", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  const { key, uploadId, partNumber } = req.body || {};
  if (!isStorageKey(key)) {
    return badRequest(res, new Error("A valid storage key is required"));
  }
  if (typeof uploadId !== "string" || !uploadId) {
    return badRequest(res, new Error("uploadId is required"));
  }
  const n = Number(partNumber);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARTS) {
    return badRequest(
      res,
      new Error(`partNumber must be an integer between 1 and ${MAX_PARTS}`)
    );
  }

  try {
    const url = await storage.presignPart(key, uploadId, n, PART_TTL);
    res.status(200).json({ url, expiresIn: PART_TTL });
  } catch (err) {
    return serverError(res, "MULTIPART_PART_FAILED", err);
  }
});

router.post("/multipart/complete", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  const { key, uploadId, parts } = req.body || {};
  if (!isStorageKey(key)) {
    return badRequest(res, new Error("A valid storage key is required"));
  }
  if (typeof uploadId !== "string" || !uploadId) {
    return badRequest(res, new Error("uploadId is required"));
  }
  if (!Array.isArray(parts) || parts.length === 0) {
    return badRequest(res, new Error("parts must be a non-empty array"));
  }
  for (const part of parts) {
    const n = Number(part && part.PartNumber);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PARTS) {
      return badRequest(res, new Error("each part needs a valid PartNumber"));
    }
    if (typeof (part && part.ETag) !== "string" || !part.ETag) {
      return badRequest(res, new Error("each part needs an ETag"));
    }
  }

  try {
    await storage.completeMultipart(key, uploadId, parts);
    const head = await storage.headObject(key);
    if (!head) {
      return res.status(502).json({
        error: "MULTIPART_COMPLETE_FAILED",
        message: "Upload completed but the object is not present",
      });
    }
    res.status(200).json({ key, size: head.size });
  } catch (err) {
    return serverError(res, "MULTIPART_COMPLETE_FAILED", err);
  }
});

router.post("/multipart/abort", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  const { key, uploadId } = req.body || {};
  if (!isStorageKey(key)) {
    return badRequest(res, new Error("A valid storage key is required"));
  }
  if (typeof uploadId !== "string" || !uploadId) {
    return badRequest(res, new Error("uploadId is required"));
  }

  try {
    await storage.abortMultipart(key, uploadId);
    res.status(204).end();
  } catch (err) {
    return serverError(res, "MULTIPART_ABORT_FAILED", err);
  }
});

// --- Confirm ----------------------------------------------------------------
//
// This is what makes the backend authoritative: a key only enters Mongo after
// the server has confirmed the object actually landed. previewUrl is a signed
// GET purely so the admin form can render a preview — only `key` gets submitted.

router.post("/complete", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  const key = req.body && req.body.key;
  if (!isStorageKey(key)) {
    return badRequest(res, new Error("A valid storage key is required"));
  }

  try {
    const head = await storage.headObject(key);
    if (!head) {
      return res
        .status(404)
        .json({ error: "UPLOAD_NOT_FOUND", message: "No object at that key" });
    }
    res.status(200).json({
      key,
      size: head.size,
      contentType: head.contentType,
      previewUrl: sign.presignGet(key),
    });
  } catch (err) {
    return serverError(res, "UPLOAD_COMPLETE_FAILED", err);
  }
});

// --- Delete -----------------------------------------------------------------

router.delete("/:key(*)", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  const key = req.params.key;
  if (!isStorageKey(key)) {
    return badRequest(res, new Error("A valid storage key is required"));
  }

  try {
    await storage.deleteObject(key);
    res.status(204).end();
  } catch (err) {
    return serverError(res, "UPLOAD_DELETE_FAILED", err);
  }
});

module.exports = router;
