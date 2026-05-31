/**
 * dev:turnstart — pins the ON_TURN_START trigger wiring END-TO-END through
 * `applyAction`. PATIENT units ("this unit gains +1/+1 for each turn it remains
 * in play") grow at the start of each of their controller's turns. The reducer
 * fires ON_TURN_START for every unit of the player whose turn is beginning.
 *
 *   PATIENT  tcg_38  "Patient. This unit gains +1/+1 for each turn it remains..."
 *
 * Also pins the passiveSpec fix: Patient emits a STATIC RESTRICT_ATTACK ("cannot
 * attack") marker that must NOT bleed into Fear's defender logic — a low-cost
 * attacker can still strike a Patient unit.
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

function arena(seed = 8642): MatchState {
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
  s.players[p].board.front.find((u) => u.instanceId === id);

/** End both players' turns once, returning to P1's turn-start. */
function fullRound(s: MatchState): MatchState {
  const a = applyAction(s, { type: "END_TURN", player: "P1" });
  const b = applyAction(a.state, { type: "END_TURN", player: "P2" });
  return b.state;
}

// --- PATIENT grows +1/+1 at the start of each of its controller's turns. -------
{
  const m = arena();
  m.players.P1.board.front = [
    unit({ instanceId: "patient", cardId: "tcg_38", attack: 2, health: 5, maxHealth: 5 }),
    unit({ instanceId: "plain", cardId: "tcg_test", attack: 2, health: 5, maxHealth: 5 }),
  ];

  // One full round -> P1's turn begins once -> Patient grew once (+1/+1).
  const r1 = fullRound(m);
  const p1 = find(r1, "P1", "patient");
  const plain1 = find(r1, "P1", "plain");
  check("PATIENT grows +1/+1 on its turn-start (2/5 -> 3/6)", p1?.attack === 3 && p1?.health === 6 && p1?.maxHealth === 6, p1);
  check("non-Patient unit does NOT grow (stays 2/5)", plain1?.attack === 2 && plain1?.health === 5, plain1);

  // A second full round -> grew twice total (+2/+2).
  const r2 = fullRound(r1);
  const p2 = find(r2, "P1", "patient");
  check("PATIENT keeps growing each turn (2/5 -> 4/7 after 2 turns)", p2?.attack === 4 && p2?.health === 7 && p2?.maxHealth === 7, p2);
}

// --- ON_TURN_START fires only for the player whose turn begins. ----------------
{
  const m = arena();
  // Patient sits on P2's board. Ending P1's turn begins P2's turn -> P2's Patient
  // grows; P1 has no turn-start in this single step.
  m.players.P2.board.front = [unit({ instanceId: "p2pat", cardId: "tcg_38", attack: 2, health: 5, maxHealth: 5 })];
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  const p2pat = find(r.state, "P2", "p2pat");
  check("ON_TURN_START fires for the beginning player's units (P2 Patient 2/5 -> 3/6)", p2pat?.attack === 3 && p2pat?.health === 6, p2pat);
}

// --- passiveSpec fix: Patient's STATIC RESTRICT_ATTACK is NOT Fear. ------------
{
  const m = arena();
  // A cost-0 attacker (tcg_test) strikes a Patient defender. Before the fix, the
  // Patient STATIC RESTRICT_ATTACK (threshold 0) would reject it as "feared".
  m.players.P1.board.front = [unit({ instanceId: "runt", cardId: "tcg_test", attack: 4, health: 6, maxHealth: 6 })];
  m.players.P2.board.front = [unit({ instanceId: "pat", cardId: "tcg_38", attack: 0, health: 8, maxHealth: 8 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "runt", defenderInstanceId: "pat" });
  const pat = find(r.state, "P2", "pat");
  const rejected = r.events.some((e) => e.type === "REJECTED");
  check("Patient is NOT a Fear unit — low-cost attacker lands (8 -> 4, no REJECT)", pat?.health === 4 && !rejected, { pat, events: r.events.map((e) => e.type) });
}

console.log(`\n=== TURN-START PROOF (Phase: ON_TURN_START Patient growth) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} turn-start check(s) failed.`);
  process.exit(1);
}
console.log("ALL TURN-START PROOFS PASSED");
