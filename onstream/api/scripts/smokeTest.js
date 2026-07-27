#!/usr/bin/env node
//
// Live round-trip against the configured bucket:
//   presign PUT -> upload -> headObject -> signed GET -> ranged GET -> delete
// plus a full multipart create/part/complete cycle and an abort.
//
//   node scripts/smokeTest.js
//   S3_ENDPOINT=https://storage.nextream.app node scripts/smokeTest.js
//
// The ranged GET is the one that matters most: without 206 Partial Content and
// Accept-Ranges, seeking breaks and iOS Safari refuses to play at all.

require("../loadEnv")();

const assert = require("node:assert");
const storage = require("../storage");
const { buildKey } = require("../storage/keys");
const sign = require("../storage/sign");
const { config } = require("../storage/config");

const created = [];
let failures = 0;

async function step(label, fn) {
  try {
    const detail = await fn();
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    failures++;
    console.log(` FAIL  ${label}\n        ${err.message}`);
  }
}

async function main() {
  const cfg = config();
  console.log(`Endpoint : ${cfg.endpoint}`);
  console.log(`Bucket   : ${cfg.bucket}\n`);

  // --- simple upload --------------------------------------------------------
  const imageKey = buildKey("images", "smoke poster.jpg");
  const imageBody = Buffer.from("fake-jpeg-bytes-for-smoke-test");

  await step("presign PUT + upload an image", async () => {
    const url = await storage.presignPut(imageKey, "image/jpeg", 900, {
      cacheControl: "public, max-age=31536000, immutable",
    });
    const res = await fetch(url, {
      method: "PUT",
      body: imageBody,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
    assert.strictEqual(res.status, 200, `PUT returned ${res.status}`);
    created.push(imageKey);
    return imageKey;
  });

  await step("headObject confirms size and content type", async () => {
    const head = await storage.headObject(imageKey);
    assert.ok(head, "headObject returned null");
    assert.strictEqual(head.size, imageBody.length);
    assert.strictEqual(head.contentType, "image/jpeg");
    return `${head.size} bytes`;
  });

  await step("headObject returns null for a missing key", async () => {
    const head = await storage.headObject("images/2026/07/does-not-exist.jpg");
    assert.strictEqual(head, null);
  });

  await step("signed GET returns the bytes", async () => {
    const res = await fetch(sign.presignGet(imageKey));
    assert.strictEqual(res.status, 200, `GET returned ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    assert.ok(body.equals(imageBody), "body did not round-trip");
    return `Cache-Control: ${res.headers.get("cache-control")}`;
  });

  await step("an unsigned GET is refused (bucket stays private)", async () => {
    const res = await fetch(`${cfg.publicEndpoint}/${cfg.bucket}/${imageKey}`);
    assert.ok(res.status === 403 || res.status === 401, `got ${res.status}`);
    return `status ${res.status}`;
  });

  await step("a tampered signature is refused", async () => {
    const url = sign.presignGet(imageKey).replace(/(X-Amz-Signature=)./, "$10");
    const res = await fetch(url);
    assert.ok(res.status >= 400, `got ${res.status}`);
    return `status ${res.status}`;
  });

  // --- range requests -------------------------------------------------------
  const videoKey = buildKey("videos", "smoke clip.mp4");
  const videoBody = Buffer.alloc(4096, 7);

  await step("upload a video object", async () => {
    const url = await storage.presignPut(videoKey, "video/mp4", 900);
    const res = await fetch(url, {
      method: "PUT",
      body: videoBody,
      headers: { "Content-Type": "video/mp4" },
    });
    assert.strictEqual(res.status, 200, `PUT returned ${res.status}`);
    created.push(videoKey);
  });

  await step("video signed URL has a >= 6h TTL", async () => {
    const url = new URL(sign.presignGet(videoKey));
    const expires = Number(url.searchParams.get("X-Amz-Expires"));
    assert.ok(expires >= 6 * 3600, `X-Amz-Expires was ${expires}`);
    return `${expires}s`;
  });

  await step("ranged GET returns 206 with Accept-Ranges", async () => {
    const res = await fetch(sign.presignGet(videoKey), {
      headers: { Range: "bytes=0-1023" },
    });
    assert.strictEqual(res.status, 206, `expected 206, got ${res.status}`);
    assert.strictEqual(res.headers.get("accept-ranges"), "bytes");
    assert.strictEqual(res.headers.get("content-length"), "1024");
    assert.strictEqual(
      res.headers.get("content-range"),
      `bytes 0-1023/${videoBody.length}`
    );
    return res.headers.get("content-range");
  });

  await step("a mid-file range seek works", async () => {
    const res = await fetch(sign.presignGet(videoKey), {
      headers: { Range: "bytes=2048-3071" },
    });
    assert.strictEqual(res.status, 206);
    const body = Buffer.from(await res.arrayBuffer());
    assert.strictEqual(body.length, 1024);
    return res.headers.get("content-range");
  });

  // --- multipart ------------------------------------------------------------
  const multiKey = buildKey("videos", "smoke multipart.mp4");
  // 5 MiB is the S3 minimum for every part except the last.
  const partA = Buffer.alloc(5 * 1024 * 1024, 1);
  const partB = Buffer.alloc(1024, 2);

  await step("multipart create -> parts -> complete", async () => {
    const { uploadId } = await storage.createMultipart(multiKey, "video/mp4");
    const parts = [];
    for (const [index, chunk] of [partA, partB].entries()) {
      const partNumber = index + 1;
      const url = await storage.presignPart(multiKey, uploadId, partNumber);
      const res = await fetch(url, { method: "PUT", body: chunk });
      assert.strictEqual(res.status, 200, `part ${partNumber}: ${res.status}`);
      const etag = res.headers.get("etag");
      assert.ok(etag, `part ${partNumber} returned no ETag`);
      parts.push({ PartNumber: partNumber, ETag: etag });
    }
    await storage.completeMultipart(multiKey, uploadId, parts);
    created.push(multiKey);

    const head = await storage.headObject(multiKey);
    assert.ok(head, "completed multipart object is missing");
    assert.strictEqual(head.size, partA.length + partB.length);
    return `${head.size} bytes in ${parts.length} parts`;
  });

  await step("multipart abort leaves nothing behind", async () => {
    const abortKey = buildKey("videos", "smoke aborted.mp4");
    const { uploadId } = await storage.createMultipart(abortKey, "video/mp4");
    const url = await storage.presignPart(abortKey, uploadId, 1);
    const res = await fetch(url, { method: "PUT", body: partA });
    assert.strictEqual(res.status, 200);

    await storage.abortMultipart(abortKey, uploadId);
    assert.strictEqual(
      await storage.headObject(abortKey),
      null,
      "aborted upload still produced an object"
    );
  });

  // --- cleanup --------------------------------------------------------------
  await step("deleteObject removes the blob", async () => {
    for (const key of created) await storage.deleteObject(key);
    for (const key of created) {
      assert.strictEqual(await storage.headObject(key), null, `${key} survived`);
    }
    return `${created.length} objects`;
  });

  console.log(
    failures === 0
      ? "\nAll storage round-trips passed."
      : `\n${failures} check(s) failed.`
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(async (err) => {
  console.error("\nSmoke test aborted:", err.message);
  for (const key of created) {
    try {
      await storage.deleteObject(key);
    } catch (_) {
      /* best effort */
    }
  }
  process.exitCode = 1;
});
