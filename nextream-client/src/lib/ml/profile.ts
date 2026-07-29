import { dot, normalizeRows } from "./linalg";
import { decay, valueOf } from "./signals";
import type { CorpusItem, Signal } from "./types";

/**
 * Who the viewer is, as far as the ranker is concerned.
 *
 * The naive version of this is one vector: the average of everything watched.
 * It is also actively wrong for the way people actually use a streaming
 * catalogue. Someone who watches horror alone and cartoons with their kid has a
 * mean taste vector pointing at neither, and a recommender built on it serves
 * gentle thrillers to a household that wants two specific things. The averaging
 * destroys exactly the structure worth modelling.
 *
 * So taste is stored as several vectors — interests found by clustering what
 * was actually engaged with — and a candidate scores against the *best* of
 * them, not the mean. The single vector is kept too, because it is the right
 * input for the two-tower model, which wants one representation and learns its
 * own decomposition.
 *
 * Everything is time-decayed. What someone watched last week says more about
 * tonight than what they binged in March, and a profile that weighs those
 * equally takes months to notice that its viewer moved on.
 */

/** Interests to look for. Beyond four, clusters start splitting one taste in two. */
const MAX_INTERESTS = 4;

/** Below this decayed value, an item is not evidence of an interest. */
const POSITIVE_THRESHOLD = 0.25;

/** Signals needed before the personalised paths are allowed to run at all. */
export const COLD_START_SIGNALS = 6;

export interface Interest {
  /** Unit vector in the latent space. */
  centroid: Float32Array;
  /** Share of the profile's total evidence, 0-1. */
  share: number;
  /** The items that formed it, strongest first — this is what "because you
   *  watched" names. */
  members: Array<{ index: number; uid: string; weight: number }>;
  /** Genres over-represented in this cluster, for labelling it. */
  label: string;
}

export interface Slate {
  id: string;
  at: number;
  surface: string;
  query?: string;
  /** Item indices as they were shown, in order. */
  shown: number[];
  /** Index within `shown` that was acted on, or -1. */
  chosen: number;
}

export interface TasteProfile {
  /** Total decayed positive evidence. Drives the cold-start decision. */
  strength: number;
  personalised: boolean;

  /** One unit vector summarising everything. Input to the two-tower user tower. */
  taste: Float32Array;
  interests: Interest[];

  /** Genre → share of engagement, summing to 1. */
  genreAffinity: Map<string, number>;
  /** The same, as the distribution the slate calibrator matches against. */
  genreDistribution: Float32Array;

  /** Item indices in time order — the sequence model's input. */
  sequence: number[];
  /** uid → net decayed value. Positive means engaged, negative means rejected. */
  engagement: Map<string, number>;
  /** uid → how many times this device has shown it. Drives exploration. */
  impressions: Map<string, number>;
  /** Titles already finished, which should not be recommended as if new. */
  completed: Set<string>;

  /** Reconstructed impression slates that had an outcome, for listwise training. */
  slates: Slate[];

  /** Queries typed, most recent first. */
  queries: string[];

  counts: { signals: number; positives: number; negatives: number; sessions: number };
}

/** Cosine of a row of an n×d matrix against a d-vector. */
function rowDot(matrix: Float32Array, index: number, dim: number, vector: Float32Array): number {
  let sum = 0;
  const base = index * dim;
  for (let i = 0; i < dim; i += 1) sum += matrix[base + i] * vector[i];
  return sum;
}

/**
 * Spherical k-means over weighted points, seeded k-means++ style.
 *
 * Spherical — assignment by cosine, centroids renormalised each round — because
 * the embeddings are unit vectors and only their direction means anything.
 * Euclidean k-means on normalised data mostly works, but it lets a cluster
 * centroid drift toward the origin as it absorbs opposing members, and a
 * near-zero centroid then matches everything equally.
 */
function cluster(
  embeddings: Float32Array,
  dim: number,
  points: Array<{ index: number; weight: number }>,
  k: number
): Array<{ centroid: Float32Array; members: Array<{ index: number; weight: number }> }> {
  if (!points.length) return [];
  const count = Math.max(1, Math.min(k, points.length));

  // Seeds: the heaviest point, then repeatedly the point least like anything
  // already chosen. Plain k-means++ samples proportional to distance; taking the
  // maximum is its deterministic cousin, and determinism matters here because
  // the profile is recomputed constantly and clusters that reshuffle between
  // renders would relabel every "because you watched" line on screen.
  const ordered = [...points].sort((a, b) => b.weight - a.weight);
  const seeds: number[] = [ordered[0].index];

  while (seeds.length < count) {
    let furthest = -1;
    let worstSimilarity = Infinity;
    for (const point of ordered) {
      if (seeds.includes(point.index)) continue;
      let best = -Infinity;
      for (const seed of seeds) {
        let similarity = 0;
        for (let i = 0; i < dim; i += 1) {
          similarity += embeddings[point.index * dim + i] * embeddings[seed * dim + i];
        }
        best = Math.max(best, similarity);
      }
      if (best < worstSimilarity) {
        worstSimilarity = best;
        furthest = point.index;
      }
    }
    if (furthest < 0) break;
    seeds.push(furthest);
  }

  const centroids = seeds.map((index) => {
    const vector = new Float32Array(dim);
    vector.set(embeddings.subarray(index * dim, index * dim + dim));
    return vector;
  });

  const assignment = new Array(points.length).fill(0);

  for (let round = 0; round < 12; round += 1) {
    let moved = false;

    points.forEach((point, i) => {
      let best = 0;
      let bestScore = -Infinity;
      centroids.forEach((centroid, c) => {
        const score = rowDot(embeddings, point.index, dim, centroid);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      });
      if (assignment[i] !== best) {
        assignment[i] = best;
        moved = true;
      }
    });

    for (let c = 0; c < centroids.length; c += 1) {
      const next = new Float32Array(dim);
      let total = 0;
      points.forEach((point, i) => {
        if (assignment[i] !== c) return;
        total += point.weight;
        for (let d = 0; d < dim; d += 1) {
          next[d] += point.weight * embeddings[point.index * dim + d];
        }
      });
      // An emptied cluster keeps its previous centroid rather than becoming
      // zeros; zeros would match everything at cosine 0 and never recover.
      if (total > 0) {
        normalizeRows(next, 1, dim);
        centroids[c] = next;
      }
    }

    if (!moved && round > 0) break;
  }

  return centroids.map((centroid, c) => ({
    centroid,
    members: points
      .filter((_, i) => assignment[i] === c)
      .sort((a, b) => b.weight - a.weight),
  }));
}

export interface ProfileInputs {
  signals: Signal[];
  items: CorpusItem[];
  /** uid → row in `embeddings` and `items`. */
  indexOf: Map<string, number>;
  embeddings: Float32Array;
  dim: number;
  /** Genre order for `genreDistribution`. */
  genres: string[];
  now?: number;
}

export function buildProfile(inputs: ProfileInputs): TasteProfile {
  const { signals, items, indexOf, embeddings, dim, genres } = inputs;
  const now = inputs.now ?? Date.now();

  const engagement = new Map<string, number>();
  const impressions = new Map<string, number>();
  const completed = new Set<string>();
  const genreWeights = new Map<string, number>();
  const queries: string[] = [];
  const slateBuilder = new Map<string, Slate>();
  const sequence: number[] = [];

  let positives = 0;
  let negatives = 0;
  let sessions = 1;
  let previousAt = 0;

  for (const signal of signals) {
    // A gap of half an hour is a new sitting. Only used for reporting, but it
    // is the number that tells someone reading the insight panel whether the
    // model has seen them once or thirty times.
    if (previousAt && signal.at - previousAt > 30 * 60 * 1000) sessions += 1;
    previousAt = signal.at;

    if (signal.kind === "search" && signal.query) {
      queries.unshift(signal.query);
      continue;
    }

    if (signal.kind === "impression") {
      impressions.set(signal.uid, (impressions.get(signal.uid) || 0) + 1);
      if (signal.slate) {
        const slate = slateBuilder.get(signal.slate) || {
          id: signal.slate,
          at: signal.at,
          surface: signal.surface,
          query: signal.query,
          shown: [],
          chosen: -1,
        };
        const index = indexOf.get(signal.uid);
        if (index !== undefined) slate.shown.push(index);
        slateBuilder.set(signal.slate, slate);
      }
    }

    if (signal.kind === "complete") completed.add(signal.uid);

    const value = valueOf(signal) * decay(signal.at, now);
    if (value === 0) continue;

    engagement.set(signal.uid, (engagement.get(signal.uid) || 0) + value);
    if (value > 0) positives += 1;
    else negatives += 1;

    if (signal.slate && value > 0) {
      const slate = slateBuilder.get(signal.slate);
      if (slate) {
        const index = indexOf.get(signal.uid);
        const at = index === undefined ? -1 : slate.shown.indexOf(index);
        if (at >= 0) slate.chosen = at;
      }
    }

    // The sequence model wants the order titles were *engaged with*, not the
    // order they were shown. Impressions would flood it with cards that scrolled
    // past, and the next-item task would degenerate into predicting the layout.
    const index = indexOf.get(signal.uid);
    if (index !== undefined && value >= POSITIVE_THRESHOLD) {
      if (sequence[sequence.length - 1] !== index) sequence.push(index);
      const item = items[index];
      for (const genre of item.genres) {
        genreWeights.set(genre, (genreWeights.get(genre) || 0) + value);
      }
    }
  }

  // --- taste vectors --------------------------------------------------------

  const points: Array<{ index: number; weight: number }> = [];
  let strength = 0;

  for (const [uid, value] of engagement) {
    if (value < POSITIVE_THRESHOLD) continue;
    const index = indexOf.get(uid);
    if (index === undefined) continue;
    points.push({ index, weight: value });
    strength += value;
  }
  points.sort((a, b) => b.weight - a.weight);

  const taste = new Float32Array(dim);
  for (const point of points) {
    for (let d = 0; d < dim; d += 1) taste[d] += point.weight * embeddings[point.index * dim + d];
  }
  normalizeRows(taste, 1, dim);

  const totalGenre = [...genreWeights.values()].reduce((sum, value) => sum + value, 0) || 1;
  const genreAffinity = new Map(
    [...genreWeights.entries()]
      .map(([genre, weight]) => [genre, weight / totalGenre] as [string, number])
      .sort((a, b) => b[1] - a[1])
  );

  const genreDistribution = new Float32Array(genres.length);
  genres.forEach((genre, i) => {
    genreDistribution[i] = genreAffinity.get(genre) || 0;
  });

  const clusters = cluster(
    embeddings,
    dim,
    // More than about thirty points and the marginal ones are noise that pulls
    // centroids toward the catalogue mean; the heaviest are what define a taste.
    points.slice(0, 30),
    Math.min(MAX_INTERESTS, Math.max(1, Math.floor(points.length / 3)))
  );

  const interests: Interest[] = clusters
    .filter((entry) => entry.members.length > 0)
    .map((entry) => {
      const weight = entry.members.reduce((sum, member) => sum + member.weight, 0);

      // Label a cluster by the genre its members share most, relative to how
      // common that genre is overall — otherwise every cluster in a catalogue
      // that is 40% drama gets called Drama.
      const local = new Map<string, number>();
      for (const member of entry.members) {
        for (const genre of items[member.index].genres) {
          local.set(genre, (local.get(genre) || 0) + member.weight);
        }
      }
      let label = "";
      let bestLift = 0;
      for (const [genre, value] of local) {
        const lift = value / weight / Math.max(0.02, genreAffinity.get(genre) || 0.02);
        if (lift > bestLift) {
          bestLift = lift;
          label = genre;
        }
      }

      return {
        centroid: entry.centroid,
        share: strength > 0 ? weight / strength : 0,
        members: entry.members.map((member) => ({
          index: member.index,
          uid: items[member.index].uid,
          weight: member.weight,
        })),
        label,
      };
    })
    .sort((a, b) => b.share - a.share);

  const slates = [...slateBuilder.values()].filter(
    (slate) => slate.shown.length >= 3 && slate.chosen >= 0
  );

  return {
    strength,
    personalised: signals.length >= COLD_START_SIGNALS && points.length >= 2,
    taste,
    interests,
    genreAffinity,
    genreDistribution,
    sequence,
    engagement,
    impressions,
    completed,
    slates,
    queries: queries.slice(0, 20),
    counts: { signals: signals.length, positives, negatives, sessions },
  };
}

/**
 * How well a candidate matches the profile.
 *
 * Maximum over interests rather than cosine against the mean — the whole point
 * of keeping several vectors. A blend of the best and the average would drag a
 * strong match on a minority taste back down toward it, which is the failure the
 * clustering exists to avoid; the share weighting is enough to keep a title from
 * a barely-held interest from outranking the viewer's main one.
 */
export function affinityOf(
  profile: TasteProfile,
  embeddings: Float32Array,
  dim: number,
  index: number
): { score: number; interest: Interest | null } {
  if (!profile.interests.length) {
    return { score: rowDot(embeddings, index, dim, profile.taste), interest: null };
  }

  let best = -Infinity;
  let bestInterest: Interest | null = null;

  for (const interest of profile.interests) {
    const similarity = rowDot(embeddings, index, dim, interest.centroid);
    // A small share should not disqualify a strong match, only discount it —
    // hence a square root rather than the share itself.
    const weighted = similarity * (0.55 + 0.45 * Math.sqrt(interest.share));
    if (weighted > best) {
      best = weighted;
      bestInterest = interest;
    }
  }

  return { score: best, interest: bestInterest };
}

/** The already-engaged title a candidate is most like — the "because you watched". */
export function nearestKnown(
  profile: TasteProfile,
  items: CorpusItem[],
  embeddings: Float32Array,
  dim: number,
  index: number
): { uid: string; title: string; similarity: number } | undefined {
  let best: { uid: string; title: string; similarity: number } | undefined;

  for (const interest of profile.interests) {
    for (const member of interest.members.slice(0, 8)) {
      if (member.index === index) continue;
      const similarity = dot(
        embeddings.subarray(index * dim, index * dim + dim),
        embeddings.subarray(member.index * dim, member.index * dim + dim)
      );
      if (!best || similarity > best.similarity) {
        best = { uid: member.uid, title: items[member.index].title, similarity };
      }
    }
  }

  // Below this the "because you watched" line is a coincidence dressed up as a
  // reason, and a wrong explanation costs more trust than no explanation.
  return best && best.similarity > 0.32 ? best : undefined;
}
