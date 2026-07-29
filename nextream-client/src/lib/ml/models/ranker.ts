import type * as TF from "@tensorflow/tfjs";
import { compute, type Tf } from "../tf";
import { gelu, ParamSet } from "./params";

/**
 * The last stage: learning how to weigh the other stages.
 *
 * Retrieval produces a handful of scores per candidate — lexical, semantic,
 * two-tower, sequential, popularity, freshness — and something has to combine
 * them. The usual answer is a line of hand-tuned constants, and it is wrong in a
 * specific way: the right weights are not the same for every query or every
 * surface. Lexical relevance should dominate when someone has typed most of a
 * title and should count for nothing on a home row. A hand-tuned blend has to
 * pick one compromise and live with it everywhere.
 *
 * This learns the combination instead, from which card in a slate was actually
 * clicked. It is small on purpose — a few hundred parameters over ten features
 * — because it trains on tens of slates, not millions, and anything larger
 * memorises them.
 *
 * The loss is listwise. Pointwise training ("was this clicked, yes or no")
 * optimises a probability nobody sees; what is on screen is an *ordering*, and
 * the only thing that matters is that the clicked card outranked the ones beside
 * it. The softmax below is over one slate, so that is precisely what it
 * maximises — this is ListNet, and it is the cheapest correct thing to do here.
 *
 * One honest limitation. Features are recomputed at training time rather than
 * stored per impression, so a slate shown last week is re-scored against
 * today's taste profile. Storing the whole feature vector for every card ever
 * displayed would triple the size of the signal log to fix a drift that is
 * small over the fortnight the log covers — but it is drift, and it is why this
 * model's weights are kept deliberately close to their prior.
 */

/** Candidates per training slate. Longer ones are truncated around the click. */
const SLATE = 12;

const HIDDEN = 24;

/** Big enough to zero a softmax over padded slots. */
const MASKED = -1e9;

/**
 * Names of the inputs, in order. The engine builds rows against this list, and
 * the insight panel reads the learned weights back through it.
 */
export const RANKER_FEATURES = [
  "lexical",
  "semantic",
  "neural",
  "sequential",
  "affinity",
  "quality",
  "popularity",
  "freshness",
  "exploration",
  "position",
  "seen",
  "isShow",
] as const;

export const RANKER_WIDTH = RANKER_FEATURES.length;

export interface RankerBatch {
  /** B × SLATE × RANKER_WIDTH. */
  features: Float32Array;
  /** B × SLATE, 1 for a real candidate and 0 for padding. */
  mask: Float32Array;
  /** B, the index within each slate that was acted on. */
  chosen: Int32Array;
  batch: number;
}

export class RankerModel {
  private readonly params: ParamSet;
  private readonly w1: TF.Variable;
  private readonly b1: TF.Variable;
  private readonly w2: TF.Variable;
  private readonly b2: TF.Variable;
  private readonly optimizer: TF.Optimizer;

  constructor(private readonly tf: Tf) {
    this.params = new ParamSet(tf, "ranker");
    this.w1 = this.params.weight("w1", [RANKER_WIDTH, HIDDEN]);
    this.b1 = this.params.bias("b1", HIDDEN);
    this.w2 = this.params.weight("w2", [HIDDEN, 1]);
    this.b2 = this.params.bias("b2", 1);
    this.optimizer = tf.train.adam(3e-3);
  }

  private forward(input: TF.Tensor2D): TF.Tensor2D {
    return this.tf.tidy(() => {
      const hidden = gelu(this.tf, this.tf.add(this.tf.matMul(input, this.w1), this.b1));
      return this.tf.add(
        this.tf.matMul(hidden as TF.Tensor2D, this.w2),
        this.b2
      ) as TF.Tensor2D;
    });
  }

  /** Scores a whole candidate list at once. Returns one number per row. */
  score(features: Float32Array, rows: number): Float32Array {
    if (!rows) return new Float32Array(0);
    return compute(this.tf, () =>
      this.forward(this.tf.tensor2d(features, [rows, RANKER_WIDTH]))
        .reshape([rows])
        .dataSync() as Float32Array
    );
  }

  train(batch: RankerBatch): number {
    if (!batch.batch) return 0;
    const B = batch.batch;

    const loss = this.optimizer.minimize(
      () =>
        this.tf.tidy(() => {
          const flat = this.tf.tensor2d(batch.features, [B * SLATE, RANKER_WIDTH]);
          const scores = this.forward(flat).reshape([B, SLATE]) as TF.Tensor2D;

          // Padded slots are pushed to -inf rather than dropped, so every slate
          // is the same width and the whole batch is one softmax.
          const mask = this.tf.tensor2d(batch.mask, [B, SLATE]);
          const masked = this.tf.add(
            this.tf.mul(scores, mask),
            this.tf.mul(this.tf.sub(1, mask), MASKED)
          ) as TF.Tensor2D;

          const labels = this.tf.oneHot(
            this.tf.tensor1d(batch.chosen, "int32") as TF.Tensor1D,
            SLATE
          ) as TF.Tensor2D;

          return this.tf.losses.softmaxCrossEntropy(labels, masked) as TF.Scalar;
        }),
      true,
      this.params.trainable
    );

    const value = loss ? (loss.dataSync()[0] as number) : 0;
    loss?.dispose();
    return value;
  }

  /**
   * How much each input moves the output, averaged over a unit step.
   *
   * A first-order sensitivity, not a true attribution — the network is
   * nonlinear and this ignores the interactions. It is enough for what it is
   * for: showing a reader of the insight panel that this device's ranker has
   * learned to lean on sequence and barely look at popularity, which is the
   * kind of statement a hand-tuned blend can never make about itself.
   */
  importances(): Array<{ feature: string; weight: number }> {
    const raw = compute(this.tf, () => {
      // |W1| · |W2| summed over the hidden layer: the magnitude of the path
      // from each input to the output.
      const first = this.tf.abs(this.w1) as TF.Tensor2D;
      const second = this.tf.abs(this.w2) as TF.Tensor2D;
      return this.tf
        .matMul(first, second)
        .reshape([RANKER_WIDTH])
        .dataSync() as Float32Array;
    });

    const total = raw.reduce((sum, value) => sum + value, 0) || 1;
    return RANKER_FEATURES.map((feature, i) => ({
      feature,
      weight: raw[i] / total,
    })).sort((a, b) => b.weight - a.weight);
  }

  save(): Promise<void> {
    return this.params.save();
  }

  restore(): Promise<boolean> {
    return this.params.restore();
  }

  dispose(): void {
    this.params.dispose();
  }
}

export { SLATE as RANKER_SLATE };
