import type * as TF from "@tensorflow/tfjs";
import { compute, type Tf } from "../tf";
import { gelu, l2Normalize, ParamSet } from "./params";

/**
 * Two-tower retrieval, trained in the browser on this device's own history.
 *
 * A tower each: one turns a viewer into a vector, the other turns a title into a
 * vector, and the score is their dot product. The arrangement is the standard
 * one for retrieval and it is chosen here for a property that matters more on a
 * phone than in a data centre — the item tower does not depend on the viewer, so
 * every title's vector is computed once and reused, and ranking the entire
 * catalogue afterwards is a single matrix multiply against one 48-wide vector.
 * Scoring a thousand titles costs less than laying out one row of cards.
 *
 * The item tower takes *content* — the latent text vector and the numeric
 * features — not an item id. That is what makes this useful on a catalogue this
 * size. An id-embedding table has to see a title before it can place it, so
 * everything published this week is invisible; a content tower places a new
 * title the moment it appears, from its genres and its synopsis, without a
 * single interaction.
 *
 * Training is in-batch sampled softmax with a popularity correction. What it is
 * doing, concretely: take the things this viewer engaged with, and for each one
 * push its vector toward the viewer-vector-at-the-time and away from everything
 * else in the batch. The correction below is what stops that from becoming a
 * popularity ranker in disguise.
 */

export interface TowerShape {
  /** Latent text dimensions from `semantic.ts`. */
  semantic: number;
  /** Numeric item features from `features.ts`. */
  features: number;
  /** Extra user-side inputs: genre distribution plus context scalars. */
  userExtra: number;
  hidden?: number;
  output?: number;
}

export interface TowerBatch {
  /** B × userWidth. */
  users: Float32Array;
  /** B positives, as rows of the item input matrix. */
  positives: Int32Array;
  /** Extra negatives sampled outside the batch, as item rows. */
  negatives: Int32Array;
  /**
   * Estimated probability of each catalogue row turning up as a candidate.
   * Length is the catalogue; see the logQ note in `loss`.
   */
  sampling: Float32Array;
}

const HIDDEN = 96;
const OUTPUT = 48;

/**
 * Softmax temperature.
 *
 * Both towers end in an L2 normalisation, so a logit is a cosine and lives in
 * [-1, 1]. A softmax over that range is nearly uniform and produces almost no
 * gradient; dividing by a small temperature is what gives the loss something to
 * work with. 0.07 is the value contrastive vision models settled on and it
 * transfers directly, because the geometry is the same.
 */
const TEMPERATURE = 0.07;

export class TwoTowerModel {
  private readonly params: ParamSet;
  private readonly itemW1: TF.Variable;
  private readonly itemB1: TF.Variable;
  private readonly itemW2: TF.Variable;
  private readonly itemB2: TF.Variable;
  private readonly userW1: TF.Variable;
  private readonly userB1: TF.Variable;
  private readonly userW2: TF.Variable;
  private readonly userB2: TF.Variable;
  private readonly optimizer: TF.Optimizer;

  /** Cached item vectors; invalidated whenever the weights move. */
  private cache: TF.Tensor2D | null = null;

  readonly itemWidth: number;
  readonly userWidth: number;
  readonly outputWidth: number;

  constructor(
    private readonly tf: Tf,
    shape: TowerShape
  ) {
    const hidden = shape.hidden ?? HIDDEN;
    const output = shape.output ?? OUTPUT;

    this.itemWidth = shape.semantic + shape.features;
    this.userWidth = shape.semantic + shape.userExtra;
    this.outputWidth = output;

    this.params = new ParamSet(tf, "tower");
    this.itemW1 = this.params.weight("itemW1", [this.itemWidth, hidden]);
    this.itemB1 = this.params.bias("itemB1", hidden);
    this.itemW2 = this.params.weight("itemW2", [hidden, output]);
    this.itemB2 = this.params.bias("itemB2", output);
    this.userW1 = this.params.weight("userW1", [this.userWidth, hidden]);
    this.userB1 = this.params.bias("userB1", hidden);
    this.userW2 = this.params.weight("userW2", [hidden, output]);
    this.userB2 = this.params.bias("userB2", output);

    this.optimizer = tf.train.adam(2e-3);
  }

  private forward(
    input: TF.Tensor2D,
    w1: TF.Variable,
    b1: TF.Variable,
    w2: TF.Variable,
    b2: TF.Variable,
    dropout: number
  ): TF.Tensor2D {
    return this.tf.tidy(() => {
      let hidden = gelu(this.tf, this.tf.add(this.tf.matMul(input, w1), b1));
      // Only while training. Dropout at inference would make the same viewer
      // and the same title score differently on every render, which the row
      // would show as cards changing order for no reason.
      if (dropout > 0) hidden = this.tf.dropout(hidden, dropout);
      const out = this.tf.add(this.tf.matMul(hidden as TF.Tensor2D, w2), b2);
      return l2Normalize(this.tf, out as TF.Tensor2D);
    });
  }

  private items(input: TF.Tensor2D, dropout = 0): TF.Tensor2D {
    return this.forward(input, this.itemW1, this.itemB1, this.itemW2, this.itemB2, dropout);
  }

  private users(input: TF.Tensor2D, dropout = 0): TF.Tensor2D {
    return this.forward(input, this.userW1, this.userB1, this.userW2, this.userB2, dropout);
  }

  /**
   * Every catalogue vector, computed once and held.
   *
   * `itemInput` is n × itemWidth and does not change between trainings, so the
   * only thing that invalidates this is a weight update — which `train` handles
   * by dropping the cache.
   */
  itemVectors(itemInput: Float32Array, count: number): TF.Tensor2D {
    if (this.cache) return this.cache;
    this.cache = this.tf.tidy(() => {
      const input = this.tf.tensor2d(itemInput, [count, this.itemWidth]);
      return this.items(input);
    });
    return this.cache;
  }

  /** Scores the whole catalogue for one viewer vector. */
  score(userInput: Float32Array, itemInput: Float32Array, count: number): Float32Array {
    const items = this.itemVectors(itemInput, count);
    return compute(this.tf, () => {
      const user = this.users(this.tf.tensor2d(userInput, [1, this.userWidth]));
      return this.tf
        .matMul(items, user, false, true)
        .reshape([count])
        .dataSync() as Float32Array;
    });
  }

  /** The viewer's own vector, for diagnostics and for the insight panel. */
  embedUser(userInput: Float32Array): Float32Array {
    return compute(this.tf, () =>
      this.users(this.tf.tensor2d(userInput, [1, this.userWidth])).dataSync() as Float32Array
    );
  }

  /**
   * One gradient step. Returns the loss.
   *
   * The candidate set is the batch's own positives plus a sampled tail: every
   * row's positive is every other row's negative. That is what makes this
   * affordable — B positives give B² comparisons for the cost of one matrix
   * multiply, instead of needing an explicit negative per example.
   *
   * The correction on the logits is the part that is easy to leave out and
   * wrong to. In-batch negatives are drawn from what the viewer engaged with,
   * so popular titles appear as negatives far more often than obscure ones and
   * the model learns to push them down — the exact opposite of what popularity
   * should do. Subtracting log(sampling probability) from each column undoes
   * the bias the sampling introduced, and nothing else.
   */
  train(batch: TowerBatch, itemInput: Float32Array, count: number): number {
    const rows = batch.positives.length;
    if (rows < 2) return 0;

    this.dropCache();

    const loss = this.optimizer.minimize(
      () =>
        this.tf.tidy(() => {
          const candidates = this.tf.concat([
            this.tf.tensor1d(batch.positives, "int32"),
            this.tf.tensor1d(batch.negatives, "int32"),
          ]) as TF.Tensor1D;

          const allItems = this.tf.tensor2d(itemInput, [count, this.itemWidth]);
          const itemRows = this.tf.gather(allItems, candidates) as TF.Tensor2D;

          const itemVectors = this.items(itemRows, 0.1);
          const userVectors = this.users(
            this.tf.tensor2d(batch.users, [rows, this.userWidth]),
            0.1
          );

          // B × (B + negatives)
          const logits = this.tf.div(
            this.tf.matMul(userVectors, itemVectors, false, true),
            TEMPERATURE
          ) as TF.Tensor2D;

          const priors = this.tf.gather(
            this.tf.tensor1d(batch.sampling),
            candidates
          ) as TF.Tensor1D;
          const corrected = this.tf.sub(
            logits,
            this.tf.log(this.tf.maximum(priors, 1e-6)).reshape([1, candidates.shape[0]])
          ) as TF.Tensor2D;

          // Row i's positive is column i, by construction of `candidates`.
          const labels = this.tf.oneHot(
            this.tf.range(0, rows, 1, "int32") as TF.Tensor1D,
            candidates.shape[0]
          ) as TF.Tensor2D;

          return this.tf.losses.softmaxCrossEntropy(labels, corrected) as TF.Scalar;
        }),
      true,
      this.params.trainable
    );

    const value = loss ? (loss.dataSync()[0] as number) : 0;
    loss?.dispose();
    return value;
  }

  dropCache(): void {
    this.cache?.dispose();
    this.cache = null;
  }

  save(): Promise<void> {
    return this.params.save();
  }

  restore(): Promise<boolean> {
    return this.params.restore();
  }

  dispose(): void {
    this.dropCache();
    this.params.dispose();
  }
}
