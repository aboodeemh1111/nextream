#!/usr/bin/env node
//
// Lists every object in the bucket, diffs it against every media field in
// Mongo, and reports (or deletes) whatever nothing references. Run monthly.
//
//   node scripts/reapOrphans.js                  # dry run, the default
//   node scripts/reapOrphans.js --commit         # actually delete
//   node scripts/reapOrphans.js --min-age-hours=48
//   node scripts/reapOrphans.js --prefix=videos/
//
// --min-age-hours (default 24) is a safety rail, not a nicety: an object that
// has just been uploaded but whose document has not been saved yet is not an
// orphan, and without an age floor this script would delete it out from under
// the admin who is still filling in the form.

require("../loadEnv")();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const storage = require("../storage");
const { config } = require("../storage/config");
const { MEDIA_MANIFEST, fieldsFor, resolveMediaValues } = require("../storage/mediaFields");
const { isStorageKey } = require("../storage/keys");

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const COMMIT = process.argv.includes("--commit");
const MIN_AGE_HOURS = Number(arg("min-age-hours", 24));
const PREFIX = arg("prefix", "");

const MODELS = {
  Movie: "../models/Movie",
  TVShow: "../models/TVShow",
  Season: "../models/Season",
  Episode: "../models/Episode",
  User: "../models/User",
};

async function collectReferencedKeys() {
  const referenced = new Set();

  for (const entry of MEDIA_MANIFEST) {
    const Model = require(MODELS[entry.model]);
    const specs = fieldsFor(entry.model);
    const projection = specs
      .map((s) => s.split("[]")[0])
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(" ");

    const cursor = Model.find({}, projection).lean().cursor();
    let count = 0;
    for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
      for (const found of resolveMediaValues(doc, specs)) {
        if (isStorageKey(found.value)) referenced.add(found.value);
      }
      count++;
    }
    console.log(`  ${entry.model.padEnd(8)} scanned ${count} documents`);
  }

  return referenced;
}

async function main() {
  const cfg = config();
  console.log(`Bucket   : ${cfg.bucket} @ ${cfg.endpoint}`);
  console.log(`Mode     : ${COMMIT ? "COMMIT (will delete)" : "dry run"}`);
  console.log(`Min age  : ${MIN_AGE_HOURS}h`);
  if (PREFIX) console.log(`Prefix   : ${PREFIX}`);
  console.log("");

  await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    dbName: "streamo",
  });

  console.log("Scanning Mongo for referenced keys...");
  const referenced = await collectReferencedKeys();
  console.log(`  ${referenced.size} keys referenced\n`);

  console.log("Listing bucket objects...");
  const cutoff = Date.now() - MIN_AGE_HOURS * 3600 * 1000;
  const orphans = [];
  let total = 0;
  let tooNew = 0;
  let bytes = 0;

  for await (const obj of storage.listObjects(PREFIX)) {
    total++;
    if (referenced.has(obj.key)) continue;
    if (obj.lastModified && obj.lastModified.getTime() > cutoff) {
      tooNew++;
      continue;
    }
    orphans.push(obj);
    bytes += obj.size || 0;
  }

  console.log(`  ${total} objects in bucket`);
  console.log(`  ${tooNew} skipped as too recent to judge`);
  console.log(
    `  ${orphans.length} orphaned (${(bytes / 1024 / 1024).toFixed(1)} MB)\n`
  );

  for (const o of orphans) {
    console.log(`  ${String(o.size).padStart(12)}  ${o.key}`);
  }

  if (orphans.length) {
    const report = path.join(__dirname, "orphan-report.jsonl");
    fs.writeFileSync(
      report,
      orphans
        .map((o) =>
          JSON.stringify({
            key: o.key,
            size: o.size,
            lastModified: o.lastModified,
            deleted: COMMIT,
          })
        )
        .join("\n") + "\n"
    );
    console.log(`\nWrote ${report}`);
  }

  if (COMMIT && orphans.length) {
    await storage.deleteObjects(orphans.map((o) => o.key));
    console.log(`\nDeleted ${orphans.length} objects.`);
  } else if (orphans.length) {
    console.log("\nDry run — nothing deleted. Re-run with --commit.");
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\nreapOrphans failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exitCode = 1;
});
