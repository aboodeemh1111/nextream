/**
 * The vocabulary the recommender is written in.
 *
 * Two boundaries are worth naming, because most of the design follows from
 * them.
 *
 * `CorpusItem` is what the server knows: text and numbers about a title, the
 * same for every viewer, cacheable. `Signal` is what only this device knows:
 * what was shown, what was ignored, how long a pointer rested. The whole system
 * is the join between those two, computed locally, and nothing in this file
 * crosses back the other way.
 */

export type ItemKind = "movie" | "show";

/** One catalogue entry, as `GET /api/search/corpus` returns it. */
export interface CorpusItem {
  uid: string;
  id: string;
  kind: ItemKind;
  badge: string;
  title: string;
  overview: string;
  /** Lower-cased. */
  genres: string[];
  tags: string[];
  year: number | null;
  runtimeMin: number | null;
  maturity: number | null;
  /** 0-10, both collections normalised onto the same scale. */
  rating10: number | null;
  votes: number;
  views: number;
  seasons: number | null;
  episodes: number | null;
  status: string | null;
  poster: string;
  backdrop: string;
  addedAt: string | null;
}

export interface CorpusSnapshot {
  schema: number;
  generatedAt: string;
  count: number;
  items: CorpusItem[];
  degraded?: string;
}

// --- signals -----------------------------------------------------------------

/**
 * Every kind of evidence the ranker learns from, ordered by how much it means.
 *
 * `impression` is the one that is easy to leave out and expensive to lose. A log
 * of only positives teaches a model that everything is good — it never sees a
 * title that was on screen, in position two, and passed over. Negatives are what
 * make the difference between a ranker and a popularity counter.
 */
export type SignalKind =
  | "impression"
  | "hover"
  | "click"
  | "play"
  | "progress"
  | "complete"
  | "abandon"
  | "list_add"
  | "list_remove"
  | "search"
  | "search_click"
  | "dismiss";

/** Where an interaction happened — the ranker conditions on it. */
export type Surface =
  | "home"
  | "row"
  | "billboard"
  | "search"
  | "search_palette"
  | "details"
  | "similar"
  | "discover"
  | "watch";

export interface Signal {
  kind: SignalKind;
  uid: string;
  /** Epoch milliseconds. */
  at: number;
  surface: Surface;
  /** Rank within the slate this was shown in; -1 when it was not in one. */
  position: number;
  /**
   * Strength, 0-1. Carries the part of the event a type name cannot: how far
   * into a title someone got, how long a pointer rested, how confident a search
   * click was.
   */
  weight: number;
  /** The query, for search events. */
  query?: string;
  /** Groups an impression slate so the listwise ranker can reconstruct it. */
  slate?: string;
}

// --- retrieval and ranking ---------------------------------------------------

/**
 * Why a title scored what it did.
 *
 * Recorded per candidate rather than derived afterwards, because by the time a
 * slate is on screen the individual retrieval scores are gone — and "we ranked
 * this second" is not an explanation anyone can act on. This is what the UI
 * turns into a sentence and what the ranker trains on, so the two can never
 * drift apart.
 */
export interface ScoreBreakdown {
  /** BM25 over the query, 0 when there is no query. */
  lexical: number;
  /** Cosine in the latent semantic space. */
  semantic: number;
  /** Two-tower retrieval score. */
  neural: number;
  /** Next-item probability from the session model. */
  sequential: number;
  /** Cosine against the viewer's long-run taste vector. */
  affinity: number;
  /** Bayesian-smoothed rating and view count. */
  quality: number;
  popularity: number;
  /** How recently this was added to the catalogue. */
  freshness: number;
  /** Upper-confidence bonus for a title this viewer has barely been shown. */
  exploration: number;
  /** Penalty applied for redundancy against the rest of the slate. */
  diversity: number;
}

export interface Candidate {
  item: CorpusItem;
  /** Index into the engine's item array — the key everything internal uses. */
  index: number;
  score: number;
  breakdown: ScoreBreakdown;
  /** Which retrieval sources proposed this, for diagnostics and fusion. */
  sources: string[];
  /** Human-readable, one line. */
  reason: string;
  /** The already-seen title this is most like, when there is one. */
  becauseOf?: { uid: string; title: string; similarity: number };
  /** Character ranges in `item.title` that the query matched. */
  highlight: Array<[number, number]>;
}

// --- model state -------------------------------------------------------------

export interface TrainingStats {
  /** Gradient steps taken across the whole lifetime of the stored weights. */
  steps: number;
  /** Most recent loss per model, for the insight panel. */
  loss: { tower: number; sequence: number; ranker: number };
  /** Signals available the last time training ran. */
  samples: number;
  lastTrainedAt: number | null;
}

export type EngineStage =
  | "idle"
  | "loading-corpus"
  | "indexing"
  | "embedding"
  | "loading-models"
  | "training"
  | "ready"
  | "failed";

export interface EngineStatus {
  stage: EngineStage;
  backend: string | null;
  /** Titles in the index. */
  items: number;
  /** Latent dimensions the semantic space was truncated to. */
  dimensions: number;
  signals: number;
  training: TrainingStats;
  /** True once there is enough history for the personalised paths to run. */
  personalised: boolean;
  error?: string;
  /** Milliseconds spent in each boot stage. */
  timings: Record<string, number>;
}

export interface RecommendOptions {
  limit?: number;
  surface?: Surface;
  /** Restrict to one collection. */
  kind?: ItemKind;
  genre?: string;
  /** Titles already placed elsewhere on the page. */
  exclude?: string[];
  /** 0 = exploit, 1 = explore. Left undefined, the bandit decides. */
  explore?: number;
  /** 0 = pure relevance, 1 = maximum spread across the slate. */
  diversity?: number;
  /** Anchor for "more like this". */
  seedUid?: string;
}

export interface SearchOptions {
  limit?: number;
  kind?: ItemKind;
  genre?: string;
  /** Blend against the viewer's taste. 0 disables personalisation entirely. */
  personalisation?: number;
}

export interface SearchOutcome {
  query: string;
  /** What the query was read as — genres, years, kinds lifted out of the text. */
  understood: Array<{ type: string; value: string | number; label: string }>;
  didYouMean: string | null;
  results: Candidate[];
  total: number;
  /** Milliseconds spent ranking, for the insight panel. */
  tookMs: number;
}
