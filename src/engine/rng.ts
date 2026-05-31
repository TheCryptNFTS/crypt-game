/**
 * Deterministic, dependency-free PRNG for the rules engine.
 *
 * The whole point: given the same numeric seed, the same sequence of values
 * comes out every time — so a match is fully reproducible from `seed + actions`
 * on both server and client. NOTHING in here touches `Math.random`, `Date`, or
 * any other global state. Keep it that way.
 */

export type Rng = () => number;

/**
 * mulberry32 — a tiny, fast, well-distributed 32-bit PRNG.
 * Returns a function producing floats in [0, 1).
 */
export function makeRng(seed: number): Rng {
  // Force to an unsigned 32-bit integer so callers can pass Date.now(), a
  // hash, etc. and still get a stable starting state.
  let state = seed >>> 0;

  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded Fisher-Yates shuffle. Pure: returns a new array, never mutates input,
 * and draws all randomness from the supplied `rng`.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
