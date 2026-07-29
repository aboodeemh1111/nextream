/**
 * TensorFlow.js, loaded on demand.
 *
 * The library is about a megabyte of parsed JavaScript and it registers a WebGL
 * backend on import — neither is something to spend on a viewer who opened the
 * page to press Resume. So nothing here is imported statically: the first call
 * that actually needs a tensor pays for the load, everything before that runs
 * on the plain-JavaScript paths in `text.ts` and `bm25.ts`.
 *
 * Backend order is WebGL, then CPU. WebGL is roughly two orders of magnitude
 * faster for the matrix multiply that retrieval reduces to, but it fails in
 * ways CPU does not — a lost context, a driver blocklist, a headless test
 * environment — and every one of those has to degrade to a slower recommender
 * rather than to a broken page.
 */

import type * as TF from "@tensorflow/tfjs";

export type Tf = typeof TF;

export type BackendName = "webgl" | "cpu";

let loading: Promise<Tf> | null = null;
let loaded: Tf | null = null;
let backend: BackendName | null = null;

export function activeBackend(): BackendName | null {
  return backend;
}

/**
 * Loads TensorFlow and settles on a backend.
 *
 * Concurrent callers share one promise: boot, the first search and the first
 * home render all race for this, and three parallel imports of a megabyte would
 * be three times the parse cost for one result.
 */
export function loadTf(): Promise<Tf> {
  if (loaded) return Promise.resolve(loaded);
  if (loading) return loading;

  loading = (async () => {
    const tf = (await import("@tensorflow/tfjs")) as unknown as Tf;

    // Half-precision textures are tempting here and must not be used. They are
    // fine for the forward pass — every value in it is a normalised feature or a
    // cosine — but this backend also runs backpropagation, and float16 carries
    // about three decimal digits. Gradients that small round to zero, the ones
    // that are not small overflow at 65504, and the result is a model whose loss
    // climbs into the thousands while every individual operation looks correct.
    // Inference speed is not the bottleneck; a diverged ranker is.
    //
    // Deleting textures eagerly rather than pooling them, on the other hand, is
    // worth it: this runs alongside a video element that wants the GPU memory
    // more than the recommender does.
    tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD", 0);

    for (const candidate of ["webgl", "cpu"] as const) {
      try {
        if (await tf.setBackend(candidate)) {
          await tf.ready();
          backend = candidate;
          break;
        }
      } catch {
        // Try the next one. A backend that throws on selection is exactly the
        // case this loop exists for.
      }
    }

    if (!backend) {
      await tf.setBackend("cpu");
      await tf.ready();
      backend = "cpu";
    }

    loaded = tf;
    return tf;
  })();

  return loading;
}

/**
 * Runs `fn` inside a tidy scope and returns plain numbers.
 *
 * `tf.tidy` cannot wrap an async function — it disposes on return, and an
 * async return is a promise, so every intermediate tensor leaks. Almost
 * everything in this module is synchronous tensor work that ends in a
 * `dataSync`, which is what this is shaped for.
 */
export function compute<T>(tf: Tf, fn: () => T): T {
  return tf.tidy(fn as () => TF.TensorContainer) as T;
}

/**
 * Yields between gradient steps.
 *
 * `tf.nextFrame` alone is the obvious choice and it deadlocks. It resolves on
 * `requestAnimationFrame`, which a browser does not fire for a tab that is not
 * compositing — a background tab, a hidden pane, a minimised window. A training
 * loop that awaits it there stops between two steps and stays stopped, holding
 * the promise every later call to `train` is waiting on, so training never
 * resumes even after the tab comes back.
 *
 * Racing it against a timer keeps the good behaviour — in a visible tab the
 * frame wins and steps land between paints, where they cost nothing visible —
 * and turns the background case into slow progress instead of a wedge.
 */
export function breathe(tf: Tf): Promise<void> {
  return Promise.race([
    tf.nextFrame(),
    new Promise<void>((resolve) => setTimeout(resolve, 40)),
  ]);
}

