import type { Candidate, CorpusItem } from "./types";

/**
 * Choosing a slate, rather than choosing n items.
 *
 * A ranker sorted by score puts the five most similar titles in the catalogue in
 * the first five slots, because if one of them is the best match the others are
 * nearly as good. Every one of those slots is then spent on the same bet. If it
 * is wrong the row is worthless; if it is right, four of the five were wasted.
 *
 * The fix is to score the *set*. Two well-known ideas, applied together, and
 * they correct different failures:
 *
 * **Maximal Marginal Relevance** discounts a candidate by how much it resembles
 * what is already placed. This is what stops five entries of the same franchise
 * from filling a row.
 *
 * **Calibration** matches the genre mix of the slate to the genre mix of the
 * viewer's history. This corrects something MMR cannot see. Someone who watches
 * 70% comedy and 30% documentary will be served nearly all comedy by any
 * accuracy-maximising ranker — the documentaries are individually less likely to
 * be clicked, so they never win a slot, and the minority taste is amortised
 * away one row at a time. Calibration keeps the proportion, which is the
 * difference between a recommender that reflects someone and one that flattens
 * them.
 *
 * Both are applied greedily. Optimal set selection under either objective is
 * combinatorial; the greedy solution to MMR is the standard one, and for
 * calibration it comes with a guarantee — the objective is submodular, so greedy
 * lands within (1 - 1/e) of optimal.
 */

export interface SlateOptions {
  /**
   * 0 = pure relevance, 1 = maximum spread. Around 0.3 in practice: the point is
   * to break up near-duplicates, not to hand the row to whatever is most unlike
   * everything else.
   */
  diversity: number;
  /** How hard to hold the slate's genre mix to the viewer's. 0 disables it. */
  calibration: number;
  /** Genre → share of the viewer's engagement. */
  target: Map<string, number>;
  /** Row-major item embeddings, and their width. */
  embeddings: Float32Array;
  dim: number;
  limit: number;
}

function similarity(embeddings: Float32Array, dim: number, a: number, b: number): number {
  let sum = 0;
  const baseA = a * dim;
  const baseB = b * dim;
  for (let i = 0; i < dim; i += 1) sum += embeddings[baseA + i] * embeddings[baseB + i];
  return sum;
}

/**
 * KL(target ‖ slate), the divergence calibration minimises.
 *
 * The slate distribution is smoothed toward the target before the comparison.
 * Without it, any genre the viewer holds that the slate has not yet placed
 * contributes log(p/0) — an infinity that makes every partial slate equally and
 * infinitely bad, so the term stops discriminating between candidates at exactly
 * the moment it should be choosing between them. This is Steck's formulation and
 * the smoothing is his.
 */
function divergence(
  target: Map<string, number>,
  counts: Map<string, number>,
  total: number,
  smoothing = 0.01
): number {
  if (!total) return 0;

  let kl = 0;
  for (const [genre, p] of target) {
    if (p <= 0) continue;
    const q = (1 - smoothing) * ((counts.get(genre) || 0) / total) + smoothing * p;
    kl += p * Math.log(p / Math.max(q, 1e-9));
  }
  return kl;
}

/**
 * Greedy slate construction.
 *
 * `candidates` must already be sorted by relevance; the first pick is free and
 * every subsequent one trades relevance against redundancy and against the
 * genre mix so far.
 */
export function composeSlate(candidates: Candidate[], options: SlateOptions): Candidate[] {
  const { diversity, calibration, target, embeddings, dim, limit } = options;
  if (candidates.length <= 1 || (diversity <= 0 && calibration <= 0)) {
    return candidates.slice(0, limit);
  }

  // Relevance is compared against the redundancy penalty, which is a cosine in
  // [-1, 1]. Raw scores are not on that scale — a lexical BM25 sum is unbounded
  // — so mixing them without this would make the diversity term either
  // irrelevant or total, depending only on the query.
  const scores = candidates.map((candidate) => candidate.score);
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  const span = highest - lowest || 1;
  const relevance = scores.map((score) => (score - lowest) / span);

  const chosen: Candidate[] = [];
  const taken = new Set<number>();
  const genreCounts = new Map<string, number>();
  let genreTotal = 0;

  while (chosen.length < Math.min(limit, candidates.length)) {
    let best = -1;
    let bestValue = -Infinity;

    for (let i = 0; i < candidates.length; i += 1) {
      if (taken.has(i)) continue;

      let redundancy = 0;
      for (const placed of chosen) {
        redundancy = Math.max(
          redundancy,
          similarity(embeddings, dim, candidates[i].index, placed.index)
        );
      }

      let calibrationGain = 0;
      if (calibration > 0 && target.size) {
        const before = divergence(target, genreCounts, genreTotal);
        const genres = candidates[i].item.genres;
        for (const genre of genres) {
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        }
        const after = divergence(target, genreCounts, genreTotal + Math.max(1, genres.length));
        for (const genre of genres) {
          genreCounts.set(genre, (genreCounts.get(genre) || 0) - 1);
        }
        // Positive when adding this candidate moves the slate *toward* the
        // viewer's mix.
        calibrationGain = before - after;
      }

      const value =
        (1 - diversity) * relevance[i] -
        diversity * redundancy +
        calibration * calibrationGain;

      if (value > bestValue) {
        bestValue = value;
        best = i;
      }
    }

    if (best < 0) break;

    taken.add(best);
    const picked = candidates[best];
    // Recorded on the candidate so the explanation can say a card is here for
    // the shape of the row rather than pretending it out-scored its neighbours.
    picked.breakdown.diversity = chosen.length
      ? Math.max(
          ...chosen.map((placed) => similarity(embeddings, dim, picked.index, placed.index))
        )
      : 0;
    chosen.push(picked);

    for (const genre of picked.item.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      genreTotal += 1;
    }
    if (!picked.item.genres.length) genreTotal += 1;
  }

  return chosen;
}

/**
 * How well a finished slate matches the viewer's mix, 0-1.
 *
 * Reported rather than used: a number the insight panel can show, so the effect
 * of the calibration weight is visible instead of being taken on trust.
 */
export function calibrationScore(items: CorpusItem[], target: Map<string, number>): number {
  if (!target.size || !items.length) return 1;

  const counts = new Map<string, number>();
  let total = 0;
  for (const item of items) {
    for (const genre of item.genres) {
      counts.set(genre, (counts.get(genre) || 0) + 1);
      total += 1;
    }
  }

  // exp(-KL) maps [0, ∞) onto (0, 1] — an identical mix reads as 1, and the
  // curve flattens where the divergence is already large enough not to matter.
  return Math.exp(-divergence(target, counts, total));
}
