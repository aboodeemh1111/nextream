const test = require("node:test");
const assert = require("node:assert");

// Deterministic, throwaway config — no live service is contacted by this file.
process.env.S3_ENDPOINT = "http://localhost:9000";
process.env.S3_REGION = "us-east-1";
process.env.S3_BUCKET = "nextream-media";
process.env.S3_ACCESS_KEY_ID = "minioadmin";
process.env.S3_SECRET_ACCESS_KEY = "minioadmin";
process.env.S3_FORCE_PATH_STYLE = "true";

const {
  MEDIA_MANIFEST,
  fieldsFor,
  resolveMediaValues,
  isAllowedMediaValue,
  validateMediaFields,
  collectStorageKeys,
  collectLegacyUrls,
} = require("./mediaFields");

const FIREBASE_URL =
  "https://firebasestorage.googleapis.com/v0/b/onstream-6a46b.appspot.com/o/videos%2Fold.mp4?alt=media&token=abc";

test("the manifest covers every model that stores media", () => {
  const models = MEDIA_MANIFEST.map((m) => m.model);
  for (const model of ["Movie", "TVShow", "Season", "Episode", "User"]) {
    assert.ok(models.includes(model), `${model} missing from manifest`);
  }
  assert.deepStrictEqual(fieldsFor("Movie"), [
    "img",
    "imgSm",
    "imgTitle",
    "trailer",
    "video",
  ]);
  assert.deepStrictEqual(fieldsFor("Nonexistent"), []);
});

test("resolveMediaValues reaches nested arrays and can write back", () => {
  const episode = {
    stillPath: "episodes/2026/07/uuid-still.jpg",
    videoSources: [
      { label: "1080p", url: "episodes/2026/07/uuid-a.mp4" },
      { label: "720p", url: "episodes/2026/07/uuid-b.mp4" },
    ],
    subtitles: [{ lang: "en", url: "subs/2026/07/uuid-en.vtt" }],
    thumbnails: ["episodes/2026/07/uuid-t1.jpg"],
  };

  const found = resolveMediaValues(episode, fieldsFor("Episode"));
  assert.strictEqual(found.length, 5);

  // The setters are what the backfill script uses to rewrite a doc in place.
  for (const entry of found) entry.set("REPLACED");
  assert.strictEqual(episode.stillPath, "REPLACED");
  assert.strictEqual(episode.videoSources[1].url, "REPLACED");
  assert.strictEqual(episode.videoSources[1].label, "720p");
  assert.strictEqual(episode.subtitles[0].url, "REPLACED");
  assert.strictEqual(episode.thumbnails[0], "REPLACED");
});

test("resolveMediaValues copes with missing and malformed fields", () => {
  assert.deepStrictEqual(resolveMediaValues(null, fieldsFor("Movie")), []);
  assert.deepStrictEqual(resolveMediaValues({}, fieldsFor("Episode")), []);
  assert.deepStrictEqual(
    resolveMediaValues(
      { videoSources: "not-an-array", thumbnails: [null, 42, ""] },
      fieldsFor("Episode")
    ),
    []
  );
});

test("storage keys and legacy Firebase URLs are accepted", () => {
  assert.ok(isAllowedMediaValue("videos/2026/07/uuid-a.mp4"));
  assert.ok(isAllowedMediaValue(FIREBASE_URL));
  assert.ok(isAllowedMediaValue(""), "clearing a field must be allowed");
});

test("existing seeded content still validates", () => {
  // Re-saving a seeded movie unchanged must not 400.
  assert.ok(isAllowedMediaValue("https://www.youtube.com/watch?v=YoHD9XEInc0"));
  assert.ok(
    isAllowedMediaValue(
      "https://images.unsplash.com/photo-1517602302552-471fe67acf66?q=80&w=1920"
    )
  );
  assert.ok(isAllowedMediaValue("https://image.tmdb.org/t/p/w500/abc.jpg"));
});

test("an arbitrary third-party host is rejected", () => {
  const rejected = [
    "https://evil.example/payload.mp4",
    "http://192.168.1.10/movie.mp4",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "not a url at all",
    "../../etc/passwd",
    // Lookalike host must not slip past the Firebase check.
    "https://firebasestorage.googleapis.com.evil.dev/x.mp4",
  ];
  for (const value of rejected) {
    assert.ok(!isAllowedMediaValue(value), `should reject: ${value}`);
  }
});

test("validateMediaFields guards a whole request body", () => {
  assert.strictEqual(
    validateMediaFields(
      {
        title: "A Movie",
        img: "images/2026/07/uuid-a.jpg",
        trailer: "https://www.youtube.com/watch?v=abc",
        video: FIREBASE_URL,
      },
      "Movie"
    ),
    null
  );

  const err = validateMediaFields(
    { title: "A Movie", video: "https://evil.example/x.mp4" },
    "Movie"
  );
  assert.match(err, /video/);

  // A nested offender is caught too.
  const nested = validateMediaFields(
    { videoSources: [{ label: "1080p", url: "https://evil.example/x.mp4" }] },
    "Episode"
  );
  assert.match(nested, /videoSources/);

  // Non-media fields are ignored entirely.
  assert.strictEqual(
    validateMediaFields({ title: "https://evil.example", desc: "x" }, "Movie"),
    null
  );
});

test("MEDIA_ALLOWED_URL_HOSTS overrides the default allowlist", () => {
  const original = process.env.MEDIA_ALLOWED_URL_HOSTS;
  try {
    process.env.MEDIA_ALLOWED_URL_HOSTS = "cdn.mine.example";
    assert.ok(isAllowedMediaValue("https://cdn.mine.example/a.mp4"));
    assert.ok(!isAllowedMediaValue("https://www.youtube.com/watch?v=abc"));
    // Keys and legacy URLs are unconditional.
    assert.ok(isAllowedMediaValue("videos/2026/07/uuid-a.mp4"));
    assert.ok(isAllowedMediaValue(FIREBASE_URL));
  } finally {
    if (original === undefined) delete process.env.MEDIA_ALLOWED_URL_HOSTS;
    else process.env.MEDIA_ALLOWED_URL_HOSTS = original;
  }
});

test("collectStorageKeys returns only bucket keys, never legacy URLs", () => {
  const movie = {
    img: "images/2026/07/uuid-a.jpg",
    imgSm: FIREBASE_URL,
    trailer: "https://www.youtube.com/watch?v=abc",
    video: "videos/2026/07/uuid-b.mp4",
  };
  assert.deepStrictEqual(collectStorageKeys(movie, "Movie"), [
    "images/2026/07/uuid-a.jpg",
    "videos/2026/07/uuid-b.mp4",
  ]);
  assert.deepStrictEqual(collectLegacyUrls(movie, "Movie"), [FIREBASE_URL]);
});

// --- Round-trip idempotency -------------------------------------------------

test("a resubmitted signed URL normalises back to its key", () => {
  const sign = require("./sign");
  const key = "videos/2026/07/uuid-round-trip.mp4";

  // What an admin edit form receives from the API and hands straight back.
  const signed = sign.presignGet(key);
  assert.ok(signed.includes("X-Amz-Signature="));

  const body = { title: "Unchanged", video: signed };
  assert.strictEqual(validateMediaFields(body, "Movie"), null);
  assert.strictEqual(
    body.video,
    key,
    "signed URL was not normalised back to a key"
  );
});

test("normalisation reaches nested fields and leaves other hosts alone", () => {
  const sign = require("./sign");
  const { normalizeMediaFields } = require("./mediaFields");
  const episode = {
    stillPath: sign.presignGet("episodes/2026/07/uuid-still.jpg"),
    videoSources: [
      { label: "1080p", url: sign.presignGet("episodes/2026/07/uuid-a.mp4") },
    ],
    subtitles: [{ lang: "en", url: FIREBASE_URL }],
    thumbnails: ["https://image.tmdb.org/t/p/w500/abc.jpg"],
  };
  normalizeMediaFields(episode, "Episode");

  assert.strictEqual(episode.stillPath, "episodes/2026/07/uuid-still.jpg");
  assert.strictEqual(episode.videoSources[0].url, "episodes/2026/07/uuid-a.mp4");
  assert.strictEqual(episode.subtitles[0].url, FIREBASE_URL);
  assert.strictEqual(episode.thumbnails[0], "https://image.tmdb.org/t/p/w500/abc.jpg");
});

test("a lookalike bucket URL is not treated as one of ours", () => {
  const { toStorageKeyIfSigned } = require("./mediaFields");
  const evil = "https://evil.example/nextream-media/videos/2026/07/uuid-a.mp4";
  assert.strictEqual(toStorageKeyIfSigned(evil), evil);
  assert.ok(!isAllowedMediaValue(evil));
});
