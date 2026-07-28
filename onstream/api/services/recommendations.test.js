const test = require("node:test");
const assert = require("node:assert");

const {
  bayesianRating,
  diversify,
  genreAffinity,
  itemSimilarity,
  matchPercent,
  mixKinds,
  movieItem,
  normaliseGenres,
  recencyDecay,
  scoreItem,
  showItem,
} = require("./recommendations");

// The ranking rules, pinned without a database. These are the decisions that
// decide what a viewer is shown, and each one has a failure mode that is
// invisible in the UI: a single 5-star review topping the catalogue, a row of
// ten near-identical thrillers, or a home page that quietly drops one of the
// two collections it exists to combine.

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 1);

function candidate(uid, { kind = "movie", genres = [], score = 1 } = {}) {
  return { item: { uid, kind, genres }, score, parts: {} };
}

// --- normalisation -----------------------------------------------------------

test("normaliseGenres lower-cases, trims and de-duplicates", () => {
  assert.deepEqual(normaliseGenres([" Action ", "action", "SCI-FI", "", null]), [
    "action",
    "sci-fi",
  ]);
});

test("normaliseGenres accepts the single string a Movie carries", () => {
  assert.deepEqual(normaliseGenres("Adventure"), ["adventure"]);
  assert.deepEqual(normaliseGenres(undefined), []);
});

test("movieItem and showItem land ratings on one 0..1 scale", () => {
  // Reviews are collected 1-5; show ratings are authored 0-10. A blend that
  // treats them as the same number ranks every show above every film.
  const movie = movieItem({
    _id: "m1",
    title: "Dune",
    genre: "Adventure",
    avgRating: 4,
    numRatings: 12,
    video: "v.mp4",
  });
  const show = showItem({ _id: "s1", title: "Arcane", genres: ["Animation"], rating: 8 });

  assert.equal(movie.ratingNormalised, 0.8);
  assert.equal(show.ratingNormalised, 0.8);
  assert.equal(movie.rating10, 8);
  assert.equal(show.rating10, 8);
});

test("uid is namespaced by kind so a Movie and a TVShow cannot collide", () => {
  const shared = "6512ab00000000000000abcd";
  assert.notEqual(
    movieItem({ _id: shared, title: "X" }).uid,
    showItem({ _id: shared, title: "X" }).uid
  );
});

test("a movie with no video file gets no play target", () => {
  assert.equal(movieItem({ _id: "m1", title: "X" }).playHref, null);
  assert.equal(movieItem({ _id: "m1", title: "X", video: "v.mp4" }).playHref, "/watch/m1");
});

test("a legacy isSeries Movie still routes as a movie but is labelled Series", () => {
  const item = movieItem({ _id: "m1", title: "X", isSeries: true, video: "v.mp4" });
  assert.equal(item.kind, "movie");
  assert.equal(item.badge, "Series");
  assert.equal(item.href, "/details/m1");
});

// --- rating ------------------------------------------------------------------

test("bayesianRating keeps a one-vote title from beating a well-reviewed one", () => {
  const mean = 0.5;
  const lucky = bayesianRating(1.0, 1, mean); // one 5-star review
  const proven = bayesianRating(0.9, 80, mean); // eighty near-perfect ones
  assert.ok(proven > lucky, `${proven} should beat ${lucky}`);
});

test("bayesianRating returns the mean for an unrated title", () => {
  assert.equal(bayesianRating(0, 0, 0.42), 0.42);
  assert.equal(bayesianRating(0.9, 0, 0.42), 0.42);
});

// --- recency -----------------------------------------------------------------

test("recencyDecay halves over one half-life", () => {
  assert.equal(recencyDecay(new Date(NOW), 45, NOW), 1);
  assert.ok(Math.abs(recencyDecay(new Date(NOW - 45 * DAY), 45, NOW) - 0.5) < 1e-9);
  assert.ok(recencyDecay(new Date(NOW - 365 * DAY), 45, NOW) < 0.01);
});

test("recencyDecay treats an undated signal as real but weak", () => {
  const value = recencyDecay(null, 45, NOW);
  assert.ok(value > 0 && value < 1);
});

// --- affinity ----------------------------------------------------------------

test("genreAffinity leans on the best matching genre, not the average", () => {
  const taste = new Map([["horror", 1], ["comedy", 0.1]]);
  // A horror-comedy should out-rank a title in two genres this viewer is
  // merely lukewarm about; averaging would invert that.
  const horrorComedy = genreAffinity(["horror", "comedy"], taste);
  const lukewarm = genreAffinity(["comedy", "comedy"], taste);
  assert.ok(horrorComedy > lukewarm);
});

test("genreAffinity is zero without a profile or without genres", () => {
  assert.equal(genreAffinity(["horror"], new Map()), 0);
  assert.equal(genreAffinity([], new Map([["horror", 1]])), 0);
});

test("itemSimilarity rises with shared genres", () => {
  const a = { kind: "movie", genres: ["action", "sci-fi"] };
  const same = { kind: "movie", genres: ["action", "sci-fi"] };
  const partial = { kind: "movie", genres: ["action", "romance"] };
  const none = { kind: "movie", genres: ["documentary"] };

  assert.ok(itemSimilarity(a, same) > itemSimilarity(a, partial));
  assert.ok(itemSimilarity(a, partial) > itemSimilarity(a, none));
});

// --- scoring -----------------------------------------------------------------

const CONTEXT = { maxViews: 1000, meanRating: 0.5, collab: new Map(), now: NOW };

function scorable(overrides = {}) {
  return {
    uid: "movie:1",
    kind: "movie",
    genres: ["horror"],
    ratingNormalised: 0.6,
    ratingVotes: 10,
    views: 100,
    addedAt: new Date(NOW - 10 * DAY),
    inMyList: false,
    watched: false,
    ...overrides,
  };
}

test("a title in the viewer's genre outranks the same title outside it", () => {
  const profile = { taste: new Map([["horror", 1]]) };
  const inGenre = scoreItem(scorable({ genres: ["horror"] }), profile, CONTEXT);
  const outOfGenre = scoreItem(scorable({ genres: ["western"] }), profile, CONTEXT);
  assert.ok(inGenre.score > outOfGenre.score);
});

test("an already-finished title is pushed below an unseen equivalent", () => {
  const profile = { taste: new Map([["horror", 1]]) };
  const seen = scoreItem(scorable({ watched: true }), profile, CONTEXT);
  const unseen = scoreItem(scorable(), profile, CONTEXT);
  assert.ok(unseen.score > seen.score);
});

test("co-watch lift moves a title the viewer's genre profile ignores", () => {
  const profile = { taste: new Map([["horror", 1]]) };
  const withCollab = scoreItem(scorable({ genres: ["western"] }), profile, {
    ...CONTEXT,
    collab: new Map([["movie:1", 1]]),
  });
  const without = scoreItem(scorable({ genres: ["western"] }), profile, CONTEXT);
  assert.ok(withCollab.score > without.score);
});

test("saved but unstarted counts as intent", () => {
  const profile = { taste: new Map() };
  const saved = scoreItem(scorable({ inMyList: true }), profile, CONTEXT);
  const plain = scoreItem(scorable(), profile, CONTEXT);
  assert.ok(saved.score > plain.score);
  assert.equal(saved.parts.intent, 1);
});

test("scoring works with no profile at all — cold start falls back to the catalogue", () => {
  const cold = { taste: new Map() };
  const popular = scoreItem(scorable({ views: 900 }), cold, CONTEXT);
  const obscure = scoreItem(scorable({ views: 1 }), cold, CONTEXT);
  assert.ok(popular.score > obscure.score);
  assert.equal(popular.parts.affinity, 0);
});

// --- match badge -------------------------------------------------------------

test("matchPercent is withheld when there is nothing to personalise against", () => {
  assert.equal(matchPercent({ affinity: 0.9, collab: 0.9 }, false), null);
  assert.equal(matchPercent({ affinity: 0, collab: 0 }, true), null);
});

test("matchPercent stays inside a believable band", () => {
  const strong = matchPercent({ affinity: 1, collab: 1 }, true);
  const weak = matchPercent({ affinity: 0.2, collab: 0 }, true);
  assert.ok(strong <= 99 && strong >= 55);
  assert.ok(weak >= 55 && weak < strong);
});

// --- re-ranking --------------------------------------------------------------

test("diversify breaks up a run of same-genre titles", () => {
  const scored = [
    candidate("a", { genres: ["horror"], score: 10 }),
    candidate("b", { genres: ["horror"], score: 9.9 }),
    candidate("c", { genres: ["horror"], score: 9.8 }),
    candidate("d", { genres: ["comedy"], score: 9 }),
  ];
  const picked = diversify(scored, { limit: 2, lambda: 0.6 }).map((entry) => entry.item.uid);
  assert.equal(picked[0], "a");
  assert.equal(picked[1], "d", "the comedy should win the second seat over a third horror");
});

test("diversify still respects score when lambda is high", () => {
  const scored = [
    candidate("a", { genres: ["horror"], score: 10 }),
    candidate("b", { genres: ["horror"], score: 9.9 }),
    candidate("c", { genres: ["comedy"], score: 1 }),
  ];
  const picked = diversify(scored, { limit: 2, lambda: 0.99 }).map((entry) => entry.item.uid);
  assert.deepEqual(picked, ["a", "b"]);
});

test("diversify never returns more than the limit or invents entries", () => {
  const scored = [candidate("a"), candidate("b")];
  assert.equal(diversify(scored, { limit: 10 }).length, 2);
  assert.equal(diversify([], { limit: 10 }).length, 0);
});

test("mixKinds reserves seats for shows when movies dominate the ranking", () => {
  const scored = [
    ...Array.from({ length: 9 }, (_, i) => candidate(`movie:${i}`, { kind: "movie", score: 10 - i })),
    candidate("show:0", { kind: "show", score: 0.5 }),
    candidate("show:1", { kind: "show", score: 0.4 }),
  ];
  const picked = mixKinds(scored, { limit: 6, minRatio: 0.34 });
  const shows = picked.filter((entry) => entry.item.kind === "show");
  assert.equal(picked.length, 6);
  assert.ok(shows.length >= 2, `expected at least 2 shows, got ${shows.length}`);
});

test("mixKinds leaves a single-kind catalogue alone rather than truncating it", () => {
  const scored = Array.from({ length: 8 }, (_, i) =>
    candidate(`movie:${i}`, { kind: "movie", score: 10 - i })
  );
  assert.equal(mixKinds(scored, { limit: 6 }).length, 6);
});

test("mixKinds never duplicates a title across the reserved and open seats", () => {
  const scored = [
    candidate("movie:0", { kind: "movie", score: 10 }),
    candidate("movie:1", { kind: "movie", score: 9 }),
    candidate("show:0", { kind: "show", score: 8 }),
    candidate("show:1", { kind: "show", score: 7 }),
  ];
  const picked = mixKinds(scored, { limit: 4, minRatio: 0.5 });
  const uids = picked.map((entry) => entry.item.uid);
  assert.equal(new Set(uids).size, uids.length);
  assert.equal(uids.length, 4);
});

test("mixKinds returns results ordered by score", () => {
  const scored = [
    candidate("movie:0", { kind: "movie", score: 10 }),
    candidate("movie:1", { kind: "movie", score: 6 }),
    candidate("show:0", { kind: "show", score: 8 }),
  ];
  const scores = mixKinds(scored, { limit: 3, minRatio: 0.3 }).map((entry) => entry.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});
