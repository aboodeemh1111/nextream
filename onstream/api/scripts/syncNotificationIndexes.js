#!/usr/bin/env node
/**
 * Brings the notification collections' indexes in line with their schemas.
 *
 *   node scripts/syncNotificationIndexes.js
 *
 * Needed because MongoDB will not redefine an existing index whose *options*
 * changed — it rejects the create with IndexOptionsConflict, and Mongoose's
 * autoIndex swallows that, so the collection quietly keeps the old definition
 * while the code assumes the new one. The specific case that motivated this:
 * `dedupeKey` was first created `unique + sparse`, which indexes the explicit
 * `null` that repeatable types carry, so the second admin broadcast ever sent
 * collided with the first and was discarded as a duplicate. It is now a partial
 * index over string values only.
 *
 * `syncIndexes` drops indexes the schema no longer declares and creates the ones
 * it does, which is exactly the reconciliation wanted here. Safe to re-run; a
 * no-op once the collections agree with the code.
 */

const loadEnv = require("../loadEnv");
loadEnv();

const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const NotificationStat = require("../models/NotificationStat");
const TVProgress = require("../models/TVProgress");
const User = require("../models/User");

async function main() {
  if (!process.env.MONGO_URL) {
    console.error("MONGO_URL is not set.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    dbName: "streamo",
  });
  console.log("Connected.");

  let failures = 0;

  for (const model of [Notification, NotificationStat, TVProgress, User]) {
    console.log(`\n${model.modelName}`);
    const before = await model.collection.indexes().catch(() => []);

    let dropped = [];
    try {
      // Returns the names of the indexes it dropped, which is the only part of
      // this worth printing — a created index is visible in the listing below.
      dropped = await model.syncIndexes();
    } catch (err) {
      // Reported and carried on: one collection's conflict must not leave the
      // rest unsynced, and which collection failed is the useful output.
      console.log(`  ! could not sync: ${err.message}`);
      failures += 1;
    }

    const after = await model.collection.indexes();
    if (dropped?.length) console.log(`  dropped: ${dropped.join(", ")}`);
    console.log(`  ${before.length} index(es) before, ${after.length} after`);
    for (const index of after) {
      const flags = [
        index.unique ? "unique" : null,
        index.sparse ? "sparse" : null,
        index.partialFilterExpression ? "partial" : null,
        index.expireAfterSeconds !== undefined ? `ttl=${index.expireAfterSeconds}s` : null,
      ].filter(Boolean);
      console.log(
        `    ${index.name}: ${JSON.stringify(index.key)}${flags.length ? ` [${flags.join(", ")}]` : ""}`
      );
    }
  }

  await mongoose.disconnect();
  console.log(failures ? `\nDone, with ${failures} collection(s) unsynced.` : "\nDone.");
  process.exitCode = failures ? 1 : 0;
}

main().catch(async (err) => {
  console.error("Index sync failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
