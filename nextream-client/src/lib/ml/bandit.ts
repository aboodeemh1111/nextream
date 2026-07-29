import { kvGet, kvSet } from "./store";

/**
 * Deciding *how* to rank, and learning from whether it worked.
 *
 * Everything upstream produces scores. Something still has to choose what kind
 * of row this should be — more of what they already love, the next episode in a
 * thread they are pulling, something new, something popular — and that choice is
 * not a scoring problem. It is a decision under uncertainty, made repeatedly,
 * where the only way to find out whether an option is good is to try it.
 *
 * Which makes it a contextual bandit, and LinUCB is the right one: it assumes
 * reward is linear in a context vector, keeps a confidence interval around each
 * arm's estimate, and picks the arm with the highest *upper* bound rather than
 * the highest estimate. An arm that has never been tried has a wide interval and
 * gets tried; one that has been tried and failed narrows and stops being chosen.
 * Optimism in the face of uncertainty, which is exploration that stops on its
 * own instead of a fixed random percentage that never does.
 *
 * The inverse covariance is maintained directly through Sherman-Morrison rather
 * than by inverting a matrix each round. Updates are rank-one by construction —
 * one observation at a time — and the closed form for that is exact, so this is
 * not an approximation, only an arrangement that avoids an inversion.
 */

/**
 * The strategies. Each is a set of weights on the blended score plus how much
 * spread and risk to accept, and the bandit's whole job is learning which of
 * these suits this viewer at this moment.
 */
export const ARMS = [
  {
    key: "familiar",
    label: "More of what you like",
    weights: { affinity: 1.35, neural: 1.25, sequential: 0.6, popularity: 0.5, freshness: 0.3 },
    explore: 0.15,
    diversity: 0.25,
  },
  {
    key: "continuation",
    label: "Where you left off",
    weights: { affinity: 0.8, neural: 0.9, sequential: 1.8, popularity: 0.3, freshness: 0.3 },
    explore: 0.1,
    diversity: 0.15,
  },
  {
    key: "discovery",
    label: "Something new for you",
    weights: { affinity: 0.75, neural: 1.0, sequential: 0.4, popularity: 0.35, freshness: 1.2 },
    explore: 0.55,
    diversity: 0.65,
  },
  {
    key: "popular",
    label: "What everyone is watching",
    weights: { affinity: 0.45, neural: 0.6, sequential: 0.2, popularity: 1.6, freshness: 0.7 },
    explore: 0.2,
    diversity: 0.4,
  },
  {
    key: "adventurous",
    label: "Off the beaten path",
    weights: { affinity: 0.9, neural: 0.8, sequential: 0.3, popularity: -0.5, freshness: 0.9 },
    explore: 0.85,
    diversity: 0.8,
  },
] as const;

export type ArmKey = (typeof ARMS)[number]["key"];
export type Arm = (typeof ARMS)[number];

/**
 * Context features, in order.
 *
 * Deliberately few. LinUCB's confidence term grows with dimension, so every
 * feature added is exploration spent — and with the handful of decisions a
 * single device generates in a week, a wide context never leaves the exploring
 * phase at all.
 */
export const CONTEXT = [
  "bias",
  "profileStrength",
  "sessionDepth",
  "evening",
  "weekend",
  "isSearch",
  "hasSequence",
] as const;

const DIMENSION = CONTEXT.length;

/** Confidence width. Higher explores longer. */
const ALPHA = 0.65;

/** Older evidence decays, so a taste that changed is not argued with forever. */
const FORGET = 0.995;

interface ArmState {
  /** Inverse covariance, DIMENSION × DIMENSION, row-major. */
  inverse: Float64Array;
  /** Reward-weighted context sum. */
  b: Float64Array;
  pulls: number;
  reward: number;
}

function identity(scale: number): Float64Array {
  const out = new Float64Array(DIMENSION * DIMENSION);
  for (let i = 0; i < DIMENSION; i += 1) out[i * DIMENSION + i] = scale;
  return out;
}

export interface BanditContext {
  profileStrength: number;
  sessionDepth: number;
  hour: number;
  day: number;
  isSearch: boolean;
  hasSequence: boolean;
}

export function contextVector(input: BanditContext): Float64Array {
  const x = new Float64Array(DIMENSION);
  x[0] = 1;
  // Saturating rather than raw: the difference between five signals and fifty
  // is enormous, between five hundred and a thousand is nothing.
  x[1] = Math.min(1, input.profileStrength / 12);
  x[2] = Math.min(1, input.sessionDepth / 10);
  x[3] = input.hour >= 18 || input.hour < 2 ? 1 : 0;
  x[4] = input.day === 0 || input.day === 6 ? 1 : 0;
  x[5] = input.isSearch ? 1 : 0;
  x[6] = input.hasSequence ? 1 : 0;
  return x;
}

export class LinUcbBandit {
  private readonly arms = new Map<ArmKey, ArmState>();

  constructor() {
    for (const arm of ARMS) {
      this.arms.set(arm.key, {
        // Ridge prior: A = I, so A⁻¹ starts at I too.
        inverse: identity(1),
        b: new Float64Array(DIMENSION),
        pulls: 0,
        reward: 0,
      });
    }
  }

  /** A⁻¹ x, the shared quantity in both the estimate and the confidence width. */
  private product(state: ArmState, x: Float64Array): Float64Array {
    const out = new Float64Array(DIMENSION);
    for (let i = 0; i < DIMENSION; i += 1) {
      let sum = 0;
      for (let j = 0; j < DIMENSION; j += 1) sum += state.inverse[i * DIMENSION + j] * x[j];
      out[i] = sum;
    }
    return out;
  }

  /** Score and confidence for every arm, for the insight panel as well as choice. */
  evaluate(x: Float64Array): Array<{ arm: Arm; estimate: number; bound: number; pulls: number }> {
    return ARMS.map((arm) => {
      const state = this.arms.get(arm.key)!;
      const Ax = this.product(state, x);

      // θ = A⁻¹ b, and the estimate is θᵀx = (A⁻¹x)ᵀb by symmetry of A⁻¹ —
      // which is why only one matrix-vector product is needed.
      let estimate = 0;
      for (let i = 0; i < DIMENSION; i += 1) estimate += Ax[i] * state.b[i];

      let variance = 0;
      for (let i = 0; i < DIMENSION; i += 1) variance += x[i] * Ax[i];

      return {
        arm,
        estimate,
        bound: estimate + ALPHA * Math.sqrt(Math.max(0, variance)),
        pulls: state.pulls,
      };
    });
  }

  select(x: Float64Array, allowed?: ArmKey[]): Arm {
    const scored = this.evaluate(x).filter(
      (entry) => !allowed || allowed.includes(entry.arm.key)
    );
    if (!scored.length) return ARMS[0];
    return scored.reduce((best, entry) => (entry.bound > best.bound ? entry : best)).arm;
  }

  /**
   * Records what an arm earned. Reward is 0-1.
   *
   * Sherman-Morrison: (A + xxᵀ)⁻¹ = A⁻¹ - (A⁻¹x)(A⁻¹x)ᵀ / (1 + xᵀA⁻¹x). Exact
   * for a rank-one update, which is what one observation is.
   */
  update(key: ArmKey, x: Float64Array, reward: number): void {
    const state = this.arms.get(key);
    if (!state) return;

    const Ax = this.product(state, x);
    let denominator = 1;
    for (let i = 0; i < DIMENSION; i += 1) denominator += x[i] * Ax[i];

    for (let i = 0; i < DIMENSION; i += 1) {
      for (let j = 0; j < DIMENSION; j += 1) {
        // The decay multiplies the *inverse*, which shrinks A itself and widens
        // every confidence interval a little on each update — the standard way
        // to keep a bandit responsive in a world that changes.
        state.inverse[i * DIMENSION + j] =
          (state.inverse[i * DIMENSION + j] - (Ax[i] * Ax[j]) / denominator) / FORGET;
      }
    }

    for (let i = 0; i < DIMENSION; i += 1) state.b[i] = state.b[i] * FORGET + reward * x[i];

    state.pulls += 1;
    state.reward += reward;
  }

  stats(): Array<{ key: ArmKey; label: string; pulls: number; averageReward: number }> {
    return ARMS.map((arm) => {
      const state = this.arms.get(arm.key)!;
      return {
        key: arm.key,
        label: arm.label,
        pulls: state.pulls,
        averageReward: state.pulls ? state.reward / state.pulls : 0,
      };
    });
  }

  async save(): Promise<void> {
    const payload: Record<string, { inverse: Float64Array; b: Float64Array; pulls: number; reward: number }> =
      {};
    for (const [key, state] of this.arms) payload[key] = { ...state };
    await kvSet("bandit.linucb", payload);
  }

  async restore(): Promise<boolean> {
    const payload = await kvGet<Record<string, ArmState>>("bandit.linucb");
    if (!payload) return false;

    for (const arm of ARMS) {
      const stored = payload[arm.key];
      // A shipped change to CONTEXT resizes every stored matrix. Starting over
      // costs a few sessions of exploration; loading a mismatched one produces
      // scores that are silently meaningless.
      if (!stored || stored.inverse?.length !== DIMENSION * DIMENSION) return false;
    }

    for (const arm of ARMS) {
      const stored = payload[arm.key];
      this.arms.set(arm.key, {
        inverse: Float64Array.from(stored.inverse),
        b: Float64Array.from(stored.b),
        pulls: stored.pulls || 0,
        reward: stored.reward || 0,
      });
    }
    return true;
  }
}

export function armFor(key: string): Arm {
  return ARMS.find((arm) => arm.key === key) || ARMS[0];
}
