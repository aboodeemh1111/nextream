/**
 * The one piece of linear algebra TensorFlow.js does not ship.
 *
 * `tf.linalg` has QR but no SVD and no symmetric eigendecomposition, and the
 * semantic embeddings in `semantic.ts` are a truncated SVD. The way around it is
 * the standard one: reduce the problem to a small dense symmetric matrix on the
 * GPU, then solve *that* here.
 *
 * "Small" is the whole reason this is affordable. Randomised range finding turns
 * an n×D problem — thousands of titles by thousands of features — into an r×r
 * one where r is the rank being kept plus a little oversampling, so this runs on
 * something like 112×112. Cyclic Jacobi on that is a few milliseconds and a page
 * of code; a general SVD would be neither.
 */

/** Row-major dense square matrix. */
export interface Symmetric {
  size: number;
  data: Float64Array;
}

export function symmetricFrom(values: ArrayLike<number>, size: number): Symmetric {
  return { size, data: Float64Array.from(values) };
}

export interface Eigen {
  /** Descending. */
  values: Float64Array;
  /** Column j is the eigenvector for values[j], stored row-major, size×size. */
  vectors: Float64Array;
}

/**
 * Cyclic Jacobi eigendecomposition of a real symmetric matrix.
 *
 * Jacobi rather than the usual tridiagonal-plus-QL: it is about twice the
 * arithmetic, and in exchange it is numerically well behaved on the nearly
 * singular matrices this actually gets — a catalogue with a few hundred titles
 * and a thousand feature buckets produces a Gram matrix whose tail eigenvalues
 * are indistinguishable from zero, and QL implementations tend to return noise
 * or NaN there rather than the zeros that are the correct answer.
 *
 * Double precision throughout, unlike everything else in this module. The
 * rotations are a long product and float32 loses orthogonality across enough of
 * them for the resulting vectors to stop being a basis.
 */
export function jacobiEigen(input: Symmetric, sweeps = 24, tolerance = 1e-10): Eigen {
  const n = input.size;
  const a = Float64Array.from(input.data);
  const v = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) v[i * n + i] = 1;

  for (let sweep = 0; sweep < sweeps; sweep += 1) {
    // Sum of squares off the diagonal: the quantity Jacobi drives to zero, and
    // the only honest convergence test.
    let off = 0;
    for (let p = 0; p < n; p += 1) {
      for (let q = p + 1; q < n; q += 1) off += a[p * n + q] * a[p * n + q];
    }
    if (off <= tolerance) break;

    for (let p = 0; p < n - 1; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        const apq = a[p * n + q];
        if (Math.abs(apq) < 1e-14) continue;

        // The rotation that zeroes (p,q). Solved through `t` rather than the
        // angle directly: the closed form for tan avoids the catastrophic
        // cancellation that (app - aqq) suffers when the two are close, which
        // is precisely the degenerate case that shows up in a Gram matrix with
        // repeated eigenvalues.
        const theta = (a[q * n + q] - a[p * n + p]) / (2 * apq);
        const t =
          Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;

        for (let k = 0; k < n; k += 1) {
          const akp = a[k * n + p];
          const akq = a[k * n + q];
          a[k * n + p] = c * akp - s * akq;
          a[k * n + q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k += 1) {
          const apk = a[p * n + k];
          const aqk = a[q * n + k];
          a[p * n + k] = c * apk - s * aqk;
          a[q * n + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k += 1) {
          const vkp = v[k * n + p];
          const vkq = v[k * n + q];
          v[k * n + p] = c * vkp - s * vkq;
          v[k * n + q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort(
    (x, y) => a[y * n + y] - a[x * n + x]
  );

  const values = new Float64Array(n);
  const vectors = new Float64Array(n * n);
  for (let j = 0; j < n; j += 1) {
    const from = order[j];
    values[j] = a[from * n + from];
    for (let i = 0; i < n; i += 1) vectors[i * n + j] = v[i * n + from];
  }

  return { values, vectors };
}

/**
 * Deterministic standard-normal samples.
 *
 * Two properties matter and `Math.random` has neither. The projection has to be
 * reproducible — a viewer who reloads must land in the same embedding space as
 * the model weights cached in IndexedDB were trained in, or every stored vector
 * is meaningless. And it has to be Gaussian: Johnson-Lindenstrauss says a random
 * projection preserves distances, and the proof wants normal entries, not
 * uniform ones.
 *
 * Box-Muller over a small xorshift generator gives both.
 */
export function gaussianMatrix(rows: number, cols: number, seed = 0x5eed1234): Float32Array {
  const out = new Float32Array(rows * cols);
  let state = seed >>> 0 || 1;

  const next = () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    // Never exactly zero: Math.log(0) in the transform below is -Infinity.
    return (state + 1) / 4294967297;
  };

  for (let i = 0; i < out.length; i += 2) {
    const u1 = next();
    const u2 = next();
    const radius = Math.sqrt(-2 * Math.log(u1));
    out[i] = radius * Math.cos(2 * Math.PI * u2);
    if (i + 1 < out.length) out[i + 1] = radius * Math.sin(2 * Math.PI * u2);
  }

  return out;
}

/** In-place L2 normalisation of each row of a row-major matrix. */
export function normalizeRows(data: Float32Array, rows: number, cols: number): Float32Array {
  for (let r = 0; r < rows; r += 1) {
    const base = r * cols;
    let sum = 0;
    for (let c = 0; c < cols; c += 1) sum += data[base + c] * data[base + c];

    // A row of zeros is a real case — an item whose every feature collided away,
    // or a query of nothing but stopwords. Leaving it as zeros makes its cosine
    // similarity to everything zero, which is the right answer; dividing would
    // make it NaN, which poisons the whole score vector it lands in.
    const norm = Math.sqrt(sum);
    if (norm < 1e-8) continue;
    for (let c = 0; c < cols; c += 1) data[base + c] /= norm;
  }
  return data;
}

/** Cosine similarity of two already-normalised vectors, i.e. their dot product. */
export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) sum += a[i] * b[i];
  return sum;
}
