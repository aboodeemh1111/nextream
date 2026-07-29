import type * as TF from "@tensorflow/tfjs";
import { kvGet, kvSet } from "../store";
import type { Tf } from "../tf";

/**
 * Weights, and getting them back after a reload.
 *
 * The models here are written against raw `tf.variable`s rather than
 * `tf.LayersModel`, so `model.save()` and the `indexeddb://` handler are not
 * available. That is a deliberate trade: causal masking, in-batch sampled
 * softmax with a popularity correction, and a listwise loss are all things the
 * Layers API makes harder rather than easier, and the price is writing the two
 * dozen lines below.
 *
 * Restoring is shape-checked rather than trusted. The stored weights outlive the
 * code that wrote them — a viewer keeps IndexedDB across deploys — so a build
 * that widens a layer will find last week's tensors waiting for it. Loading them
 * anyway throws deep inside a matmul with a message about dimensions that names
 * nothing the reader can act on; refusing and starting fresh costs one training
 * pass.
 */

export interface Param {
  name: string;
  variable: TF.Variable;
  shape: number[];
}

export class ParamSet {
  readonly params: Param[] = [];

  constructor(
    private readonly tf: Tf,
    readonly namespace: string
  ) {}

  /**
   * A weight matrix under Glorot initialisation.
   *
   * Scaling by fan-in and fan-out keeps activation variance roughly constant
   * through the stack. It matters more here than usual: these networks train on
   * a few hundred examples in a handful of passes, and there is no budget for
   * the first several hundred steps to be spent recovering from a bad scale.
   */
  weight(name: string, shape: number[], gain = 1): TF.Variable {
    const [fanIn, fanOut] = shape.length === 2 ? shape : [shape[0], shape[0]];
    const limit = gain * Math.sqrt(6 / (fanIn + fanOut));
    // Seeded, so a reload that fails to restore lands in the same starting
    // point rather than a different random model each time — which would make
    // "did that change help" impossible to answer.
    const variable = this.tf.variable(
      this.tf.randomUniform(shape, -limit, limit, "float32", this.seedFor(name)),
      true,
      `${this.namespace}/${name}`
    );
    this.params.push({ name, variable, shape });
    return variable;
  }

  bias(name: string, size: number): TF.Variable {
    const variable = this.tf.variable(this.tf.zeros([size]), true, `${this.namespace}/${name}`);
    this.params.push({ name, variable, shape: [size] });
    return variable;
  }

  private seedFor(name: string): number {
    let hash = 2166136261;
    const key = `${this.namespace}/${name}`;
    for (let i = 0; i < key.length; i += 1) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash % 100000;
  }

  get trainable(): TF.Variable[] {
    return this.params.map((param) => param.variable);
  }

  async save(): Promise<void> {
    const payload: Record<string, { shape: number[]; data: Float32Array }> = {};
    for (const param of this.params) {
      payload[param.name] = {
        shape: param.shape,
        data: param.variable.dataSync() as Float32Array,
      };
    }
    await kvSet(`model.${this.namespace}`, payload);
  }

  /** True when a complete, shape-compatible set was found and applied. */
  async restore(): Promise<boolean> {
    const payload = await kvGet<Record<string, { shape: number[]; data: Float32Array }>>(
      `model.${this.namespace}`
    );
    if (!payload) return false;

    for (const param of this.params) {
      const stored = payload[param.name];
      if (!stored || stored.shape.join() !== param.shape.join()) return false;
    }

    for (const param of this.params) {
      const stored = payload[param.name];
      const tensor = this.tf.tensor(stored.data, param.shape);
      param.variable.assign(tensor);
      tensor.dispose();
    }
    return true;
  }

  dispose(): void {
    for (const param of this.params) param.variable.dispose();
    this.params.length = 0;
  }
}

/**
 * GELU.
 *
 * ReLU's dead-unit problem is a real risk at this scale: a unit that a bad step
 * pushes negative for every one of a few hundred examples receives no gradient
 * again, and with a network this small losing four of forty-eight hidden units
 * is visible in the ranking. GELU has a gradient everywhere.
 *
 * The tanh approximation rather than the exact erf form — TensorFlow.js has no
 * erf kernel on WebGL, and the difference is below 1e-3.
 */
export function gelu(tf: Tf, x: TF.Tensor): TF.Tensor {
  return tf.tidy(() => {
    const inner = tf.mul(
      Math.sqrt(2 / Math.PI),
      tf.add(x, tf.mul(0.044715, tf.pow(x, 3)))
    );
    return tf.mul(tf.mul(0.5, x), tf.add(1, tf.tanh(inner)));
  });
}

/** Row-wise L2 normalisation, so a dot product is a cosine. */
export function l2Normalize(tf: Tf, x: TF.Tensor2D): TF.Tensor2D {
  return tf.tidy(() => {
    const norm = tf.sqrt(tf.maximum(tf.sum(tf.square(x), 1, true), 1e-12));
    return tf.div(x, norm) as TF.Tensor2D;
  }) as TF.Tensor2D;
}

/**
 * Layer normalisation over the last axis.
 *
 * Without learned scale and shift. They add parameters for a model this size to
 * overfit with, and the transformer block below uses this purely to keep the
 * residual stream from drifting — which the normalisation alone does.
 */
export function layerNorm(tf: Tf, x: TF.Tensor): TF.Tensor {
  return tf.tidy(() => {
    const moments = tf.moments(x, -1, true);
    return tf.div(tf.sub(x, moments.mean), tf.sqrt(tf.add(moments.variance, 1e-6)));
  });
}
