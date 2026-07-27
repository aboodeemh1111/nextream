const test = require("node:test");
const assert = require("node:assert");

const {
  buildKey,
  isStorageKey,
  isLegacyFirebaseUrl,
  mediaTypeFor,
  PREFIXES,
} = require("./keys");

test("buildKey generates a server-side, date-sharded, uuid-prefixed key", () => {
  const key = buildKey("videos", "My Movie (1080p).MP4");
  assert.match(
    key,
    /^videos\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-my-movie-1080p\.mp4$/
  );
  assert.ok(isStorageKey(key));
});

test("buildKey never reuses a key for the same filename", () => {
  const a = buildKey("images", "poster.jpg");
  const b = buildKey("images", "poster.jpg");
  assert.notStrictEqual(a, b);
});

test("buildKey rejects path traversal", () => {
  assert.throws(() => buildKey("videos", "../../etc/passwd"), /traversal/);
  assert.throws(() => buildKey("videos", "..\\..\\windows\\x"), /traversal/);
  assert.throws(() => buildKey("videos", ".."), /traversal/);
  assert.throws(() => buildKey("videos", "a/../../b.mp4"), /traversal/);
});

test("buildKey rejects absolute paths", () => {
  assert.throws(() => buildKey("videos", "/etc/passwd"), /absolute path/);
  assert.throws(() => buildKey("videos", "\\\\server\\share\\x"), /absolute path/);
  assert.throws(() => buildKey("videos", "C:\\Windows\\x.mp4"), /absolute path/);
});

test("buildKey rejects null bytes", () => {
  assert.throws(() => buildKey("videos", "movie\0.mp4"), /null byte/);
  assert.throws(() => buildKey("videos", "\0"), /null byte/);
});

test("buildKey rejects a prefix outside the allowlist", () => {
  assert.throws(() => buildKey("etc", "x.mp4"), /Invalid prefix/);
  assert.throws(() => buildKey("../videos", "x.mp4"), /Invalid prefix/);
  assert.throws(() => buildKey("", "x.mp4"), /Invalid prefix/);
  assert.throws(() => buildKey(undefined, "x.mp4"), /Invalid prefix/);
});

test("buildKey rejects a missing or oversized filename", () => {
  assert.throws(() => buildKey("videos", ""), /required/);
  assert.throws(() => buildKey("videos", null), /required/);
  assert.throws(() => buildKey("videos", "a".repeat(256)), /too long/);
});

test("buildKey strips directory components that survive validation", () => {
  const key = buildKey("images", "sub/dir/poster.jpg");
  assert.match(key, /-poster\.jpg$/);
  assert.ok(!key.includes("sub"));
});

test("buildKey copes with names that slugify to nothing", () => {
  const key = buildKey("images", "___.jpg");
  assert.match(key, /-file\.jpg$/);
});

test("every allowed prefix round-trips through isStorageKey", () => {
  for (const prefix of PREFIXES) {
    assert.ok(isStorageKey(buildKey(prefix, "sample.bin")), prefix);
  }
});

test("isStorageKey accepts real keys", () => {
  assert.ok(isStorageKey("videos/2026/07/abc-movie.mp4"));
  assert.ok(isStorageKey("shows/seasons/2026/07/uuid-poster.jpg"));
  assert.ok(isStorageKey("subs/2026/07/uuid-en.vtt"));
});

test("isStorageKey rejects URLs, traversal and non-strings", () => {
  // Legacy Firebase URLs must never be mistaken for keys.
  assert.ok(
    !isStorageKey(
      "https://firebasestorage.googleapis.com/v0/b/onstream-6a46b.appspot.com/o/images%2Fx.jpg?alt=media&token=abc"
    )
  );
  // Demo/seed data returned by movies.js:129 and :281.
  assert.ok(
    !isStorageKey(
      "https://images.unsplash.com/photo-1517602302552-471fe67acf66?q=80&w=1920"
    )
  );
  assert.ok(!isStorageKey("https://image.tmdb.org/t/p/w500/abc.jpg"));
  assert.ok(!isStorageKey("https://www.youtube.com/watch?v=YoHD9XEInc0"));
  assert.ok(!isStorageKey("videos/../../etc/passwd"));
  assert.ok(!isStorageKey("/videos/2026/07/x.mp4"));
  assert.ok(!isStorageKey("videos//2026/x.mp4"));
  assert.ok(!isStorageKey("etc/passwd"));
  assert.ok(!isStorageKey("videos/2026/07/x.mp4?query=1"));
  assert.ok(!isStorageKey(""));
  assert.ok(!isStorageKey(null));
  assert.ok(!isStorageKey(undefined));
  assert.ok(!isStorageKey(42));
  assert.ok(!isStorageKey({ videos: 1 }));
  assert.ok(!isStorageKey("videos/" + "a".repeat(1100)));
});

test("isLegacyFirebaseUrl discriminates correctly", () => {
  assert.ok(
    isLegacyFirebaseUrl(
      "https://firebasestorage.googleapis.com/v0/b/onstream-6a46b.appspot.com/o/videos%2Fx.mp4?alt=media&token=abc"
    )
  );
  assert.ok(!isLegacyFirebaseUrl("videos/2026/07/uuid-x.mp4"));
  assert.ok(!isLegacyFirebaseUrl("https://images.unsplash.com/photo-1"));
  assert.ok(!isLegacyFirebaseUrl("https://image.tmdb.org/t/p/w500/abc.jpg"));
  // Must not match a lookalike host.
  assert.ok(
    !isLegacyFirebaseUrl("https://firebasestorage.googleapis.com.evil.dev/x")
  );
  assert.ok(!isLegacyFirebaseUrl(null));
  assert.ok(!isLegacyFirebaseUrl(12));
});

test("a value is never both a storage key and a legacy URL", () => {
  const samples = [
    buildKey("videos", "a.mp4"),
    "https://firebasestorage.googleapis.com/v0/b/x/o/y.mp4?alt=media",
    "https://images.unsplash.com/photo-1",
    "Some Movie Title",
  ];
  for (const value of samples) {
    assert.ok(!(isStorageKey(value) && isLegacyFirebaseUrl(value)), value);
  }
});

test("mediaTypeFor uses the extension, not just the prefix", () => {
  // episodes/ holds both video and stillPath images; shows/ holds posters.
  assert.strictEqual(mediaTypeFor("episodes/2026/07/uuid-ep1.mp4"), "video");
  assert.strictEqual(mediaTypeFor("episodes/2026/07/uuid-still.jpg"), "image");
  assert.strictEqual(mediaTypeFor("shows/2026/07/uuid-poster.png"), "image");
  assert.strictEqual(mediaTypeFor("shows/2026/07/uuid-teaser.mp4"), "video");
  assert.strictEqual(mediaTypeFor("subs/2026/07/uuid-en.vtt"), "subtitle");
  assert.strictEqual(mediaTypeFor("videos/2026/07/uuid-film.mkv"), "video");
  assert.strictEqual(mediaTypeFor("avatars/2026/07/uuid-me.webp"), "image");
  // No extension -> fall back to the prefix.
  assert.strictEqual(mediaTypeFor("videos/2026/07/uuid-noext"), "video");
  assert.strictEqual(mediaTypeFor("images/2026/07/uuid-noext"), "image");
});
