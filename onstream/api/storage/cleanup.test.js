// Exercises blob cleanup against a real bucket (local MinIO by default).
//
//   docker compose -f ../../docker-compose.dev.yml up -d
//   node --test storage/cleanup.test.js

require("../loadEnv")();

const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

// No Mongo in this test; fail fast instead of buffering for 10s.
mongoose.set("bufferCommands", false);

const storage = require("./index");
const { buildKey } = require("./keys");
const { reapDocumentMedia, reapManyDocumentMedia } = require("./cleanup");

const FIREBASE_URL =
  "https://firebasestorage.googleapis.com/v0/b/onstream-6a46b.appspot.com/o/videos%2Fold.mp4?alt=media&token=abc";

async function putObject(prefix, name, contentType) {
  const key = buildKey(prefix, name);
  const url = await storage.presignPut(key, contentType, 900);
  const res = await fetch(url, {
    method: "PUT",
    body: Buffer.from("x"),
    headers: { "Content-Type": contentType },
  });
  assert.strictEqual(res.status, 200, `seed upload failed: ${res.status}`);
  return key;
}

test("deleting a movie removes every one of its blobs", async () => {
  const img = await putObject("images", "poster.jpg", "image/jpeg");
  const video = await putObject("videos", "movie.mp4", "video/mp4");

  const movie = {
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    title: "Doomed",
    img,
    video,
    // Untouched: not ours to delete, and not a bucket object.
    trailer: "https://www.youtube.com/watch?v=abc",
  };

  const result = await reapDocumentMedia(movie, "Movie");
  assert.strictEqual(result.deleted, 2);
  assert.strictEqual(await storage.headObject(img), null);
  assert.strictEqual(await storage.headObject(video), null);
});

test("nested episode media is collected and deleted", async () => {
  const still = await putObject("episodes", "still.jpg", "image/jpeg");
  const source = await putObject("episodes", "ep.mp4", "video/mp4");
  const sub = await putObject("subs", "en.vtt", "text/vtt");
  const thumb = await putObject("episodes", "thumb.jpg", "image/jpeg");

  const episode = {
    _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
    stillPath: still,
    videoSources: [{ label: "1080p", url: source }],
    subtitles: [{ lang: "en", url: sub }],
    thumbnails: [thumb],
  };

  const result = await reapDocumentMedia(episode, "Episode");
  assert.strictEqual(result.deleted, 4);
  for (const key of [still, source, sub, thumb]) {
    assert.strictEqual(await storage.headObject(key), null, key);
  }
});

test("a cascade reaps every document it is handed", async () => {
  const a = await putObject("episodes", "a.mp4", "video/mp4");
  const b = await putObject("episodes", "b.mp4", "video/mp4");

  const result = await reapManyDocumentMedia(
    [
      { _id: "1", videoSources: [{ label: "x", url: a }] },
      { _id: "2", videoSources: [{ label: "x", url: b }] },
    ],
    "Episode"
  );
  assert.strictEqual(result.deleted, 2);
  assert.strictEqual(await storage.headObject(a), null);
  assert.strictEqual(await storage.headObject(b), null);
});

test("legacy Firebase URLs are reported, never deleted", async () => {
  const key = await putObject("images", "mixed.jpg", "image/jpeg");
  const movie = { _id: "cccccccccccccccccccccccc", img: key, video: FIREBASE_URL };

  // Recording needs Mongo, which is absent here. The blob delete must still
  // happen and the call must not throw — the document is already gone, so
  // throwing would turn a successful delete into a 500.
  const result = await reapDocumentMedia(movie, "Movie");
  assert.strictEqual(result.deleted, 1);
  assert.strictEqual(result.legacy, 1);
  assert.strictEqual(await storage.headObject(key), null);
});

test("a missing blob does not break the delete", async () => {
  const movie = {
    _id: "dddddddddddddddddddddddd",
    img: "images/2026/07/never-existed.jpg",
  };
  await assert.doesNotReject(() => reapDocumentMedia(movie, "Movie"));
});

test("a document with no media is a no-op", async () => {
  assert.deepStrictEqual(await reapDocumentMedia({ title: "x" }, "Movie"), {
    deleted: 0,
    legacy: 0,
  });
  assert.deepStrictEqual(await reapDocumentMedia(null, "Movie"), {
    deleted: 0,
    legacy: 0,
  });
});
