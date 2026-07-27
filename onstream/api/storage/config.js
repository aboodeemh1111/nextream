// Single place the storage env vars are read, so the driver and the signer can
// never disagree about which bucket/host they are talking to.

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return fallback;
  }
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function boolFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return fallback;
  }
  return String(raw).trim().toLowerCase() === "true";
}

function config() {
  const endpoint = (process.env.S3_ENDPOINT || "").trim().replace(/\/+$/, "");
  if (!endpoint) {
    throw new Error(
      "S3_ENDPOINT is not set. Storage is unconfigured — see STORAGE_MIGRATION.md §10."
    );
  }
  // The host the *browser* reaches. Signatures cover the Host header, so if the
  // API talks to MinIO over a private address the public host must be signed.
  const publicEndpoint = (process.env.S3_PUBLIC_ENDPOINT || endpoint)
    .trim()
    .replace(/\/+$/, "");

  return {
    endpoint,
    publicEndpoint,
    region: (process.env.S3_REGION || "us-east-1").trim(),
    bucket: (process.env.S3_BUCKET || "nextream-media").trim(),
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: boolFromEnv("S3_FORCE_PATH_STYLE", true),
    maxUploadMb: intFromEnv("MEDIA_MAX_UPLOAD_MB", 4096),
  };
}

function assertCredentials(cfg) {
  if (!cfg.accessKeyId || !cfg.secretAccessKey) {
    throw new Error(
      "S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are not set. Storage is unconfigured."
    );
  }
}

module.exports = { config, assertCredentials, intFromEnv, boolFromEnv };
