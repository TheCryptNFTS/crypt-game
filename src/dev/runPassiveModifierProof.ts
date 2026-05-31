/**
 * dev:passives — pins the Phase D passive combat modifiers END-TO-END through
 * `applyAction`, using REAL card ids so the reducer's cardId -> ability lookup is
 * exercised exactly as in a match:
 *
 *   JUDGMENT  tcg_146  "Strike ignores enemy armor."          -> PIERCE_ARMOR
 *   FEAR      tcg_373  "Enemy units 2 cost or less cannot attack this." -> RESTRICT_ATTACK(2)
 *
 * Judgment is the ATTACKER's keyword (its strike pierces armor; the defender's
 * counter is unaffected). Fear is the DEFENDER's keyword (low-cost attackers are
 * rejected). Attacker cost is read from the live catalog via the attacker's
 * cardId — tcg_146 (cost 6) is a legal Fear attacker; tcg_test (cost 0) is not.
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

function arena(seed = 9191): MatchState {
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

// --- JUDGMENT: attacker ignores defender armor. -------------------------------
{
  // Control: a plain 6-attacker into 4-armor defender -> 6-4 = 2 dmg.
  const c = arena();
  c.players.P1.board.front = [unit({ instanceId: "plain", cardId: "tcg_test", attack: 6, health: 9, maxHealth: 9 })];
  c.players.P2.board.front = [unit({ instanceId: "wall", cardId: "tcg_test", attack: 0, health: 9, maxHealth: 9, armor: 4 })];
  const wallC = applyAction(c, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "plain", defenderInstanceId: "wall" })
    .state.players.P2.board.front.find((u) => u.instanceId === "wall");
  check("control: 6 atk vs 4 armor -> 2 dmg (9 -> 7)", wallC?.health === 7, wallC);

  // Judgment (tcg_146): same 6 attack, but armor is ignored -> full 6 dmg.
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "judge", cardId: "tcg_146", attack: 6, health: 9, maxHealth: 9 })];
  m.players.P2.board.front = [unit({ instanceId: "wall", cardId: "tcg_test", attack: 0, health: 9, maxHealth: 9, armor: 4 })];
  const wall = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "judge", defenderInstanceId: "wall" })
    .state.players.P2.board.front.find((u) => u.instanceId === "wall");
  check("JUDGMENT ignores 4 armor -> full 6 dmg (9 -> 3)", wall?.health === 3, wall);
}

// Judgment does NOT help the defender's counter (it rides only on the attacker).
{
  const m = arena();
  // Judge attacks a defender that itself has armor on its counter path? No: the
  // counter is the DEFENDER striking the attacker; the attacker's own armor still
  // applies normally. Defender 5 atk vs attacker 3 armor -> counter 5-3 = 2.
  m.players.P1.board.front = [unit({ instanceId: "judge", cardId: "tcg_146", attack: 6, health: 9, maxHealth: 9, armor: 3 })];
  m.players.P2.board.front = [unit({ instanceId: "biter", cardId: "tcg_test", attack: 5, health: 9, maxHealth: 9 })];
  const judge = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "judge", defenderInstanceId: "biter" })
    .state.players.P1.board.front.find((u) => u.instanceId === "judge");
  check("JUDGMENT does not pierce the defender's counter (5-3=2 -> 9-2=7)", judge?.health === 7, judge);
}

// --- FEAR: low-cost attackers cannot strike the Fear unit. --------------------
{
  // Attacker cost 0 (tcg_test) <= threshold 2 -> rejected, no damage.
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "runt", cardId: "tcg_test", attack: 4, health: 6, maxHealth: 6 })];
  m.players.P2.board.front = [unit({ instanceId: "dread", cardId: "tcg_373", attack: 0, health: 6, maxHealth: 6 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "runt", defenderInstanceId: "dread" });
  const dread = r.state.players.P2.board.front.find((u) => u.instanceId === "dread");
  check("FEAR rejects a low-cost attacker (full HP, REJECTED event)",
    dread?.health === 6 && r.events.some((e) => e.type === "REJECTED" && (e as any).reason === "attacker-feared"), { dread, events: r.events.map((e) => e.type) });

  // Attacker cost 6 (tcg_146, above threshold 2) -> attack lands normally.
  const m2 = arena();
  m2.players.P1.board.front = [unit({ instanceId: "big", cardId: "tcg_146", attack: 4, health: 6, maxHealth: 6 })];
  m2.players.P2.board.front = [unit({ instanceId: "dread", cardId: "tcg_373", attack: 0, health: 6, maxHealth: 6 })];
  const dread2 = applyAction(m2, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "big", defenderInstanceId: "dread" })
    .state.players.P2.board.front.find((u) => u.instanceId === "dread");
  check("FEAR allows an above-threshold attacker (cost 6 lands 4 dmg -> 2)", dread2?.health === 2, dread2);
}

// Fear does NOT block the nexus (it only protects the unit itself).
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "runt", cardId: "tcg_test", attack: 4, health: 6, maxHealth: 6 })];
  m.players.P2.board.front = [unit({ instanceId: "dread", cardId: "tcg_373", attack: 0, health: 6, maxHealth: 6 })];
  const r = applyAction(m, { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "runt" });
  check("FEAR does not block ATTACK_FACE (nexus 20 -> 16)", r.state.players.P2.nexusHealth === 16, r.state.players.P2.nexusHealth);
}

console.log(`\n=== PASSIVE MODIFIER PROOF (Phase D: JUDGMENT / FEAR) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} passive-modifier check(s) failed.`);
  process.exit(1);
}
console.log("ALL PASSIVE MODIFIER PROOFS PASSED");
