import { describe, it, expect } from "vitest";
import { createSnapMatch } from "../setup";
import { playableHand } from "../reducer";
import { OPENING_HAND } from "../types";

/**
 * Locks the "no dead turn 1" guarantee: a freshly-dealt opening hand must always
 * contain at least one card the player can afford on turn 1 (energy 1), i.e. a
 * cost-≤1 card. The curated pool's cheapest card is cost 2, so setup.ts re-costs
 * the cheapest hand card to a vanilla 1-drop when none exists — this proves that
 * holds for every seed, not just the ones we happened to click through.
 */
describe("snap opening hand", () => {
  const SEEDS = Array.from({ length: 400 }, (_, i) => i);

  it("always deals P1 a playable turn-1 card (cost ≤ 1)", () => {
    for (const seed of SEEDS) {
      const state = createSnapMatch({ seed });
      const hand = state.players.P1.hand;
      expect(hand.length).toBe(OPENING_HAND);
      expect(hand.some((c) => c.cost <= 1)).toBe(true);
      // The engine's own playability check must agree with the cost invariant.
      expect(playableHand(state, "P1").length).toBeGreaterThan(0);
    }
  });

  it("also guarantees the AI (P2) a turn-1 play", () => {
    for (const seed of SEEDS) {
      const state = createSnapMatch({ seed });
      expect(state.players.P2.hand.some((c) => c.cost <= 1)).toBe(true);
    }
  });
});
