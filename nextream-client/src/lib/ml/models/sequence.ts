import type * as TF from "@tensorflow/tfjs";
import { compute, type Tf } from "../tf";
import { gelu, layerNorm, ParamSet } from "./params";

/**
 * What to play next, from the order things were watched.
 *
 * The two-tower model answers "what does this person like", which is a question
 * about a viewer in general. It cannot answer "they have watched three episodes
 * tonight, what now" — order is exactly the information a bag-of-history
 * average throws away, and it is most of what decides the next click.
 *
 * This is SASRec, reduced to what a browser can afford: masked self-attention
 * over the recent sequence, trained to predict the item at each next position.
 * The attention is the point. A recurrent model compresses the session into one
 * hidden state and everything competes for room in it; attention lets the
 * prediction look directly at whichever earlier item is relevant — the film two
 * hours ago rather than the trailer clicked thirty seconds ago — and learns
 * which that is.
 *
 * Items enter as *content* vectors through a shared projection, not as rows of
 * an id-embedding table. Two reasons, and both are about scale. An id table for
 * a growing catalogue is the largest thing in the model and the part that
 * overfits first when there are two hundred training examples. And it cannot
 * represent a title nobody has watched yet, which on a small catalogue is most
 * of it.
 *
 * The projection is shared between input and output — the same matrix that maps
 * a title into the model also scores it at the end. Weight tying halves the
 * parameters and, more usefully, forces the predicted "next" vector to live in
 * the same space as the items it is compared against.
 */

/** Positions attended over. Two evenings of watching. */
export const SEQUENCE_LENGTH = 24;

/** Model width. Wide enough to hold a session, narrow enough to train on one. */
const MODEL_DIM = 48;

/** Attention blocks. */
const BLOCKS = 2;

/** Negatives sampled per batch for the softmax. */
const NEGATIVES = 64;

/** Big enough to zero a softmax, small enough not to be an infinity. */
const MASKED = -1e9;

interface Block {
  q: TF.Variable;
  k: TF.Variable;
  v: TF.Variable;
  o: TF.Variable;
  w1: TF.Variable;
  b1: TF.Variable;
  w2: TF.Variable;
  b2: TF.Variable;
}

export interface SequenceBatch {
  /** B × L item rows, left-padded with 0. */
  inputs: Int32Array;
  /** B × L, the item that followed each position. */
  targets: Int32Array;
  /** B × L, 1 where the position is real and has a target. */
  mask: Float32Array;
  /** B × L × L additive attention mask: causal, and blind to padding. */
  attention: Float32Array;
  /** Item rows to score against as negatives. */
  negatives: Int32Array;
  batch: number;
}

export class SequenceModel {
  private readonly params: ParamSet;
  private readonly projection: TF.Variable;
  private readonly positions: TF.Variable;
  private readonly blocks: Block[] = [];
  private readonly optimizer: TF.Optimizer;

  private cache: TF.Tensor2D | null = null;

  constructor(
    private readonly tf: Tf,
    private readonly semanticDim: number,
    private readonly dim = MODEL_DIM
  ) {
    this.params = new ParamSet(tf, "sequence");
    this.projection = this.params.weight("projection", [semanticDim, dim]);
    this.positions = this.params.weight("positions", [SEQUENCE_LENGTH, dim], 0.3);

    for (let i = 0; i < BLOCKS; i += 1) {
      this.blocks.push({
        q: this.params.weight(`q${i}`, [dim, dim]),
        k: this.params.weight(`k${i}`, [dim, dim]),
        v: this.params.weight(`v${i}`, [dim, dim]),
        o: this.params.weight(`o${i}`, [dim, dim]),
        w1: this.params.weight(`ff1_${i}`, [dim, dim * 2]),
        b1: this.params.bias(`ffb1_${i}`, dim * 2),
        w2: this.params.weight(`ff2_${i}`, [dim * 2, dim]),
        b2: this.params.bias(`ffb2_${i}`, dim),
      });
    }

    this.optimizer = tf.train.adam(1.5e-3);
  }

  /** Every catalogue title in model space, held until the weights move. */
  private projected(semantic: Float32Array, count: number): TF.Tensor2D {
    if (this.cache) return this.cache;
    this.cache = this.tf.tidy(
      () =>
        this.tf.matMul(
          this.tf.tensor2d(semantic, [count, this.semanticDim]),
          this.projection
        ) as TF.Tensor2D
    );
    return this.cache;
  }

  /**
   * Runs the stack. Takes B × L × dim, returns (B·L) × dim.
   *
   * Pre-norm rather than post-norm — normalising the input to each sub-layer and
   * leaving the residual path untouched. Post-norm is what the original
   * transformer paper does and it needs a learning-rate warmup to train at all;
   * there is no room for a warmup in a handful of steps on a phone, and pre-norm
   * trains from the first step without one.
   *
   * The residual stream is carried flattened, and only the attention reshapes
   * back to three dimensions. That is not a style choice: TensorFlow.js will
   * happily broadcast a rank-2 weight matrix against a rank-3 activation in the
   * forward pass and then fail in the backward one, because the gradient it
   * computes for the weight keeps the batch dimension and no longer matches the
   * variable it belongs to. Every per-position projection here is therefore a
   * genuine 2-D matmul, and the only batched ones are the two inside attention,
   * where both operands are rank 3 and the batch dimensions agree.
   */
  private encode(
    sequence: TF.Tensor3D,
    attention: TF.Tensor3D,
    batch: number,
    dropout: number
  ): TF.Tensor2D {
    return this.tf.tidy(() => {
      const L = SEQUENCE_LENGTH;
      const D = this.dim;
      const scale = 1 / Math.sqrt(D);
      let x = sequence.reshape([batch * L, D]) as TF.Tensor2D;

      for (const block of this.blocks) {
        const normed = layerNorm(this.tf, x) as TF.Tensor2D;

        const q = this.tf.matMul(normed, block.q).reshape([batch, L, D]) as TF.Tensor3D;
        const k = this.tf.matMul(normed, block.k).reshape([batch, L, D]) as TF.Tensor3D;
        const v = this.tf.matMul(normed, block.v).reshape([batch, L, D]) as TF.Tensor3D;

        const scores = this.tf.add(
          this.tf.mul(this.tf.matMul(q, k, false, true), scale),
          attention
        );
        let attended = this.tf
          .matMul(this.tf.softmax(scores, -1) as TF.Tensor3D, v)
          .reshape([batch * L, D]) as TF.Tensor2D;
        attended = this.tf.matMul(attended, block.o) as TF.Tensor2D;
        if (dropout > 0) attended = this.tf.dropout(attended, dropout) as TF.Tensor2D;

        x = this.tf.add(x, attended) as TF.Tensor2D;

        const normed2 = layerNorm(this.tf, x) as TF.Tensor2D;
        let hidden = gelu(
          this.tf,
          this.tf.add(this.tf.matMul(normed2, block.w1), block.b1)
        ) as TF.Tensor2D;
        hidden = this.tf.add(this.tf.matMul(hidden, block.w2), block.b2) as TF.Tensor2D;
        if (dropout > 0) hidden = this.tf.dropout(hidden, dropout) as TF.Tensor2D;

        x = this.tf.add(x, hidden) as TF.Tensor2D;
      }

      return layerNorm(this.tf, x) as TF.Tensor2D;
    });
  }

  private embed(
    rows: TF.Tensor2D,
    inputs: TF.Tensor1D,
    batch: number
  ): TF.Tensor3D {
    return this.tf.tidy(() => {
      const gathered = this.tf.gather(rows, inputs) as TF.Tensor2D;
      const shaped = gathered.reshape([batch, SEQUENCE_LENGTH, this.dim]) as TF.Tensor3D;
      // Position is added, not concatenated: the residual stream has to stay one
      // width all the way through, and every transformer since the first has
      // done it this way for that reason.
      return this.tf.add(shaped, this.positions.reshape([1, SEQUENCE_LENGTH, this.dim]));
    });
  }

  /**
   * Scores the catalogue for what comes next after `history`.
   *
   * `history` is item rows in time order, oldest first. Shorter than the window
   * is fine and normal — most sessions are.
   */
  predict(history: number[], semantic: Float32Array, count: number): Float32Array {
    if (!history.length) return new Float32Array(count);

    const window = history.slice(-SEQUENCE_LENGTH);
    const pad = SEQUENCE_LENGTH - window.length;

    const inputs = new Int32Array(SEQUENCE_LENGTH);
    for (let i = 0; i < window.length; i += 1) inputs[pad + i] = window[i];

    // Causal, and blind to the padding at the front.
    const attention = new Float32Array(SEQUENCE_LENGTH * SEQUENCE_LENGTH);
    for (let i = 0; i < SEQUENCE_LENGTH; i += 1) {
      for (let j = 0; j < SEQUENCE_LENGTH; j += 1) {
        attention[i * SEQUENCE_LENGTH + j] = j <= i && j >= pad ? 0 : MASKED;
      }
    }

    const rows = this.projected(semantic, count);

    return compute(this.tf, () => {
      const embedded = this.embed(rows, this.tf.tensor1d(inputs, "int32"), 1);
      const encoded = this.encode(
        embedded,
        this.tf.tensor3d(attention, [1, SEQUENCE_LENGTH, SEQUENCE_LENGTH]),
        1,
        0
      );

      // The last position is the one that has attended over the whole history.
      const last = this.tf
        .slice(encoded, [SEQUENCE_LENGTH - 1, 0], [1, this.dim]) as TF.Tensor2D;

      return this.tf
        .matMul(rows, last, false, true)
        .reshape([count])
        .dataSync() as Float32Array;
    });
  }

  /**
   * One gradient step over a batch of windows.
   *
   * Every position in every window is a training example — a window of length
   * twelve is eleven next-item predictions, not one. That multiplication is what
   * makes a transformer trainable on a history this short, and it is the reason
   * the loss is computed over the whole sequence rather than only its end.
   */
  train(batch: SequenceBatch, semantic: Float32Array, count: number): number {
    if (!batch.batch) return 0;
    this.dropCache();

    const B = batch.batch;
    const L = SEQUENCE_LENGTH;

    const loss = this.optimizer.minimize(
      () =>
        this.tf.tidy(() => {
          const rows = this.tf.matMul(
            this.tf.tensor2d(semantic, [count, this.semanticDim]),
            this.projection
          ) as TF.Tensor2D;

          const embedded = this.embed(rows, this.tf.tensor1d(batch.inputs, "int32"), B);
          const flat = this.encode(
            embedded,
            this.tf.tensor3d(batch.attention, [B, L, L]),
            B,
            0.15
          );

          const targets = this.tf.gather(
            rows,
            this.tf.tensor1d(batch.targets, "int32")
          ) as TF.Tensor2D;
          // Element-wise then summed, rather than a matmul: only the diagonal of
          // predictions-against-their-own-targets is wanted, and forming the
          // full (B·L)² product to read its diagonal is the classic way to turn
          // a cheap step into an out-of-memory error.
          const positive = this.tf.sum(this.tf.mul(flat, targets), 1) as TF.Tensor1D;

          const negatives = this.tf.gather(
            rows,
            this.tf.tensor1d(batch.negatives, "int32")
          ) as TF.Tensor2D;
          // One negative set shared by every position in the batch. Sampling
          // per position would be more faithful and costs a rank-4 tensor;
          // sharing costs a slightly correlated gradient and is the trade every
          // practical implementation makes.
          const against = this.tf.matMul(flat, negatives, false, true) as TF.Tensor2D;

          // log-sum-exp over [positive, negatives...] minus the positive: the
          // sampled softmax cross-entropy, written so the positive is never
          // duplicated into the negative set.
          const all = this.tf.concat(
            [positive.reshape([B * L, 1]) as TF.Tensor2D, against],
            1
          ) as TF.Tensor2D;
          const perPosition = this.tf.sub(this.tf.logSumExp(all, 1), positive) as TF.Tensor1D;

          // Padding positions and the final position of each window have no
          // target; including them would train the model to predict item 0.
          const mask = this.tf.tensor1d(batch.mask);
          return this.tf.div(
            this.tf.sum(this.tf.mul(perPosition, mask)),
            this.tf.maximum(this.tf.sum(mask), 1)
          ) as TF.Scalar;
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

/**
 * Turns one history into overlapping training windows.
 *
 * Sliding rather than chunking: a history of forty items chunked into windows of
 * twenty-four gives two examples, and slid gives sixteen. The overlap correlates
 * them, which costs some effective sample size — and on a device with a few
 * dozen interactions in total, sixteen correlated examples beat two independent
 * ones by a distance.
 */
export function buildSequenceBatch(
  sequence: number[],
  sampleNegatives: (count: number) => Int32Array,
  maxWindows = 32
): SequenceBatch | null {
  if (sequence.length < 3) return null;

  const L = SEQUENCE_LENGTH;
  const windows: number[][] = [];
  // Every prefix ending at `end` is a session as it stood at that moment.
  for (let end = sequence.length; end >= 3; end -= 1) {
    windows.push(sequence.slice(Math.max(0, end - L - 1), end));
    if (windows.length >= maxWindows) break;
  }

  const B = windows.length;
  const inputs = new Int32Array(B * L);
  const targets = new Int32Array(B * L);
  const mask = new Float32Array(B * L);
  const attention = new Float32Array(B * L * L);

  windows.forEach((window, b) => {
    // Input is the window minus its last item; the targets are the window
    // shifted by one, so position t predicts what actually came after it.
    const source = window.slice(0, -1);
    const following = window.slice(1);
    const pad = L - source.length;

    for (let i = 0; i < source.length; i += 1) {
      inputs[b * L + pad + i] = source[i];
      targets[b * L + pad + i] = following[i];
      mask[b * L + pad + i] = 1;
    }

    for (let i = 0; i < L; i += 1) {
      for (let j = 0; j < L; j += 1) {
        attention[b * L * L + i * L + j] = j <= i && j >= pad ? 0 : MASKED;
      }
    }
  });

  return {
    inputs,
    targets,
    mask,
    attention,
    negatives: sampleNegatives(NEGATIVES),
    batch: B,
  };
}
