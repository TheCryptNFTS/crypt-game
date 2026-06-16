import { describe, it, expect } from "vitest";
import { applyAction } from "../reducer";
import { makeSeededMatch } from "../../dev/reducerHarness";
import { ENERGY_CAP, SURGE_ENERGY, type MatchState, type UnitInPlay } from "../state";

/**
 * THE SURGE (#4 — the "Snap" beat). Pins the one-per-match all-in tempo button:
 * it spikes the surger's energy (capped), readies their OWN summoning-sick units
 * for an alpha-strike, fires exactly once per player, is opt-in via `rules.surge`,
 * and is strictly NO-BURN — the opponent's board and nexus are never touched. It is
 * a one-sided declaration on your own turn, so it does NOT reintroduce a response
 * stack (an out-of-turn SURGE reject-softs `not-your-turn`).
 */

/** Enable the Surge ruleset on a freshly-seeded vanilla match. */
function surgeOn(seed: number): MatchState {
  const s = makeSeededMatch(seed);
  s.rules = { ...(s.rules ?? {}), surge: true };
  return s;
}

/** A minimal board unit for crafting board states. */
function unit(over: Partial<UnitInPlay>): UnitInPlay {
  return {
    instanceId: "u_test",
    cardId: "tcg_0001",
    lane: "front",
    attack: 2,
    health: 3,
    maxHealth: 3,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: false,
    summoningSick: false,
    ...over,
  };
}

describe("SURGE — opt-in gate", () => {
  it("rejects (surge-disabled) in a vanilla match and is a clean no-op", () => {
    const state = makeSeededMatch(70001); // no rules
    const energyBefore = state.players.P1.energy;
    const res = applyAction(state, { type: "SURGE", player: "P1" });
    // Reject returns the SAME reference (true no-op) + one REJECTED event.
    expect(res.state).toBe(state);
    expect(res.events).toEqual([{ type: "REJECTED", reason: "surge-disabled" }]);
    expect(state.players.P1.energy).toBe(energyBefore);
    expect(state.players.P1.surgeUsed ?? false).toBe(false);
  });
});

describe("SURGE — energy spike", () => {
  it("adds SURGE_ENERGY and emits SURGED with the gained amount", () => {
    const state = surgeOn(70002);
    state.players.P1.energy = 3;
    const res = applyAction(state, { type: "SURGE", player: "P1" });
    expect(res.state.players.P1.energy).toBe(3 + SURGE_ENERGY);
    expect(res.state.players.P1.surgeUsed).toBe(true);
    const surged = res.events.find((e) => e.type === "SURGED") as any;
    expect(surged).toBeTruthy();
    expect(surged.energyGained).toBe(SURGE_ENERGY);
    expect(surged.player).toBe("P1");
  });

  it("clamps the spike at ENERGY_CAP (no runaway energy)", () => {
    const state = surgeOn(70003);
    state.players.P1.energy = ENERGY_CAP - 1; // only room for +1
    const res = applyAction(state, { type: "SURGE", player: "P1" });
    expect(res.state.players.P1.energy).toBe(ENERGY_CAP);
    const surged = res.events.find((e) => e.type === "SURGED") as any;
    expect(surged.energyGained).toBe(1);
  });
});

describe("SURGE — readies the OWN side for an alpha-strike", () => {
  it("clears summoning sickness but NOT exhaustion, and counts the readied", () => {
    const state = surgeOn(70004);
    state.players.P1.board.front = [
      unit({ instanceId: "fresh", summoningSick: true }),
      unit({ instanceId: "tired", summoningSick: false, exhausted: true }),
    ];
    state.players.P1.board.back = [unit({ instanceId: "freshBack", summoningSick: true })];

    const res = applyAction(state, { type: "SURGE", player: "P1" });
    const front = res.state.players.P1.board.front;
    const back = res.state.players.P1.board.back;

    expect(front.find((u) => u.instanceId === "fresh")!.summoningSick).toBe(false);
    expect(back.find((u) => u.instanceId === "freshBack")!.summoningSick).toBe(false);
    // Exhaustion is deliberately untouched — no bonus second attacks.
    expect(front.find((u) => u.instanceId === "tired")!.exhausted).toBe(true);

    const surged = res.events.find((e) => e.type === "SURGED") as any;
    expect(surged.readied).toBe(2);
  });
});

describe("SURGE — NO-BURN (enemy is never touched)", () => {
  it("leaves the opponent's nexus and board byte-identical", () => {
    const state = surgeOn(70005);
    state.players.P2.board.front = [unit({ instanceId: "enemy", attack: 4, health: 5, maxHealth: 5, summoningSick: true, exhausted: true })];
    const enemyNexusBefore = state.players.P2.nexusHealth;
    const enemyEnergyBefore = state.players.P2.energy;

    const res = applyAction(state, { type: "SURGE", player: "P1" });

    // No-burn: the enemy nexus and every combat-relevant stat of its units are
    // untouched (a Surge only edits the surger's own energy + own units). The
    // reducer's global aura pass may normalise zero-value aura bookkeeping on any
    // action — that is not a burn, so we assert the stats that actually matter.
    expect(res.state.players.P2.nexusHealth).toBe(enemyNexusBefore);
    expect(res.state.players.P2.energy).toBe(enemyEnergyBefore);
    const enemy = res.state.players.P2.board.front[0];
    expect(enemy.attack).toBe(4);
    expect(enemy.health).toBe(5);
    expect(enemy.exhausted).toBe(true);
    // The enemy's summoning-sick unit is NOT readied by my Surge.
    expect(enemy.summoningSick).toBe(true);
  });
});

describe("SURGE — once per match, on your turn only", () => {
  it("a second SURGE rejects (surge-already-used)", () => {
    const state = surgeOn(70006);
    const first = applyAction(state, { type: "SURGE", player: "P1" });
    expect(first.state.players.P1.surgeUsed).toBe(true);
    const second = applyAction(first.state, { type: "SURGE", player: "P1" });
    expect(second.state).toBe(first.state); // clean no-op
    expect(second.events).toEqual([{ type: "REJECTED", reason: "surge-already-used" }]);
  });

  it("an out-of-turn SURGE rejects (not-your-turn) — no response-stack interrupt", () => {
    const state = surgeOn(70007);
    expect(state.activePlayer).toBe("P1");
    const res = applyAction(state, { type: "SURGE", player: "P2" });
    expect(res.state).toBe(state);
    expect(res.events).toEqual([{ type: "REJECTED", reason: "not-your-turn" }]);
  });
});
