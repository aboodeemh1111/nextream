import { genreVocabulary } from "./corpus";
import type { CorpusItem } from "./types";

/**
 * The numeric side of an item, next to the textual side in `semantic.ts`.
 *
 * The latent space knows what a title is *about*; it knows nothing about
 * whether it is any good, whether anyone watched it, or whether it came out
 * last week. Those are the signals that decide between two titles the
 * embeddings consider interchangeable, and a model cannot use them unless they
 * are on the same scale as everything else in its input vector.
 *
 * Every feature here lands in roughly 0-1 with a roughly uniform spread. That
 * is not tidiness — a network with an input ranging over millions of views next
 * to one ranging over 0-1 spends its first several thousand steps learning to
 * undo the scale difference, and with a few hundred training examples on a
 * phone there are no thousands of steps to spare.
 */

/** Genres kept as their own feature. Beyond this the tail is single-item noise. */
const GENRE_SLOTS = 24;

/** Scalar features, in the order they appear in each row. */
const SCALARS = [
  "isShow",
  "quality",
  "hasRating",
  "popularity",
  "recency",
  "era",
  "runtime",
  "maturity",
  "episodic",
  "complete",
  "votes",
] as const;

export const FEATURE_SCALARS = SCALARS.length;

export interface FeatureSpace {
  /** n × width, row-major. */
  matrix: Float32Array;
  width: number;
  /** Genre → its column offset within the multi-hot block. */
  genreIndex: Map<string, number>;
  genres: string[];
  /** Genre multi-hot for an arbitrary genre list, e.g. a parsed query. */
  genreVector(genres: string[]): Float32Array;
  /** Named values for one item, for the explanation UI. */
  describe(index: number): Record<string, number>;
}

/** Compresses a count with a long tail into 0-1 without a hard ceiling. */
function logScale(value: number, midpoint: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.log1p(value) / Math.log1p(value + midpoint);
}

/**
 * Rating shrunk toward the catalogue mean by how few votes it has.
 *
 * A 10/10 from one rater is not better than an 8.5 from two hundred, and a
 * ranker fed raw averages will put every barely-rated title at the top of every
 * quality-sorted row. The prior is the standard Bayesian correction: pretend
 * every title also received `prior` votes at the mean.
 */
function bayesianRating(rating: number | null, votes: number, mean: number, prior = 8): number {
  if (rating === null) return mean / 10;
  const v = Math.max(0, votes);
  return (v * rating + prior * mean) / ((v + prior) * 10);
}

export function buildFeatureSpace(items: CorpusItem[]): FeatureSpace {
  const genres = genreVocabulary(items)
    .slice(0, GENRE_SLOTS)
    .map((entry) => entry.value);
  const genreIndex = new Map(genres.map((genre, i) => [genre, i]));

  const width = SCALARS.length + genres.length;
  const matrix = new Float32Array(items.length * width);

  // Reference points come from the catalogue rather than from constants, so the
  // same code produces sensible features for a hundred titles or ten thousand.
  const rated = items.filter((item) => item.rating10 !== null);
  const meanRating =
    rated.reduce((sum, item) => sum + (item.rating10 || 0), 0) / Math.max(1, rated.length) || 6.5;

  const viewValues = items.map((item) => item.views).sort((a, b) => a - b);
  const medianViews = viewValues[Math.floor(viewValues.length / 2)] || 1;

  const years = items.map((item) => item.year).filter((year): year is number => year !== null);
  const oldest = years.length ? Math.min(...years) : 1970;
  const newest = years.length ? Math.max(...years) : new Date().getFullYear();
  const span = Math.max(1, newest - oldest);

  const added = items
    .map((item) => (item.addedAt ? Date.parse(item.addedAt) : 0))
    .filter((value) => value > 0);
  const earliestAdd = added.length ? Math.min(...added) : 0;
  const latestAdd = added.length ? Math.max(...added) : 1;
  const addSpan = Math.max(1, latestAdd - earliestAdd);

  items.forEach((item, i) => {
    const base = i * width;
    const values: Record<(typeof SCALARS)[number], number> = {
      isShow: item.kind === "show" ? 1 : 0,
      quality: bayesianRating(item.rating10, item.votes, meanRating),
      // A model cannot tell "rated 6.5" from "unrated, shrunk to 6.5" without
      // being told, and the two mean very different things about a title.
      hasRating: item.rating10 === null ? 0 : 1,
      popularity: logScale(item.views, medianViews),
      // How recently the *catalogue* got it, which is what drives a "new
      // arrivals" row and is unrelated to when it was made.
      recency: added.length ? (Date.parse(item.addedAt || "") - earliestAdd) / addSpan || 0 : 0,
      era: item.year ? (item.year - oldest) / span : 0.5,
      runtime: item.runtimeMin ? Math.min(1, item.runtimeMin / 180) : 0,
      maturity: item.maturity ? Math.min(1, item.maturity / 18) : 0,
      episodic: logScale(item.episodes || 0, 24),
      complete: item.status === "ended" ? 1 : 0,
      votes: logScale(item.votes, 20),
    };

    SCALARS.forEach((name, slot) => {
      matrix[base + slot] = Number.isFinite(values[name]) ? values[name] : 0;
    });

    for (const genre of item.genres) {
      const slot = genreIndex.get(genre);
      if (slot !== undefined) matrix[base + SCALARS.length + slot] = 1;
    }
  });

  return {
    matrix,
    width,
    genreIndex,
    genres,

    genreVector(list: string[]): Float32Array {
      const vector = new Float32Array(genres.length);
      for (const genre of list) {
        const slot = genreIndex.get(genre.toLowerCase());
        if (slot !== undefined) vector[slot] = 1;
      }
      return vector;
    },

    describe(index: number): Record<string, number> {
      const base = index * width;
      const out: Record<string, number> = {};
      SCALARS.forEach((name, slot) => {
        out[name] = matrix[base + slot];
      });
      return out;
    },
  };
}
