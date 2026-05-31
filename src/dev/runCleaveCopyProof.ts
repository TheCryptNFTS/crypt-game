/**
 * dev:cleave-copy — pins the two new ON_ATTACK / ON_SUMMON templates end-to-end.
 *
 *   CLEAVE      (tcg_293)  "Cleave. ... half its attack ... to adjacent enemies on attack."
 *                          -> on attack, splash floor(attack/2) to the struck
 *                             defender's board-neighbors (same lane, index ±1).
 *   DEAL_DAMAGE (tcg_2450) "Cleave. ... deals 3 damage to an enemy in addition to
 *                             its normal attack." -> flat bonus to the struck enemy
 *                             (reuses the existing DEAL_DAMAGE op).
 *   COPY_UNIT   (tcg_3415) "On play: copy stats and abilities of highest-cost
 *                             enemy unit." -> the summon auto-selects the highest
 *                             cost enemy and copies its cardId/stats/keywords.
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

function arena(seed = 9100): MatchState {
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

// --- CLEAVE: half-attack splash to the struck defender's neighbors --------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "cl", cardId: "tcg_293", attack: 6, health: 8, maxHealth: 8 })];
  m.players.P2.board.front = [
    unit({ instanceId: "nbL", health: 5, maxHealth: 5 }),
    unit({ instanceId: "def", health: 20, maxHealth: 20 }),
    unit({ instanceId: "nbR", health: 5, maxHealth: 5 }),
  ];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "cl", defenderInstanceId: "def" });
  const nbL = r.state.players.P2.board.front.find((u) => u.instanceId === "nbL");
  const nbR = r.state.players.P2.board.front.find((u) => u.instanceId === "nbR");
  const def = r.state.players.P2.board.front.find((u) => u.instanceId === "def");
  check("CLEAVE splashes floor(6/2)=3 to the left neighbor (5 -> 2)", nbL?.health === 2, nbL?.health);
  check("CLEAVE splashes floor(6/2)=3 to the right neighbor (5 -> 2)", nbR?.health === 2, nbR?.health);
  check("CLEAVE leaves the struck defender to normal combat only (20 -> 14)", def?.health === 14, def?.health);
}

// --- CLEAVE: only neighbors of the STRUCK unit are hit (not the whole board) -----
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "cl", cardId: "tcg_293", attack: 6, health: 8, maxHealth: 8 })];
  m.players.P2.board.front = [
    unit({ instanceId: "far", health: 5, maxHealth: 5 }),
    unit({ instanceId: "nbL", health: 5, maxHealth: 5 }),
    unit({ instanceId: "def", health: 20, maxHealth: 20 }),
  ];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "cl", defenderInstanceId: "def" });
  const far = r.state.players.P2.board.front.find((u) => u.instanceId === "far");
  const nbL = r.state.players.P2.board.front.find((u) => u.instanceId === "nbL");
  check("CLEAVE does NOT hit the non-adjacent unit (far stays 5)", far?.health === 5, far?.health);
  check("CLEAVE hits the one real neighbor (nbL 5 -> 2)", nbL?.health === 2, nbL?.health);
}

// --- bonus on-attack damage (tcg_2450): +3 to the struck enemy ------------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "ir", cardId: "tcg_2450", attack: 2, health: 9, maxHealth: 9 })];
  m.players.P2.board.front = [unit({ instanceId: "def", health: 10, maxHealth: 10 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "ir", defenderInstanceId: "def" });
  const def = r.state.players.P2.board.front.find((u) => u.instanceId === "def");
  check("Cleave-bonus deals combat 2 + ability 3 to the struck enemy (10 -> 5)", def?.health === 5, def?.health);
}

// --- COPY_UNIT: a lone enemy is copied (stats + keywords + cardId) ---------------
{
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "big", cardId: "tcg_475", attack: 17, health: 9, maxHealth: 9, keywords: ["DEATHRATTLE"] })];
  m.players.P1.hand = ["tcg_3415"];
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const copy = r.state.players.P1.board.front[r.state.players.P1.board.front.length - 1];
  check("COPY_UNIT takes the enemy's stats (4/6 -> 17/9)", copy?.attack === 17 && copy?.maxHealth === 9, copy);
  check("COPY_UNIT takes the enemy's keywords (DEATHRATTLE)", (copy?.keywords ?? []).includes("DEATHRATTLE"), copy?.keywords);
  check("COPY_UNIT takes the enemy's cardId (abilities follow)", copy?.cardId === "tcg_475", copy?.cardId);
}

// --- COPY_UNIT: auto-selects the HIGHEST-cost enemy when several are present -----
{
  const m = arena();
  m.players.P2.board.front = [
    unit({ instanceId: "small", cardId: "tcg_33", attack: 1, health: 1, maxHealth: 1 }),
    unit({ instanceId: "big", cardId: "tcg_475", attack: 17, health: 9, maxHealth: 9, keywords: ["DEATHRATTLE"] }),
  ];
  m.players.P1.hand = ["tcg_3415"];
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const copy = r.state.players.P1.board.front[r.state.players.P1.board.front.length - 1];
  check("COPY_UNIT picks the cost-10 enemy over the cost-1 (copies 17/9)", copy?.attack === 17 && copy?.cardId === "tcg_475", copy);
}

// --- COPY_UNIT: empty enemy board is a clean no-op (keeps its own stats) ---------
{
  const m = arena();
  m.players.P1.hand = ["tcg_3415"];
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const copy = r.state.players.P1.board.front[r.state.players.P1.board.front.length - 1];
  check("COPY_UNIT with no enemy is a no-op (stays itself, cardId unchanged)", copy?.cardId === "tcg_3415", copy);
}

console.log(`\n=== CLEAVE / COPY PROOF (ON_ATTACK splash + bonus, ON_SUMMON copy) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} cleave/copy check(s) failed.`);
  process.exit(1);
}
console.log("ALL CLEAVE/COPY PROOFS PASSED");
