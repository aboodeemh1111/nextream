// Integration test for the upload API. Talks to a real bucket (local MinIO by
// default) over real HTTP, but mounts only the uploads router so it needs no
// Mongo connection.
//
//   docker compose -f ../../docker-compose.dev.yml up -d
//   node --test routes/uploads.test.js

require("../loadEnv")();

const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.SECRET_KEY = process.env.SECRET_KEY || "test-secret";

const storage = require("../storage");
const uploadsRoute = require("./uploads");

const app = express();
app.use(express.json());
app.use("/api/uploads", uploadsRoute);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api/uploads`;
test.after(() => server.close());

const adminToken = jwt.sign(
  { id: "admin-1", isAdmin: true },
  process.env.SECRET_KEY,
  { expiresIn: "1h" }
);
const userToken = jwt.sign(
  { id: "user-1", isAdmin: false },
  process.env.SECRET_KEY,
  { expiresIn: "1h" }
);

const created = [];

function call(path, options) {
  const opts = options || {};
  const headers = { "Content-Type": "application/json" };
  if (opts.token) headers.token = `Bearer ${opts.token}`;
  return fetch(`${base}${path}`, {
    method: opts.method || "POST",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

test.after(async () => {
  for (const key of created) {
    try {
      await storage.deleteObject(key);
    } catch (_) {
      /* best effort */
    }
  }
});

// --- Authorisation ----------------------------------------------------------

const ALL_ROUTES = [
  ["/presign", "POST"],
  ["/multipart/create", "POST"],
  ["/multipart/part", "POST"],
  ["/multipart/complete", "POST"],
  ["/multipart/abort", "POST"],
  ["/complete", "POST"],
  ["/videos/2026/07/uuid-x.mp4", "DELETE"],
];

test("a non-admin JWT gets 403 from every route", async () => {
  for (const [path, method] of ALL_ROUTES) {
    const res = await call(path, { method, token: userToken, body: {} });
    assert.strictEqual(res.status, 403, `${method} ${path}`);
  }
});

test("no token at all gets 401 from every route", async () => {
  for (const [path, method] of ALL_ROUTES) {
    const res = await call(path, { method, body: {} });
    assert.strictEqual(res.status, 401, `${method} ${path}`);
  }
});

test("a token signed with the wrong secret gets 403", async () => {
  const forged = jwt.sign({ id: "x", isAdmin: true }, "not-the-secret");
  const res = await call("/presign", { token: forged, body: {} });
  assert.strictEqual(res.status, 403);
});

// --- Input validation -------------------------------------------------------

test("a forged prefix is rejected", async () => {
  for (const prefix of ["etc", "../videos", "", null, "videos/../..", 42]) {
    const res = await call("/presign", {
      token: adminToken,
      body: { prefix, filename: "x.mp4", contentType: "video/mp4" },
    });
    assert.strictEqual(res.status, 400, `prefix: ${prefix}`);
  }
});

test("a traversal filename is rejected", async () => {
  for (const filename of [
    "../../etc/passwd",
    "/etc/passwd",
    "..\\..\\windows\\system32",
    "C:\\secrets.mp4",
  ]) {
    const res = await call("/presign", {
      token: adminToken,
      body: { prefix: "videos", filename, contentType: "video/mp4" },
    });
    assert.strictEqual(res.status, 400, `filename: ${filename}`);
    const body = await res.json();
    assert.strictEqual(body.error, "UPLOAD_BAD_REQUEST");
  }
});

test("content type must match the prefix", async () => {
  const rejected = [
    ["images", "video/mp4"],
    ["videos", "image/png"],
    ["subs", "video/mp4"],
    ["shows", "video/mp4"],
    ["avatars", "text/html"],
  ];
  for (const [prefix, contentType] of rejected) {
    const res = await call("/presign", {
      token: adminToken,
      body: { prefix, filename: "x.bin", contentType },
    });
    assert.strictEqual(res.status, 400, `${prefix} + ${contentType}`);
  }

  const accepted = [
    ["images", "image/jpeg"],
    ["videos", "video/mp4"],
    ["subs", "text/vtt"],
    ["shows", "image/png"],
    ["episodes", "video/mp4"],
    ["episodes", "image/jpeg"], // stillPath / thumbnails
  ];
  for (const [prefix, contentType] of accepted) {
    const res = await call("/presign", {
      token: adminToken,
      body: { prefix, filename: "x.bin", contentType },
    });
    assert.strictEqual(res.status, 200, `${prefix} + ${contentType}`);
  }
});

test("oversized uploads are rejected per prefix", async () => {
  const res = await call("/presign", {
    token: adminToken,
    body: {
      prefix: "images",
      filename: "huge.jpg",
      contentType: "image/jpeg",
      size: 200 * 1024 * 1024,
    },
  });
  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).message, /too large/i);
});

test("the server generates the key — the client cannot choose it", async () => {
  const res = await call("/presign", {
    token: adminToken,
    body: {
      prefix: "videos",
      filename: "movie.mp4",
      contentType: "video/mp4",
      key: "videos/attacker-chosen.mp4",
      Key: "videos/attacker-chosen.mp4",
    },
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.notStrictEqual(body.key, "videos/attacker-chosen.mp4");
  assert.match(body.key, /^videos\/\d{4}\/\d{2}\/[0-9a-f-]{36}-movie\.mp4$/);
});

// --- Simple upload round trip ----------------------------------------------

test("presign -> PUT -> complete round-trips an image", async () => {
  const presign = await call("/presign", {
    token: adminToken,
    body: {
      prefix: "images",
      filename: "poster.jpg",
      contentType: "image/jpeg",
      size: 12,
    },
  });
  assert.strictEqual(presign.status, 200);
  const { key, uploadUrl, headers, expiresIn } = await presign.json();
  created.push(key);

  assert.strictEqual(headers["Content-Type"], "image/jpeg");
  assert.strictEqual(
    headers["Cache-Control"],
    "public, max-age=31536000, immutable"
  );
  assert.strictEqual(expiresIn, 900);

  const body = Buffer.from("hello-jpeg!!");
  const put = await fetch(uploadUrl, { method: "PUT", body, headers });
  assert.strictEqual(put.status, 200, `PUT returned ${put.status}`);

  const complete = await call("/complete", { token: adminToken, body: { key } });
  assert.strictEqual(complete.status, 200);
  const done = await complete.json();
  assert.strictEqual(done.key, key);
  assert.strictEqual(done.size, body.length);
  assert.ok(done.previewUrl.includes("X-Amz-Signature"));

  // The preview URL must actually resolve.
  const preview = await fetch(done.previewUrl);
  assert.strictEqual(preview.status, 200);
});

test("Content-Type is pinned by the signature, not merely allowlisted", async () => {
  const presign = await call("/presign", {
    token: adminToken,
    body: { prefix: "images", filename: "p.jpg", contentType: "image/jpeg" },
  });
  const { key, uploadUrl, headers } = await presign.json();
  created.push(key);

  // The type the server approved must appear in SignedHeaders, otherwise the
  // per-prefix allowlist is decorative and any bytes can be stored as any type.
  assert.strictEqual(
    new URL(uploadUrl).searchParams.get("X-Amz-SignedHeaders"),
    "content-type;host"
  );

  const wrong = await fetch(uploadUrl, {
    method: "PUT",
    body: Buffer.from("<script>alert(1)</script>"),
    headers: { "Content-Type": "text/html" },
  });
  assert.ok(wrong.status >= 400, `expected rejection, got ${wrong.status}`);

  // The approved type still works.
  const right = await fetch(uploadUrl, {
    method: "PUT",
    body: Buffer.from("x"),
    headers,
  });
  assert.strictEqual(right.status, 200);
});

test("/complete 404s for a key that was never uploaded", async () => {
  const res = await call("/complete", {
    token: adminToken,
    body: { key: "images/2026/07/never-uploaded.jpg" },
  });
  assert.strictEqual(res.status, 404);
});

test("/complete rejects a non-key", async () => {
  for (const key of [
    "https://firebasestorage.googleapis.com/v0/b/x/o/y.jpg",
    "../../etc/passwd",
    "etc/passwd",
    "",
  ]) {
    const res = await call("/complete", { token: adminToken, body: { key } });
    assert.strictEqual(res.status, 400, `key: ${key}`);
  }
});

// --- Multipart --------------------------------------------------------------

test("multipart create -> part -> complete round-trips a video", async () => {
  const create = await call("/multipart/create", {
    token: adminToken,
    body: {
      prefix: "videos",
      filename: "big movie.mp4",
      contentType: "video/mp4",
      size: 6 * 1024 * 1024,
    },
  });
  assert.strictEqual(create.status, 200);
  const { key, uploadId, partSize } = await create.json();
  created.push(key);
  assert.ok(uploadId);
  assert.strictEqual(partSize, 16 * 1024 * 1024);

  const chunks = [Buffer.alloc(5 * 1024 * 1024, 1), Buffer.alloc(1024, 2)];
  const parts = [];
  for (const [index, chunk] of chunks.entries()) {
    const partNumber = index + 1;
    const partRes = await call("/multipart/part", {
      token: adminToken,
      body: { key, uploadId, partNumber },
    });
    assert.strictEqual(partRes.status, 200);
    const { url } = await partRes.json();
    const put = await fetch(url, { method: "PUT", body: chunk });
    assert.strictEqual(put.status, 200);
    const etag = put.headers.get("etag");
    assert.ok(etag, "no ETag exposed — check bucket CORS ExposeHeaders");
    parts.push({ PartNumber: partNumber, ETag: etag });
  }

  const complete = await call("/multipart/complete", {
    token: adminToken,
    body: { key, uploadId, parts },
  });
  assert.strictEqual(complete.status, 200);
  const done = await complete.json();
  assert.strictEqual(done.size, 5 * 1024 * 1024 + 1024);
});

test("multipart abort cancels the upload", async () => {
  const create = await call("/multipart/create", {
    token: adminToken,
    body: { prefix: "videos", filename: "cancel.mp4", contentType: "video/mp4" },
  });
  const { key, uploadId } = await create.json();

  const partRes = await call("/multipart/part", {
    token: adminToken,
    body: { key, uploadId, partNumber: 1 },
  });
  const { url } = await partRes.json();
  const put = await fetch(url, {
    method: "PUT",
    body: Buffer.alloc(5 * 1024 * 1024, 3),
  });
  assert.strictEqual(put.status, 200);

  const abort = await call("/multipart/abort", {
    token: adminToken,
    body: { key, uploadId },
  });
  assert.strictEqual(abort.status, 204);
  assert.strictEqual(
    await storage.headObject(key),
    null,
    "aborted upload left an object behind"
  );
});

test("multipart routes validate their inputs", async () => {
  const cases = [
    ["/multipart/part", { key: "../x", uploadId: "u", partNumber: 1 }],
    ["/multipart/part", { key: "videos/2026/07/a.mp4", partNumber: 1 }],
    ["/multipart/part", { key: "videos/2026/07/a.mp4", uploadId: "u", partNumber: 0 }],
    ["/multipart/part", { key: "videos/2026/07/a.mp4", uploadId: "u", partNumber: 99999 }],
    ["/multipart/complete", { key: "videos/2026/07/a.mp4", uploadId: "u", parts: [] }],
    ["/multipart/complete", { key: "videos/2026/07/a.mp4", uploadId: "u", parts: [{ PartNumber: 1 }] }],
    ["/multipart/abort", { key: "etc/passwd", uploadId: "u" }],
  ];
  for (const [path, body] of cases) {
    const res = await call(path, { token: adminToken, body });
    assert.strictEqual(res.status, 400, `${path} ${JSON.stringify(body)}`);
  }
});

// --- Delete -----------------------------------------------------------------

test("DELETE removes an uploaded object", async () => {
  const presign = await call("/presign", {
    token: adminToken,
    body: { prefix: "images", filename: "doomed.jpg", contentType: "image/jpeg" },
  });
  const { key, uploadUrl, headers } = await presign.json();
  await fetch(uploadUrl, { method: "PUT", body: Buffer.from("x"), headers });
  assert.ok(await storage.headObject(key));

  const res = await call(`/${key}`, { method: "DELETE", token: adminToken });
  assert.strictEqual(res.status, 204);
  assert.strictEqual(await storage.headObject(key), null);
});

test("DELETE rejects keys outside the allowed prefixes", async () => {
  // Percent-encoded traversal: express decodes it into req.params, so unlike a
  // literal "../" (which the HTTP layer normalises away before routing) this
  // actually reaches the handler and must be rejected there.
  const cases = [
    "etc/passwd",
    "videos%2F..%2F..%2Fetc%2Fpasswd",
    "videos/%2E%2E%2F%2E%2E%2Fetc",
    "https%3A%2F%2Ffirebasestorage.googleapis.com%2Fv0%2Fb%2Fx%2Fo%2Fy.mp4",
  ];
  for (const key of cases) {
    const res = await call(`/${key}`, { method: "DELETE", token: adminToken });
    assert.strictEqual(res.status, 400, `key: ${key}`);
  }
});
