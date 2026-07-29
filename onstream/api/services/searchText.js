/**
 * Text matching primitives for catalogue search.
 *
 * Split out from search.js because none of this touches Mongo: it is the part
 * worth pinning with unit tests, and the part that decides whether typing
 * "totro" finds My Neighbour Totoro.
 *
 * Everything here works on *folded* text — lower-cased, de-accented, punctuation
 * flattened to spaces — so "Kiki's Delivery Service", "kikis delivery service"
 * and "KIKI’S  DELIVERY  SERVICE" are one string by the time they are compared.
 * Folding carries an index map alongside it, so a match found in folded space
 * can still be highlighted in the original the user actually sees.
 */

/** Symbols people type interchangeably with words. */
const ALIASES = {
  "&": "and",
  "+": "and",
  "@": "at",
};

/**
 * Dropped outright rather than flattened to a separator.
 *
 * An apostrophe inside a word is not a word break: splitting on it turns
 * "Kiki's Delivery Service" into four tokens, one of which is a bare "s" — which
 * both pollutes token matching and makes the acronym "ksds" instead of "kds".
 */
const ELIDED = new Set(["'", "’", "‘", "´", "`"]);

/**
 * Folds `value` and records, for every folded character, which index of the
 * original it came from.
 *
 * The map is why highlighting works: "Pokémon" folds to "pokemon" (the combining
 * accent is dropped, so the strings are different lengths), and "Tom & Jerry"
 * folds to "tom and jerry" (one character becomes three). Without the map a
 * match at folded offset 4 would be underlined at the wrong place in the source.
 */
function foldWithMap(value) {
  const source = String(value ?? "");
  const chars = [];
  const map = [];

  for (let index = 0; index < source.length; index += 1) {
    const raw = source[index];

    // A symbol only stands in for a word when it stands alone: "Tom & Jerry"
    // is "tom and jerry", but "AT&T" is not "at and t". Unspaced symbols fall
    // through to the separator branch below.
    const alias = /\s/.test(source[index - 1] || " ") ? ALIASES[raw] : null;
    if (alias) {
      for (const char of alias) {
        chars.push(char);
        map.push(index);
      }
      continue;
    }

    if (ELIDED.has(raw)) continue;

    const base = raw
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

    if (!base) continue;

    if (/^[a-z0-9]+$/.test(base)) {
      for (const char of base) {
        chars.push(char);
        map.push(index);
      }
      continue;
    }

    // Everything else — punctuation, spaces, scripts we cannot fold — becomes a
    // single separator. Collapsed on the way in so the token split is trivial.
    if (chars.length && chars[chars.length - 1] !== " ") {
      chars.push(" ");
      map.push(index);
    }
  }

  while (chars.length && chars[chars.length - 1] === " ") {
    chars.pop();
    map.pop();
  }

  return { text: chars.join(""), map };
}

function fold(value) {
  return foldWithMap(value).text;
}

/** Folded tokens, empties dropped. */
function tokenize(value) {
  const folded = fold(value);
  return folded ? folded.split(" ").filter(Boolean) : [];
}

/**
 * Tokens with their offsets in the *folded* string, so a per-token match can be
 * translated back through the fold map into a highlight range.
 */
function tokenSpans(folded) {
  const spans = [];
  const pattern = /[a-z0-9]+/g;
  let match = pattern.exec(folded);
  while (match) {
    spans.push({ token: match[0], start: match.index, end: match.index + match[0].length });
    match = pattern.exec(folded);
  }
  return spans;
}

/** "Kiki's Delivery Service" -> "kds", so "kds" finds it. */
function acronym(value) {
  return tokenize(value)
    .map((token) => token[0])
    .join("");
}

/**
 * How many single-character edits a token of this length may absorb.
 *
 * Fixed thresholds punish short words: one edit turns "cat" into "car", so a
 * three-letter query has to match exactly or it matches everything.
 */
function fuzzyBudget(length) {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  return 3;
}

/**
 * Optimal string alignment distance, abandoned once it exceeds `max`.
 *
 * Transpositions count as one edit rather than two, because swapping adjacent
 * letters is the most common typo there is ("teh", "raito") and plain
 * Levenshtein rates it as far from the target as a genuinely different word.
 */
function editDistance(a, b, max = 3) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (!la) return lb <= max ? lb : max + 1;
  if (!lb) return la <= max ? la : max + 1;
  if (Math.abs(la - lb) > max) return max + 1;

  let twoAgo = [];
  let prev = new Array(lb + 1);
  for (let j = 0; j <= lb; j += 1) prev[j] = j;

  for (let i = 1; i <= la; i += 1) {
    const row = new Array(lb + 1);
    row[0] = i;
    let best = row[0];

    for (let j = 1; j <= lb; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let value = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);

      if (
        i > 1 &&
        j > 1 &&
        a.charCodeAt(i - 1) === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
      ) {
        value = Math.min(value, twoAgo[j - 2] + 1);
      }

      row[j] = value;
      if (value < best) best = value;
    }

    // Every remaining row can only add to the running minimum, so once the
    // cheapest alignment so far is already over budget the answer is "no".
    if (best > max) return max + 1;

    twoAgo = prev;
    prev = row;
  }

  return prev[lb];
}

/** 1 for identical, falling to 0 as the edit distance approaches the budget. */
function tokenSimilarity(query, candidate) {
  if (query === candidate) return 1;
  const budget = fuzzyBudget(Math.max(query.length, candidate.length));
  if (!budget) return 0;
  const distance = editDistance(query, candidate, budget);
  if (distance > budget) return 0;
  return 1 - distance / (budget + 1);
}

/** Merges overlapping/adjacent highlight ranges and sorts them. */
function mergeRanges(ranges) {
  const sorted = ranges
    .filter((range) => range && range[1] > range[0])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      out.push([range[0], range[1]]);
    }
  }
  return out;
}

/** Folded [start,end) back to an original-string range via the fold map. */
function toSourceRange(map, start, length) {
  if (!length || start < 0 || start >= map.length) return null;
  const last = Math.min(map.length - 1, start + length - 1);
  return [map[start], map[last] + 1];
}

/**
 * Scores one query against one field, and says where it matched.
 *
 * The tiers below are ordered by how much confidence a match of that shape
 * carries. They are not additive: a title that matches the whole query as a
 * prefix has already told us everything, and adding a per-token bonus on top
 * would rank a long title above a short exact one.
 *
 *   1.00  the field *is* the query
 *   0.94  the query is a prefix of the field          ("kiki" → "Kiki's ...")
 *   0.86  the query starts one of the field's words   ("del"  → "... Delivery ...")
 *   0.72  the query appears anywhere in the field
 *   0.70  the query is the field's acronym            ("kds"  → "Kiki's Delivery Service")
 *   ≤0.66 every query token matches some word, exactly, by prefix, or fuzzily
 *
 * Returns `null` when nothing matched at all, so callers can drop the candidate
 * rather than reason about a zero.
 */
function matchField(query, field, { fuzzy = true } = {}) {
  const folded = foldWithMap(String(field ?? ""));
  if (!folded.text) return null;

  const queryFolded = fold(query);
  if (!queryFolded) return null;

  const haystack = folded.text;
  const spans = tokenSpans(haystack);

  if (haystack === queryFolded) {
    return { score: 1, tier: "exact", ranges: [[0, String(field).length]] };
  }

  if (haystack.startsWith(queryFolded)) {
    // Longer titles are weaker prefix matches: "the" should rank "The Wire"
    // above "The Lord of the Rings: The Fellowship of the Ring". Bounded so the
    // weakest whole-string prefix still outranks the best word-prefix below.
    const coverage = queryFolded.length / haystack.length;
    return {
      score: 0.94 - 0.06 * (1 - coverage),
      tier: "prefix",
      ranges: mergeRanges([toSourceRange(folded.map, 0, queryFolded.length)]),
    };
  }

  const wordStart = spans.find((span) => haystack.startsWith(queryFolded, span.start));
  if (wordStart) {
    return {
      score: 0.86,
      tier: "word-prefix",
      ranges: mergeRanges([toSourceRange(folded.map, wordStart.start, queryFolded.length)]),
    };
  }

  const anywhere = haystack.indexOf(queryFolded);
  if (anywhere >= 0) {
    return {
      score: 0.72,
      tier: "substring",
      ranges: mergeRanges([toSourceRange(folded.map, anywhere, queryFolded.length)]),
    };
  }

  const initials = spans.map((span) => span.token[0]).join("");
  if (queryFolded.length >= 2 && !queryFolded.includes(" ") && initials.startsWith(queryFolded)) {
    return {
      score: 0.7,
      tier: "acronym",
      ranges: mergeRanges(
        spans
          .slice(0, queryFolded.length)
          .map((span) => toSourceRange(folded.map, span.start, 1))
      ),
    };
  }

  // Token coverage. Each query token takes its best match among the field's
  // words; the field's score is the average, so a query where half the words
  // land scores half as well as one where all of them do.
  const queryTokens = queryFolded.split(" ").filter(Boolean);
  if (!queryTokens.length) return null;

  const ranges = [];
  let total = 0;
  let matched = 0;

  for (const token of queryTokens) {
    let best = 0;
    let bestSpan = null;
    let bestLength = 0;

    for (const span of spans) {
      let value = 0;
      let length = 0;

      if (span.token === token) {
        value = 1;
        length = token.length;
      } else if (span.token.startsWith(token)) {
        // A prefix of a long word says less than a prefix of a short one:
        // "car" into "carnival" is a weaker signal than "car" into "cars".
        value = 0.82 - 0.12 * (1 - token.length / span.token.length);
        length = token.length;
      } else if (token.length >= 4 && span.token.includes(token)) {
        value = 0.6;
        length = token.length;
      } else if (fuzzy) {
        const similarity = tokenSimilarity(token, span.token);
        if (similarity > 0) {
          value = 0.66 * similarity;
          length = span.token.length;
        }
      }

      if (value > best) {
        best = value;
        bestSpan = span;
        bestLength = length;
      }
    }

    if (best > 0 && bestSpan) {
      matched += 1;
      total += best;
      const range = toSourceRange(folded.map, bestSpan.start, bestLength || bestSpan.token.length);
      if (range) ranges.push(range);
    }
  }

  if (!matched) return null;

  const coverage = matched / queryTokens.length;
  const mean = total / queryTokens.length;

  // A single token out of four landing is usually a coincidence, not a match.
  if (coverage < 0.5 && queryTokens.length > 2) return null;

  return {
    score: Math.min(0.66, mean) * (0.55 + 0.45 * coverage),
    tier: coverage === 1 ? "tokens" : "partial",
    ranges: mergeRanges(ranges),
  };
}

/**
 * Nearest catalogue word to a token the catalogue does not contain.
 *
 * Drives "did you mean" — and only that. Correcting a token that *does* exist
 * would rewrite "the" into "she" on every query that contains it.
 */
function closestTerm(token, vocabulary) {
  if (!token || vocabulary.has(token)) return null;
  const budget = fuzzyBudget(token.length);
  if (!budget) return null;

  let best = null;
  let bestDistance = budget + 1;
  let bestFrequency = 0;

  for (const [term, frequency] of vocabulary) {
    if (Math.abs(term.length - token.length) > budget) continue;
    const distance = editDistance(token, term, budget);
    if (distance > budget) continue;
    if (distance < bestDistance || (distance === bestDistance && frequency > bestFrequency)) {
      best = term;
      bestDistance = distance;
      bestFrequency = frequency;
    }
  }

  return best;
}

/**
 * A corrected spelling of the whole query, or null when nothing needed fixing.
 *
 * Only tokens absent from the catalogue are touched, and the suggestion is
 * withheld unless at least one was actually replaced — a "did you mean" that
 * echoes the query back is noise.
 */
function suggestSpelling(query, vocabulary) {
  const tokens = tokenize(query);
  if (!tokens.length || !vocabulary?.size) return null;

  let changed = false;
  const corrected = tokens.map((token) => {
    const replacement = closestTerm(token, vocabulary);
    if (replacement && replacement !== token) {
      changed = true;
      return replacement;
    }
    return token;
  });

  return changed ? corrected.join(" ") : null;
}

module.exports = {
  acronym,
  closestTerm,
  editDistance,
  fold,
  foldWithMap,
  fuzzyBudget,
  matchField,
  mergeRanges,
  suggestSpelling,
  tokenSimilarity,
  tokenSpans,
  tokenize,
};
