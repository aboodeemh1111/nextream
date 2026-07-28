#!/usr/bin/env node
//
// Asserts the bucket host is reachable and CORS-correct for browser uploads.
// Run this before Phase 4 — a missing preflight or a hidden ETag makes every
// admin upload fail, and multipart fail silently.
//
//   node scripts/verifyCors.js                 # local MinIO
//   S3_ENDPOINT=https://storage.nextream.app node scripts/verifyCors.js
//
// NOTE: STORAGE_MIGRATION.md §2.5 configures this with `mc cors set` / the S3
// PutBucketCors API. Community MinIO implements neither — it answers
// "A header you provided implies functionality that is not implemented".
// Restrict origins with the server-level MINIO_API_CORS_ALLOW_ORIGIN env var
// instead (see docker-compose.dev.yml). This script checks the result either
// way, so it is valid against any S3-compatible host.

require("../loadEnv")();

const { config } = require("../storage/config");

const ORIGIN = process.env.CORS_TEST_ORIGIN || "http://localhost:3000";
const BAD_ORIGIN = "https://not-your-admin-app.example";

let failures = 0;

function check(label, ok, detail) {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (detail) console.log(`        ${detail}`);
  if (!ok) failures++;
}

async function preflight(origin, method) {
  const cfg = config();
  const res = await fetch(`${cfg.publicEndpoint}/${cfg.bucket}/probe-object`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": method,
      "Access-Control-Request-Headers": "content-type",
    },
  });
  return res;
}

async function main() {
  const cfg = config();
  console.log(`Endpoint : ${cfg.publicEndpoint}`);
  console.log(`Bucket   : ${cfg.bucket}`);
  console.log(`Origin   : ${ORIGIN}\n`);

  const put = await preflight(ORIGIN, "PUT");
  const allowOrigin = put.headers.get("access-control-allow-origin");
  check(
    "preflight PUT is allowed",
    put.status >= 200 && put.status < 300,
    `status ${put.status}`
  );
  check(
    "Access-Control-Allow-Origin echoes the admin origin",
    allowOrigin === ORIGIN || allowOrigin === "*",
    `got: ${allowOrigin}`
  );

  // ExposeHeaders lands on the actual response, not the preflight.
  const get = await fetch(`${cfg.publicEndpoint}/${cfg.bucket}/probe-object`, {
    headers: { Origin: ORIGIN },
  });
  const expose = (get.headers.get("access-control-expose-headers") || "")
    .toLowerCase();
  check(
    "ETag is exposed to the browser (required for multipart)",
    expose.includes("etag") || expose.includes("*"),
    `Access-Control-Expose-Headers: ${expose || "(absent)"}`
  );

  const bad = await preflight(BAD_ORIGIN, "PUT");
  const badAllow = bad.headers.get("access-control-allow-origin");
  if (badAllow === BAD_ORIGIN || badAllow === "*") {
    console.log(
      `  warn  bucket accepts uploads from any origin (${BAD_ORIGIN} allowed).\n` +
        "        Set MINIO_API_CORS_ALLOW_ORIGIN on the MinIO server to restrict it."
    );
  } else {
    check("an unknown origin is rejected", true, `got: ${badAllow}`);
  }

  console.log(
    failures === 0 ? "\nCORS looks correct." : `\n${failures} check(s) failed.`
  );
  // exitCode rather than exit(): fetch keeps sockets alive briefly, and forcing
  // the process down mid-flight trips a libuv assertion on Windows.
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error("\nCORS verification could not run:", err.message);
  process.exitCode = 1;
});
