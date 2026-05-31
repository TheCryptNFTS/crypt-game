/**
 * dev:continuous-aura — pins the GENERAL continuous-effects layer END-TO-END
 * through `applyAction` -> recomputeAuras. This is the non-faction generalization
 * of the existing AURA_FACTION_STAT path; all four ops are RECOMPUTED from board
 * state every pass (never one-shot), so they are idempotent, order-independent
 * and reversible the instant a source leaves play.
 *
 *   AURA_ALLY_STAT    — "[other] allied units gain +A/+B while in play"
 *   AURA_KEYWORD      — "[other] allies gain <KEYWORD> while in play"
 *   AURA_ADJACENT_STAT— "adjacent allies gain +A/+B" (same-lane index ±1)
 *   AURA_FACTION_STAT — inclusive "your <Faction> gain +A/+B" (source included)
 *
 * AURA_ALLY_STAT and AURA_KEYWORD have no real corpus card (the shipped catalog
 * phrases its continuous buffs with faction nouns), so this proof registers a
 * couple of synthetic test cards on `allPlayableCards` BEFORE dynamically
 * importing the reducer — exactly the cardId -> ability lookup a real card uses.
 * AURA_ADJACENT_STAT and the inclusive faction aura use the REAL ids tcg_239 /
 * tcg_2688.
 */

import { allPlayableCards } from "../engine/cards";

// --- Register synthetic continuous-aura sources (id -> ability text). These are
//     pushed before the reducer module builds its cardId catalog. ---------------
const SYN = [
  { id: "syn_allystat", faction: "STONE_KEEPERS", cost: 3, type: "unit",
    rawTraits: { Ability: "Guard. While this unit is in play, your other allied units gain +2/+1." } },
  { id: "syn_keyword", faction: "STONE_KEEPERS", cost: 3, type: "unit",
    rawTraits: { Ability: "Ward. While this unit is in play, your other allies gain Guard." } },
  { id: "syn_hpaura", faction: "STONE_KEEPERS", cost: 3, type: "unit",
    rawTraits: { Ability: "Guard. While this unit is in play, your other allied units gain +0/+3." } },
];
for (const c of SYN) (allPlayableCards as any[]).push(c);

async function main() {
  // Dynamic import AFTER registering synthetic cards so the reducer's module-level
  // cardId -> ability/faction Map includes them.
  const { applyAction } = await import("../engine/reducer");
  const { makeSeededMatch } = await import("./reducerHarness");
  const { unitHasKeyword } = await import("../engine/keywordEngine");
  type MatchState = import("../engine/state").MatchState;
  type UnitInPlay = import("../engine/state").UnitInPlay;

  let failures = 0;
  function check(name: string, cond: boolean, detail?: unknown) {
    if (cond) console.log(`OK: ${name}`);
    else {
      failures += 1;
      console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
    }
  }

  function unit(over: Partial<UnitInPlay> & { instanceId: string; cardId: string }): UnitInPlay {
    return {
      lane: "front", attack: 1, health: 5, maxHealth: 5, speed: 0, armor: 0,
      keywords: [], exhausted: false, summoningSick: false, ...over,
    };
  }

  function arena(seed = 5151): MatchState {
    const m = makeSeededMatch(seed);
    m.activePlayer = "P1";
    m.winner = null;
    for (const p of ["P1", "P2"] as const) {
      m.players[p].board.front = [];
      m.players[p].board.back = [];
      m.players[p].nexusHealth = 20;
      m.players[p].energy = 99;
      m.players[p].maxEnergy = 99;
    }
    return m;
  }

  const find = (s: MatchState, p: "P1" | "P2", id: string) =>
    [...s.players[p].board.front, ...s.players[p].board.back].find((u) => u.instanceId === id);

  // (a) ALLY-STAT aura buffs other allies, not the source's enemies. ------------
  {
    const m = arena();
    m.players.P1.board.front = [
      unit({ instanceId: "src", cardId: "syn_allystat", attack: 0, health: 9, maxHealth: 9 }),
      unit({ instanceId: "ally", cardId: "tcg_1", attack: 2, health: 5, maxHealth: 5 }),
    ];
    // Off-faction ally still benefits (AURA_ALLY_STAT is faction-agnostic).
    m.players.P1.board.back = [unit({ instanceId: "ally2", cardId: "tcg_14", attack: 1, health: 3, maxHealth: 3 })];
    // Enemy unit must be untouched.
    m.players.P2.board.front = [unit({ instanceId: "enemy", cardId: "tcg_1", attack: 2, health: 5, maxHealth: 5 })];
    const r = applyAction(m, { type: "END_TURN", player: "P1" });
    const ally = find(r.state, "P1", "ally");
    const ally2 = find(r.state, "P1", "ally2");
    const src = find(r.state, "P1", "src");
    const enemy = find(r.state, "P2", "enemy");
    check("ally-stat buffs a same-board ally +2/+1 (2/5 -> 4/6)", ally?.attack === 4 && ally?.health === 6 && ally?.maxHealth === 6, ally);
    check("ally-stat buffs an off-faction ally too (1/3 -> 3/4)", ally2?.attack === 3 && ally2?.health === 4, ally2);
    check("ally-stat does NOT buff its own source ('other')", src?.attack === 0 && src?.health === 9, src);
    check("ally-stat does NOT touch enemies (enemy stays 2/5)", enemy?.attack === 2 && enemy?.health === 5, enemy);
  }

  // (b) ally-stat aura is REMOVED when the source leaves play. -------------------
  {
    const m = arena();
    m.players.P1.board.front = [
      unit({ instanceId: "src", cardId: "syn_allystat", attack: 0, health: 3, maxHealth: 3 }),
      unit({ instanceId: "ally", cardId: "tcg_1", attack: 2, health: 5, maxHealth: 5 }),
    ];
    m.players.P2.board.front = [unit({ instanceId: "killer", cardId: "tcg_test", attack: 5, health: 9, maxHealth: 9 })];
    const settled = applyAction(m, { type: "END_TURN", player: "P1" });
    const buffed = find(settled.state, "P1", "ally");
    check("setup: ally buffed while source lives (4/6)", buffed?.attack === 4 && buffed?.health === 6, buffed);
    const killed = applyAction(settled.state, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "killer", defenderInstanceId: "src" });
    const src = find(killed.state, "P1", "src");
    const ally = find(killed.state, "P1", "ally");
    check("source died and left the board", src === undefined, src);
    check("ally-stat stripped when source leaves (4/6 -> 2/5)", ally?.attack === 2 && ally?.health === 5 && ally?.maxHealth === 5, ally);
  }

  // (c) idempotent — two recomputes yield the same stats (no double-stacking). ---
  {
    const m = arena();
    m.players.P1.board.front = [
      unit({ instanceId: "src", cardId: "syn_allystat", attack: 0, health: 9, maxHealth: 9 }),
      unit({ instanceId: "ally", cardId: "tcg_1", attack: 2, health: 5, maxHealth: 5 }),
    ];
    const r1 = applyAction(m, { type: "END_TURN", player: "P1" });
    const a1 = find(r1.state, "P1", "ally");
    // A second successful action triggers a second recompute over already-buffed
    // state; a non-idempotent pass would double-stack to +4/+2.
    const r2 = applyAction(r1.state, { type: "END_TURN", player: "P2" });
    const a2 = find(r2.state, "P1", "ally");
    check("recompute is idempotent (stays 4/6 across two passes)", a1?.attack === 4 && a1?.health === 6 && a2?.attack === 4 && a2?.health === 6, { a1, a2 });
  }

  // (d) KEYWORD aura grants GUARD to allies and revokes on source death. ---------
  //     NOTE (BUG 4 FIX): "your OTHER allies gain Guard" now correctly EXCLUDES
  //     the source, so `src` does NOT itself carry the aura-GUARD. We give src a
  //     PRINTED Guard so the killer can legally attack and kill it (a GUARD
  //     defender is always attackable) — otherwise the ally's aura-GUARD would
  //     (correctly) shield src from a direct attack. The point under test is that
  //     the ally LOSES its aura-GUARD when the source dies.
  {
    const m = arena();
    m.players.P1.board.front = [
      unit({ instanceId: "src", cardId: "syn_keyword", attack: 0, health: 3, maxHealth: 3, keywords: ["GUARD"] }),
      unit({ instanceId: "ally", cardId: "tcg_1", attack: 2, health: 5, maxHealth: 5, keywords: [] }),
    ];
    m.players.P2.board.front = [unit({ instanceId: "killer", cardId: "tcg_test", attack: 5, health: 9, maxHealth: 9 })];
    const settled = applyAction(m, { type: "END_TURN", player: "P1" });
    const ally = find(settled.state, "P1", "ally");
    check("keyword aura grants GUARD to an ally (derived, not printed)", !!ally && unitHasKeyword(ally as any, "GUARD") && !(ally!.keywords ?? []).includes("GUARD"), ally);
    const killed = applyAction(settled.state, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "killer", defenderInstanceId: "src" });
    const ally2 = find(killed.state, "P1", "ally");
    check("keyword aura revoked when source dies (no longer GUARD)", !!ally2 && !unitHasKeyword(ally2 as any, "GUARD"), ally2);
  }

  // (e) ADJACENT-stat aura hits index±1 only (real card tcg_239, +1/+1 to adjacent
  //     Silver Sentinels). Layout: [left SS][src tcg_239][right SS][far SS]. -----
  {
    const m = arena();
    m.players.P1.board.front = [
      unit({ instanceId: "left", cardId: "tcg_2688", attack: 2, health: 5, maxHealth: 5 }),   // SS, adjacent
      unit({ instanceId: "src", cardId: "tcg_239", attack: 0, health: 9, maxHealth: 9 }),
      unit({ instanceId: "right", cardId: "tcg_2688", attack: 2, health: 5, maxHealth: 5 }),  // SS, adjacent
      unit({ instanceId: "far", cardId: "tcg_2688", attack: 2, health: 5, maxHealth: 5 }),    // SS, NOT adjacent
    ];
    // Isolate the adjacent aura: give all SS a fresh seed so the inclusive
    // tcg_2688 faction aura is accounted for, then assert the DELTA from adjacency.
    const r = applyAction(m, { type: "END_TURN", player: "P1" });
    const left = find(r.state, "P1", "left");
    const right = find(r.state, "P1", "right");
    const far = find(r.state, "P1", "far");
    // Each SS gets the inclusive +1/+1 from the three tcg_2688 sources... so to
    // make this test about ADJACENCY only, assert left/right exceed far by exactly
    // the adjacent +1/+1.
    const dAtkL = (left?.attack ?? 0) - (far?.attack ?? 0);
    const dHpL = (left?.maxHealth ?? 0) - (far?.maxHealth ?? 0);
    const dAtkR = (right?.attack ?? 0) - (far?.attack ?? 0);
    check("adjacent-stat hits the LEFT neighbour (+1/+1 over the far unit)", dAtkL === 1 && dHpL === 1, { left, far });
    check("adjacent-stat hits the RIGHT neighbour (+1/+1 over the far unit)", dAtkR === 1, { right, far });
    check("adjacent-stat does NOT reach the far (index ±2) unit", dAtkL === 1 && dAtkR === 1, { far });
  }

  // (f) BUG 1 FIX: losing a +health aura LOWERS maxHealth and CLAMPS current
  //     health to the new max — it must NOT subtract phantom damage. A frail
  //     DEATHRATTLE unit (base maxHealth 1) chipped to current health 1 while a
  //     +0/+3 aura inflates it to max 4 must SURVIVE at 1/1 when the source dies
  //     (min(1, 1) = 1), NOT be reaped to -2. Because it does not die, its
  //     deathrattle never fires (no nexus tick). (Old buggy code did
  //     health -= 3 -> -2 -> silently reaped a unit at its true base health.) ----
  {
    const m = arena();
    m.players.P1.board.front = [
      unit({ instanceId: "src", cardId: "syn_hpaura", attack: 0, health: 3, maxHealth: 3 }),
      // Frail DEATHRATTLE beneficiary: base 1 maxHealth, currently at 1 health.
      // The recompute will lift it to maxHealth 4 (health 1+3 = 4) this pass.
      unit({ instanceId: "frail", cardId: "tcg_1", attack: 1, health: 1, maxHealth: 1, keywords: ["DEATHRATTLE"] }),
    ];
    m.players.P2.board.front = [unit({ instanceId: "killer", cardId: "tcg_test", attack: 5, health: 9, maxHealth: 9 })];
    const settled = applyAction(m, { type: "END_TURN", player: "P1" });
    const frailBuffed = find(settled.state, "P1", "frail");
    check("setup: frail lifted to maxHealth 4 by the +0/+3 aura", frailBuffed?.maxHealth === 4, frailBuffed);
    // Chip frail down to current health 1 (at its TRUE base max). Losing the
    // aura lowers max 4 -> 1 and clamps health min(1,1) = 1: it survives.
    frailBuffed!.health = 1;
    const p2NexusBefore = settled.state.players.P2.nexusHealth ?? 20;
    // Kill the aura source. recompute strips +3 max-health from frail and clamps
    // (no phantom damage): frail ends at 1/1, alive.
    const killed = applyAction(settled.state, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "killer", defenderInstanceId: "src" });
    const frail = find(killed.state, "P1", "frail");
    const p2NexusAfter = killed.state.players.P2.nexusHealth ?? 20;
    check("frail SURVIVES losing its +health aura (no phantom damage)", !!frail && frail.health === 1 && frail.maxHealth === 1, frail);
    check("surviving frail fired NO deathrattle (no nexus damage)", p2NexusAfter === p2NexusBefore, { p2NexusBefore, p2NexusAfter });
  }

  console.log(`\n=== CONTINUOUS-AURA PROOF (general continuous-effects layer via recomputeAuras) ===`);
  if (failures > 0) {
    console.error(`FAILED: ${failures} continuous-aura check(s) failed.`);
    process.exit(1);
  }
  console.log("ALL CONTINUOUS-AURA PROOFS PASSED");
}

main();
