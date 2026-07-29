import { gaussianMatrix, jacobiEigen, normalizeRows, symmetricFrom } from "./linalg";
import { bigrams, bucketOf, charGrams, tokenize } from "./text";
import { compute, type Tf } from "./tf";
import type { CorpusItem } from "./types";

/**
 * Dense semantic embeddings for the catalogue, computed in the browser.
 *
 * The obvious way to get sentence embeddings in a browser is to download a
 * pretrained encoder. Universal Sentence Encoder Lite is about 25MB — more than
 * this entire application — and it would still know nothing about *this*
 * catalogue: that these two shows share an audience, that this genre label is
 * used the way another app would use a different one. It is a lot of bytes to
 * spend on general English when the interesting structure is local.
 *
 * So the embeddings are learned from the catalogue itself, by latent semantic
 * analysis: build a weighted term-document matrix, take its truncated SVD, and
 * use the left singular vectors as coordinates. Two titles end up close when
 * they are described in overlapping language — not because they share a word,
 * but because the words they do use co-occur across the rest of the catalogue.
 * That is what lets "heist" reach a synopsis that only ever says "robbery".
 *
 * Three things make it affordable:
 *
 *   The hashing trick. Terms go into a fixed number of buckets instead of a
 *   vocabulary, so the matrix width is a constant we choose rather than however
 *   many distinct words the catalogue happens to contain. Signed hashing keeps
 *   collisions from biasing the result — see `bucketOf`.
 *
 *   Randomised range finding. A full SVD of an n×D matrix is out of the
 *   question; sketching it down to r columns with a random Gaussian projection
 *   and decomposing *that* recovers the top-k factors to within a few percent,
 *   which is far below the noise floor of the thing being modelled.
 *
 *   No QR. The textbook algorithm orthonormalises the sketch with a QR
 *   factorisation, and TensorFlow.js implements that as a loop of Householder
 *   reflections that is the slowest step by an order of magnitude. Löwdin
 *   orthogonalisation gets the same basis from an r×r symmetric inverse square
 *   root — one small eigendecomposition, which `linalg.ts` already has.
 */

/** Feature buckets. A power of two so the modulo is a mask. */
const DIMENSIONS = 2048;

/** Latent dimensions kept. */
const RANK = 96;

/** Extra sketch columns. Oversampling is what makes the tail factors accurate. */
const OVERSAMPLE = 16;

/** Subspace iterations. Two is the standard recommendation and it shows. */
const POWER_ITERATIONS = 2;

/** Rows per GPU upload, so a large catalogue never needs one huge texture. */
const CHUNK = 2048;

/**
 * How much each part of an item contributes.
 *
 * Genres outweigh everything because they are the catalogue's own statement
 * about what a title *is*, written by someone who watched it, in a vocabulary
 * of a few dozen words that every item shares. An overview is longer and richer
 * but also noisier — it is where the plot lives, and two unrelated films can
 * both be about a family in a house.
 */
const WEIGHTS = {
  genre: 4.0,
  titleWord: 3.0,
  titleBigram: 2.2,
  titleGram: 0.7,
  tag: 2.0,
  overviewWord: 1.0,
  overviewBigram: 0.55,
  facet: 1.2,
};

/** Terms and their raw weights for one item, before idf. */
function featuresOf(item: CorpusItem): Map<string, number> {
  const features = new Map<string, number>();
  const add = (term: string, weight: number) => {
    if (!term) return;
    features.set(term, (features.get(term) || 0) + weight);
  };

  const titleTokens = tokenize(item.title);
  for (const token of titleTokens) add(`t:${token}`, WEIGHTS.titleWord);
  for (const gram of bigrams(titleTokens)) add(`tb:${gram}`, WEIGHTS.titleBigram);
  // Character grams of the title put franchise entries near each other even
  // when they share no whole word — "Spider-Man" and "Spiderman", a numbered
  // sequel, a subtitle that replaced the original words entirely.
  for (const gram of charGrams(item.title, 4, 4)) add(`g:${gram}`, WEIGHTS.titleGram);

  for (const genre of item.genres) {
    for (const token of tokenize(genre)) add(`gn:${token}`, WEIGHTS.genre);
  }
  for (const tag of item.tags) {
    for (const token of tokenize(tag)) add(`tg:${token}`, WEIGHTS.tag);
  }

  const overviewTokens = tokenize(item.overview);
  for (const token of overviewTokens) add(`o:${token}`, WEIGHTS.overviewWord);
  for (const gram of bigrams(overviewTokens)) add(`ob:${gram}`, WEIGHTS.overviewBigram);

  // Facets as terms, so era and format participate in the latent space rather
  // than being bolted on as separate features later. A viewer who watches
  // eighties horror is expressing one taste, not two.
  add(`k:${item.kind}`, WEIGHTS.facet);
  if (item.year) add(`d:${Math.floor(item.year / 10) * 10}`, WEIGHTS.facet);
  if (item.status) add(`s:${item.status}`, WEIGHTS.facet * 0.5);

  return features;
}

/**
 * Hashes a feature map into a dense row.
 *
 * `1 + log(weight)` rather than the weight itself: raw counts let a synopsis
 * that repeats a word five times dominate one that says it once, and the log is
 * the standard damping. idf then discounts the terms every item has — without
 * it, "series" and "the" would define the first singular direction and the
 * whole space would be a length measurement.
 */
function hashRow(
  features: Map<string, number>,
  idf: Map<string, number>,
  into: Float32Array,
  offset: number
): void {
  for (const [term, weight] of features) {
    const scale = (1 + Math.log(weight)) * (idf.get(term) ?? 1);
    const { index, sign } = bucketOf(term, DIMENSIONS);
    into[offset + index] += sign * scale;
  }
}

export interface SemanticSpace {
  /** n × rank, L2-normalised, row-major. */
  embeddings: Float32Array;
  rank: number;
  count: number;
  /** Relative weight of each latent direction, for diagnostics. */
  spectrum: Float32Array;
  /** Projects a hashed query row into the latent space. */
  project(row: Float32Array): Float32Array;
  /** Turns free text into a latent vector, using the same features as the index. */
  encode(text: string): Float32Array;
}

/** X · R, in row chunks, so no single tensor holds the whole catalogue. */
function multiplyRight(
  tf: Tf,
  matrix: Float32Array,
  rows: number,
  cols: number,
  right: Float32Array,
  rightCols: number
): Float32Array {
  const out = new Float32Array(rows * rightCols);
  const R = tf.tensor2d(right, [cols, rightCols]);

  for (let start = 0; start < rows; start += CHUNK) {
    const height = Math.min(CHUNK, rows - start);
    const slice = matrix.subarray(start * cols, (start + height) * cols);
    const block = compute(tf, () => {
      const X = tf.tensor2d(slice as Float32Array, [height, cols]);
      return tf.matMul(X, R).dataSync() as Float32Array;
    });
    out.set(block, start * rightCols);
  }

  R.dispose();
  return out;
}

/** Xᵀ · Y, accumulated over the same row chunks. */
function multiplyLeftTransposed(
  tf: Tf,
  matrix: Float32Array,
  rows: number,
  cols: number,
  right: Float32Array,
  rightCols: number
): Float32Array {
  let accumulator = tf.zeros([cols, rightCols]) as import("@tensorflow/tfjs").Tensor2D;

  for (let start = 0; start < rows; start += CHUNK) {
    const height = Math.min(CHUNK, rows - start);
    const next = compute(tf, () => {
      const X = tf.tensor2d(matrix.subarray(start * cols, (start + height) * cols) as Float32Array, [
        height,
        cols,
      ]);
      const Y = tf.tensor2d(right.subarray(start * rightCols, (start + height) * rightCols) as Float32Array, [
        height,
        rightCols,
      ]);
      return tf.add(accumulator, tf.matMul(X, Y, true, false));
    }) as import("@tensorflow/tfjs").Tensor2D;

    accumulator.dispose();
    accumulator = next;
  }

  const out = accumulator.dataSync() as Float32Array;
  accumulator.dispose();
  return out;
}

/**
 * Orthonormal basis for the columns of Y, by Löwdin's symmetric method.
 *
 * Q = Y (YᵀY)^{-1/2}. The Gram matrix is r×r — a hundred or so on a side — so
 * its inverse square root is one Jacobi decomposition, against a QR that would
 * run r sequential Householder passes over the full n×r sketch.
 *
 * Directions whose eigenvalue has collapsed are dropped rather than inverted.
 * A catalogue with fewer items than sketch columns, or one where whole genres
 * are duplicated, produces a rank-deficient Gram matrix, and 1/sqrt(≈0) is how
 * that becomes NaN in every embedding at once.
 */
function orthonormalize(
  tf: Tf,
  Y: Float32Array,
  rows: number,
  cols: number
): { basis: Float32Array; cols: number } {
  const gram = multiplyLeftTransposed(tf, Y, rows, cols, Y, cols);
  const { values, vectors } = jacobiEigen(symmetricFrom(gram, cols));

  const largest = values[0] || 1;
  const keep: number[] = [];
  for (let j = 0; j < cols; j += 1) {
    if (values[j] > largest * 1e-7) keep.push(j);
  }
  if (!keep.length) return { basis: Y, cols };

  // W Λ^{-1/2} — the transform from Y's columns to an orthonormal set.
  const transform = new Float32Array(cols * keep.length);
  keep.forEach((j, target) => {
    const inverse = 1 / Math.sqrt(values[j]);
    for (let i = 0; i < cols; i += 1) {
      transform[i * keep.length + target] = vectors[i * cols + j] * inverse;
    }
  });

  // Löwdin proper is Y W Λ^{-1/2} Wᵀ; the trailing Wᵀ is an orthogonal rotation
  // within the subspace and the SVD that follows is invariant to it, so it is
  // left off.
  return {
    basis: multiplyRight(tf, Y, rows, cols, transform, keep.length),
    cols: keep.length,
  };
}

/**
 * Builds the latent space.
 *
 * Returns synchronously once the caller has TensorFlow in hand; on a catalogue
 * of a few thousand titles the whole thing is well under a second on WebGL, and
 * the engine runs it inside a worker anyway.
 */
export function buildSemanticSpace(tf: Tf, items: CorpusItem[]): SemanticSpace {
  const n = items.length;
  // Truncation is where the "latent" in latent semantic analysis happens.
  // Keeping as many dimensions as there are items makes the decomposition a
  // rotation of the original feature space and nothing else — every idiosyncrasy
  // of every synopsis is preserved, including the ones that make two titles look
  // different when they are not. A third of the catalogue is the usual rule of
  // thumb for where the discarded directions stop carrying signal.
  const rank = Math.max(4, Math.min(RANK, Math.ceil(n / 3)));
  const sketchCols = Math.min(rank + OVERSAMPLE, Math.max(rank, n));

  // --- term-document matrix -------------------------------------------------

  const perItem = items.map(featuresOf);

  const documentFrequency = new Map<string, number>();
  for (const features of perItem) {
    for (const term of features.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, df] of documentFrequency) {
    idf.set(term, Math.log((n + 1) / (df + 0.5)));
  }

  const X = new Float32Array(n * DIMENSIONS);
  for (let i = 0; i < n; i += 1) hashRow(perItem[i], idf, X, i * DIMENSIONS);
  // Row normalisation before the decomposition, so a long synopsis does not get
  // a longer vector and therefore a larger share of every singular direction.
  normalizeRows(X, n, DIMENSIONS);

  // --- randomised range finding ---------------------------------------------

  let Y = multiplyRight(
    tf,
    X,
    n,
    DIMENSIONS,
    gaussianMatrix(DIMENSIONS, sketchCols),
    sketchCols
  );
  let sketch = sketchCols;

  for (let iteration = 0; iteration < POWER_ITERATIONS; iteration += 1) {
    // Re-orthonormalising between iterations is not optional. Each multiplication
    // by XᵀX amplifies the leading direction, and in float32 every column
    // collapses onto it within two or three passes if left alone — the sketch
    // stops spanning anything and the tail factors come back as noise.
    const orthonormal = orthonormalize(tf, Y, n, sketch);
    Y = orthonormal.basis;
    sketch = orthonormal.cols;

    const projected = multiplyLeftTransposed(tf, X, n, DIMENSIONS, Y, sketch);
    Y = multiplyRight(tf, X, n, DIMENSIONS, projected, sketch);
  }

  const orthonormal = orthonormalize(tf, Y, n, sketch);
  const Q = orthonormal.basis;
  sketch = orthonormal.cols;

  // --- decompose the sketch -------------------------------------------------

  // B = Qᵀ X, sketch × DIMENSIONS. Small in the dimension that matters.
  const B = multiplyLeftTransposed(tf, Q, n, sketch, X, DIMENSIONS);
  const Bt = new Float32Array(sketch * DIMENSIONS);
  for (let i = 0; i < DIMENSIONS; i += 1) {
    for (let j = 0; j < sketch; j += 1) Bt[i * sketch + j] = B[j * DIMENSIONS + i];
  }

  // C = B Bᵀ shares its eigenvectors with B's left singular vectors, and its
  // eigenvalues are the squared singular values.
  const C = multiplyLeftTransposed(tf, Bt, DIMENSIONS, sketch, Bt, sketch);
  const { values, vectors } = jacobiEigen(symmetricFrom(C, sketch));

  const kept = Math.min(rank, sketch);
  const spectrum = new Float32Array(kept);
  for (let j = 0; j < kept; j += 1) spectrum[j] = Math.sqrt(Math.max(0, values[j]));

  // V = Bᵀ U Λ^{-1/2}: the right singular vectors, i.e. the map from feature
  // space into the latent space. This is what a query gets projected through.
  const scaled = new Float32Array(sketch * kept);
  for (let j = 0; j < kept; j += 1) {
    const inverse = spectrum[j] > 1e-6 ? 1 / spectrum[j] : 0;
    for (let i = 0; i < sketch; i += 1) scaled[i * kept + j] = vectors[i * sketch + j] * inverse;
  }
  const V = multiplyRight(tf, Bt, DIMENSIONS, sketch, scaled, kept);

  // Item coordinates. X V = U Σ — the classic LSA document representation, kept
  // un-whitened so the leading directions still carry more weight, then
  // normalised so every comparison downstream is a plain dot product.
  const embeddings = multiplyRight(tf, X, n, DIMENSIONS, V, kept);
  normalizeRows(embeddings, n, kept);

  const project = (row: Float32Array): Float32Array => {
    const out = new Float32Array(kept);
    for (let d = 0; d < DIMENSIONS; d += 1) {
      const value = row[d];
      if (value === 0) continue;
      const base = d * kept;
      for (let j = 0; j < kept; j += 1) out[j] += value * V[base + j];
    }
    normalizeRows(out, 1, kept);
    return out;
  };

  return {
    embeddings,
    rank: kept,
    count: n,
    spectrum,

    project,

    /**
     * Free text into the latent space.
     *
     * A query is encoded as an item with only a title would be — same feature
     * prefixes, same hashing, same idf. Using different features on the two
     * sides is the classic way to build a semantic search that returns nothing:
     * the vectors live in the same number of dimensions but not in the same
     * space, and the cosine between them is noise that looks like a score.
     */
    encode(text: string): Float32Array {
      const features = new Map<string, number>();
      const tokens = tokenize(text);

      for (const token of tokens) {
        features.set(`t:${token}`, WEIGHTS.titleWord);
        // The same word is looked up as a genre, a tag and a synopsis term,
        // because a searcher does not know which field the catalogue put it in.
        features.set(`gn:${token}`, WEIGHTS.genre * 0.8);
        features.set(`tg:${token}`, WEIGHTS.tag * 0.8);
        features.set(`o:${token}`, WEIGHTS.overviewWord * 1.2);
      }
      for (const gram of bigrams(tokens)) {
        features.set(`tb:${gram}`, WEIGHTS.titleBigram);
        features.set(`ob:${gram}`, WEIGHTS.overviewBigram);
      }
      for (const gram of charGrams(text, 4, 4)) {
        features.set(`g:${gram}`, WEIGHTS.titleGram);
      }

      const row = new Float32Array(DIMENSIONS);
      hashRow(features, idf, row, 0);
      normalizeRows(row, 1, DIMENSIONS);
      return project(row);
    },
  };
}
