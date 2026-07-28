#!/usr/bin/env node
//
// Repairs TV data that drifted while the counters were maintained with $inc and
// the season reorder renumbered Season documents without touching the
// seasonNumber denormalised onto every Episode.
//
//   node scripts/recountTv.js              # dry run, the default
//   node scripts/recountTv.js --commit     # write the fixes
//   node scripts/recountTv.js --show=<id>  # limit to one show
//
// Three classes of damage are handled:
//   1. seasonsCount / episodesCount that disagree with the collections.
//   2. Episode.seasonNumber that disagrees with its own Season.
//   3. Seasons parked at a placeholder number by a reorder that died mid-run
//      (the old code used 1000+i, the new one uses negatives).

require("../loadEnv")();

const mongoose = require("mongoose");
const TVShow = require("../models/TVShow");
const Season = require("../models/Season");
const Episode = require("../models/Episode");

const COMMIT = process.argv.includes("--commit");
const showArg = process.argv.find((a) => a.startsWith("--show="));
const ONLY_SHOW = showArg ? showArg.slice("--show=".length) : null;

function log(...args) {
  console.log(...args);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    dbName: "streamo",
  });

  const filter = ONLY_SHOW ? { _id: ONLY_SHOW } : {};
  const shows = await TVShow.find(filter).lean();
  log(`${COMMIT ? "Repairing" : "Checking"} ${shows.length} show(s)\n`);

  const totals = { counters: 0, episodeNumbers: 0, placeholders: 0 };

  for (const show of shows) {
    const seasons = await Season.find({ showId: show._id })
      .sort({ seasonNumber: 1 })
      .lean();
    const episodes = await Episode.find({ showId: show._id }).lean();
    const problems = [];

    // 1. Show-level counters.
    if (show.seasonsCount !== seasons.length || show.episodesCount !== episodes.length) {
      problems.push(
        `counters ${show.seasonsCount}/${show.episodesCount} -> ${seasons.length}/${episodes.length}`
      );
      totals.counters++;
      if (COMMIT) {
        await TVShow.updateOne(
          { _id: show._id },
          { $set: { seasonsCount: seasons.length, episodesCount: episodes.length } }
        );
      }
    }

    // 3. Placeholder season numbers left behind by an interrupted reorder.
    const stranded = seasons.filter((s) => s.seasonNumber < 0 || s.seasonNumber >= 1000);
    if (stranded.length) {
      problems.push(`${stranded.length} season(s) stranded on a placeholder number`);
      totals.placeholders += stranded.length;
      if (COMMIT) {
        // Keep the relative order the placeholders already imply, and append
        // them after whatever legitimate numbers survive.
        const healthy = seasons.filter((s) => s.seasonNumber >= 0 && s.seasonNumber < 1000);
        let next = healthy.reduce((max, s) => Math.max(max, s.seasonNumber), 0) + 1;
        for (const season of stranded.sort((a, b) => a.seasonNumber - b.seasonNumber)) {
          await Season.updateOne({ _id: season._id }, { $set: { seasonNumber: next } });
          await Episode.updateMany({ seasonId: season._id }, { $set: { seasonNumber: next } });
          season.seasonNumber = next;
          next++;
        }
      }
    }

    for (const season of seasons) {
      const own = episodes.filter((e) => String(e.seasonId) === String(season._id));

      // 1. Season-level counter.
      if (season.episodesCount !== own.length) {
        problems.push(`S${season.seasonNumber} count ${season.episodesCount} -> ${own.length}`);
        totals.counters++;
        if (COMMIT) {
          await Season.updateOne({ _id: season._id }, { $set: { episodesCount: own.length } });
        }
      }

      // 2. Episodes describing the wrong season.
      const mismatched = own.filter((e) => e.seasonNumber !== season.seasonNumber);
      if (mismatched.length) {
        problems.push(
          `S${season.seasonNumber} has ${mismatched.length} episode(s) labelled with another season number`
        );
        totals.episodeNumbers += mismatched.length;
        if (COMMIT) {
          await Episode.updateMany(
            { seasonId: season._id },
            { $set: { seasonNumber: season.seasonNumber } }
          );
        }
      }
    }

    if (problems.length) {
      log(`${show.title} (${show._id})`);
      for (const problem of problems) log(`  - ${problem}`);
    }
  }

  log(
    `\n${COMMIT ? "Fixed" : "Would fix"}: ${totals.counters} counter(s), ` +
      `${totals.episodeNumbers} episode season-number(s), ` +
      `${totals.placeholders} stranded season(s).`
  );
  if (!COMMIT) log("Dry run — re-run with --commit to apply.");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
