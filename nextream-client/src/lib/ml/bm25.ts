import { bigrams, charGrams, editDistance, normalize, tokenize } from "./text";
import type { CorpusItem } from "./types";

/**
 * The lexical half of search: an inverted index with BM25F scoring.
 *
 * It would be tempting to skip this and let the embeddings do everything. That
 * fails on the query search boxes actually receive. Someone typing "godfather"
 * wants *The Godfather* — not the three films the latent space thinks are
 * thematically adjacent to it, which is what a pure cosine ranking returns when
 * the exact title happens to sit slightly off the query's projection. Dense
 * retrieval generalises; sparse retrieval is exact. A search box needs both, and
 * `search.ts` fuses them.
 *
 * BM25F rather than plain BM25 because a title is not a synopsis. Ordinary BM25
 * over concatenated fields lets a long overview outweigh the title purely by
 * containing the query word twice, and length normalisation cannot fix it —
 * the fields have different natural lengths and different worth. BM25F applies
 * the boost and the normalisation *per field*, before saturation, which is the
 * only arrangement where "the title matches" reliably beats "the plot summary
 * mentions it".
 */

/**
 * Field boosts and per-field length normalisation.
 *
 * `b` is how hard a long field is penalised. Titles get b=0.4 — a long title is
 * only mildly less focused than a short one. Overviews get b=0.85, close to
 * full normalisation, because synopsis length varies enormously between
 * catalogue entries and says nothing about relevance.
 */
const FIELDS = {
  title: { boost: 4.2, b: 0.4 },
  genres: { boost: 2.0, b: 0.3 },
  tags: { boost: 1.5, b: 0.5 },
  overview: { boost: 0.9, b: 0.85 },
} as const;

type FieldName = keyof typeof FIELDS;
const FIELD_NAMES = Object.keys(FIELDS) as FieldName[];

/** Saturation. Above this, more occurrences of a term stop earning much. */
const K1 = 1.35;

/** Edits allowed when a query term is not in the vocabulary, by term length. */
function fuzzyBudget(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 8) return 2;
  return 3;
}

interface Posting {
  doc: number;
  /** Per-field term frequencies, already length-normalised. */
  weighted: number;
}

export interface LexicalHit {
  doc: number;
  score: number;
  /** True when the query had to be corrected to reach this. */
  fuzzy: boolean;
  /** The vocabulary terms that fired, for highlighting. */
  terms: string[];
}

export class LexicalIndex {
  private readonly postings = new Map<string, Posting[]>();
  private readonly documentFrequency = new Map<string, number>();
  /** Vocabulary term → the char-grams it contains, for fuzzy candidate lookup. */
  private readonly gramIndex = new Map<string, string[]>();
  private readonly vocabulary: string[] = [];
  private count = 0;

  constructor(items: CorpusItem[]) {
    this.build(items);
  }

  private build(items: CorpusItem[]): void {
    this.count = items.length;

    // Two passes. The first collects per-document field lengths so the second
    // can normalise against the *average*, which is not knowable until every
    // document has been seen.
    const perDoc: Array<Map<string, Partial<Record<FieldName, number>>>> = [];
    const fieldLengths: Record<FieldName, number[]> = {
      title: [], genres: [], tags: [], overview: [],
    };

    for (const item of items) {
      const fields: Record<FieldName, string[]> = {
        // Bigrams on the title only: they are what separates "star wars" from
        // "star trek", and on an overview they would triple the index for
        // phrases nobody searches.
        title: (() => {
          const tokens = tokenize(item.title);
          return [...tokens, ...bigrams(tokens)];
        })(),
        genres: item.genres.flatMap((genre) => tokenize(genre)),
        tags: item.tags.flatMap((tag) => tokenize(tag)),
        overview: tokenize(item.overview),
      };

      const counts = new Map<string, Partial<Record<FieldName, number>>>();
      for (const field of FIELD_NAMES) {
        fieldLengths[field].push(fields[field].length);
        for (const term of fields[field]) {
          const entry = counts.get(term) || {};
          entry[field] = (entry[field] || 0) + 1;
          counts.set(term, entry);
        }
      }

      perDoc.push(counts);
    }

    const averages = {} as Record<FieldName, number>;
    for (const field of FIELD_NAMES) {
      const lengths = fieldLengths[field];
      const total = lengths.reduce((sum, value) => sum + value, 0);
      averages[field] = total / Math.max(1, lengths.length) || 1;
    }

    for (let doc = 0; doc < perDoc.length; doc += 1) {
      for (const [term, counts] of perDoc[doc]) {
        let weighted = 0;
        for (const field of FIELD_NAMES) {
          const tf = counts[field];
          if (!tf) continue;
          const { boost, b } = FIELDS[field];
          const length = fieldLengths[field][doc];
          const normalised = 1 - b + (b * length) / averages[field];
          weighted += (boost * tf) / normalised;
        }

        const list = this.postings.get(term);
        if (list) list.push({ doc, weighted });
        else this.postings.set(term, [{ doc, weighted }]);

        this.documentFrequency.set(term, (this.documentFrequency.get(term) || 0) + 1);
      }
    }

    // The fuzzy side. Only single words go in — a bigram is never what someone
    // mistyped, and indexing them would double this for no recall.
    for (const term of this.postings.keys()) {
      if (term.includes("_") || term.length < 3) continue;
      this.vocabulary.push(term);
      for (const gram of new Set(charGrams(term, 3, 3))) {
        const list = this.gramIndex.get(gram);
        if (list) list.push(term);
        else this.gramIndex.set(gram, [term]);
      }
    }
  }

  /** ln(1 + (N - df + 0.5) / (df + 0.5)) — always positive, unlike the classic form. */
  private idf(term: string): number {
    const df = this.documentFrequency.get(term) || 0;
    if (!df) return 0;
    return Math.log(1 + (this.count - df + 0.5) / (df + 0.5));
  }

  /**
   * Vocabulary terms within an edit budget of `term`.
   *
   * Comparing against all of the vocabulary would be tens of thousands of edit
   * distances per query word. The gram index cuts that to the terms sharing at
   * least one 3-gram — for a typo, which by definition differs in one or two
   * characters, that set contains the answer and is two orders of magnitude
   * smaller. This is the same blocking trick a spell checker uses, and it is
   * what makes typo tolerance affordable on every keystroke.
   */
  private expand(term: string, max = 3): Array<{ term: string; penalty: number }> {
    const budget = fuzzyBudget(term.length);
    if (!budget) return [];

    const seen = new Map<string, number>();
    for (const gram of new Set(charGrams(term, 3, 3))) {
      for (const candidate of this.gramIndex.get(gram) || []) {
        seen.set(candidate, (seen.get(candidate) || 0) + 1);
      }
    }

    const scored: Array<{ term: string; penalty: number }> = [];
    for (const [candidate, shared] of seen) {
      if (candidate === term) continue;
      // Two shared grams for anything but the shortest terms: one is noise, and
      // running an edit distance per noisy candidate is the cost being avoided.
      if (shared < (term.length > 5 ? 2 : 1)) continue;

      const distance = editDistance(term, candidate, budget);
      if (distance > budget) continue;
      // A corrected term is worth less than one that was typed. The falloff is
      // steep so a real match on the literal query always outranks a fuzzy one.
      scored.push({ term: candidate, penalty: Math.pow(0.45, distance) });
    }

    return scored.sort((a, b) => b.penalty - a.penalty).slice(0, max);
  }

  /**
   * Scores the whole catalogue against a query.
   *
   * Prefix expansion is what makes this work as-you-type: the last token of a
   * query being typed is a *prefix*, not a word, and matching it literally
   * means the panel goes blank between every character and the one that
   * completes a word. Every vocabulary term starting with it fires instead,
   * discounted by how much of it is still missing.
   */
  search(query: string, options: { limit?: number; prefix?: boolean } = {}): LexicalHit[] {
    const { limit = 200, prefix = true } = options;
    const tokens = tokenize(query);
    if (!tokens.length) return [];

    const queryTerms = [...tokens, ...bigrams(tokens)];
    const scores = new Map<number, { score: number; fuzzy: boolean; terms: Set<string> }>();

    const contribute = (term: string, multiplier: number, fuzzy: boolean) => {
      const list = this.postings.get(term);
      if (!list) return;
      const idf = this.idf(term);
      if (idf <= 0) return;

      for (const posting of list) {
        const value = idf * (posting.weighted / (K1 + posting.weighted)) * multiplier;
        const entry = scores.get(posting.doc);
        if (entry) {
          entry.score += value;
          entry.fuzzy = entry.fuzzy && fuzzy;
          entry.terms.add(term);
        } else {
          scores.set(posting.doc, { score: value, fuzzy, terms: new Set([term]) });
        }
      }
    };

    tokens.forEach((token, position) => {
      const isLast = position === tokens.length - 1;
      contribute(token, 1, false);

      if (!this.postings.has(token)) {
        for (const { term, penalty } of this.expand(token)) contribute(term, penalty, true);
      }

      if (prefix && isLast && token.length >= 2) {
        for (const term of this.vocabulary) {
          if (term === token || !term.startsWith(token)) continue;
          contribute(term, 0.75 * (token.length / term.length), false);
        }
      }
    });

    // Bigrams are a bonus on top of their component words, never a requirement
    // — a phrase match should lift a title above the ones that merely contain
    // both words, not exclude them.
    for (const gram of queryTerms) {
      if (gram.includes("_")) contribute(gram, 1.6, false);
    }

    return [...scores.entries()]
      .map(([doc, entry]) => ({
        doc,
        score: entry.score,
        fuzzy: entry.fuzzy,
        terms: [...entry.terms],
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * The catalogue title closest to a query that found little.
   *
   * Only consulted when the results are thin, because correcting a query that
   * worked is how a search box starts arguing with the person using it.
   */
  suggest(query: string): string | null {
    const tokens = tokenize(query, { stemming: false });
    if (!tokens.length) return null;

    let changed = false;
    const corrected = tokens.map((token) => {
      if (this.postings.has(token) || token.length < 4) return token;
      const [best] = this.expand(token, 1);
      if (!best) return token;
      changed = true;
      return best.term;
    });

    return changed ? corrected.join(" ") : null;
  }

  /** Character ranges in a title that a set of matched terms covers. */
  highlight(title: string, terms: string[]): Array<[number, number]> {
    const haystack = normalize(title);
    const ranges: Array<[number, number]> = [];

    for (const term of terms) {
      // A stemmed posting will not appear literally in the title, so match on
      // the stem's prefix and let the word finish however it finishes.
      const stem = term.split("_")[0];
      if (stem.length < 2) continue;

      let from = 0;
      while (from < haystack.length) {
        const at = haystack.indexOf(stem, from);
        if (at === -1) break;
        // Word-initial only: highlighting "ing" inside "Shining" reads as a bug.
        if (at === 0 || haystack[at - 1] === " ") {
          let end = at + stem.length;
          while (end < haystack.length && haystack[end] !== " ") end += 1;
          ranges.push([at, end]);
        }
        from = at + stem.length;
      }
    }

    if (!ranges.length) return [];

    // `normalize` can shorten the string (it collapses punctuation), so ranges
    // are clamped to the original rather than trusted against it.
    ranges.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const [start, end] of ranges) {
      const last = merged[merged.length - 1];
      if (last && start <= last[1]) last[1] = Math.max(last[1], end);
      else merged.push([Math.min(start, title.length), Math.min(end, title.length)]);
    }
    return merged;
  }


  get terms(): number {
    return this.postings.size;
  }
}
