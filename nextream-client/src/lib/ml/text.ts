/**
 * Text, reduced to the things a bag-of-features model can count.
 *
 * All of this is plain JavaScript on purpose. It runs on every keystroke in the
 * search box and once per catalogue item at boot, and neither is worth waiting
 * on a megabyte of TensorFlow for. The tensors only start where the arithmetic
 * does, in `bm25.ts` and beyond.
 *
 * The three representations here answer three different questions, and the
 * search stack uses all of them because no one of them is enough:
 *
 *   tokens      "does this share a word with the query" — precise, and blind to
 *               a single mistyped letter.
 *   charGrams   "does this share a *shape* with the query" — survives typos,
 *               plurals and joined words, at the cost of matching "star" to
 *               "start" nearly as well as to "stars".
 *   editDistance the tie-breaker, run only on the handful of candidates the
 *               first two already surfaced, because it is O(n·m) per pair.
 */

/**
 * Words that carry no retrieval signal in a catalogue of titles.
 *
 * Kept short deliberately. Aggressive stoplists are a search bug factory: "The
 * Thing", "It", "Us" and "Her" are all real films, and a list that drops those
 * tokens makes them unfindable by name. Everything here is either a preposition
 * or an article that never appears alone as a title.
 */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has",
  "have", "in", "into", "is", "of", "on", "or", "that", "the", "their", "there",
  "this", "to", "was", "were", "will", "with",
]);

/**
 * Suffix rules, longest first.
 *
 * This is not a Porter stemmer and does not try to be — a full one is a page of
 * conditional rules to conflate word forms that a catalogue of proper nouns
 * mostly does not contain. What it does buy is the plural and the participle,
 * which is where nearly all real query/title mismatch lives: "zombies" against
 * "Zombie", "haunting" against "Haunted".
 */
const SUFFIXES: Array<[string, string]> = [
  ["ational", "ate"],
  ["iveness", "ive"],
  ["fulness", "ful"],
  ["ousness", "ous"],
  ["ization", "ize"],
  ["ateness", "ate"],
  ["ements", "ement"],
  ["ements", "ement"],
  ["ingly", ""],
  ["edly", ""],
  ["ement", ""],
  ["ness", ""],
  ["ings", ""],
  ["ally", "al"],
  ["ies", "y"],
  ["ied", "y"],
  ["ing", ""],
  ["ers", "er"],
  ["est", ""],
  ["ed", ""],
  ["es", ""],
  ["s", ""],
];

/**
 * Lower-cased, unaccented, punctuation-free.
 *
 * NFKD splits an accented character into its base plus a combining mark, which
 * the following range then strips — so "Amélie" and "Amelie" become the same
 * string without a per-language character table. Apostrophes close up rather
 * than becoming a space, so "don't" is one token and not two.
 */
export function normalize(value: string): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function stem(token: string): string {
  // Below five characters the suffix rules do more harm than good: they turn
  // "ties" into "ty" and "sees" into "see", and short titles are exactly where
  // a wrong conflation is most visible.
  if (token.length < 5) return token;

  for (const [suffix, replacement] of SUFFIXES) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
      return token.slice(0, -suffix.length) + replacement;
    }
  }
  return token;
}

export interface TokenizeOptions {
  /** Keep stopwords — the query parser wants them, the index does not. */
  keepStopwords?: boolean;
  stemming?: boolean;
}

export function tokenize(value: string, options: TokenizeOptions = {}): string[] {
  const { keepStopwords = false, stemming = true } = options;
  const words = normalize(value).split(" ").filter(Boolean);

  const tokens: string[] = [];
  for (const word of words) {
    if (!keepStopwords && STOPWORDS.has(word)) continue;
    tokens.push(stemming ? stem(word) : word);
  }
  return tokens;
}

/** Adjacent token pairs, which is what makes "star wars" beat "star trek". */
export function bigrams(tokens: string[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 1) pairs.push(`${tokens[i]}_${tokens[i + 1]}`);
  return pairs;
}

/**
 * Character n-grams over the whole string, with boundary markers.
 *
 * The markers matter more than they look: without them "war" appearing at the
 * start of a title is indistinguishable from "war" in the middle of "warehouse",
 * and prefix matching — which is what someone typing a title is doing — loses
 * its advantage entirely.
 */
export function charGrams(value: string, min = 3, max = 4): string[] {
  const padded = `^${normalize(value).replace(/ /g, "^")}$`;
  const grams: string[] = [];

  for (let n = min; n <= max; n += 1) {
    for (let i = 0; i + n <= padded.length; i += 1) grams.push(padded.slice(i, i + n));
  }
  return grams;
}

/** First letters of each word: "lotr" finding "Lord of the Rings". */
export function acronym(value: string): string {
  return normalize(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("");
}

/**
 * FNV-1a, 32-bit.
 *
 * The hashing trick needs a hash that is fast, well distributed over short
 * ASCII strings, and identical between the indexer and the query encoder. FNV-1a
 * is all three and is nine lines; anything stronger is paying for collision
 * resistance that a feature bucket does not need.
 *
 * `>>> 0` after the multiply keeps the value in unsigned 32-bit range —
 * JavaScript's `*` on large ints silently loses precision through doubles
 * otherwise, and Math.imul does the multiply in 32-bit for us.
 */
export function hash32(value: string, seed = 0x811c9dc5): number {
  let h = seed;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Which bucket a feature lands in, and whether it counts up or down.
 *
 * The sign is the point. Two features colliding into one bucket normally add,
 * which inflates that bucket and biases every dot product that touches it.
 * Giving each feature an independent ±1 from a second hash makes collisions
 * cancel in expectation instead — the standard signed-hashing correction, and
 * the difference between a hashed space that behaves like the real one and one
 * that quietly rewards common words.
 */
export function bucketOf(feature: string, dimensions: number): { index: number; sign: number } {
  const h = hash32(feature);
  return {
    index: h % dimensions,
    sign: (hash32(feature, 0x9e3779b1) & 1) === 0 ? 1 : -1,
  };
}

/**
 * Damerau-Levenshtein, abandoned once it passes `max`.
 *
 * Transposition is included because it is the single most common typing error
 * and plain Levenshtein charges two edits for it — which is enough to push
 * "Totoro" out of reach of "Totro" at any threshold tight enough to be useful.
 *
 * The early exit is not an optimisation detail; it is what makes this callable
 * per candidate. Rows whose best possible score already exceeds the budget stop
 * the whole computation, so a comparison against a long unrelated title costs
 * one row rather than n·m cells.
 */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev2: number[] = [];
  let prev: number[] = new Array(b.length + 1);
  let curr: number[] = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prev2[j - 2] + 1);
      }

      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }

    if (rowMin > max) return max + 1;

    prev2 = prev;
    prev = curr;
    curr = new Array(b.length + 1);
  }

  return prev[b.length];
}

/** 1 for identical, falling to 0 at the edit budget. */
export function fuzzyScore(a: string, b: string, max = 3): number {
  const distance = editDistance(a, b, max);
  if (distance > max) return 0;
  return 1 - distance / (Math.max(a.length, b.length) || 1);
}

/**
 * How the query matched a field, on a 0-1 scale.
 *
 * Shape carries information that a bag of tokens throws away. Someone who typed
 * the exact title has already decided; someone whose query is a prefix is
 * mid-way through deciding; someone whose query appears in the middle of a long
 * synopsis has probably matched by accident. Collapsing all three to "matched"
 * is how a search box ends up putting a documentary about the making of a film
 * above the film.
 */
export function matchShape(query: string, field: string): number {
  const q = normalize(query);
  const f = normalize(field);
  if (!q || !f) return 0;

  if (f === q) return 1;
  if (f.startsWith(q)) return 0.92;

  // Word-initial: "wars" against "Star Wars" is a real hit; "ars" is not.
  const words = f.split(" ");
  if (words.some((word) => word.startsWith(q))) return 0.78;

  if (acronym(f) === q) return 0.74;
  if (f.includes(q)) return 0.55;

  // Every query word present somewhere, in any order.
  const queryWords = q.split(" ").filter(Boolean);
  if (queryWords.length > 1 && queryWords.every((word) => f.includes(word))) return 0.62;

  const best = Math.max(0, ...words.map((word) => fuzzyScore(q, word, q.length <= 4 ? 1 : 2)));
  return best > 0.62 ? best * 0.7 : 0;
}
