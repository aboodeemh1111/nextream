const test = require("node:test");
const assert = require("node:assert");

const {
  CATEGORIES,
  TYPES,
  buildEntry,
  defaultPreferences,
  truncate,
  typesByCategory,
  weekKey,
} = require("./catalog");

// The catalog is the contract every other part of the system reads. What is
// pinned here is not the wording — that will change — but the invariants the
// policy engine and the settings page depend on: every type belongs to a
// category a viewer can find, every dedupe key actually distinguishes the thing
// it names, and a context missing its subject produces no notification at all
// rather than one that renders "New episode of undefined".

const NOW = new Date("2026-07-29T12:00:00Z");

const show = { _id: "show1", title: "The Long Dark", backdrop: "b.jpg", poster: "p.jpg" };
const episode = {
  _id: "ep1",
  title: "Whiteout",
  seasonNumber: 2,
  episodeNumber: 7,
  stillPath: "still.jpg",
};

test("every type declares a category that exists", () => {
  for (const definition of Object.values(TYPES)) {
    assert.ok(
      CATEGORIES[definition.category],
      `${definition.type} names category "${definition.category}", which is not in CATEGORIES`
    );
  }
});

test("every category is reachable by at least one type", () => {
  // A switch on the settings page that governs nothing is a promise the product
  // does not keep.
  for (const [category, types] of Object.entries(typesByCategory())) {
    assert.ok(types.length > 0, `category "${category}" has no types`);
  }
});

test("only the account category is locked, and it is transactional", () => {
  const locked = Object.values(CATEGORIES).filter((entry) => entry.locked);
  assert.deepStrictEqual(
    locked.map((entry) => entry.key),
    ["account"]
  );
  assert.strictEqual(TYPES["account.security"].priority, "transactional");
});

test("default preferences cover every category", () => {
  const prefs = defaultPreferences();
  assert.deepStrictEqual(
    Object.keys(prefs.categories).sort(),
    Object.keys(CATEGORIES).sort()
  );
  // Opt-in rather than opt-out: a digest nobody asked for is still a send.
  assert.strictEqual(prefs.categories.digest, false);
  assert.strictEqual(prefs.categories.new_content, true);
});

test("a new episode renders the show, the code and the episode name", () => {
  const entry = buildEntry("episode.published", { show, episode, userId: "u1", now: NOW });

  assert.strictEqual(entry.title, "New episode of The Long Dark");
  assert.strictEqual(entry.body, "S2:E7 · Whiteout");
  assert.strictEqual(entry.deepLink, "/watch/episode/ep1");
  assert.strictEqual(entry.image, "still.jpg");
  assert.strictEqual(entry.category, "new_content");
  assert.strictEqual(entry.priority, "high");
  assert.deepStrictEqual(entry.entity, { kind: "episode", id: "ep1", title: "Whiteout" });
});

test("a missing subject yields no notification rather than a broken one", () => {
  assert.strictEqual(buildEntry("episode.published", { episode, userId: "u1" }), null);
  assert.strictEqual(buildEntry("episode.published", { show, userId: "u1" }), null);
  assert.strictEqual(buildEntry("season.published", { show, userId: "u1" }), null);
  assert.strictEqual(buildEntry("movie.published", { movie: {}, userId: "u1" }), null);
  assert.strictEqual(buildEntry("digest.weekly", { items: [], userId: "u1" }), null);
  assert.strictEqual(buildEntry("system.announcement", { body: "no title" }), null);
});

test("an unknown type is refused", () => {
  assert.strictEqual(buildEntry("does.not.exist", { userId: "u1" }), null);
});

test("dedupe keys separate the episode, the viewer and nothing else", () => {
  const a = buildEntry("episode.published", { show, episode, userId: "u1", now: NOW });
  const b = buildEntry("episode.published", { show, episode, userId: "u2", now: NOW });
  const c = buildEntry("episode.published", {
    show,
    episode: { ...episode, _id: "ep2" },
    userId: "u1",
    now: NOW,
  });

  assert.notStrictEqual(a.dedupeKey, b.dedupeKey, "two viewers must each get one");
  assert.notStrictEqual(a.dedupeKey, c.dedupeKey, "two episodes are two events");

  // The same episode announced twice to the same person is the case the unique
  // index has to catch — a re-publish, a retried request, a replayed hook.
  const again = buildEntry("episode.published", {
    show,
    episode,
    userId: "u1",
    now: new Date("2026-08-02T09:00:00Z"),
  });
  assert.strictEqual(a.dedupeKey, again.dedupeKey);
});

test("weekly types repeat between weeks but not inside one", () => {
  const monday = buildEntry("digest.weekly", {
    userId: "u1",
    items: [{ title: "A" }],
    now: new Date("2026-07-27T08:00:00Z"),
  });
  const friday = buildEntry("digest.weekly", {
    userId: "u1",
    items: [{ title: "A" }],
    now: new Date("2026-07-31T08:00:00Z"),
  });
  const nextMonday = buildEntry("digest.weekly", {
    userId: "u1",
    items: [{ title: "A" }],
    now: new Date("2026-08-03T08:00:00Z"),
  });

  assert.strictEqual(monday.dedupeKey, friday.dedupeKey);
  assert.notStrictEqual(monday.dedupeKey, nextMonday.dedupeKey);
});

test("an admin broadcast is never deduped", () => {
  // Two campaigns may legitimately carry the same words; a unique key would
  // swallow the second one and report success.
  const entry = buildEntry("system.announcement", { title: "Maintenance tonight" });
  assert.strictEqual(entry.dedupeKey, null);
});

test("weekKey follows ISO weeks across a year boundary", () => {
  // 1 Jan 2027 is a Friday, so it belongs to the last ISO week of 2026.
  assert.strictEqual(weekKey(new Date("2027-01-01T00:00:00Z")), "2026-W53");
  assert.strictEqual(weekKey(new Date("2027-01-04T00:00:00Z")), "2027-W01");
  // Sunday and the Monday after it are different weeks, which is the property
  // "once a week" depends on.
  assert.notStrictEqual(
    weekKey(new Date("2026-08-02T00:00:00Z")),
    weekKey(new Date("2026-08-03T00:00:00Z"))
  );
});

test("recommendation types refuse a weak match", () => {
  const ctx = { show, userId: "u1", now: NOW };

  assert.strictEqual(buildEntry("show.published", { ...ctx, score: 0.2 }), null);
  assert.ok(buildEntry("show.published", { ...ctx, score: 0.8 }));
  // A followed show has no floor: the viewer already asked for it.
  assert.ok(buildEntry("episode.published", { show, episode, userId: "u1", score: 0 }));
});

test("expiry is set from the type's own horizon", () => {
  const entry = buildEntry("episode.published", { show, episode, userId: "u1", now: NOW });
  const days = (entry.expiresAt - NOW) / (24 * 60 * 60 * 1000);
  assert.strictEqual(days, TYPES["episode.published"].ttlDays);
});

test("in-app-only types never ask for push", () => {
  const entry = buildEntry("next_episode.ready", { show, episode, userId: "u1", now: NOW });
  assert.deepStrictEqual(entry.channels, ["inapp"]);
});

test("a season drop counts episodes instead of announcing each one", () => {
  const entry = buildEntry("season.published", {
    show,
    season: { _id: "s2", seasonNumber: 2 },
    episodeCount: 8,
    userId: "u1",
    now: NOW,
  });

  assert.strictEqual(entry.title, "The Long Dark — Season 2");
  assert.strictEqual(entry.body, "8 new episodes just landed.");

  const single = buildEntry("season.published", {
    show,
    season: { _id: "s3", seasonNumber: 3 },
    episodeCount: 1,
    userId: "u1",
    now: NOW,
  });
  assert.strictEqual(single.body, "1 new episode just landed.");
});

test("a resume nudge omits a progress figure that says nothing", () => {
  const base = { entityTitle: "Dune", deepLink: "/details/m1", entityId: "m1", userId: "u1", now: NOW };

  assert.match(buildEntry("continue.reminder", { ...base, percent: 42 }).body, /42% through/);
  // Barely started and all but finished both fall back to the generic line.
  assert.strictEqual(
    buildEntry("continue.reminder", { ...base, percent: 1 }).body,
    "Pick up where you left off."
  );
  assert.strictEqual(
    buildEntry("continue.reminder", { ...base, percent: 99 }).body,
    "Pick up where you left off."
  );
});

test("truncate cuts on a word boundary and marks the elision", () => {
  assert.strictEqual(truncate("short", 20), "short");
  assert.strictEqual(truncate("  collapses   whitespace  ", 40), "collapses whitespace");

  const cut = truncate("The Assassination of Jesse James by the Coward Robert Ford", 30);
  assert.ok(cut.length <= 30, `"${cut}" is longer than the limit`);
  assert.ok(cut.endsWith("…"));
  assert.ok(!cut.includes("  "));

  // A single long word has no boundary to fall back to; it is still bounded.
  const word = truncate("Supercalifragilisticexpialidocious", 10);
  assert.ok(word.length <= 10);
  assert.ok(word.endsWith("…"));
});

test("titles are bounded regardless of what the admin form accepted", () => {
  const entry = buildEntry("episode.published", {
    show: { ...show, title: "A".repeat(300) },
    episode,
    userId: "u1",
    now: NOW,
  });
  assert.ok(entry.title.length < 80, `title was ${entry.title.length} characters`);
});
