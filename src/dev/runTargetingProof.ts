/**
 * dev:targeting — Phase E. Over the runtime-playable pool there are NO
 * "choose a target" battlecries; every targeted op resolves against a
 * contextually-known unit. This pins the one remaining case: Decay's ON_ATTACK
 * DEBUFF_ENEMY lands on the DEFENDER the unit strikes, driven end-to-end through
 * `applyAction` with a real card id.
 *
 *   DECAY  tcg_52  "Enemy hit by this loses 1 attack next turn." -> DEBUFF_ENEMY(1)
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

function arena(seed = 5150): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].energy = 10;
    m.players[p].maxEnergy = 10;
  }
  return m;
}

// --- DECAY: the struck defender loses attack. ---------------------------------
{
  const m = arena();
  // Decayer attacks a healthy defender that survives the hit, so we can read its
  // post-combat attack. Decayer 2 atk vs defender 9 hp -> defender lives at 7.
  m.players.P1.board.front = [unit({ instanceId: "decayer", cardId: "tcg_52", attack: 2, health: 8, maxHealth: 8 })];
  m.players.P2.board.front = [unit({ instanceId: "victim", cardId: "tcg_test", attack: 5, health: 9, maxHealth: 9 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "decayer", defenderInstanceId: "victim" });
  const victim = r.state.players.P2.board.front.find((u) => u.instanceId === "victim");
  check("DECAY lowers the struck defender's attack (5 -> 4)", victim?.attack === 4, victim);
  check("DECAY leaves the defender's HP to normal combat (9 - 2 = 7)", victim?.health === 7, victim);
}

// Decay's debuff floors at 0 and never touches the attacker's own allies.
{
  const m = arena();
  m.players.P1.board.front = [
    unit({ instanceId: "decayer", cardId: "tcg_52", attack: 1, health: 8, maxHealth: 8 }),
    unit({ instanceId: "myAlly", cardId: "tcg_test", attack: 3, health: 5, maxHealth: 5 }),
  ];
  m.players.P2.board.front = [unit({ instanceId: "weak", cardId: "tcg_test", attack: 0, health: 9, maxHealth: 9 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "decayer", defenderInstanceId: "weak" });
  const weak = r.state.players.P2.board.front.find((u) => u.instanceId === "weak");
  const ally = r.state.players.P1.board.front.find((u) => u.instanceId === "myAlly");
  check("DECAY floors enemy attack at 0 (0 - 1 -> 0)", weak?.attack === 0, weak);
  check("DECAY does not touch the attacker's own allies (ally stays 3)", ally?.attack === 3, ally);
}

// Decay on a FACE swing has no unit defender, so nothing is debuffed (no crash).
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "decayer", cardId: "tcg_52", attack: 4, health: 8, maxHealth: 8 })];
  const r = applyAction(m, { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "decayer" });
  check("DECAY on face is a safe no-op (nexus 20 -> 16)", r.state.players.P2.nexusHealth === 16, r.state.players.P2.nexusHealth);
}

console.log(`\n=== TARGETING PROOF (Phase E: Decay -> struck defender) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} targeting check(s) failed.`);
  process.exit(1);
}
console.log("ALL TARGETING PROOFS PASSED");
