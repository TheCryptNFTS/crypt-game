/**
 * dev:turnend — pins the ON_TURN_END trigger wiring END-TO-END through
 * `applyAction`. ON_TURN_END fires for the units of the player whose turn is
 * ENDING (before control passes), for the deterministic self-targeted effects:
 *
 *   DECAY self-damage   tcg_4492  "...this unit loses 1 health..."
 *   DECAY damage + buff  tcg_5889  "...loses 1 health and gains +1 attack."
 *   PATIENT self-heal    tcg_764   "...restore 1 health to this unit."
 *
 * Also pins the patient-branch split: the EOT-regenerator Patient (self-heal)
 * must NOT be treated as the turn-start GROWER (tcg_38) — it heals, it does not
 * gain +1/+1 each turn.
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

function arena(seed = 7531): MatchState {
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

// --- DECAY: self-damage at the end of its controller's turn. -------------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "rot", cardId: "tcg_4492", attack: 2, health: 5, maxHealth: 5 })];
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  const rot = find(r.state, "P1", "rot");
  check("DECAY loses 1 health at its turn-end (5 -> 4)", rot?.health === 4, rot);
}

// --- DECAY at 1 HP decays to death and is reaped from the board. ---------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "frail", cardId: "tcg_4492", attack: 2, health: 1, maxHealth: 5 })];
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  check("DECAY at 1 HP dies and is removed from the board", find(r.state, "P1", "frail") === undefined, r.state.players.P1.board.front.map((u) => u.instanceId));
}

// --- DECAY+buff: loses 1 health AND gains +1 attack. ---------------------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "feral", cardId: "tcg_5889", attack: 2, health: 5, maxHealth: 5 })];
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  const f = find(r.state, "P1", "feral");
  check("DECAY+buff loses 1 HP and gains +1 attack (2/5 -> 3/4)", f?.attack === 3 && f?.health === 4, f);
}

// --- PATIENT EOT regenerator: self-heals, capped at maxHealth, no attack grow. -
{
  const m = arena();
  // Damaged 3/6 Patient regenerator. Heals 1 -> 4/6. Attack must NOT grow.
  m.players.P1.board.front = [unit({ instanceId: "mend", cardId: "tcg_764", attack: 2, health: 3, maxHealth: 6 })];
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  const mend = find(r.state, "P1", "mend");
  check("PATIENT regenerator self-heals 1 at turn-end (3 -> 4)", mend?.health === 4, mend);
  check("PATIENT regenerator does NOT grow attack (stays 2)", mend?.attack === 2, mend);

  // Full-health regenerator does not overheal past maxHealth.
  const m2 = arena();
  m2.players.P1.board.front = [unit({ instanceId: "full", cardId: "tcg_764", attack: 2, health: 6, maxHealth: 6 })];
  const r2 = applyAction(m2, { type: "END_TURN", player: "P1" });
  check("PATIENT regenerator does not overheal past maxHealth (6 -> 6)", find(r2.state, "P1", "full")?.health === 6);
}

// --- ON_TURN_END fires only for the ENDING player's units. ---------------------
{
  const m = arena();
  // P2's decay unit must NOT lose health when P1 ends its turn (it is P2's turn
  // that begins, not ends).
  m.players.P2.board.front = [unit({ instanceId: "p2rot", cardId: "tcg_4492", attack: 2, health: 5, maxHealth: 5 })];
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  check("ON_TURN_END does NOT fire for the beginning player (P2 decay stays 5)", find(r.state, "P2", "p2rot")?.health === 5, find(r.state, "P2", "p2rot"));
}

console.log(`\n=== TURN-END PROOF (Phase: ON_TURN_END self-decay / self-heal) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} turn-end check(s) failed.`);
  process.exit(1);
}
console.log("ALL TURN-END PROOFS PASSED");
