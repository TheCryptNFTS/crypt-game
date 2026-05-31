/**
 * dev:marquee-summon — pins the ON_SUMMON / battlecry marquee ops END-TO-END
 * through the REAL play path (`PLAY_UNIT` -> playUnitFromHand -> fireTrigger
 * ON_SUMMON), so the proof catches real instantiation bugs. The source card id is
 * placed in P1's hand and PLAYED; only the victims/allies are crafted units.
 *
 *   DESTROY_ENEMY_SELECT  (tcg_3360 "I Am Death")   HIGHEST_COST on play.
 *   DESTROY_ENEMY_SELECT  (tcg_101  "D'Vile One")   RANDOM_COST_GATE: destroy a
 *                          random enemy with cost <= own attack. NOTE: the
 *                          compiler classifies this as ON_SUMMON (battlecry), NOT
 *                          a literal "start of combat" trigger.
 *   DEBUFF_ALL_ENEMIES    (tcg_3385 "Lucifer")      all enemies -3 atk THIS TURN
 *                          (restored at end of turn); allies +1/+1 permanently.
 *   SWAP_STATS_ALL_ENEMIES(tcg_3267 "Kiss of Death")swap atk<->hp of every enemy.
 *
 * The two destroy ops must NEVER touch the enemy nexus (face damage = BUG).
 */

import { applyAction } from "../engine/reducer";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, UnitInPlay } from "../engine/state";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`OK: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

function unit(over: Partial<UnitInPlay> & { instanceId: string; cardId: string }): UnitInPlay {
  return {
    lane: "front",
    attack: 1,
    health: 5,
    maxHealth: 5,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: false,
    summoningSick: false,
    ...over,
  };
}

function arena(seed = 9300): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].energy = 99;
    m.players[p].maxEnergy = 99;
    m.players[p].hand = [];
    m.players[p].discard = [];
    m.players[p].graveyard = [];
  }
  return m;
}

// --- DESTROY_ENEMY_SELECT (HIGHEST_COST): I Am Death destroys the costliest enemy.
// Real cost ladder (from catalog): tcg_3360=10 (the costliest cards), tcg_101=6,
// tcg_2256=5. Stage enemies with KNOWN costs and assert the costliest dies.
{
  const m = arena();
  // tcg_101 (cost 6) vs tcg_2256 (cost 5): the cost-6 enemy must be reaped.
  m.players.P2.board.front = [
    unit({ instanceId: "cheap", cardId: "tcg_2256", attack: 3, health: 5, maxHealth: 5 }),
    unit({ instanceId: "dear", cardId: "tcg_101", attack: 6, health: 5, maxHealth: 5 }),
  ];
  m.players.P1.hand = ["tcg_3360"];
  const nexusBefore = m.players.P2.nexusHealth;
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const front = r.state.players.P2.board.front;
  check("HIGHEST_COST reaps the cost-6 enemy (tcg_101 gone)", !front.some((u) => u.instanceId === "dear"), front.map((u) => u.cardId));
  check("HIGHEST_COST spares the cost-5 enemy (tcg_2256 stays)", front.some((u) => u.instanceId === "cheap"), front.map((u) => u.cardId));
  check("DESTROY (highest-cost) deals NO face damage to enemy nexus", r.state.players.P2.nexusHealth === nexusBefore, r.state.players.P2.nexusHealth);
}

// --- DESTROY_ENEMY_SELECT (HIGHEST_COST): empty enemy board is a clean no-op. ---
{
  const m = arena();
  m.players.P1.hand = ["tcg_3360"];
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  check("HIGHEST_COST with no enemy is a clean no-op (I Am Death still summons)", r.state.players.P1.board.front.some((u) => u.cardId === "tcg_3360"), r.state.players.P1.board.front.map((u) => u.cardId));
  check("HIGHEST_COST no-op leaves enemy nexus full (20)", r.state.players.P2.nexusHealth === 20, r.state.players.P2.nexusHealth);
}

// --- DESTROY_ENEMY_SELECT (RANDOM_COST_GATE): D'Vile One (atk 6) destroys the
// highest-cost enemy whose cost <= 6, and CANNOT touch a costlier one. ----------
{
  const m = arena();
  // tcg_3360 cost 10 (> 6 gate, immune), tcg_101 cost 6 (== gate, eligible),
  // tcg_2256 cost 5 (< gate). Highest eligible cost (6) is destroyed.
  m.players.P2.board.front = [
    unit({ instanceId: "immune", cardId: "tcg_3360", attack: 10, health: 10, maxHealth: 10 }),
    unit({ instanceId: "five", cardId: "tcg_2256", attack: 3, health: 5, maxHealth: 5 }),
    unit({ instanceId: "six", cardId: "tcg_101", attack: 6, health: 5, maxHealth: 5 }),
  ];
  m.players.P1.hand = ["tcg_101"]; // attacker source, live attack 6
  const nexusBefore = m.players.P2.nexusHealth;
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const front = r.state.players.P2.board.front;
  check("COST_GATE reaps the highest enemy within gate (cost-6 tcg_101 gone)", !front.some((u) => u.instanceId === "six"), front.map((u) => u.cardId));
  check("COST_GATE cannot touch a cost-10 enemy above the gate (tcg_3360 survives)", front.some((u) => u.instanceId === "immune"), front.map((u) => u.cardId));
  check("COST_GATE leaves the lower-cost in-gate enemy (cost-5 stays)", front.some((u) => u.instanceId === "five"), front.map((u) => u.cardId));
  check("DESTROY (cost-gate) deals NO face damage to enemy nexus", r.state.players.P2.nexusHealth === nexusBefore, r.state.players.P2.nexusHealth);
}

// --- DESTROY_ENEMY_SELECT (RANDOM_COST_GATE): nothing in gate -> clean no-op. ---
{
  const m = arena();
  // Only a cost-10 enemy present; D'Vile One (atk 6) cannot gate it.
  m.players.P2.board.front = [unit({ instanceId: "big", cardId: "tcg_3360", attack: 10, health: 10, maxHealth: 10 })];
  m.players.P1.hand = ["tcg_101"];
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  check("COST_GATE with no eligible enemy is a no-op (cost-10 enemy untouched)", r.state.players.P2.board.front.some((u) => u.instanceId === "big"), r.state.players.P2.board.front.map((u) => u.cardId));
}

// --- DEBUFF_ALL_ENEMIES (Lucifer): all enemies -3 atk THIS turn (restored at EOT),
// allies +1/+1 permanent. -------------------------------------------------------
{
  const m = arena();
  m.players.P2.board.front = [
    unit({ instanceId: "e1", cardId: "tcg_2256", attack: 5, health: 6, maxHealth: 6 }),
    unit({ instanceId: "e2", cardId: "tcg_101", attack: 2, health: 6, maxHealth: 6 }), // atk 2 -> floor at 0, not -1
  ];
  m.players.P1.board.front = [unit({ instanceId: "ally", cardId: "tcg_2256", attack: 4, health: 4, maxHealth: 4 })];
  m.players.P1.hand = ["tcg_3385"];
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const e1 = r.state.players.P2.board.front.find((u) => u.instanceId === "e1");
  const e2 = r.state.players.P2.board.front.find((u) => u.instanceId === "e2");
  const ally = r.state.players.P1.board.front.find((u) => u.instanceId === "ally");
  check("DEBUFF_ALL: enemy atk 5 -> 2 (this turn)", e1?.attack === 2, e1?.attack);
  check("DEBUFF_ALL: enemy atk 2 -> 0 (floored, never negative)", e2?.attack === 0, e2?.attack);
  check("DEBUFF_ALL ally rider: +1/+1 permanent (4/4 -> 5/5)", ally?.attack === 5 && ally?.health === 5 && ally?.maxHealth === 5, ally);

  // End P1's turn: the THIS-TURN attack debuff is restored; ally buff persists.
  const r2 = applyAction(r.state, { type: "END_TURN", player: "P1" });
  const e1b = r2.state.players.P2.board.front.find((u) => u.instanceId === "e1");
  const e2b = r2.state.players.P2.board.front.find((u) => u.instanceId === "e2");
  const allyb = r2.state.players.P1.board.front.find((u) => u.instanceId === "ally");
  check("DEBUFF_ALL expires at end of turn (enemy atk 2 -> 5 restored)", e1b?.attack === 5, e1b?.attack);
  check("DEBUFF_ALL expiry restores floored enemy too (0 -> 2)", e2b?.attack === 2, e2b?.attack);
  check("DEBUFF_ALL ally +1/+1 is PERMANENT (still 5/5 after EOT)", allyb?.attack === 5 && allyb?.maxHealth === 5, allyb);
}

// --- SWAP_STATS_ALL_ENEMIES (Kiss of Death): swap atk<->hp on every enemy. ------
{
  const m = arena();
  m.players.P2.board.front = [
    unit({ instanceId: "a", cardId: "tcg_2256", attack: 2, health: 7, maxHealth: 7 }), // -> 7/2
    unit({ instanceId: "b", cardId: "tcg_101", attack: 6, health: 1, maxHealth: 4 }), // -> 1/6
  ];
  m.players.P1.hand = ["tcg_3267"];
  const nexusBefore = m.players.P2.nexusHealth;
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const a = r.state.players.P2.board.front.find((u) => u.instanceId === "a");
  const b = r.state.players.P2.board.front.find((u) => u.instanceId === "b");
  check("SWAP: enemy 2/7 -> 7/2 (atk<->hp)", a?.attack === 7 && a?.health === 2 && a?.maxHealth === 2, a);
  check("SWAP: enemy 6/1(max4) -> 1/6 (new hp = old atk)", b?.attack === 1 && b?.health === 6 && b?.maxHealth === 6, b);
  check("SWAP deals NO face damage to enemy nexus", r.state.players.P2.nexusHealth === nexusBefore, r.state.players.P2.nexusHealth);
}

// --- SWAP_STATS_ALL_ENEMIES: a 0-attack enemy swaps to 0 HP and is reaped. ------
{
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "z", cardId: "tcg_2256", attack: 0, health: 9, maxHealth: 9 })];
  m.players.P1.hand = ["tcg_3267"];
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  check("SWAP: 0/9 enemy swaps to 9/0 and dies (reaped from board)", !r.state.players.P2.board.front.some((u) => u.instanceId === "z"), r.state.players.P2.board.front.map((u) => u.cardId));
  check("SWAP-to-death records the non-token enemy to its graveyard", r.state.players.P2.graveyard.length === 1, r.state.players.P2.graveyard);
}

console.log(`\n=== MARQUEE SUMMON PROOF (DESTROY_ENEMY_SELECT x2 / DEBUFF_ALL_ENEMIES / SWAP_STATS_ALL_ENEMIES) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} marquee-summon check(s) failed.`);
  process.exit(1);
}
console.log("ALL MARQUEE SUMMON PROOFS PASSED");
