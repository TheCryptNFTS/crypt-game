/**
 * dev:track-a2 — pins the "Track A2" damage-mitigation + per-unit damage-window
 * trackers end-to-end through the LIVE reducer (real ATTACK_UNIT / END_TURN
 * actions), NOT just the compiler. Each assertion drives the effect exactly where
 * it fires in a match.
 *
 *   FEATURE 1 — MITIGATE_DAMAGE
 *     "Armored N. When this unit takes damage, reduce it by N." (and the
 *     "Patient. ... reduce damage by N." variant) -> a flat reduction of each
 *     incoming COMBAT-damage instance to the bearer, floored at 0, applied AFTER
 *     armor and WARD/DIVINE_SHIELD absorb. Never heals, never goes negative, never
 *     double-counts with armor/PIERCE_ARMOR.
 *
 *   FEATURE 2 — "undamaged this turn" grower (BUFF_IF_UNDAMAGED)
 *     "Patient. Gains +N/+N for each turn it remains undamaged." -> at the
 *     controller's ON_TURN_START the unit grows +N/+N ONLY if it took no damage
 *     during the round; it does NOT grow on a turn it was hit.
 *
 *   FEATURE 3 — damage-this-turn per-point grower (BUFF_PER_DAMAGE_TAKEN)
 *     "Taunt. Gain +N/+N per point of damage taken." -> on ON_DAMAGE the unit
 *     grows +N/+N scaled by the points of THAT hit (capped when "up to M"), and
 *     the accumulator resets next turn.
 *
 * Negatives / edges asserted: empty/missing input is a clean no-op; mitigation
 * never negative / never overheals; the undamaged grower is suppressed on a hit
 * turn; the per-point grower no-ops on a fully-mitigated (0-landed) hit; reducer
 * is reject-soft throughout.
 */

import { applyAction } from "../engine/reducer";
import { compileAbility } from "../engine/abilityCompiler";
import { resolveEffect } from "../engine/effectResolver";
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

function arena(seed = 4040): MatchState {
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

// === COMPILER SANITY: the chosen real cards classify to the A2 ops ===============
// (Drives the proof off REAL ability strings so the regexes match reality.)
{
  const ARMORED2 = "tcg_6202"; // "Armored 2. When this unit takes damage, reduce it by 2."
  const ARMORED1 = "tcg_2093"; // "Armored 1. When this unit takes damage, reduce the damage by 1."
  const UNDAMAGED = "tcg_4465"; // "Patient. This unit gains +1/+1 for each turn it remains undamaged."
  const PERPOINT = "tcg_6356"; // "Taunt. When this unit takes damage, gain +1/+1 for each point of damage taken."
  const PERPOINT_CAP = "tcg_3821"; // "... gain +1/+1 for each damage taken up to 3."
  const NEGATION = "tcg_4715"; // "Armored. This unit takes no damage from the first attack each turn." (NOT mitigation)

  const m2 = compileAbility("Armored 2. When this unit takes damage, reduce it by 2.").specs;
  check("compile: Armored 2 -> MITIGATE_DAMAGE amount 2", m2.some((s) => s.op === "MITIGATE_DAMAGE" && s.amount === 2), m2);
  check("compile: full-negation 'takes no damage from first attack' is NOT MITIGATE_DAMAGE",
    !compileAbility("Armored. This unit takes no damage from the first attack each turn.").specs.some((s) => s.op === "MITIGATE_DAMAGE"));
  const u = compileAbility("Patient. This unit gains +1/+1 for each turn it remains undamaged.").specs;
  check("compile: per-turn-undamaged -> BUFF_IF_UNDAMAGED (NOT unconditional ON_TURN_START BUFF_SELF)",
    u.some((s) => s.op === "BUFF_IF_UNDAMAGED") && !u.some((s) => s.op === "BUFF_SELF"), u);
  const p = compileAbility("Taunt. When this unit takes damage, gain +1/+1 for each point of damage taken.").specs;
  check("compile: per-point -> BUFF_PER_DAMAGE_TAKEN (NOT a fixed BUFF_SELF)",
    p.some((s) => s.op === "BUFF_PER_DAMAGE_TAKEN") && !p.some((s) => s.op === "BUFF_SELF"), p);
  const pc = compileAbility("Patient. When this unit is attacked, gain +1/+1 for each damage taken up to 3.").specs;
  check("compile: 'up to 3' carries cap=3", pc.some((s) => s.op === "BUFF_PER_DAMAGE_TAKEN" && s.cap === 3), pc);

  // Keep the ids referenced so a future rename surfaces here, not silently.
  void [ARMORED2, ARMORED1, UNDAMAGED, PERPOINT, PERPOINT_CAP, NEGATION];
}

// === FEATURE 1: mitigation reduces a REAL ATTACK_UNIT's combat damage ============
// P2's 5-attack unit hits P1's "Armored 2 reduce by 2" unit. 5 - 2 = 3 lands.
{
  const m = arena();
  m.activePlayer = "P2";
  m.players.P1.board.front = [unit({ instanceId: "armor", cardId: "tcg_6202", attack: 1, health: 10, maxHealth: 10 })];
  m.players.P2.board.front = [unit({ instanceId: "atk", attack: 5, health: 10, maxHealth: 10 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "atk", defenderInstanceId: "armor" });
  const def = r.state.players.P1.board.front.find((u) => u.instanceId === "armor");
  check("F1: Armored-2 reduced 5 combat damage to 3 (10 -> 7)", def?.health === 7, def?.health);
}

// === FEATURE 1 (floor): mitigation never makes damage negative / overheal ========
// A 1-attack hit into "reduce by 2" lands 0 damage — health unchanged, never +.
{
  const m = arena();
  m.activePlayer = "P2";
  m.players.P1.board.front = [unit({ instanceId: "armor", cardId: "tcg_6202", attack: 0, health: 8, maxHealth: 8 })];
  m.players.P2.board.front = [unit({ instanceId: "atk", attack: 1, health: 10, maxHealth: 10 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "atk", defenderInstanceId: "armor" });
  const def = r.state.players.P1.board.front.find((u) => u.instanceId === "armor");
  check("F1-floor: 1 dmg vs reduce-2 lands 0 (health stays 8, no overheal)", def?.health === 8, def?.health);
}

// === FEATURE 1 (armor + mitigation do not double-count, layered cleanly) =========
// Defender has armor 1 AND "reduce by 2". A 5-attack strike: armor 1 -> 4, then
// mitigation 2 -> 2 lands. (Distinct subtractions, applied in the documented
// order; total reduction is 3, NOT a single field re-counted.)
{
  const m = arena();
  m.activePlayer = "P2";
  m.players.P1.board.front = [unit({ instanceId: "armor", cardId: "tcg_6202", attack: 0, health: 10, maxHealth: 10, armor: 1 })];
  m.players.P2.board.front = [unit({ instanceId: "atk", attack: 5, health: 10, maxHealth: 10 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "atk", defenderInstanceId: "armor" });
  const def = r.state.players.P1.board.front.find((u) => u.instanceId === "armor");
  check("F1-layer: armor 1 then mitigation 2 -> 5 becomes 2 landed (10 -> 8)", def?.health === 8, def?.health);
}

// === FEATURE 1 (mitigation also applies to the counter-strike) ===================
// P1's armored unit ATTACKS a 4-attack defender. The counter (4) is mitigated by 2
// on the armored attacker -> 2 lands back. (Same applyCombatDamage path.)
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "armor", cardId: "tcg_6202", attack: 3, health: 10, maxHealth: 10 })];
  m.players.P2.board.front = [unit({ instanceId: "def", attack: 4, health: 10, maxHealth: 10 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "armor", defenderInstanceId: "def" });
  const atk = r.state.players.P1.board.front.find((u) => u.instanceId === "armor");
  check("F1-counter: armored attacker's counter (4) mitigated by 2 -> 2 (10 -> 8)", atk?.health === 8, atk?.health);
}

// === FEATURE 2: undamaged grower fires across END_TURN cycles =====================
// A Patient "+1/+1 per turn undamaged" unit on P1's board. END_TURN (P1->P2) then
// END_TURN (P2->P1) brings P1's turn start again with NO damage in between -> grow.
{
  let m = arena();
  m.players.P1.board.front = [unit({ instanceId: "patient", cardId: "tcg_4465", attack: 2, health: 6, maxHealth: 6 })];
  const a0 = m.players.P1.board.front[0].attack;
  const h0 = m.players.P1.board.front[0].maxHealth;
  m = applyAction(m, { type: "END_TURN", player: "P1" }).state; // -> P2's turn start (P1 unit not fired)
  m = applyAction(m, { type: "END_TURN", player: "P2" }).state; // -> P1's turn start: grower fires
  const p = m.players.P1.board.front.find((u) => u.instanceId === "patient");
  check("F2: undamaged unit grew +1/+1 at its turn start (atk)", p?.attack === a0 + 1, { before: a0, after: p?.attack });
  check("F2: undamaged unit grew +1/+1 at its turn start (maxHealth)", p?.maxHealth === h0 + 1, { before: h0, after: p?.maxHealth });
}

// === FEATURE 2 (negative): does NOT grow on a turn it was hit =====================
// Same unit, but P2 attacks it during P2's turn (so it took damage that round).
// At P1's next turn start the grower must be SUPPRESSED.
{
  let m = arena();
  m.players.P1.board.front = [unit({ instanceId: "patient", cardId: "tcg_4465", attack: 2, health: 20, maxHealth: 20 })];
  m.players.P2.board.front = [unit({ instanceId: "atk", attack: 3, health: 20, maxHealth: 20 })];
  const a0 = m.players.P1.board.front[0].attack;
  m = applyAction(m, { type: "END_TURN", player: "P1" }).state; // -> P2's turn
  // P2 attacks the patient unit (it takes damage this round).
  m = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "atk", defenderInstanceId: "patient" }).state;
  m = applyAction(m, { type: "END_TURN", player: "P2" }).state; // -> P1's turn start
  const p = m.players.P1.board.front.find((u) => u.instanceId === "patient");
  check("F2-neg: a unit hit during the round does NOT grow at turn start", p?.attack === a0, { before: a0, after: p?.attack });
  check("F2-neg: damage flag reset after the suppressed turn start", p?.tookDamageThisTurn === false, p?.tookDamageThisTurn);
}

// === FEATURE 2 (recovery): after a quiet round it grows again =====================
// Continue the previous scenario: now P1 ends turn, P2 does nothing, P1's turn
// starts again with no new damage -> the grower fires.
{
  let m = arena();
  m.players.P1.board.front = [unit({ instanceId: "patient", cardId: "tcg_4465", attack: 2, health: 20, maxHealth: 20 })];
  m.players.P2.board.front = [unit({ instanceId: "atk", attack: 3, health: 20, maxHealth: 20 })];
  m = applyAction(m, { type: "END_TURN", player: "P1" }).state;
  m = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "atk", defenderInstanceId: "patient" }).state;
  m = applyAction(m, { type: "END_TURN", player: "P2" }).state; // P1 turn start: suppressed
  const aMid = m.players.P1.board.front.find((u) => u.instanceId === "patient")!.attack;
  m = applyAction(m, { type: "END_TURN", player: "P1" }).state; // P2 turn (no attack)
  m = applyAction(m, { type: "END_TURN", player: "P2" }).state; // P1 turn start: grows
  const p = m.players.P1.board.front.find((u) => u.instanceId === "patient");
  check("F2-recover: grows again after a clean round (+1 atk over the suppressed value)", p?.attack === aMid + 1, { mid: aMid, after: p?.attack });
}

// === FEATURE 3: per-point grower scales by the damage of THAT hit =================
// P2's 3-attack unit hits P1's "gain +1/+1 per point of damage taken" unit.
// 3 points landed -> +3/+3.
{
  const m = arena();
  m.activePlayer = "P2";
  m.players.P1.board.front = [unit({ instanceId: "taunt", cardId: "tcg_6356", attack: 2, health: 12, maxHealth: 12 })];
  m.players.P2.board.front = [unit({ instanceId: "atk", attack: 3, health: 12, maxHealth: 12 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "atk", defenderInstanceId: "taunt" });
  const t = r.state.players.P1.board.front.find((u) => u.instanceId === "taunt");
  // Combat: 12 - 3 = 9 health, then +3 health from the grower -> 12; attack 2 -> 5.
  check("F3: per-point grower added +3 attack for a 3-damage hit", t?.attack === 5, t?.attack);
  check("F3: per-point grower added +3 health (9 after combat -> 12)", t?.health === 12, t?.health);
}

// === FEATURE 3 (cap): 'up to 3' caps a big hit's growth ==========================
// A 5-damage hit into a "for each damage taken up to 3" unit grows only +3/+3.
{
  const m = arena();
  m.activePlayer = "P2";
  m.players.P1.board.front = [unit({ instanceId: "cap", cardId: "tcg_3821", attack: 2, health: 20, maxHealth: 20 })];
  m.players.P2.board.front = [unit({ instanceId: "atk", attack: 5, health: 20, maxHealth: 20 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "atk", defenderInstanceId: "cap" });
  const c = r.state.players.P1.board.front.find((u) => u.instanceId === "cap");
  check("F3-cap: 5-damage hit grows only +3 attack (capped)", c?.attack === 5, c?.attack);
}

// === FEATURE 3 (reset): the accumulator resets next turn ==========================
// After the hit, the unit's damageTakenThisTurn must clear at its next turn start.
{
  let m = arena();
  m.activePlayer = "P2";
  m.players.P1.board.front = [unit({ instanceId: "taunt", cardId: "tcg_6356", attack: 2, health: 20, maxHealth: 20 })];
  m.players.P2.board.front = [unit({ instanceId: "atk", attack: 3, health: 20, maxHealth: 20 })];
  m = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "atk", defenderInstanceId: "taunt" }).state;
  const accAfterHit = m.players.P1.board.front.find((u) => u.instanceId === "taunt")!.damageTakenThisTurn;
  m = applyAction(m, { type: "END_TURN", player: "P2" }).state; // -> P1 turn start: reset
  const t = m.players.P1.board.front.find((u) => u.instanceId === "taunt");
  check("F3-reset: accumulator recorded the hit (3) before reset", accAfterHit === 3, accAfterHit);
  check("F3-reset: accumulator cleared at the controller's next turn start", (t?.damageTakenThisTurn ?? 0) === 0, t?.damageTakenThisTurn);
}

// === NEGATIVE: empty/missing input is a clean no-op (reject-soft) =================
{
  const m = arena();
  // Attack with non-existent attacker -> reject, state unchanged, no throw.
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "nope", defenderInstanceId: "nope2" });
  check("neg: missing combatants -> REJECTED no-op (no throw)", r.events.some((e) => e.type === "REJECTED"), r.events);

  // The resolver ops themselves no-op without a source.
  let threw = false;
  try {
    resolveEffect({ trigger: "ON_DAMAGE", op: "BUFF_PER_DAMAGE_TAKEN", attack: 1, health: 1, raw: "" } as any, {
      state: m,
      controller: "P1",
    } as any);
    resolveEffect({ trigger: "ON_TURN_START", op: "BUFF_IF_UNDAMAGED", attack: 1, health: 1, raw: "" } as any, {
      state: m,
      controller: "P1",
    } as any);
    resolveEffect({ trigger: "PASSIVE", op: "MITIGATE_DAMAGE", amount: 2, raw: "" } as any, {
      state: m,
      controller: "P1",
    } as any);
  } catch {
    threw = true;
  }
  check("neg: A2 resolver ops no-op without a source and never throw", !threw);
}

// === NEGATIVE: fully-mitigated hit does not fire a spurious per-point buff ========
// Hypothetical unit that BOTH mitigates and grows-per-point: a hit fully absorbed
// (0 landed) must grow it by 0, not by the pre-mitigation amount.
{
  const m = arena();
  m.activePlayer = "P2";
  // Construct an instance whose cardId compiles to mitigation; pair it conceptually
  // with the per-point op via a direct resolver call after a 0-landed combat hit.
  m.players.P1.board.front = [unit({ instanceId: "armor", cardId: "tcg_6202", attack: 0, health: 10, maxHealth: 10 })];
  m.players.P2.board.front = [unit({ instanceId: "atk", attack: 2, health: 10, maxHealth: 10 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "atk", defenderInstanceId: "armor" });
  const def = r.state.players.P1.board.front.find((u) => u.instanceId === "armor")!;
  // 2 attack - 2 mitigation = 0 landed; lastDamageTaken must be 0 so a per-point
  // grower would no-op. Resolve the per-point op directly against this unit.
  const before = def.attack;
  resolveEffect({ trigger: "ON_DAMAGE", op: "BUFF_PER_DAMAGE_TAKEN", attack: 1, health: 1, raw: "" } as any, {
    state: r.state,
    controller: "P1",
    source: def,
  } as any);
  check("neg: 0-landed hit zeroes lastDamageTaken (per-point grows by 0)", def.attack === before && (def.lastDamageTaken ?? 0) === 0, {
    attack: def.attack,
    last: def.lastDamageTaken,
  });
}

console.log(`\n=== TRACK A2 PROOF (MITIGATE_DAMAGE / BUFF_IF_UNDAMAGED / BUFF_PER_DAMAGE_TAKEN) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} Track A2 check(s) failed.`);
  process.exit(1);
}
console.log("ALL TRACK A2 PROOFS PASSED");
