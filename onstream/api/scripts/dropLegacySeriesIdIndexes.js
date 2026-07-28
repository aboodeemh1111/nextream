/**
 * Drops leftover unique indexes from when seasons used `seriesId` instead of
 * `showId`. Mongo treats a missing field as null in a unique compound index, so
 * `seriesId_1_seasonNumber_1` made season number 1 creatable only once across
 * the whole collection — every other show got a silent 409 on create.
 *
 * Safe to re-run: missing indexes are ignored.
 */
require("../loadEnv")();
const mongoose = require("mongoose");

const TARGETS = [
  { collection: "seasons", index: "seriesId_1_seasonNumber_1" },
  { collection: "episodes", index: "seriesId_1" },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: "streamo",
  });

  for (const { collection, index } of TARGETS) {
    try {
      await mongoose.connection.db.collection(collection).dropIndex(index);
      console.log(`Dropped ${collection}.${index}`);
    } catch (err) {
      if (err.codeName === "IndexNotFound" || err.code === 27) {
        console.log(`Already gone: ${collection}.${index}`);
      } else {
        throw err;
      }
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
