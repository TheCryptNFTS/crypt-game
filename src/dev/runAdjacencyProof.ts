/**
 * dev:adjacency — pins the self-anchored ADJACENCY ops end-to-end.
 *
 * Adjacency is defined on the EXISTING array shape ONLY: a unit's adjacents are
 * its same-lane array neighbors at index ±1 (the same neighbor logic CLEAVE uses
 * for the struck defender). There is NO cross-lane column grid.
 *
 *   DAMAGE_ADJACENT_ENEMIES (single)  tcg_6395 "Decay. At the end of each turn,
 *       deal 1 damage to an adjacent enemy unit." -> ON_TURN_END, hit the nearest
 *       opponent in the source's same lane (opponent at source's index, else 0).
 *   DAMAGE_ADJACENT_ENEMIES (all)     tcg_4970 / tcg_309 / ... "Taunt. When this
 *       unit takes damage, deal 1 damage to all adjacent enemies." -> ON_DAMAGE,
 *       splash to the opponent units at the source's [idx-1, idx, idx+1].
 *   BUFF_SELF scaleBy ADJACENT_UNITS  tcg_4616 "Patient. At the end of your turn,
 *       gain +1/+1 for each adjacent unit." -> ON_TURN_END, ×(own same-lane
 *       neighbor count at index ±1).
 *
 * Everything is driven through the real `applyAction`.
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

function unit(over: Partial<UnitInPlay> & { instanceId: string }): UnitInPlay {
  return {
    cardId: "tcg_test",
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
  }
  return m;
}

// --- (a) Decay: end-of-turn deal 1 to an adjacent enemy, via END_TURN ----------
// tcg_6395 at P1 front index 1; the opponent at the SAME index (1) is the nearest
// adjacent enemy and takes 1. The opponent at a different index is untouched.
{
  const m = arena();
  m.players.P1.board.front = [
    unit({ instanceId: "pad", health: 9, maxHealth: 9 }),
    unit({ instanceId: "decay", cardId: "tcg_6395", health: 9, maxHealth: 9 }),
  ];
  m.players.P2.board.front = [
    unit({ instanceId: "e0", health: 9, maxHealth: 9 }),
    unit({ instanceId: "e1", health: 9, maxHealth: 9 }),
  ];
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  const e0 = r.state.players.P2.board.front.find((u) => u.instanceId === "e0");
  const e1 = r.state.players.P2.board.front.find((u) => u.instanceId === "e1");
  check("DECAY hits the single nearest adjacent enemy (e1 at same idx: 9 -> 8)", e1?.health === 8, e1?.health);
  check("DECAY leaves the non-adjacent enemy alone (e0 stays 9)", e0?.health === 9, e0?.health);
}

// --- (b) Taunt AoE: on-damage hits adjacent enemies but NOT the far one --------
// A P1 attacker strikes the MIDDLE enemy (def, idx 1). def has tcg_4970 (Taunt,
// "deal 1 to all adjacent enemies" on damage), self-anchored on its OWN board:
// its same-lane neighbors are the enemy units at idx 0 and idx 2 of P1's board.
{
  const m = arena();
  // P2 owns the taunt unit at idx 1; P1 attacks it. The taunt's "adjacent
  // enemies" are the P1 units in its same lane at [idx-1, idx, idx+1] = [0,1,2]
  // -> nbL, atk, nbR. The idx-3 unit ("far") is outside the band and untouched.
  m.players.P2.board.front = [
    unit({ instanceId: "p2pad", attack: 0, health: 20, maxHealth: 20 }),
    unit({ instanceId: "taunt", cardId: "tcg_4970", attack: 0, health: 20, maxHealth: 20, keywords: ["GUARD"] }),
  ];
  m.players.P1.board.front = [
    unit({ instanceId: "nbL", health: 5, maxHealth: 5 }),
    unit({ instanceId: "atk", attack: 3, health: 9, maxHealth: 9 }),
    unit({ instanceId: "nbR", health: 5, maxHealth: 5 }),
    unit({ instanceId: "far", health: 5, maxHealth: 5 }),
  ];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "taunt" });
  const nbL = r.state.players.P1.board.front.find((u) => u.instanceId === "nbL");
  const nbR = r.state.players.P1.board.front.find((u) => u.instanceId === "nbR");
  const far = r.state.players.P1.board.front.find((u) => u.instanceId === "far");
  // taunt at P2 idx 1 -> adjacent-enemy band on P1 is idx [0,1,2] = nbL, atk, nbR.
  check("TAUNT-AoE splashes the left adjacent enemy (nbL 5 -> 4)", nbL?.health === 4, nbL?.health);
  check("TAUNT-AoE splashes the right adjacent enemy (nbR 5 -> 4)", nbR?.health === 4, nbR?.health);
  check("TAUNT-AoE does NOT hit the far (idx 3) enemy (far stays 5)", far?.health === 5, far?.health);
}

// --- (c) Patient: +1/+1 per adjacent unit (0 neighbors -> none, 2 -> ×2) -------
// 0 neighbors: a lone patient unit gains nothing.
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "pat", cardId: "tcg_4616", attack: 2, health: 6, maxHealth: 6 })];
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  const pat = r.state.players.P1.board.front.find((u) => u.instanceId === "pat");
  check("PATIENT with 0 adjacent units gains nothing (stays 2/6)", pat?.attack === 2 && pat?.maxHealth === 6, pat);
}
// 2 neighbors: a patient unit flanked on both sides gains +2/+2.
{
  const m = arena();
  m.players.P1.board.front = [
    unit({ instanceId: "L", health: 9, maxHealth: 9 }),
    unit({ instanceId: "pat", cardId: "tcg_4616", attack: 2, health: 6, maxHealth: 6 }),
    unit({ instanceId: "R", health: 9, maxHealth: 9 }),
  ];
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  const pat = r.state.players.P1.board.front.find((u) => u.instanceId === "pat");
  check("PATIENT with 2 adjacent units gains +2/+2 (2/6 -> 4/8)", pat?.attack === 4 && pat?.maxHealth === 8, pat);
}

console.log(`\n=== ADJACENCY PROOF (self-anchored same-lane index±1) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} adjacency check(s) failed.`);
  process.exit(1);
}
console.log("ALL ADJACENCY PROOFS PASSED");
