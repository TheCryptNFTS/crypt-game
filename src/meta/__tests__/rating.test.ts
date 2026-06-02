import { describe, it, expect } from "vitest";
import {
  expectedScore,
  computeRatingDelta,
  applyMatchResult,
  ratingOf,
  DEFAULT_K,
  BASELINE_RATING,
  MIN_RATING,
  type RatingState,
} from "../rating";

/**
 * Elo math tests: expected-score properties, symmetry, zero-sum exchange, and the
 * immutable rating-table update with the MIN_RATING floor.
 */

describe("expectedScore", () => {
  it("equal ratings give exactly 0.5", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 12);
  });

  it("is bounded in (0,1)", () => {
    expect(expectedScore(3000, 100)).toBeGreaterThan(0.99);
    expect(expectedScore(100, 3000)).toBeLessThan(0.01);
    expect(expectedScore(100, 3000)).toBeGreaterThan(0);
  });

  it("the two sides' expected scores sum to 1", () => {
    expect(expectedScore(1200, 800) + expectedScore(800, 1200)).toBeCloseTo(1, 12);
  });

  it("a +400 gap yields the canonical ~0.909 expectation", () => {
    expect(expectedScore(1400, 1000)).toBeCloseTo(1 / (1 + Math.pow(10, -1)), 12);
  });

  it("is monotonic in the rating gap", () => {
    expect(expectedScore(1100, 1000)).toBeGreaterThan(expectedScore(1050, 1000));
  });
});

describe("computeRatingDelta", () => {
  it("is exactly zero-sum after rounding", () => {
    const d = computeRatingDelta(1000, 1000);
    expect(d.winnerDelta + d.loserDelta).toBe(0);
  });

  it("equal ratings split the full K (winner +K/2)", () => {
    const d = computeRatingDelta(1000, 1000, 32);
    expect(d.winnerDelta).toBe(16);
    expect(d.loserDelta).toBe(-16);
  });

  it("an upset (low-rated winner) awards more points than an expected win", () => {
    const upset = computeRatingDelta(800, 1200);
    const expected = computeRatingDelta(1200, 800);
    expect(upset.winnerDelta).toBeGreaterThan(expected.winnerDelta);
  });

  it("winnerDelta is non-negative and stays within K", () => {
    const d = computeRatingDelta(500, 2500, 32);
    expect(d.winnerDelta).toBeGreaterThanOrEqual(0);
    expect(d.winnerDelta).toBeLessThanOrEqual(32);
  });

  it("honors a custom K-factor", () => {
    expect(computeRatingDelta(1000, 1000, 10).winnerDelta).toBe(5);
    expect(computeRatingDelta(1000, 1000, 64).winnerDelta).toBe(32);
  });

  it("defaults to DEFAULT_K when k omitted", () => {
    expect(computeRatingDelta(1000, 1000)).toEqual(computeRatingDelta(1000, 1000, DEFAULT_K));
  });
});

describe("ratingOf", () => {
  it("returns BASELINE for an unknown player", () => {
    expect(ratingOf({ ratings: {} }, "ghost")).toBe(BASELINE_RATING);
  });

  it("returns the stored rating when present", () => {
    expect(ratingOf({ ratings: { a: 1234 } }, "a")).toBe(1234);
  });
});

describe("applyMatchResult", () => {
  it("does not mutate the input state (immutable update)", () => {
    const state: RatingState = { ratings: { a: 1000, b: 1000 } };
    const snapshot = JSON.stringify(state);
    applyMatchResult(state, { winnerId: "a", loserId: "b" });
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("moves winner up and loser down by the symmetric delta", () => {
    const { state, delta } = applyMatchResult(
      { ratings: { a: 1000, b: 1000 } },
      { winnerId: "a", loserId: "b" }
    );
    expect(state.ratings.a).toBe(1000 + delta.winnerDelta);
    expect(state.ratings.b).toBe(1000 + delta.loserDelta);
    expect(delta.winnerDelta + delta.loserDelta).toBe(0);
  });

  it("seeds unknown players from BASELINE", () => {
    const { state } = applyMatchResult({ ratings: {} }, { winnerId: "x", loserId: "y" });
    expect(state.ratings.x).toBe(BASELINE_RATING + 16);
    expect(state.ratings.y).toBe(BASELINE_RATING - 16);
  });

  it("clamps a losing rating at MIN_RATING (never below the floor)", () => {
    const { state } = applyMatchResult(
      { ratings: { hi: 3000, lo: MIN_RATING } },
      { winnerId: "hi", loserId: "lo" }
    );
    expect(state.ratings.lo).toBeGreaterThanOrEqual(MIN_RATING);
  });

  it("the total rating mass is conserved away from the floor", () => {
    const before = { ratings: { a: 1500, b: 1500 } };
    const { state } = applyMatchResult(before, { winnerId: "a", loserId: "b" });
    expect(state.ratings.a + state.ratings.b).toBe(before.ratings.a + before.ratings.b);
  });
});
