const test = require("node:test");
const assert = require("node:assert");

const {
  acronym,
  closestTerm,
  editDistance,
  fold,
  foldWithMap,
  matchField,
  suggestSpelling,
  tokenize,
} = require("./searchText");

// The matcher, pinned without a database. Every failure here is one a viewer
// meets as "I typed the name of the thing and it did not come up".

// --- folding -----------------------------------------------------------------

test("fold strips diacritics so accented titles are reachable from a plain keyboard", () => {
  assert.equal(fold("Pokémon: Détective Pikachu"), "pokemon detective pikachu");
  assert.equal(fold("Amélie"), "amelie");
});

test("fold elides apostrophes rather than splitting on them", () => {
  // Splitting would leave a bare "s" token, which pollutes token matching and
  // makes the acronym "ksds" instead of "kds".
  assert.equal(fold("Kiki's Delivery Service"), "kikis delivery service");
  assert.equal(acronym("Kiki's Delivery Service"), "kds");
});

test("fold reads a spaced ampersand as a word and an unspaced one as a break", () => {
  assert.equal(fold("Tom & Jerry"), "tom and jerry");
  assert.equal(fold("AT&T"), "at t");
});

test("fold collapses punctuation and runs of whitespace to single separators", () => {
  assert.equal(fold("  Spider-Man:   No  Way Home!! "), "spider man no way home");
  assert.deepEqual(tokenize("Spider-Man: No Way Home"), ["spider", "man", "no", "way", "home"]);
});

test("foldWithMap points every folded character back at its source index", () => {
  const { text, map } = foldWithMap("Tom & Jerry");
  assert.equal(text, "tom and jerry");
  assert.equal(map.length, text.length);
  // "jerry" starts at folded offset 8 and at source offset 6.
  assert.equal(text.slice(8), "jerry");
  assert.equal(map[8], 6);
});

// --- edit distance -----------------------------------------------------------

test("editDistance counts an adjacent transposition as one edit, not two", () => {
  assert.equal(editDistance("teh", "the", 3), 1);
  assert.equal(editDistance("raito", "ratio", 3), 1);
});

test("editDistance abandons once the budget is blown", () => {
  // The exact value past the budget is not meaningful; exceeding it is.
  assert.ok(editDistance("totoro", "casablanca", 2) > 2);
});

test("editDistance rejects on length difference before doing any work", () => {
  assert.ok(editDistance("a", "abcdefgh", 3) > 3);
});

// --- match tiers -------------------------------------------------------------

test("an exact title beats a prefix beats a word-prefix beats a substring", () => {
  const exact = matchField("the wire", "The Wire").score;
  const prefix = matchField("the wi", "The Wire").score;
  const wordPrefix = matchField("wir", "The Wire").score;
  const substring = matchField("he wir", "The Wire").score;

  assert.ok(exact > prefix, "exact should beat prefix");
  assert.ok(prefix > wordPrefix, "prefix should beat word-prefix");
  assert.ok(wordPrefix > substring, "word-prefix should beat substring");
});

test("a whole-string prefix outranks a word-prefix even on a long title", () => {
  // The prefix tier carries a length penalty; it must never sink far enough to
  // put "del" ahead of "kiki" for the same title.
  const byPrefix = matchField("kiki", "Kiki's Delivery Service").score;
  const byWord = matchField("del", "Kiki's Delivery Service").score;
  assert.ok(byPrefix > byWord);
});

test("a short title wins a prefix tie against a long one", () => {
  const short = matchField("the", "The Wire").score;
  const long = matchField("the", "The Lord of the Rings: The Fellowship of the Ring").score;
  assert.ok(short > long);
});

test("initials find a title nobody wants to type out", () => {
  const hit = matchField("kds", "Kiki's Delivery Service");
  assert.equal(hit.tier, "acronym");
  // One highlight per initial, at the start of each word.
  assert.deepEqual(hit.ranges, [
    [0, 1],
    [7, 8],
    [16, 17],
  ]);
});

test("a typo still finds the title", () => {
  assert.ok(matchField("totro", "My Neighbor Totoro"));
  assert.ok(matchField("breking bad", "Breaking Bad"));
  assert.ok(matchField("intersteller", "Interstellar"));
});

test("an unrelated query matches nothing at all", () => {
  assert.equal(matchField("zzzqqq", "My Neighbor Totoro"), null);
  assert.equal(matchField("casablanca", "The Wire"), null);
});

test("one token out of four landing is a coincidence, not a match", () => {
  assert.equal(matchField("the quick brown fox", "The Wire"), null);
});

test("highlight ranges index the original string, not the folded one", () => {
  const hit = matchField("pokemon", "Pokémon: Détective Pikachu");
  const [[start, end]] = hit.ranges;
  assert.equal("Pokémon: Détective Pikachu".slice(start, end), "Pokémon");
});

test("fuzzy matching can be switched off for weak fields", () => {
  // A synopsis hit is worth so little that a fuzzy one is pure noise.
  assert.ok(matchField("breking", "Breaking Bad", { fuzzy: true }));
  assert.equal(matchField("breking", "Breaking Bad", { fuzzy: false }), null);
});

// --- spelling ----------------------------------------------------------------

const VOCABULARY = new Map([
  ["totoro", 1],
  ["neighbor", 1],
  ["breaking", 2],
  ["bad", 3],
  ["interstellar", 1],
]);

test("suggestSpelling corrects only the words the catalogue does not have", () => {
  assert.equal(suggestSpelling("totro", VOCABULARY), "totoro");
  assert.equal(suggestSpelling("breking bad", VOCABULARY), "breaking bad");
});

test("suggestSpelling stays quiet when every word is already a catalogue word", () => {
  assert.equal(suggestSpelling("breaking bad", VOCABULARY), null);
  assert.equal(suggestSpelling("totoro", VOCABULARY), null);
});

test("suggestSpelling stays quiet when nothing is close enough to be a typo", () => {
  assert.equal(suggestSpelling("casablanca", VOCABULARY), null);
});

test("closestTerm breaks a distance tie on how common the word is", () => {
  const vocabulary = new Map([
    ["bland", 9],
    ["blend", 1],
  ]);
  assert.equal(closestTerm("blxnd", vocabulary), "bland");
});

test("closestTerm refuses to correct words too short to have a safe budget", () => {
  // One edit turns "cat" into "car"; correcting at that length invents results.
  assert.equal(closestTerm("cat", new Map([["car", 5]])), null);
});
