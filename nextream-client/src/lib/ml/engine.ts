import { armFor, contextVector, LinUcbBandit, type Arm, type ArmKey, type BanditContext } from "./bandit";
import { LexicalIndex } from "./bm25";
import { loadCorpus, genreVocabulary } from "./corpus";
import { calibrationScore, composeSlate } from "./diversity";
import { buildFeatureSpace, type FeatureSpace } from "./features";
import { normalizeRows } from "./linalg";
import { RankerModel, RANKER_WIDTH } from "./models/ranker";
import { buildSequenceBatch, SequenceModel } from "./models/sequence";
import { TwoTowerModel } from "./models/tower";
import { affinityOf, buildProfile, nearestKnown, type TasteProfile } from "./profile";
import { isBrowse, parseQuery } from "./query";
import { allSignals, decay, valueOf } from "./signals";
import { buildSemanticSpace, type SemanticSpace } from "./semantic";
import { kvGet, kvSet } from "./store";
import { matchShape } from "./text";
import { activeBackend, breathe, loadTf, type Tf } from "./tf";
import type {
  Candidate,
  CorpusItem,
  EngineStatus,
  RecommendOptions,
  ScoreBreakdown,
  SearchOptions,
  SearchOutcome,
  Signal,
} from "./types";

/**
 * The recommender, assembled.
 *
 * Everything before this file is a component with one job. This is where they
 * become a system, and the shape of it is the standard multi-stage one that
 * every large recommender converges on, for the same reason they all do:
 *
 *   retrieve  →  score  →  rank  →  compose
 *
 * Retrieval is cheap and runs over everything. Scoring is a vectorised blend
 * over the whole catalogue, which sounds expensive and is one matrix multiply.
 * Ranking is the learned model and runs over a hundred survivors, because a
 * neural network per catalogue item would not fit in a frame. Composition
 * chooses the *set*, which no per-item score can do.
 *
 * The stages are not interchangeable and the order is not arbitrary — each one
 * is affordable only because the one before it narrowed the field.
 *
 * Two things are deliberately *not* here. This does not replace the server's
 * search: `/api/search` still answers, still ranks, and is what a first-time
 * visitor with an empty profile gets. And it does not send anything back — the
 * signal log stays on the device, which is what makes it reasonable to record
 * the fine-grained behaviour that makes the ranking good.
 */

/** Candidates that reach the learned ranker. */
const RANK_DEPTH = 140;

/** Context scalars appended to the user tower's input. */
const USER_CONTEXT = 5;

/** Gradient steps per training pass, per model. */
const STEPS = { tower: 8, sequence: 6, ranker: 10 };

/** Slates needed before the ranker is trusted at all. */
const RANKER_WARMUP = 8;

const EMPTY_BREAKDOWN: ScoreBreakdown = {
  lexical: 0, semantic: 0, neural: 0, sequential: 0, affinity: 0,
  quality: 0, popularity: 0, freshness: 0, exploration: 0, diversity: 0,
};

/** Rescales a whole vector to 0-1 by its own range. */
function rescale(values: Float32Array): Float32Array {
  let lowest = Infinity;
  let highest = -Infinity;
  for (const value of values) {
    if (value < lowest) lowest = value;
    if (value > highest) highest = value;
  }
  const span = highest - lowest || 1;
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += 1) out[i] = (values[i] - lowest) / span;
  return out;
}

export class RecommendationEngine {
  private tf: Tf | null = null;
  private items: CorpusItem[] = [];
  private indexOf = new Map<string, number>();
  private lexical: LexicalIndex | null = null;
  private semantic: SemanticSpace | null = null;
  private features: FeatureSpace | null = null;
  private genres: string[] = [];

  /** n × (semantic rank + feature width) — the item tower's input, built once. */
  private itemInput = new Float32Array(0);

  private tower: TwoTowerModel | null = null;
  private sequence: SequenceModel | null = null;
  private ranker: RankerModel | null = null;
  private readonly bandit = new LinUcbBandit();

  private profile: TasteProfile | null = null;
  private signals: Signal[] = [];

  private status: EngineStatus = {
    stage: "idle",
    backend: null,
    items: 0,
    dimensions: 0,
    signals: 0,
    training: { steps: 0, loss: { tower: 0, sequence: 0, ranker: 0 }, samples: 0, lastTrainedAt: null },
    personalised: false,
    timings: {},
  };

  /** Which arm produced a slate, so its reward can be attributed later. */
  private readonly slateArms = new Map<string, { arm: ArmKey; context: Float64Array; at: number }>();

  private booting: Promise<void> | null = null;
  private training: Promise<void> | null = null;
  private dirty = false;

  // --- boot -----------------------------------------------------------------

  boot(): Promise<void> {
    if (this.booting) return this.booting;
    this.booting = this.run();
    return this.booting;
  }

  private async run(): Promise<void> {
    const mark = (stage: EngineStatus["stage"], from: number) => {
      this.status.timings[this.status.stage] = Math.round(performance.now() - from);
      this.status.stage = stage;
      return performance.now();
    };

    try {
      let at = performance.now();
      this.status.stage = "loading-corpus";

      const corpus = await loadCorpus({
        // A refresh lands while the app is running. Rebuilding in place rather
        // than reloading keeps the models — they are trained on interactions,
        // not on the catalogue, and throwing them away because a title was
        // published would cost the viewer their entire profile.
        onRefresh: (load) => void this.reindex(load.items),
      });

      if (!corpus.items.length) {
        this.status.stage = "failed";
        this.status.error = corpus.degraded || "EMPTY_CATALOGUE";
        return;
      }

      at = mark("indexing", at);
      this.adopt(corpus.items);

      at = mark("embedding", at);
      this.tf = await loadTf();
      this.status.backend = activeBackend();
      this.buildSpaces();

      at = mark("loading-models", at);
      await this.createModels();

      mark("ready", at);
      this.status.items = this.items.length;
      this.status.dimensions = this.semantic?.rank || 0;

      await this.refreshProfile();
      // First training runs behind the first paint. Everything works without
      // it — the blend has sensible priors — and blocking the initial render
      // on a gradient step would trade the thing viewers notice for the thing
      // they do not.
      void this.trainSoon();
    } catch (error) {
      this.status.stage = "failed";
      this.status.error = error instanceof Error ? error.message : String(error);
    }
  }

  private adopt(items: CorpusItem[]): void {
    this.items = items;
    this.indexOf = new Map(items.map((item, index) => [item.uid, index]));
    this.lexical = new LexicalIndex(items);
    this.genres = genreVocabulary(items).map((entry) => entry.value);
  }

  private buildSpaces(): void {
    if (!this.tf) return;

    this.semantic = buildSemanticSpace(this.tf, this.items);
    this.features = buildFeatureSpace(this.items);

    const rank = this.semantic.rank;
    const width = rank + this.features.width;
    this.itemInput = new Float32Array(this.items.length * width);

    for (let i = 0; i < this.items.length; i += 1) {
      this.itemInput.set(this.semantic.embeddings.subarray(i * rank, (i + 1) * rank), i * width);
      this.itemInput.set(
        this.features.matrix.subarray(i * this.features.width, (i + 1) * this.features.width),
        i * width + rank
      );
    }
  }

  private async createModels(): Promise<void> {
    if (!this.tf || !this.semantic || !this.features) return;

    this.tower?.dispose();
    this.sequence?.dispose();
    this.ranker?.dispose();

    this.tower = new TwoTowerModel(this.tf, {
      semantic: this.semantic.rank,
      features: this.features.width,
      userExtra: this.features.genres.length + USER_CONTEXT,
    });
    this.sequence = new SequenceModel(this.tf, this.semantic.rank);
    this.ranker = new RankerModel(this.tf);

    const stats = await kvGet<EngineStatus["training"]>("training.stats");
    // Weights are only adopted as a complete set. A model restored next to two
    // freshly initialised ones produces scores on three unrelated scales, and
    // the blend between them would be meaningless in a way nothing downstream
    // could detect.
    const restored = await Promise.all([
      this.tower.restore(),
      this.sequence.restore(),
      this.ranker.restore(),
      this.bandit.restore(),
    ]);

    if (restored.slice(0, 3).every(Boolean) && stats) {
      this.status.training = stats;
    }
  }

  /** Rebuilds the index against a newer catalogue, keeping the trained weights. */
  private async reindex(items: CorpusItem[]): Promise<void> {
    if (!this.tf || this.status.stage === "failed") return;
    this.adopt(items);
    this.buildSpaces();
    // The towers project content, so their weights stay valid across a catalogue
    // change — only the cached per-item vectors are stale.
    this.tower?.dropCache();
    this.sequence?.dropCache();
    this.status.items = items.length;
    await this.refreshProfile();
  }

  // --- profile --------------------------------------------------------------

  private async refreshProfile(): Promise<void> {
    if (!this.semantic || !this.features) return;

    this.signals = await allSignals();
    this.profile = buildProfile({
      signals: this.signals,
      items: this.items,
      indexOf: this.indexOf,
      embeddings: this.semantic.embeddings,
      dim: this.semantic.rank,
      genres: this.features.genres,
    });

    this.status.signals = this.signals.length;
    this.status.personalised = this.profile.personalised;
  }

  /** Called by the host when signals have been recorded. */
  markDirty(): void {
    this.dirty = true;
  }

  private async ensureFresh(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    await this.refreshProfile();
  }

  // --- user representation ---------------------------------------------------

  /**
   * The user tower's input: taste, genre mix, and when it is.
   *
   * Time of day is two features rather than one because it is *cyclical* —
   * 23:00 and 01:00 are adjacent, and a single 0-1 hour feature puts them at
   * opposite ends of the range. Sine and cosine of the angle keep the adjacency,
   * which is the standard encoding and the only one that lets the model learn
   * "late evening" as one thing.
   */
  private userVector(taste: Float32Array, genreMix: Float32Array, at: number, depth: number): Float32Array {
    const rank = this.semantic?.rank || 0;
    const out = new Float32Array(rank + genreMix.length + USER_CONTEXT);
    out.set(taste.subarray(0, rank), 0);
    out.set(genreMix, rank);

    const date = new Date(at);
    const angle = (2 * Math.PI * date.getHours()) / 24;
    const base = rank + genreMix.length;
    out[base] = Math.min(1, (this.profile?.strength || 0) / 12);
    out[base + 1] = Math.min(1, depth / 24);
    out[base + 2] = Math.sin(angle);
    out[base + 3] = Math.cos(angle);
    out[base + 4] = date.getDay() === 0 || date.getDay() === 6 ? 1 : 0;
    return out;
  }

  private currentUserVector(): Float32Array {
    const profile = this.profile;
    const rank = this.semantic?.rank || 0;
    const genreCount = this.features?.genres.length || 0;

    if (!profile) {
      return this.userVector(new Float32Array(rank), new Float32Array(genreCount), Date.now(), 0);
    }
    return this.userVector(profile.taste, profile.genreDistribution, Date.now(), profile.sequence.length);
  }

  // --- scoring ---------------------------------------------------------------

  /**
   * Every signal, for every item, as full-length vectors.
   *
   * Computing these over the whole catalogue rather than over a candidate set is
   * the choice that makes the rest simple. Each is either a matrix multiply or a
   * linear scan, both of which are faster over ten thousand items than the
   * bookkeeping of a candidate set would be — and having them all means a filter
   * can be applied after scoring instead of before, so a genre refinement never
   * needs a second retrieval pass.
   */
  private signalVectors(): {
    neural: Float32Array;
    sequential: Float32Array;
    affinity: Float32Array;
    quality: Float32Array;
    popularity: Float32Array;
    freshness: Float32Array;
    exploration: Float32Array;
  } {
    const n = this.items.length;
    const features = this.features!;
    const semantic = this.semantic!;
    const profile = this.profile;

    const neural = this.tower
      ? rescale(this.tower.score(this.currentUserVector(), this.itemInput, n))
      : new Float32Array(n);

    const sequential =
      this.sequence && profile && profile.sequence.length >= 2
        ? rescale(this.sequence.predict(profile.sequence, semantic.embeddings, n))
        : new Float32Array(n);

    const affinity = new Float32Array(n);
    if (profile && profile.interests.length) {
      for (let i = 0; i < n; i += 1) {
        affinity[i] = Math.max(0, affinityOf(profile, semantic.embeddings, semantic.rank, i).score);
      }
    }

    const quality = new Float32Array(n);
    const popularity = new Float32Array(n);
    const freshness = new Float32Array(n);
    const width = features.width;
    for (let i = 0; i < n; i += 1) {
      quality[i] = features.matrix[i * width + 1];
      popularity[i] = features.matrix[i * width + 3];
      freshness[i] = features.matrix[i * width + 4];
    }

    // Upper-confidence exploration, per item. sqrt(log(total) / shown) is the
    // classic UCB1 bonus: a title this device has never displayed carries the
    // largest bonus, and the bonus shrinks as it is shown — so exploration is
    // spent on genuinely unseen catalogue rather than re-rolled at random on
    // every render.
    const exploration = new Float32Array(n);
    const totalImpressions = profile
      ? [...profile.impressions.values()].reduce((sum, value) => sum + value, 0) + 1
      : 1;
    const logTotal = Math.log(totalImpressions + 1);
    for (let i = 0; i < n; i += 1) {
      const shown = profile?.impressions.get(this.items[i].uid) || 0;
      exploration[i] = Math.min(1, Math.sqrt(logTotal / (shown + 1)) / 2);
    }

    return { neural, sequential, affinity, quality, popularity, freshness, exploration };
  }

  private banditContext(isSearch: boolean): { context: Float64Array; input: BanditContext } {
    const now = new Date();
    const input: BanditContext = {
      profileStrength: this.profile?.strength || 0,
      sessionDepth: this.profile?.sequence.length || 0,
      hour: now.getHours(),
      day: now.getDay(),
      isSearch,
      hasSequence: (this.profile?.sequence.length || 0) >= 3,
    };
    return { context: contextVector(input), input };
  }

  /** Ranker input row for one candidate. Order must match RANKER_FEATURES. */
  private rankerRow(breakdown: ScoreBreakdown, position: number, index: number, into: Float32Array, offset: number): void {
    const features = this.features!;
    const seen = this.profile?.engagement.get(this.items[index].uid) || 0;

    into[offset] = breakdown.lexical;
    into[offset + 1] = breakdown.semantic;
    into[offset + 2] = breakdown.neural;
    into[offset + 3] = breakdown.sequential;
    into[offset + 4] = breakdown.affinity;
    into[offset + 5] = breakdown.quality;
    into[offset + 6] = breakdown.popularity;
    into[offset + 7] = breakdown.freshness;
    into[offset + 8] = breakdown.exploration;
    into[offset + 9] = Math.min(1, position / 20);
    // Clamped both ways: whether this was engaged with before, and whether that
    // went well, are different facts and the ranker should see both.
    into[offset + 10] = Math.max(-1, Math.min(1, seen));
    into[offset + 11] = features.matrix[index * features.width];
  }

  /**
   * How much the learned ranker is allowed to move things.
   *
   * It starts at zero and grows with the slates it has seen. A model trained on
   * four clicks is confidently wrong, and letting it reorder a page from the
   * first session is how a recommender ends up worse than the constants it
   * replaced. This is a trust schedule, not a hyperparameter — the prior blend
   * is a perfectly good ranker and the learned one has to earn its way past it.
   */
  private rankerTrust(): number {
    const slates = this.profile?.slates.length || 0;
    if (slates < RANKER_WARMUP) return 0;
    return Math.min(0.55, 0.15 + (slates - RANKER_WARMUP) * 0.01);
  }

  private applyRanker(candidates: Candidate[]): void {
    const trust = this.rankerTrust();
    if (!this.ranker || trust <= 0 || !candidates.length) return;

    const rows = new Float32Array(candidates.length * RANKER_WIDTH);
    candidates.forEach((candidate, position) => {
      this.rankerRow(candidate.breakdown, position, candidate.index, rows, position * RANKER_WIDTH);
    });

    const learned = rescale(this.ranker.score(rows, candidates.length));
    const prior = rescale(Float32Array.from(candidates.map((candidate) => candidate.score)));

    candidates.forEach((candidate, i) => {
      candidate.score = (1 - trust) * prior[i] + trust * learned[i];
      candidate.sources.push("ranker");
    });
    candidates.sort((a, b) => b.score - a.score);
  }

  // --- recommendation --------------------------------------------------------

  async recommend(options: RecommendOptions = {}): Promise<{ slate: Candidate[]; arm: Arm; calibration: number }> {
    await this.boot();
    await this.ensureFresh();

    const limit = options.limit ?? 20;
    if (this.status.stage === "failed" || !this.semantic || !this.features) {
      return { slate: [], arm: armFor("popular"), calibration: 1 };
    }

    const { context } = this.banditContext(false);
    // Cold start has nothing for the personalised arms to work from, so the
    // bandit is not asked a question it cannot answer — it would spend its
    // early exploration budget discovering that a viewer with no history does
    // not have a sequence.
    const arm = this.profile?.personalised
      ? this.bandit.select(context)
      : armFor("popular");

    const explore = options.explore ?? arm.explore;
    const spread = options.diversity ?? arm.diversity;
    const vectors = this.signalVectors();
    const exclude = new Set(options.exclude || []);

    // "More like this" replaces the taste term with similarity to one title,
    // which is the same machinery pointed at a different anchor.
    const seedIndex = options.seedUid ? this.indexOf.get(options.seedUid) : undefined;
    const seedSimilarity = seedIndex === undefined ? null : this.similarityTo(seedIndex);

    const scored: Candidate[] = [];

    for (let i = 0; i < this.items.length; i += 1) {
      const item = this.items[i];
      if (exclude.has(item.uid) || i === seedIndex) continue;
      if (options.kind && item.kind !== options.kind) continue;
      if (options.genre && !item.genres.includes(options.genre)) continue;

      const breakdown: ScoreBreakdown = {
        ...EMPTY_BREAKDOWN,
        neural: vectors.neural[i],
        sequential: vectors.sequential[i],
        affinity: seedSimilarity ? seedSimilarity[i] : vectors.affinity[i],
        quality: vectors.quality[i],
        popularity: vectors.popularity[i],
        freshness: vectors.freshness[i],
        exploration: vectors.exploration[i],
      };

      let score =
        arm.weights.affinity * breakdown.affinity +
        arm.weights.neural * breakdown.neural +
        arm.weights.sequential * breakdown.sequential +
        arm.weights.popularity * breakdown.popularity +
        arm.weights.freshness * breakdown.freshness +
        0.55 * breakdown.quality +
        explore * breakdown.exploration;

      // Something already finished is not a recommendation, but it is not
      // nothing either — a rewatch is real. Damped rather than dropped.
      if (this.profile?.completed.has(item.uid)) score *= 0.25;
      const engagement = this.profile?.engagement.get(item.uid) || 0;
      if (engagement < -0.3) score *= 0.3;

      scored.push({
        item, index: i, score, breakdown,
        sources: ["blend"], reason: "", highlight: [],
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const shortlist = scored.slice(0, RANK_DEPTH);
    this.applyRanker(shortlist);

    const slate = composeSlate(shortlist, {
      diversity: spread,
      // Calibration is meaningless without a mix to calibrate against, and on a
      // thin profile it would lock a row to two genres seen once each.
      calibration: this.profile?.personalised ? 0.35 : 0,
      target: this.profile?.genreAffinity || new Map(),
      embeddings: this.semantic.embeddings,
      dim: this.semantic.rank,
      limit,
    });

    for (const candidate of slate) this.explain(candidate, arm);

    return {
      slate,
      arm,
      calibration: calibrationScore(
        slate.map((candidate) => candidate.item),
        this.profile?.genreAffinity || new Map()
      ),
    };
  }

  /** Cosine of every catalogue item against one of them. */
  private similarityTo(index: number): Float32Array {
    const semantic = this.semantic!;
    const n = this.items.length;
    const rank = semantic.rank;
    const out = new Float32Array(n);
    const base = index * rank;

    for (let i = 0; i < n; i += 1) {
      let sum = 0;
      for (let d = 0; d < rank; d += 1) sum += semantic.embeddings[base + d] * semantic.embeddings[i * rank + d];
      out[i] = Math.max(0, sum);
    }
    return out;
  }

  // --- search ----------------------------------------------------------------

  async search(query: string, options: SearchOptions = {}): Promise<SearchOutcome> {
    await this.boot();
    await this.ensureFresh();

    const started = performance.now();
    const limit = options.limit ?? 24;
    const empty: SearchOutcome = {
      query, understood: [], didYouMean: null, results: [], total: 0, tookMs: 0,
    };

    if (!this.lexical || !this.semantic || !this.features) return empty;

    const parsed = parseQuery(query, this.genres);
    const kind = options.kind || parsed.kind;
    const genre = options.genre || parsed.genres[0];
    const personalisation = options.personalisation ?? 1;

    const n = this.items.length;
    const lexicalScores = new Float32Array(n);
    const lexicalTerms = new Map<number, string[]>();
    let bestLexical = 0;

    if (parsed.text) {
      for (const hit of this.lexical.search(parsed.text, { limit: 400 })) {
        lexicalScores[hit.doc] = hit.score;
        lexicalTerms.set(hit.doc, hit.terms);
        if (hit.score > bestLexical) bestLexical = hit.score;
      }
    }

    // Dense retrieval over the same query. The two disagree constantly and that
    // is the point — one finds the title that was typed, the other finds the
    // ones that were meant.
    const semanticScores = new Float32Array(n);
    if (parsed.text) {
      const encoded = this.semantic.encode(parsed.text);
      const rank = this.semantic.rank;
      for (let i = 0; i < n; i += 1) {
        let sum = 0;
        for (let d = 0; d < rank; d += 1) sum += encoded[d] * this.semantic.embeddings[i * rank + d];
        semanticScores[i] = Math.max(0, sum);
      }
    }

    const vectors = this.signalVectors();
    const browse = isBrowse(parsed) || !parsed.text;
    const results: Candidate[] = [];

    for (let i = 0; i < n; i += 1) {
      const item = this.items[i];

      if (kind && item.kind !== kind) continue;
      if (genre && !item.genres.includes(genre)) continue;
      if (parsed.year && item.year !== parsed.year) continue;
      if (parsed.decade && (item.year === null || Math.floor(item.year / 10) * 10 !== parsed.decade)) continue;
      if (parsed.status && item.status !== parsed.status) continue;

      const lexical = bestLexical ? lexicalScores[i] / bestLexical : 0;
      const semantic = semanticScores[i];

      // A query that produced neither a lexical nor a semantic signal did not
      // match this title, and letting popularity carry it into the results is
      // how a search box starts answering questions nobody asked.
      if (!browse && lexical <= 0 && semantic < 0.18) continue;

      const breakdown: ScoreBreakdown = {
        ...EMPTY_BREAKDOWN,
        lexical,
        semantic,
        neural: vectors.neural[i],
        sequential: 0,
        affinity: vectors.affinity[i],
        quality: vectors.quality[i],
        popularity: vectors.popularity[i],
        freshness: vectors.freshness[i],
        exploration: 0,
      };

      // Shape is a strong, cheap prior that neither retrieval arm captures:
      // "the query is a prefix of this title" is worth more than any amount of
      // term overlap, and the embeddings have no notion of it at all.
      const shape = parsed.text ? matchShape(parsed.text, item.title) : 0;

      let score = browse
        ? 0.6 * breakdown.quality + 0.9 * breakdown.popularity + 0.4 * breakdown.freshness
        : 2.4 * lexical + 1.5 * shape + 1.0 * semantic;

      // Personalisation breaks ties in search; it does not decide it. Someone
      // typing a title wants that title however far it is from their taste, and
      // this weight is deliberately an order below the relevance terms.
      score += personalisation * (0.28 * breakdown.affinity + 0.22 * breakdown.neural);
      score += 0.18 * breakdown.quality + 0.14 * breakdown.popularity;

      if (parsed.sort === "rating") score += 1.2 * breakdown.quality;
      if (parsed.sort === "popular") score += 1.2 * breakdown.popularity;
      if (parsed.sort === "newest") score += 1.2 * breakdown.freshness;
      if (parsed.sort === "year" && item.year) score += item.year / 4000;

      results.push({
        item, index: i, score, breakdown,
        sources: [lexical > 0 ? "lexical" : "", semantic > 0.18 ? "semantic" : ""].filter(Boolean),
        reason: "",
        highlight: this.lexical.highlight(item.title, lexicalTerms.get(i) || []),
      });
    }

    results.sort((a, b) => b.score - a.score);
    const total = results.length;

    const shortlist = results.slice(0, RANK_DEPTH);
    this.applyRanker(shortlist);

    // A search result set is barely diversified. Someone looking for a specific
    // thing wants the near-duplicates — the sequels, the remake — sitting
    // together, which is exactly what MMR would break up.
    const final = composeSlate(shortlist, {
      diversity: browse ? 0.3 : 0.08,
      calibration: 0,
      target: new Map(),
      embeddings: this.semantic.embeddings,
      dim: this.semantic.rank,
      limit,
    });

    for (const candidate of final) this.explain(candidate, null, parsed.text);

    return {
      query,
      understood: parsed.understood,
      // Only offered when the results are thin. Correcting a query that worked
      // is a search box arguing with the person using it.
      didYouMean: total < 3 && parsed.text ? this.lexical.suggest(parsed.text) : null,
      results: final,
      total,
      tookMs: Math.round(performance.now() - started),
    };
  }

  // --- explanation -----------------------------------------------------------

  /**
   * One line on why a card is here.
   *
   * Written from the breakdown that actually produced the score, not from a
   * separate heuristic that guesses at it. A recommender that explains itself
   * with a plausible-sounding reason it did not use is worse than one that says
   * nothing — the explanation is the part viewers check against, and once it is
   * caught being decorative nothing it says counts again.
   */
  private explain(candidate: Candidate, arm: Arm | null, query?: string): void {
    const { breakdown, item } = candidate;
    const profile = this.profile;

    if (profile && this.semantic) {
      candidate.becauseOf = nearestKnown(
        profile, this.items, this.semantic.embeddings, this.semantic.rank, candidate.index
      );
    }

    // A query short enough to be a title is quoted back; a sentence is not.
    // Echoing "Matches 'a heist that goes wrong'" under six cards in a row is
    // the reason line saying nothing at four times the width.
    const quotable = query && query.length <= 24;

    const parts: Array<[number, string]> = [
      [breakdown.lexical * 2.4, quotable ? `Matches “${query}”` : query ? "Matches your search" : ""],
      // Semantic relevance is its own reason, not a weaker version of lexical:
      // a title that shares no word with the query and still surfaced did so
      // because of what it is about, and saying that is more useful than
      // claiming a match that a reader would then fail to find in the title.
      [breakdown.semantic * 2.0, query ? "Close to what you described" : ""],
      [breakdown.sequential * 1.8, "Follows what you were watching"],
      [
        breakdown.affinity * 1.5,
        candidate.becauseOf ? `Like ${candidate.becauseOf.title}` : "Matches your taste",
      ],
      [breakdown.neural * 1.2, "Picked for you"],
      [breakdown.exploration * (arm?.explore || 0) * 1.4, "Something you haven't seen"],
      [breakdown.popularity * 1.1, "Popular right now"],
      [breakdown.quality * 0.9, item.rating10 ? `Rated ${item.rating10.toFixed(1)}` : "Well rated"],
      [breakdown.freshness * 0.8, "New to the catalogue"],
    ];

    const [, reason] = parts
      .filter(([weight, text]) => text && weight > 0.18)
      .sort((a, b) => b[0] - a[0])[0] || [0, ""];

    // Genres the viewer holds and this title shares are a better fallback than
    // "recommended", which says nothing.
    if (!reason && profile?.genreAffinity.size) {
      const shared = item.genres.find((genre) => (profile.genreAffinity.get(genre) || 0) > 0.08);
      candidate.reason = shared ? `${shared[0].toUpperCase()}${shared.slice(1)} you might like` : "";
      return;
    }
    candidate.reason = reason;
  }

  // --- feedback --------------------------------------------------------------

  /** Registers which strategy produced a slate, so its reward can be credited. */
  attributeSlate(slateId: string, arm: ArmKey): void {
    const { context } = this.banditContext(false);
    this.slateArms.set(slateId, { arm, context, at: Date.now() });
    // Bounded: a long session produces a slate per row per render, and the ones
    // that were never acted on have already been charged their zero reward.
    if (this.slateArms.size > 60) {
      const oldest = [...this.slateArms.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) this.slateArms.delete(oldest[0]);
    }
  }

  /**
   * Credits or charges the strategy behind a slate.
   *
   * Reward is bounded to 0-1 and comes from what the viewer actually did, so a
   * strategy that produces rows people scroll past learns that from the
   * impressions alone — no click is itself a signal, and it is the most common
   * one.
   */
  reward(slateId: string, value: number): void {
    const record = this.slateArms.get(slateId);
    if (!record) return;
    this.bandit.update(record.arm, record.context, Math.max(0, Math.min(1, value)));
    void this.bandit.save();
  }

  // --- training ---------------------------------------------------------------

  private trainingTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Schedules a training pass, coalescing bursts.
   *
   * Every interaction makes the model slightly stale, and retraining on each one
   * would run a gradient step per pointer move. The delay is long enough that a
   * scroll through a page settles into one pass.
   */
  trainSoon(delayMs = 12_000): void {
    if (this.trainingTimer) return;
    this.trainingTimer = setTimeout(() => {
      this.trainingTimer = null;
      void this.train();
    }, delayMs);
  }

  async train(): Promise<void> {
    if (this.training) return this.training;
    this.training = this.runTraining();
    try {
      await this.training;
    } finally {
      this.training = null;
    }
  }

  private async runTraining(): Promise<void> {
    await this.boot();
    await this.ensureFresh();
    if (!this.tf || !this.semantic || !this.features || !this.profile) return;
    if (this.signals.length < 8) return;

    const previous = this.status.stage;
    this.status.stage = "training";

    try {
      const loss = { ...this.status.training.loss };

      // Progress is published after every step rather than at the end of the
      // pass. The panel is the only window onto this, and a counter that jumps
      // from 0 to 24 cannot distinguish "training is quick" from "training
      // stopped somewhere in the middle".
      const advance = () => {
        this.status.training = {
          ...this.status.training,
          steps: this.status.training.steps + 1,
          loss,
          samples: this.signals.length,
        };
      };

      const towerBatch = this.buildTowerBatch();
      if (towerBatch && this.tower) {
        for (let step = 0; step < STEPS.tower; step += 1) {
          loss.tower = this.tower.train(towerBatch, this.itemInput, this.items.length);
          advance();
          // Yielding between steps rather than running the whole pass in one
          // task. Each step is a few milliseconds of GPU work and the pass is
          // background work by definition — it must never be the reason a
          // scroll stutters.
          await breathe(this.tf);
        }
        this.tower.dropCache();
      }

      const sequenceBatch = buildSequenceBatch(this.profile.sequence, (count) => this.sampleNegatives(count));
      if (sequenceBatch && this.sequence) {
        for (let step = 0; step < STEPS.sequence; step += 1) {
          loss.sequence = this.sequence.train(sequenceBatch, this.semantic.embeddings, this.items.length);
          advance();
          await breathe(this.tf);
        }
        this.sequence.dropCache();
      }

      const rankerBatch = this.buildRankerBatch();
      if (rankerBatch && this.ranker) {
        for (let step = 0; step < STEPS.ranker; step += 1) {
          loss.ranker = this.ranker.train(rankerBatch);
          advance();
          await breathe(this.tf);
        }
      }

      this.status.training = { ...this.status.training, loss, lastTrainedAt: Date.now() };

      await Promise.all([
        this.tower?.save(),
        this.sequence?.save(),
        this.ranker?.save(),
        kvSet("training.stats", this.status.training),
      ]);
    } catch (error) {
      // A failed training pass must not take the recommender with it. The
      // previous weights are still loaded and still work; the pass will be
      // retried the next time signals accumulate.
      this.status.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.status.stage = previous === "training" ? "ready" : previous;
    }
  }

  /**
   * Items to push against, drawn from what was shown and ignored.
   *
   * A negative sampled from the catalogue at random is usually a title the
   * viewer has never had the chance to reject, which teaches the model very
   * little — it is easy to rank below a positive and the gradient is nearly
   * zero. One that was displayed and passed over is a *hard* negative: the
   * ranker already thought it was good, and being wrong about it is where the
   * learning is. The random tail is kept so the model still sees the rest of
   * the catalogue exists.
   */
  private sampleNegatives(count: number): Int32Array {
    const out = new Int32Array(count);
    const profile = this.profile;
    const hard: number[] = [];

    if (profile) {
      for (const [uid, shown] of profile.impressions) {
        if (shown < 2) continue;
        if ((profile.engagement.get(uid) || 0) > 0.1) continue;
        const index = this.indexOf.get(uid);
        if (index !== undefined) hard.push(index);
      }
    }

    const hardShare = Math.min(hard.length, Math.floor(count * 0.6));
    for (let i = 0; i < count; i += 1) {
      out[i] =
        i < hardShare
          ? hard[Math.floor(Math.random() * hard.length)]
          : Math.floor(Math.random() * this.items.length);
    }
    return out;
  }

  /**
   * Training examples for the two-tower model.
   *
   * The user vector for each example is built from the interactions that came
   * *before* it, never from the profile as it stands now. That is the whole
   * discipline of this function: today's profile already contains the item being
   * predicted, and training against it would teach the model to recognise
   * something it will never be given at inference. The running prefix sum below
   * is what keeps the two honest.
   */
  private buildTowerBatch(): {
    users: Float32Array; positives: Int32Array; negatives: Int32Array; sampling: Float32Array;
  } | null {
    const profile = this.profile;
    const semantic = this.semantic;
    const features = this.features;
    if (!profile || !semantic || !features) return null;

    const rank = semantic.rank;
    const genreCount = features.genres.length;
    const userWidth = rank + genreCount + USER_CONTEXT;

    const running = new Float32Array(rank);
    const genreRunning = new Float32Array(genreCount);
    let depth = 0;

    const users: number[] = [];
    const positives: number[] = [];
    const now = Date.now();

    for (const signal of this.signals) {
      const index = this.indexOf.get(signal.uid);
      if (index === undefined) continue;

      const value = valueOf(signal) * decay(signal.at, now);
      if (value < 0.25) continue;

      // Snapshot first, then absorb — the order is the no-leakage guarantee.
      if (depth >= 2) {
        const taste = Float32Array.from(running);
        normalizeRows(taste, 1, rank);

        const mix = Float32Array.from(genreRunning);
        const total = mix.reduce((sum, x) => sum + x, 0) || 1;
        for (let i = 0; i < mix.length; i += 1) mix[i] /= total;

        const row = this.userVector(taste, mix, signal.at, depth);
        for (let i = 0; i < userWidth; i += 1) users.push(row[i]);
        positives.push(index);
      }

      for (let d = 0; d < rank; d += 1) running[d] += value * semantic.embeddings[index * rank + d];
      for (const genre of this.items[index].genres) {
        const slot = features.genreIndex.get(genre);
        if (slot !== undefined) genreRunning[slot] += value;
      }
      depth += 1;
    }

    if (positives.length < 4) return null;

    // The most recent window. Older examples are already folded into every
    // later example's prefix vector, so training on all of them over-weights
    // the start of the history.
    const keep = Math.min(positives.length, 96);
    const from = positives.length - keep;

    // Sampling probability per catalogue row, for the logQ correction. Empirical
    // frequency among the positives, smoothed so an item that never appears
    // does not contribute log(0) when it turns up as a sampled negative.
    const sampling = new Float32Array(this.items.length).fill(1 / this.items.length);
    for (const index of positives.slice(from)) sampling[index] += 1 / keep;

    return {
      users: Float32Array.from(users.slice(from * userWidth)),
      positives: Int32Array.from(positives.slice(from)),
      negatives: this.sampleNegatives(32),
      sampling,
    };
  }

  /** Slates that had an outcome, re-scored into ranker rows. */
  private buildRankerBatch(): {
    features: Float32Array; mask: Float32Array; chosen: Int32Array; batch: number;
  } | null {
    const profile = this.profile;
    if (!profile || profile.slates.length < 3 || !this.features) return null;

    const SLATE = 12;
    const usable = profile.slates.slice(-40);
    const vectors = this.signalVectors();

    const rows = new Float32Array(usable.length * SLATE * RANKER_WIDTH);
    const mask = new Float32Array(usable.length * SLATE);
    const chosen = new Int32Array(usable.length);
    let batch = 0;

    for (const slate of usable) {
      // Truncating around the click rather than from the front: a slate whose
      // clicked card sat at position fifteen would otherwise train on twelve
      // cards none of which was chosen, and the softmax has no correct answer.
      const start = Math.max(0, Math.min(slate.chosen - 3, slate.shown.length - SLATE));
      const window = slate.shown.slice(start, start + SLATE);
      const chosenAt = slate.chosen - start;
      if (chosenAt < 0 || chosenAt >= window.length) continue;

      window.forEach((index, position) => {
        const breakdown: ScoreBreakdown = {
          ...EMPTY_BREAKDOWN,
          neural: vectors.neural[index],
          sequential: vectors.sequential[index],
          affinity: vectors.affinity[index],
          quality: vectors.quality[index],
          popularity: vectors.popularity[index],
          freshness: vectors.freshness[index],
          exploration: vectors.exploration[index],
          // Search slates carried a query; recomputing its lexical score here
          // would need the query text, which the slate does not keep. Left at
          // zero, which is honest — the ranker simply learns nothing about
          // lexical weighting from home rows, and search slates are the ones
          // that teach it that.
          lexical: 0,
          semantic: 0,
        };
        this.rankerRow(
          breakdown, position, index, rows,
          (batch * SLATE + position) * RANKER_WIDTH
        );
        mask[batch * SLATE + position] = 1;
      });

      chosen[batch] = chosenAt;
      batch += 1;
    }

    return batch >= 3 ? { features: rows, mask, chosen, batch } : null;
  }

  // --- diagnostics -----------------------------------------------------------

  getStatus(): EngineStatus {
    return { ...this.status, timings: { ...this.status.timings } };
  }

  /** Everything the insight panel shows. */
  introspect(): {
    status: EngineStatus;
    interests: Array<{ label: string; share: number; titles: string[] }>;
    genres: Array<{ genre: string; share: number }>;
    arms: Array<{ key: string; label: string; pulls: number; averageReward: number }>;
    importances: Array<{ feature: string; weight: number }>;
    spectrum: number[];
    lexicon: { terms: number; items: number };
  } {
    const profile = this.profile;
    return {
      status: this.getStatus(),
      interests: (profile?.interests || []).map((interest) => ({
        label: interest.label,
        share: interest.share,
        titles: interest.members.slice(0, 4).map((member) => this.items[member.index]?.title || ""),
      })),
      genres: [...(profile?.genreAffinity || new Map())]
        .slice(0, 8)
        .map(([genre, share]) => ({ genre, share })),
      arms: this.bandit.stats(),
      importances: this.ranker?.importances() || [],
      spectrum: Array.from(this.semantic?.spectrum || []).slice(0, 24),
      lexicon: { terms: this.lexical?.terms || 0, items: this.items.length },
    };
  }

  /** For "you might also like" under a title, without a profile in play. */
  async similar(uid: string, limit = 12): Promise<Candidate[]> {
    const { slate } = await this.recommend({ seedUid: uid, limit, diversity: 0.2, surface: "similar" });
    return slate;
  }

}

let singleton: RecommendationEngine | null = null;

/**
 * One engine per document.
 *
 * It holds the catalogue, several megabytes of embeddings and three sets of GPU
 * weights. A second copy would double all of that and — worse — train two
 * models on the same signals in parallel, each overwriting the other's saved
 * weights on every pass.
 */
export function getEngine(): RecommendationEngine {
  if (!singleton) singleton = new RecommendationEngine();
  return singleton;
}
