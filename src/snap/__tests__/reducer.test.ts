import { describe, it, expect } from "vitest";
import { snapReducer, playableHand } from "../reducer";
import { createSnapMatch } from "../setup";
import { detectSnapWinner } from "../scoreLane";
import {
  LANE_CAPACITY,
  MAX_TURNS,
  type LaneIndex,
  type SnapCard,
  type SnapState,
} from "../types";

/**
 * Locks the reducer's rules-engine guarantees. The AI planner (ai.ts) depends on
 * reject-soft returning the SAME state reference to know an action was illegal
 * (`next === working` → stop), so these tests assert reference identity, not just
 * value equality — a reject that returned a fresh-but-equal clone would silently
 * break the AI's turn loop.
 */

const SEED = 42;

/** A throwaway vanilla card for hand-crafting board states. */
function card(id: string, cost: number, power: number): SnapCard {
  return { instanceId: id, cardId: id, name: id, cost, power, keyword: null };
}

describe("snap reducer — legality (reject-soft, same reference)", () => {
  it("rejects acting out of turn", () => {
    const s = createSnapMatch({ seed: SEED });
    const out = snapReducer(s, { type: "END_TURN", seat: "P2" });
    expect(out).toBe(s); // it's P1's turn
  });

  it("rejects playing a card not in hand", () => {
    const s = createSnapMatch({ seed: SEED });
    const out = snapReducer(s, {
      type: "PLAY_CARD",
      seat: "P1",
      instanceId: "does-not-exist",
      lane: 0,
    });
    expect(out).toBe(s);
  });

  it("rejects an unaffordable card (cost > energy)", () => {
    const s = createSnapMatch({ seed: SEED });
    const tooDear = s.players.P1.hand.find((c) => c.cost > s.players.P1.energy);
    // Turn-1 energy is 1 and the cost-1 guarantee re-costs only ONE card, so a
    // dealt hand of 3 always has at least one card above the energy bank.
    expect(tooDear).toBeDefined();
    const out = snapReducer(s, {
      type: "PLAY_CARD",
      seat: "P1",
      instanceId: tooDear!.instanceId,
      lane: 0,
    });
    expect(out).toBe(s);
  });

  it("rejects placing into a full Crypt", () => {
    const base = createSnapMatch({ seed: SEED });
    const s: SnapState = structuredClone(base);
    // Fill lane 0 for P1 to capacity, hand them an affordable 1-drop with energy.
    s.lanes[0].P1 = Array.from({ length: LANE_CAPACITY }, (_, i) => card(`fill${i}`, 1, 1));
    const one = card("myOne", 1, 1);
    s.players.P1.hand = [one];
    s.players.P1.energy = 5;
    const out = snapReducer(s, {
      type: "PLAY_CARD",
      seat: "P1",
      instanceId: one.instanceId,
      lane: 0,
    });
    expect(out).toBe(s);
  });

  it("rejects a bad lane index", () => {
    const s = createSnapMatch({ seed: SEED });
    const playable = playableHand(s, "P1")[0];
    const out = snapReducer(s, {
      type: "PLAY_CARD",
      seat: "P1",
      instanceId: playable.instanceId,
      lane: 9 as LaneIndex,
    });
    expect(out).toBe(s);
  });

  it("freezes a decided match", () => {
    const base = createSnapMatch({ seed: SEED });
    const s: SnapState = structuredClone(base);
    s.winner = "P1";
    const playable = s.players.P1.hand[0];
    const out = snapReducer(s, {
      type: "PLAY_CARD",
      seat: "P1",
      instanceId: playable.instanceId,
      lane: 0,
    });
    expect(out).toBe(s);
  });
});

describe("snap reducer — energy accounting", () => {
  it("deducts on placement and forbids overspend within a turn", () => {
    const base = createSnapMatch({ seed: SEED });
    const s: SnapState = structuredClone(base);
    // Two 2-cost cards, a 3-energy bank: first is affordable, second is not.
    const a = card("a", 2, 4);
    const b = card("b", 2, 4);
    s.players.P1.hand = [a, b];
    s.players.P1.energy = 3;

    const afterA = snapReducer(s, { type: "PLAY_CARD", seat: "P1", instanceId: "a", lane: 0 });
    expect(afterA).not.toBe(s);
    expect(afterA.players.P1.energy).toBe(1); // 3 - 2

    const afterB = snapReducer(afterA, { type: "PLAY_CARD", seat: "P1", instanceId: "b", lane: 0 });
    expect(afterB).toBe(afterA); // 2 > 1 → rejected, no overspend
  });
});

describe("snap reducer — match loop", () => {
  it("advances turn, refills energy to the turn number, and settles only at MAX_TURNS", () => {
    let s = createSnapMatch({ seed: SEED });
    for (let turn = 1; turn < MAX_TURNS; turn++) {
      expect(s.turn).toBe(turn);
      expect(s.active).toBe("P1");
      expect(s.players.P1.energy).toBe(turn);
      s = snapReducer(s, { type: "END_TURN", seat: "P1" });
      expect(s.active).toBe("P2");
      expect(s.winner).toBeNull(); // no early settle
      s = snapReducer(s, { type: "END_TURN", seat: "P2" });
      expect(s.turn).toBe(turn + 1);
      expect(s.players.P1.energy).toBe(turn + 1);
      expect(s.players.P2.energy).toBe(turn + 1);
    }
    // Now on turn 6: the P2 END_TURN resolves the whole match.
    expect(s.turn).toBe(MAX_TURNS);
    s = snapReducer(s, { type: "END_TURN", seat: "P1" });
    expect(s.winner).toBeNull();
    s = snapReducer(s, { type: "END_TURN", seat: "P2" });
    expect(s.winner).not.toBeNull();
    expect(s.outcomes).not.toBeNull();
    expect(s.outcomes!).toHaveLength(3);
  });
});

describe("snap scoring — crypt-count tie breaks on total power", () => {
  function craft(p1: [LaneIndex, number][], p2: [LaneIndex, number][]): SnapState {
    const s = createSnapMatch({ seed: SEED });
    for (const lane of s.lanes) {
      lane.P1 = [];
      lane.P2 = [];
    }
    for (const [lane, power] of p1) s.lanes[lane].P1.push(card(`p1_${lane}`, 1, power));
    for (const [lane, power] of p2) s.lanes[lane].P2.push(card(`p2_${lane}`, 1, power));
    return s;
  }

  it("awards the match on total power when Crypts are 1–1 (third empty)", () => {
    // P1 wins lane 0 by a hair, P2 wins lane 1 big — but total power favors P1.
    const s = craft(
      [[0, 10], [1, 9]],
      [[0, 1], [1, 11]],
    );
    // Crypts: lane0 P1, lane1 P2 → 1–1. Totals: P1 19, P2 12 → P1.
    expect(detectSnapWinner(s)).toBe("P1");
  });

  it("draws when Crypts AND total power are dead even", () => {
    const s = craft(
      [[0, 5], [1, 3]],
      [[0, 3], [1, 5]],
    );
    // lane0 P1, lane1 P2 → 1–1. Totals: P1 8, P2 8 → DRAW.
    expect(detectSnapWinner(s)).toBe("DRAW");
  });
});
