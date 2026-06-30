import { describe, it, expect } from "vitest";
import { resolveEffect, type EffectContext } from "../effectResolver";
import type { EffectSpec } from "../abilityCompiler";
import { makeSeededMatch } from "../../dev/reducerHarness";
import type { MatchState, UnitInPlay } from "../state";

/**
 * KEYWORD TARGETING ENFORCEMENT — STEALTH (and ground-attacker FLYING evasion)
 * must hold for ALL targeting, not just the player's direct attack/spell target.
 *
 * STEALTH ("can't be attacked OR targeted") was previously gated only at the
 * combat / player-spell boundary; the resolver's auto-selectors and splash effects
 * bypassed it. These pin the fix: every internal enemy-victim path now routes
 * through the shared `isAutoTargetable` predicate, so a stealthed unit survives an
 * auto-selected single-target burst, a selected destroy, and a splash sweep. The
 * FLYING case pins that an ON-ATTACK CLEAVE from a GROUND attacker cannot reach a
 * flyer (same evasion rule as the direct attack).
 */

/** A minimal board unit. */
function unit(over: Partial<UnitInPlay>): UnitInPlay {
  return {
    instanceId: "u",
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

/** Fresh seeded match with both boards cleared, ready for hand-placed units. */
function emptyBoardMatch(seed: number): MatchState {
  const s = makeSeededMatch(seed);
  s.players.P1.board.front = [];
  s.players.P1.board.back = [];
  s.players.P2.board.front = [];
  s.players.P2.board.back = [];
  return s;
}

/** P1 controls the effect; P2 is the enemy whose units get targeted. */
function ctxFor(state: MatchState, source?: UnitInPlay): EffectContext {
  return { state, controller: "P1", source };
}

/** EffectSpec literal with the required `raw` injected (tests don't exercise it). */
function spec(over: Partial<EffectSpec> & Pick<EffectSpec, "trigger" | "op">): EffectSpec {
  return { raw: "test", ...over } as EffectSpec;
}

describe("STEALTH — single-target auto-selector (STRONGEST_ENEMY)", () => {
  it("skips a stealthed unit even when it is the strongest; if ALL candidates are stealthed it hits nothing", () => {
    const state = emptyBoardMatch(81001);
    // The strongest enemy is stealthed; a weaker non-stealthed unit is the only
    // legal target, so the burst lands on the weaker one (stealth survives).
    state.players.P2.board.front = [
      unit({ instanceId: "stealthBig", attack: 9, health: 5, maxHealth: 5, keywords: ["STEALTH"], stealthed: true }),
      unit({ instanceId: "openSmall", attack: 1, health: 5, maxHealth: 5 }),
    ];
    const burst = spec({ trigger: "ON_DEATH", op: "DEAL_DAMAGE", amount: 3, damageTarget: "STRONGEST_ENEMY" });
    resolveEffect(burst, ctxFor(state));

    const front = state.players.P2.board.front;
    expect(front.find((u) => u.instanceId === "stealthBig")!.health).toBe(5); // untouched
    expect(front.find((u) => u.instanceId === "openSmall")!.health).toBe(2); // took the 3

    // Now ONLY a stealthed candidate remains -> no legal target -> clean no-op.
    const state2 = emptyBoardMatch(81002);
    state2.players.P2.board.front = [
      unit({ instanceId: "onlyStealth", attack: 9, health: 5, maxHealth: 5, keywords: ["STEALTH"], stealthed: true }),
    ];
    resolveEffect(burst, ctxFor(state2));
    expect(state2.players.P2.board.front[0].health).toBe(5); // survives — nothing was selected
  });
});

describe("STEALTH — DESTROY_ENEMY_SELECT", () => {
  it("cannot destroy a stealthed unit; a board of only stealthed units is a clean no-op", () => {
    const state = emptyBoardMatch(81003);
    state.players.P2.board.front = [
      unit({ instanceId: "stealthVictim", attack: 4, health: 6, maxHealth: 6, keywords: ["STEALTH"], stealthed: true }),
    ];
    const destroy = spec({ trigger: "ON_SUMMON", op: "DESTROY_ENEMY_SELECT", selector: "HIGHEST_COST" });
    resolveEffect(destroy, ctxFor(state, unit({ instanceId: "src", attack: 5 })));
    // Stealthed unit is excluded from the pool -> no victim -> still alive.
    expect(state.players.P2.board.front[0].health).toBe(6);
  });

  it("still destroys a non-stealthed unit standing alongside a stealthed one", () => {
    const state = emptyBoardMatch(81004);
    state.players.P2.board.front = [
      unit({ instanceId: "stealthSafe", attack: 4, health: 6, maxHealth: 6, keywords: ["STEALTH"], stealthed: true }),
      unit({ instanceId: "openDies", attack: 4, health: 6, maxHealth: 6 }),
    ];
    const destroy = spec({ trigger: "ON_SUMMON", op: "DESTROY_ENEMY_SELECT", selector: "HIGHEST_COST" });
    resolveEffect(destroy, ctxFor(state, unit({ instanceId: "src", attack: 5 })));
    expect(state.players.P2.board.front.find((u) => u.instanceId === "stealthSafe")!.health).toBe(6);
    expect(state.players.P2.board.front.find((u) => u.instanceId === "openDies")!.health).toBe(0);
  });
});

describe("STEALTH — splash effects skip the stealthed unit", () => {
  it("DAMAGE_LANE sweep excludes a stealthed unit while hitting its lane-mates", () => {
    const state = emptyBoardMatch(81005);
    state.players.P2.board.front = [
      unit({ instanceId: "a", health: 5, maxHealth: 5 }),
      unit({ instanceId: "ghost", health: 5, maxHealth: 5, keywords: ["STEALTH"], stealthed: true }),
      unit({ instanceId: "b", health: 5, maxHealth: 5 }),
    ];
    const sweep = spec({ trigger: "ON_SUMMON", op: "DAMAGE_LANE", amount: 2, targetLane: "front" });
    resolveEffect(sweep, ctxFor(state));
    const f = state.players.P2.board.front;
    expect(f.find((u) => u.instanceId === "a")!.health).toBe(3);
    expect(f.find((u) => u.instanceId === "ghost")!.health).toBe(5); // skipped
    expect(f.find((u) => u.instanceId === "b")!.health).toBe(3);
  });

  it("CLEAVE skips a stealthed neighbor of the struck defender", () => {
    const state = emptyBoardMatch(81006);
    // P1 attacker cleaves; ctx.target is the struck P2 defender at index 1, so its
    // neighbors at index 0 (stealthed) and 2 are the splash victims.
    const attacker = unit({ instanceId: "atk", attack: 6 });
    const struck = unit({ instanceId: "struck", health: 9, maxHealth: 9 });
    state.players.P2.board.front = [
      unit({ instanceId: "ghostNb", health: 9, maxHealth: 9, keywords: ["STEALTH"], stealthed: true }),
      struck,
      unit({ instanceId: "openNb", health: 9, maxHealth: 9 }),
    ];
    const cleave = spec({ trigger: "ON_ATTACK", op: "CLEAVE", amount: 3 });
    resolveEffect(cleave, { state, controller: "P1", source: attacker, target: struck });
    const f = state.players.P2.board.front;
    expect(f.find((u) => u.instanceId === "ghostNb")!.health).toBe(9); // stealth survives splash
    expect(f.find((u) => u.instanceId === "openNb")!.health).toBe(6); // took the 3
  });
});

describe("FLYING — ground-attacker CLEAVE cannot reach a flyer", () => {
  it("a GROUND attacker's cleave skips a FLYING neighbor but hits a ground neighbor", () => {
    const state = emptyBoardMatch(81007);
    const groundAttacker = unit({ instanceId: "ground", attack: 6, keywords: [] }); // no FLYING/RANGED
    const struck = unit({ instanceId: "struck", health: 9, maxHealth: 9 });
    state.players.P2.board.front = [
      unit({ instanceId: "flyerNb", health: 9, maxHealth: 9, keywords: ["FLYING"] }),
      struck,
      unit({ instanceId: "groundNb", health: 9, maxHealth: 9 }),
    ];
    const cleave = spec({ trigger: "ON_ATTACK", op: "CLEAVE", amount: 3 });
    resolveEffect(cleave, { state, controller: "P1", source: groundAttacker, target: struck });
    const f = state.players.P2.board.front;
    expect(f.find((u) => u.instanceId === "flyerNb")!.health).toBe(9); // evaded
    expect(f.find((u) => u.instanceId === "groundNb")!.health).toBe(6); // took the 3
  });

  it("a FLYING attacker's cleave DOES hit a flyer (evasion only blocks ground)", () => {
    const state = emptyBoardMatch(81008);
    const flyingAttacker = unit({ instanceId: "flyAtk", attack: 6, keywords: ["FLYING"] });
    const struck = unit({ instanceId: "struck", health: 9, maxHealth: 9 });
    state.players.P2.board.front = [
      unit({ instanceId: "flyerNb", health: 9, maxHealth: 9, keywords: ["FLYING"] }),
      struck,
    ];
    const cleave = spec({ trigger: "ON_ATTACK", op: "CLEAVE", amount: 3 });
    resolveEffect(cleave, { state, controller: "P1", source: flyingAttacker, target: struck });
    expect(state.players.P2.board.front.find((u) => u.instanceId === "flyerNb")!.health).toBe(6);
  });
});
