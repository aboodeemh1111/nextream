const test = require("node:test");
const assert = require("node:assert");

const {
  applyOverrides,
  buildFacets,
  parseQuery,
  passesFilters,
  rank,
  relevanceOf,
} = require("./search");

// Query understanding and ranking, pinned without a database. The queries below
// are the ones that break a naive title regex: a search that names a genre and
// a decade rather than a title, a title that happens to contain a filter word,
// and an episode addressed by number.

const GENRES = [
  { value: "horror", label: "Horror" },
  { value: "comedy", label: "Comedy" },
  { value: "sci fi", label: "Sci-Fi" },
  { value: "animation", label: "Animation" },
];

const parse = (query) => parseQuery(query, { genres: GENRES });

function movie(title, extra = {}) {
  return {
    uid: `movie:${title}`,
    id: title,
    kind: "movie",
    filterKind: "movie",
    title,
    overview: "",
    genres: [],
    genreLabels: [],
    tagLabels: [],
    year: null,
    views: 0,
    ratingNormalised: 0,
    ratingVotes: 0,
    addedAt: null,
    ...extra,
  };
}

function episode(title, seasonNumber, episodeNumber, extra = {}) {
  return movie(title, {
    uid: `episode:${title}:${seasonNumber}:${episodeNumber}`,
    kind: "episode",
    filterKind: "episode",
    seasonNumber,
    episodeNumber,
    ...extra,
  });
}

const CONTEXT = { profile: { taste: new Map() }, maxViews: 100, meanRating: 0.55, sort: null };

const titlesFor = (query, items, context = CONTEXT) =>
  rank(items, parse(query), context).scored.map((entry) => entry.item.title);

// --- query understanding -----------------------------------------------------

test("a query that is all filters leaves no text to match", () => {
  const parsed = parse("top rated horror series from 2019");
  assert.equal(parsed.text, "");
  assert.equal(parsed.filters.kind, "show");
  assert.deepEqual(parsed.filters.genres, ["horror"]);
  assert.equal(parsed.filters.year, 2019);
  assert.equal(parsed.filters.sort, "rating");
});

test("a multi-word genre is taken whole rather than leaving half behind", () => {
  const parsed = parse("sci-fi movies");
  assert.deepEqual(parsed.filters.genres, ["sci fi"]);
  assert.equal(parsed.text, "");
});

test("a decade becomes a range", () => {
  assert.deepEqual(
    [parse("90s comedy").filters.yearFrom, parse("90s comedy").filters.yearTo],
    [1990, 1999]
  );
  assert.deepEqual(
    [parse("2010s horror").filters.yearFrom, parse("2010s horror").filters.yearTo],
    [2010, 2019]
  );
});

test("an episode address is parsed in every notation people use", () => {
  for (const query of ["the wire s2e5", "the wire 2x05", "the wire season 2 episode 5"]) {
    const parsed = parse(query);
    assert.equal(parsed.filters.seasonNumber, 2, query);
    assert.equal(parsed.filters.episodeNumber, 5, query);
    assert.equal(parsed.text, "wire", query);
  }
});

test("a connector survives when it is the entire query", () => {
  // "the" is glue in "horror from 2019" and a title in "the".
  assert.equal(parse("the").text, "the");
  assert.equal(parse("horror from 2019").text, "");
});

test("explicit refinements beat anything inferred from the words", () => {
  const parsed = applyOverrides(parse("horror movies"), { kind: "show", genre: "comedy" });
  assert.equal(parsed.filters.kind, "show");
  assert.deepEqual(parsed.filters.genres, ["comedy"]);
  // And the chips say so exactly once, rather than showing both readings.
  assert.equal(parsed.understood.filter((entry) => entry.type === "kind").length, 1);
  assert.equal(parsed.understood.filter((entry) => entry.type === "genre").length, 1);
});

// --- relevance ---------------------------------------------------------------

test("stripping a filter word cannot lose a title that contains it", () => {
  // "movies" parses as a kind, leaving no text — but the raw query is still
  // scored, so the film actually called "Movies" is still the top hit.
  const parsed = parse("movies");
  assert.equal(parsed.text, "");
  assert.ok(relevanceOf(movie("Movies"), parsed).score > 0.9);
});

test("a title match outranks a synopsis match by a wide margin", () => {
  const parsed = parse("dragon");
  const byTitle = relevanceOf(movie("Dragon"), parsed).score;
  const bySynopsis = relevanceOf(movie("Unrelated", { overview: "A dragon appears" }), parsed).score;
  assert.ok(byTitle > bySynopsis * 3);
});

test("relevance says which field it matched, so the UI can explain itself", () => {
  const parsed = parse("horror");
  const hit = relevanceOf(movie("Sinister", { genreLabels: ["Horror"] }), parsed);
  assert.equal(hit.field, "genres");
});

// --- ranking -----------------------------------------------------------------

test("relevance dominates popularity", () => {
  const titles = titlesFor("totoro", [
    movie("Blockbuster", { views: 100 }),
    movie("My Neighbor Totoro", { views: 1 }),
  ]);
  assert.equal(titles[0], "My Neighbor Totoro");
});

test("popularity breaks a tie between equally relevant titles", () => {
  const titles = titlesFor("dragon", [
    movie("Dragon", { views: 2, id: "quiet" }),
    movie("Dragon", { views: 90, id: "loud" }),
  ]);
  // Same title, same relevance — the one people watch comes first.
  const ranked = rank(
    [movie("Dragon", { uid: "quiet", views: 2 }), movie("Dragon", { uid: "loud", views: 90 })],
    parse("dragon"),
    CONTEXT
  );
  assert.equal(ranked.scored[0].item.uid, "loud");
  assert.equal(titles.length, 2);
});

test("a title the query does not match is not a result", () => {
  const titles = titlesFor("totoro", [movie("Casablanca"), movie("My Neighbor Totoro")]);
  assert.deepEqual(titles, ["My Neighbor Totoro"]);
});

test("a query that is only filters admits the whole pool", () => {
  // Nothing to be relevant to, so ordering falls to the filters and the signals
  // rather than the pool coming back empty.
  const titles = titlesFor("horror", [
    movie("Sinister", { genres: ["horror"], views: 5 }),
    movie("Hereditary", { genres: ["horror"], views: 9 }),
  ]);
  assert.equal(titles.length, 2);
});

test("filters partition rather than cut, so a filter can be relaxed", () => {
  const items = [movie("Old Horror", { genres: ["horror"], year: 1999 })];
  const { scored, filtered } = rank(items, parse("horror 2019"), CONTEXT);
  assert.equal(filtered, 0, "nothing satisfies the year");
  assert.equal(scored.length, 1, "but the horror title is still available to fall back on");
});

test("titles that satisfy every filter sort above titles that do not", () => {
  const items = [
    movie("Wrong Year", { genres: ["horror"], year: 1999, views: 100 }),
    movie("Right Year", { genres: ["horror"], year: 2019, views: 1 }),
  ];
  assert.equal(titlesFor("horror 2019", items)[0], "Right Year");
});

test("an addressed episode outranks its siblings", () => {
  const items = [
    episode("Pilot", 1, 1, { showTitle: "The Wire" }),
    episode("Stray Rounds", 2, 5, { showTitle: "The Wire" }),
  ];
  assert.equal(titlesFor("the wire s2e5", items)[0], "Stray Rounds");
});

test("an explicit sort replaces the relevance order", () => {
  const items = [
    movie("Older", { genres: ["horror"], addedAt: new Date(2020, 0, 1) }),
    movie("Newer", { genres: ["horror"], addedAt: new Date(2026, 0, 1) }),
  ];
  const parsed = parse("horror");
  const byRelevance = rank(items, parsed, CONTEXT).scored.map((e) => e.item.title);
  const byDate = rank(items, parsed, { ...CONTEXT, sort: "newest" }).scored.map((e) => e.item.title);
  assert.equal(byDate[0], "Newer");
  assert.equal(byRelevance.length, byDate.length);
});

// --- filters -----------------------------------------------------------------

test("a series filter includes legacy movie rows flagged as series", () => {
  // Those rows are labelled "Series" on every card, so a series filter that
  // dropped them would hide titles the UI has already called series.
  const legacy = movie("Legacy Show", { filterKind: "show" });
  assert.equal(passesFilters(legacy, parse("series").filters), true);
});

test("a status filter excludes movies, which have no status", () => {
  assert.equal(passesFilters(movie("A Film"), parse("completed series").filters), false);
});

test("a genre filter requires every named genre, not any of them", () => {
  const filters = parse("horror comedy").filters;
  assert.equal(passesFilters(movie("Both", { genres: ["horror", "comedy"] }), filters), true);
  assert.equal(passesFilters(movie("One", { genres: ["horror"] }), filters), false);
});

// --- facets ------------------------------------------------------------------

test("facets count what is in the results, ordered by how much of it there is", () => {
  const facets = buildFacets([
    { item: movie("A", { filterKind: "movie", genres: ["horror"], genreLabels: ["Horror"], year: 2019 }) },
    { item: movie("B", { filterKind: "movie", genres: ["horror"], genreLabels: ["Horror"], year: 2014 }) },
    { item: movie("C", { filterKind: "show", genres: ["comedy"], genreLabels: ["Comedy"], year: 1994 }) },
  ]);

  assert.deepEqual(
    facets.genres.map((facet) => [facet.label, facet.count]),
    [
      ["Horror", 2],
      ["Comedy", 1],
    ]
  );
  assert.deepEqual(facets.kinds[0], { value: "movie", label: "Movies", count: 2 });
  assert.deepEqual(
    facets.decades.map((facet) => facet.label),
    ["2010s", "1990s"]
  );
});
