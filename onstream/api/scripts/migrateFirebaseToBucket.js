#!/usr/bin/env node
//
// Backfill: copy every media blob still hosted on Firebase Storage into the
// self-hosted bucket, and repoint the Mongo field at the new key.
//
//   node scripts/migrateFirebaseToBucket.js                     # dry run
//   node scripts/migrateFirebaseToBucket.js --collection=User   # one slice
//   node scripts/migrateFirebaseToBucket.js --collection=Movie --commit
//   node scripts/migrateFirebaseToBucket.js --commit --concurrency=3
//
// Dry run is the default; --commit is required to write anything. Because of
// dual-read in middleware/mediaUrls.js, each field flips independently with no
// downtime and no coordinated cutover — a half-migrated database is a perfectly
// valid state.
//
// Suggested order, smallest first, so problems surface cheaply:
//   --collection=User  ->  TVShow / Season  ->  Movie  ->  Episode
//
// This script NEVER deletes anything from Firebase. Keep that bucket for at
// least one billing cycle as the rollback path; migration-log.jsonl records
// oldUrl for every record so a reverse script can restore any slice.

require("../loadEnv")();

const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const mongoose = require("mongoose");

const storage = require("../storage");
const { config } = require("../storage/config");
const { buildKey, isStorageKey, isLegacyFirebaseUrl } = require("../storage/keys");
const { fieldsFor, resolveMediaValues } = require("../storage/mediaFields");

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const COMMIT = process.argv.includes("--commit");
const ONLY_COLLECTION = arg("collection", null);
const CONCURRENCY = Math.max(1, Number(arg("concurrency", 3)));
const LIMIT = Number(arg("limit", 0));
const RETRIES = 3;

const LOG_PATH = path.join(__dirname, "migration-log.jsonl");

// Smallest and least risky first.
const COLLECTIONS = [
  { model: "User", modulePath: "../models/User" },
  { model: "TVShow", modulePath: "../models/TVShow" },
  { model: "Season", modulePath: "../models/Season" },
  { model: "Movie", modulePath: "../models/Movie" },
  { model: "Episode", modulePath: "../models/Episode" },
];

// The destination prefix comes from the field, not from the old Firebase path:
// the field is authoritative about what the blob actually is.
const FIELD_PREFIX = {
  "Movie.img": "images",
  "Movie.imgSm": "images",
  "Movie.imgTitle": "images",
  "Movie.trailer": "trailers",
  "Movie.video": "videos",
  "TVShow.poster": "shows",
  "TVShow.backdrop": "shows",
  "TVShow.trailerUrl": "trailers",
  "Season.poster": "shows",
  "Season.backdrop": "shows",
  "Episode.stillPath": "episodes",
  "Episode.videoSources[].url": "episodes",
  "Episode.subtitles[].url": "subs",
  "Episode.thumbnails[]": "episodes",
  "User.profilePic": "avatars",
};

// Firebase download URLs look like
//   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/videos%2F123_movie.mp4?alt=media&token=...
// Only the trailing filename is reused, purely for a readable slug — the key
// itself is still generated server-side from a UUID.
function filenameFromFirebaseUrl(url) {
  try {
    const encoded = new URL(url).pathname.split("/o/")[1] || "";
    const decoded = decodeURIComponent(encoded);
    const base = decoded.split("/").pop() || "file";
    // Strip the "<timestamp>_" prefix the old FileUpload component added.
    return base.replace(/^\d{10,}[_-]/, "") || "file";
  } catch (_) {
    return "file";
  }
}

function loadDoneSet() {
  const done = new Set();
  if (!fs.existsSync(LOG_PATH)) return done;
  for (const line of fs.readFileSync(LOG_PATH, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.newKey) done.add(`${rec.collection}|${rec._id}|${rec.path}`);
    } catch (_) {
      /* skip malformed line */
    }
  }
  return done;
}

function appendLog(record) {
  fs.appendFileSync(LOG_PATH, JSON.stringify(record) + "\n");
}

async function withRetry(label, fn) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < RETRIES) {
        const wait = 1000 * Math.pow(2, attempt - 1);
        console.warn(`    retry ${attempt}/${RETRIES - 1} for ${label}: ${err.message}`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

// Streamed end to end. A 2 GB movie through Buffer would OOM the process.
async function copyBlob(oldUrl, key, contentTypeHint) {
  const res = await fetch(oldUrl);
  if (!res.ok) throw new Error(`source returned HTTP ${res.status}`);
  if (!res.body) throw new Error("source returned no body");

  const contentType =
    res.headers.get("content-type") || contentTypeHint || "application/octet-stream";
  const declared = Number(res.headers.get("content-length")) || null;

  await storage.uploadStream(key, Readable.fromWeb(res.body), {
    contentType,
    cacheControl: contentType.startsWith("image/")
      ? "public, max-age=31536000, immutable"
      : undefined,
  });

  const head = await storage.headObject(key);
  if (!head) throw new Error("object missing after upload");
  if (declared !== null && head.size !== declared) {
    // Delete the partial copy so a re-run starts clean.
    await storage.deleteObject(key).catch(() => {});
    throw new Error(`size mismatch: expected ${declared}, stored ${head.size}`);
  }
  return { bytes: head.size, contentType };
}

async function buildTasks(done) {
  const tasks = [];

  for (const entry of COLLECTIONS) {
    if (ONLY_COLLECTION && entry.model !== ONLY_COLLECTION) continue;
    const Model = require(entry.modulePath);
    const specs = fieldsFor(entry.model);

    const cursor = Model.find({}).lean().cursor();
    for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
      for (const found of resolveMediaValues(doc, specs)) {
        // Idempotent: anything already migrated is skipped, so the script is
        // safe to re-run after a crash.
        if (isStorageKey(found.value)) continue;
        if (!isLegacyFirebaseUrl(found.value)) continue;
        const id = `${entry.model}|${doc._id}|${found.path}`;
        if (done.has(id)) continue;

        tasks.push({
          model: entry.model,
          modulePath: entry.modulePath,
          _id: doc._id,
          spec: found.spec,
          path: found.path,
          oldUrl: found.value,
          prefix: FIELD_PREFIX[`${entry.model}.${found.spec}`] || "images",
        });
      }
    }
  }

  return LIMIT > 0 ? tasks.slice(0, LIMIT) : tasks;
}

async function runTask(task, index, total) {
  const label = `${task.model}/${task._id}/${task.path}`;
  const filename = filenameFromFirebaseUrl(task.oldUrl);
  const key = buildKey(task.prefix, filename);

  if (!COMMIT) {
    console.log(`  [${index}/${total}] would copy ${label}`);
    console.log(`             -> ${key}`);
    return { skipped: true };
  }

  const { bytes, contentType } = await withRetry(label, () =>
    copyBlob(task.oldUrl, key)
  );

  const Model = require(task.modulePath);
  await Model.updateOne({ _id: task._id }, { $set: { [task.path]: key } });

  appendLog({
    collection: task.model,
    _id: String(task._id),
    field: task.spec,
    path: task.path,
    oldUrl: task.oldUrl,
    newKey: key,
    bytes,
    contentType,
  });

  console.log(
    `  [${index}/${total}] ${label} -> ${key} (${(bytes / 1024 / 1024).toFixed(2)} MB)`
  );
  return { bytes };
}

// Bounded worker pool: this is limited by the VPS's inbound bandwidth, not CPU.
async function runPool(tasks) {
  let cursor = 0;
  let migrated = 0;
  let failed = 0;
  let bytes = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor++;
      try {
        const result = await runTask(tasks[index], index + 1, tasks.length);
        if (!result.skipped) {
          migrated++;
          bytes += result.bytes || 0;
        }
      } catch (err) {
        failed++;
        console.error(`  FAILED ${tasks[index].oldUrl.slice(0, 80)}: ${err.message}`);
        appendLog({
          collection: tasks[index].model,
          _id: String(tasks[index]._id),
          path: tasks[index].path,
          oldUrl: tasks[index].oldUrl,
          error: err.message,
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker)
  );
  return { migrated, failed, bytes };
}

async function main() {
  const cfg = config();
  console.log(`Bucket      : ${cfg.bucket} @ ${cfg.endpoint}`);
  console.log(`Mode        : ${COMMIT ? "COMMIT (will write)" : "dry run"}`);
  console.log(`Collection  : ${ONLY_COLLECTION || "all"}`);
  console.log(`Concurrency : ${CONCURRENCY}`);
  if (LIMIT) console.log(`Limit       : ${LIMIT}`);
  console.log("");

  await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    dbName: "streamo",
  });

  const done = loadDoneSet();
  if (done.size) console.log(`Resuming: ${done.size} fields already migrated.\n`);

  console.log("Scanning for Firebase-hosted media...");
  const tasks = await buildTasks(done);
  console.log(`  ${tasks.length} fields to migrate\n`);

  if (!tasks.length) {
    console.log("Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  const result = await runPool(tasks);

  console.log("");
  if (COMMIT) {
    console.log(
      `Migrated ${result.migrated}, failed ${result.failed}, ` +
        `${(result.bytes / 1024 / 1024).toFixed(1)} MB copied.`
    );
    console.log(`Log: ${LOG_PATH}`);
    console.log("Firebase was not touched — keep it as the rollback path.");
  } else {
    console.log(`Dry run — nothing written. Re-run with --commit.`);
  }
  if (result.failed) process.exitCode = 1;

  await mongoose.disconnect();
}

// Only migrate when invoked directly — requiring this file (from a test, or by
// accident) must never start copying data.
if (require.main === module) {
  main().catch(async (err) => {
    console.error("\nMigration failed:", err.message);
    try {
      await mongoose.disconnect();
    } catch (_) {
      /* ignore */
    }
    process.exitCode = 1;
  });
}

module.exports = {
  FIELD_PREFIX,
  COLLECTIONS,
  filenameFromFirebaseUrl,
  copyBlob,
  loadDoneSet,
  LOG_PATH,
};
