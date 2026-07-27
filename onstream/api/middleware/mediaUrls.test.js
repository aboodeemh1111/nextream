require("../loadEnv")();

const test = require("node:test");
const assert = require("node:assert");
const express = require("express");

const mediaUrls = require("./mediaUrls");
const { transform } = mediaUrls;

const FIREBASE_URL =
  "https://firebasestorage.googleapis.com/v0/b/onstream-6a46b.appspot.com/o/videos%2Fold.mp4?alt=media&token=abc123";
const UNSPLASH_URL =
  "https://images.unsplash.com/photo-1517602302552-471fe67acf66?q=80&w=1920&auto=format&fit=crop";
const TMDB_URL = "https://image.tmdb.org/t/p/w500/abc.jpg";
const YOUTUBE_URL = "https://www.youtube.com/watch?v=YoHD9XEInc0";

function isSigned(value) {
  return (
    typeof value === "string" &&
    value.startsWith("http://localhost:9000/nextream-media/") &&
    value.includes("X-Amz-Signature=")
  );
}

// --- The dual-read requirement ---------------------------------------------

test("a legacy Firebase URL and a storage key survive the same payload", () => {
  const out = transform({
    migrated: { title: "New", video: "videos/2026/07/uuid-new.mp4" },
    legacy: { title: "Old", video: FIREBASE_URL },
  });

  assert.ok(isSigned(out.migrated.video), "storage key was not signed");
  assert.strictEqual(
    out.legacy.video,
    FIREBASE_URL,
    "legacy Firebase URL was altered"
  );
});

test("non-storage URLs are never rewritten", () => {
  const body = {
    img: UNSPLASH_URL,
    poster: TMDB_URL,
    trailer: YOUTUBE_URL,
    firebase: FIREBASE_URL,
    title: "Nextream Showcase",
    desc: "Database not connected yet.",
    genre: "Demo",
    duration: "2h 00m",
  };
  assert.deepStrictEqual(transform(body), body);
});

test("the movies.js demo payload passes through verbatim", () => {
  // movies.js:129 / :281 — returned when Mongo is unreachable or empty.
  const demo = [
    {
      _id: "demo-featured",
      title: "Nextream Showcase",
      desc: "A demo featured title.",
      img: UNSPLASH_URL,
      year: "2024",
      limit: 12,
      genre: "Demo",
      duration: "2h 00m",
      isSeries: false,
    },
  ];
  assert.deepStrictEqual(transform(demo), demo);
});

// --- Signing ----------------------------------------------------------------

test("every media field on a movie doc is signed", () => {
  const out = transform({
    title: "A Movie",
    img: "images/2026/07/uuid-a.jpg",
    imgSm: "images/2026/07/uuid-b.jpg",
    imgTitle: "images/2026/07/uuid-c.png",
    trailer: "trailers/2026/07/uuid-d.mp4",
    video: "videos/2026/07/uuid-e.mp4",
  });
  for (const field of ["img", "imgSm", "imgTitle", "trailer", "video"]) {
    assert.ok(isSigned(out[field]), `${field} was not signed`);
  }
  assert.strictEqual(out.title, "A Movie");
});

test("nested arrays and objects on an episode doc are signed", () => {
  const out = transform({
    title: "Episode 1",
    stillPath: "episodes/2026/07/uuid-still.jpg",
    videoSources: [
      { label: "1080p", url: "episodes/2026/07/uuid-1080.mp4" },
      { label: "720p", url: "episodes/2026/07/uuid-720.mp4" },
    ],
    subtitles: [{ lang: "en", url: "subs/2026/07/uuid-en.vtt" }],
    thumbnails: [
      "episodes/2026/07/uuid-t1.jpg",
      "episodes/2026/07/uuid-t2.jpg",
    ],
  });

  assert.ok(isSigned(out.stillPath));
  assert.ok(isSigned(out.videoSources[0].url));
  assert.ok(isSigned(out.videoSources[1].url));
  assert.strictEqual(out.videoSources[0].label, "1080p");
  assert.ok(isSigned(out.subtitles[0].url));
  assert.strictEqual(out.subtitles[0].lang, "en");
  assert.ok(out.thumbnails.every(isSigned));
});

test("video keys get a >= 6h TTL and images a longer one", () => {
  const out = transform({
    video: "videos/2026/07/uuid-a.mp4",
    img: "images/2026/07/uuid-b.jpg",
  });
  const expiresOf = (u) => Number(new URL(u).searchParams.get("X-Amz-Expires"));
  assert.ok(expiresOf(out.video) >= 6 * 3600);
  assert.ok(expiresOf(out.img) >= expiresOf(out.video));
});

test("paginated list payloads are walked", () => {
  const out = transform({
    data: [
      { title: "A", img: "images/2026/07/uuid-a.jpg" },
      { title: "B", img: FIREBASE_URL },
    ],
    page: 1,
    pageSize: 50,
    total: 2,
  });
  assert.ok(isSigned(out.data[0].img));
  assert.strictEqual(out.data[1].img, FIREBASE_URL);
  assert.strictEqual(out.total, 2);
});

// --- Shape and safety -------------------------------------------------------

test("primitives, null and empty payloads are untouched", () => {
  assert.strictEqual(transform("You are not allowed!"), "You are not allowed!");
  assert.strictEqual(transform(null), null);
  assert.strictEqual(transform(42), 42);
  assert.strictEqual(transform(true), true);
  assert.deepStrictEqual(transform([]), []);
  assert.deepStrictEqual(transform({}), {});
});

test("the original object is not mutated", () => {
  const body = { img: "images/2026/07/uuid-a.jpg" };
  transform(body);
  assert.strictEqual(body.img, "images/2026/07/uuid-a.jpg");
});

test("mongoose-style documents are serialised through toJSON", () => {
  const doc = {
    $__: { internal: true },
    _doc: { should: "not be walked" },
    toJSON() {
      return { title: "Doc", img: "images/2026/07/uuid-a.jpg" };
    },
  };
  const out = transform({ movie: doc });
  assert.ok(isSigned(out.movie.img));
  assert.strictEqual(out.movie.title, "Doc");
  assert.strictEqual(out.movie.$__, undefined);
});

test("dates and ObjectId-like values survive", () => {
  const created = new Date("2026-07-28T10:30:00Z");
  const out = transform({
    createdAt: created,
    airDate: created,
    _id: { toJSON: () => "507f1f77bcf86cd799439011" },
  });
  assert.strictEqual(out.createdAt, created); // skipped key, passed through
  assert.strictEqual(out.airDate, created.toJSON());
  assert.strictEqual(out._id.toJSON(), "507f1f77bcf86cd799439011");
});

test("recursion is bounded", () => {
  let deep = { img: "images/2026/07/uuid-deep.jpg" };
  for (let i = 0; i < 40; i++) deep = { nested: deep };
  assert.doesNotThrow(() => transform(deep));
});

test("a self-referencing payload does not hang", () => {
  const a = { name: "a" };
  a.self = a;
  assert.doesNotThrow(() => transform(a));
});

// --- Wiring -----------------------------------------------------------------

test("res.json is wrapped for normal routes and exempt for uploads", async () => {
  const app = express();
  app.use(express.json());
  app.use(mediaUrls);
  app.get("/api/movies/find/1", (req, res) =>
    res.json({ video: "videos/2026/07/uuid-a.mp4", legacy: FIREBASE_URL })
  );
  // The upload API hands back keys for the admin app to submit to Mongo.
  // Signing them here would store an expiring URL in the database.
  app.post("/api/uploads/presign", (req, res) =>
    res.json({ key: "videos/2026/07/uuid-a.mp4" })
  );
  app.post("/uploads/presign", (req, res) =>
    res.json({ key: "videos/2026/07/uuid-a.mp4" })
  );

  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const movie = await (await fetch(`${base}/api/movies/find/1`)).json();
    assert.ok(isSigned(movie.video), "route response was not signed");
    assert.strictEqual(movie.legacy, FIREBASE_URL);

    for (const path of ["/api/uploads/presign", "/uploads/presign"]) {
      const res = await fetch(`${base}${path}`, { method: "POST" });
      const body = await res.json();
      assert.strictEqual(
        body.key,
        "videos/2026/07/uuid-a.mp4",
        `${path} key was rewritten into a URL`
      );
    }
  } finally {
    server.close();
  }
});

test("an unconfigured storage layer degrades to raw keys, not a 500", () => {
  const endpoint = process.env.S3_ENDPOINT;
  const sign = require("../storage/sign");
  try {
    delete process.env.S3_ENDPOINT;
    sign.clearCache();
    const out = transform({ video: "videos/2026/07/uuid-unconfigured.mp4" });
    assert.strictEqual(out.video, "videos/2026/07/uuid-unconfigured.mp4");
  } finally {
    process.env.S3_ENDPOINT = endpoint;
    sign.clearCache();
  }
});
