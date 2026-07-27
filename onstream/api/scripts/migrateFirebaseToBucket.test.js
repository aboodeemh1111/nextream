// Verifies the backfill's moving parts without running the backfill itself.
// The streaming copy is exercised against a local HTTP server standing in for
// Firebase, so no production data and no Firebase bucket is touched.
//
//   node --test scripts/migrateFirebaseToBucket.test.js

require("../loadEnv")();

const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const crypto = require("crypto");

const storage = require("../storage");
const { MEDIA_MANIFEST } = require("../storage/mediaFields");
const { isStorageKey } = require("../storage/keys");
const {
  FIELD_PREFIX,
  COLLECTIONS,
  filenameFromFirebaseUrl,
  copyBlob,
} = require("./migrateFirebaseToBucket");

test("every media field in the manifest has a destination prefix", () => {
  for (const entry of MEDIA_MANIFEST) {
    for (const field of entry.fields) {
      const key = `${entry.model}.${field}`;
      assert.ok(FIELD_PREFIX[key], `no destination prefix mapped for ${key}`);
    }
  }
});

test("every manifest model is covered by a collection slice", () => {
  const models = COLLECTIONS.map((c) => c.model);
  for (const entry of MEDIA_MANIFEST) {
    assert.ok(models.includes(entry.model), `${entry.model} not in COLLECTIONS`);
  }
});

test("subtitles land in subs and avatars in avatars, not with their siblings", () => {
  // Episode.subtitles[].url sits on the Episode doc but is not episode video.
  assert.strictEqual(FIELD_PREFIX["Episode.subtitles[].url"], "subs");
  assert.strictEqual(FIELD_PREFIX["Episode.videoSources[].url"], "episodes");
  assert.strictEqual(FIELD_PREFIX["User.profilePic"], "avatars");
  assert.strictEqual(FIELD_PREFIX["TVShow.trailerUrl"], "trailers");
});

test("filenames are recovered from Firebase download URLs", () => {
  const cases = [
    [
      "https://firebasestorage.googleapis.com/v0/b/onstream-6a46b.appspot.com/o/videos%2F1699999999999_My%20Movie.mp4?alt=media&token=abc",
      "My Movie.mp4",
    ],
    [
      "https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/images%2Fposter.jpg?alt=media",
      "poster.jpg",
    ],
    [
      // Nested path: only the basename matters.
      "https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/shows%2Fseasons%2Fbanner.png?alt=media",
      "banner.png",
    ],
    ["https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/", "file"],
    ["not a url", "file"],
  ];
  for (const [url, expected] of cases) {
    assert.strictEqual(filenameFromFirebaseUrl(url), expected, url);
  }
});

// --- Streaming copy ---------------------------------------------------------

function startSource(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, () => resolve(server));
  });
}

test("copyBlob streams a large object through and verifies its size", async () => {
  // 40 MB: crosses lib-storage's part boundary, so this genuinely exercises the
  // streaming multipart path rather than a single buffered PUT.
  const payload = crypto.randomBytes(40 * 1024 * 1024);
  const server = await startSource((req, res) => {
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": String(payload.length),
    });
    res.end(payload);
  });
  const port = server.address().port;
  const key = "videos/2026/07/migrate-test-large.mp4";

  try {
    const result = await copyBlob(`http://127.0.0.1:${port}/movie.mp4`, key);
    assert.strictEqual(result.bytes, payload.length);
    assert.strictEqual(result.contentType, "video/mp4");

    const head = await storage.headObject(key);
    assert.ok(head);
    assert.strictEqual(head.size, payload.length);
    assert.ok(isStorageKey(key));
  } finally {
    await storage.deleteObject(key).catch(() => {});
    server.close();
  }
});

test("a truncated source is rejected and leaves no partial object", async () => {
  const server = await startSource((req, res) => {
    // Claims more than it sends.
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": "1000",
    });
    res.end(Buffer.alloc(100));
  });
  const port = server.address().port;
  const key = "videos/2026/07/migrate-test-truncated.mp4";

  try {
    await assert.rejects(
      () => copyBlob(`http://127.0.0.1:${port}/short.mp4`, key),
      /size mismatch|terminated|aborted|socket/i
    );
    // A partial copy must not survive, or a re-run would consider it done.
    assert.strictEqual(await storage.headObject(key), null);
  } finally {
    await storage.deleteObject(key).catch(() => {});
    server.close();
  }
});

test("an HTTP error from the source is surfaced, not silently skipped", async () => {
  const server = await startSource((req, res) => {
    res.writeHead(404).end("nope");
  });
  const port = server.address().port;
  try {
    await assert.rejects(
      () =>
        copyBlob(
          `http://127.0.0.1:${port}/gone.mp4`,
          "videos/2026/07/migrate-test-404.mp4"
        ),
      /HTTP 404/
    );
  } finally {
    server.close();
  }
});

test("images are copied with a long cache lifetime", async () => {
  const payload = Buffer.from("fake-image-bytes");
  const server = await startSource((req, res) => {
    res.writeHead(200, {
      "Content-Type": "image/jpeg",
      "Content-Length": String(payload.length),
    });
    res.end(payload);
  });
  const port = server.address().port;
  const key = "images/2026/07/migrate-test-poster.jpg";

  try {
    await copyBlob(`http://127.0.0.1:${port}/p.jpg`, key);
    const sign = require("../storage/sign");
    const res = await fetch(sign.presignGet(key));
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get("cache-control") || "", /immutable/);
  } finally {
    await storage.deleteObject(key).catch(() => {});
    server.close();
  }
});
