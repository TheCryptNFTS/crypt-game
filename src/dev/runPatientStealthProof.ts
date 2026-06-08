/**
 * dev:patient-stealth — pins TWO legality-gate fixes that previously parsed a
 * rule but never enforced it (the same class as the summoning-sickness gap):
 *
 *   BUG 1 — PATIENT "this unit cannot attack" is now enforced. PATIENT units emit
 *   a STATIC `RESTRICT_ATTACK` spec (abilityCompiler.ts `case "patient"`). The
 *   reducer now rejects ATTACK_UNIT and ATTACK_FACE from such a unit with
 *   `attacker-cannot-attack`, while a non-PATIENT unit of the SAME age swings
 *   freely, and Fear (defender-side PASSIVE RESTRICT_ATTACK) is unaffected.
 *
 *   BUG 2 — targeted spells/battlecries no longer bypass STEALTH. A damage spell
 *   aimed at an un-revealed stealthed ENEMY unit is rejected with
 *   `spell-target-stealthed`; the same spell lands on a non-stealthed enemy. Your
 *   OWN stealthed units stay targetable by your own spells.
 *
 * Real catalog ids (confirmed by compiling the live catalog):
 *   tcg_32     PATIENT — "This unit cannot attack but grants +1/+1 ..." (STATIC RESTRICT_ATTACK)
 *   tcg_373    FEAR    — "Enemy units 2 cost or less cannot attack this." (PASSIVE RESTRICT_ATTACK, threshold 2)
 *   spell_bolt SPELL   — "On play: deal 4 damage." (DEAL_DAMAGE 4)
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
    attack: 3,
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

function arena(seed = 7777): MatchState {
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

// --- BUG 1: PATIENT cannot ATTACK_FACE, normal unit of same age can -------------
{
  const m = arena();
  // Both attackers are equally "ready": not exhausted, not summoning sick.
  m.players.P1.board.front = [
    unit({ instanceId: "patient", cardId: "tcg_32" }),
    unit({ instanceId: "normal", cardId: "tcg_test_vanilla" }),
  ];
  const rPatient = applyAction(m, { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "patient" } as any);
  check(
    "PATIENT unit is rejected from ATTACK_FACE with attacker-cannot-attack",
    (rPatient.events ?? []).some((e: any) => e.type === "REJECTED" && e.reason === "attacker-cannot-attack"),
    rPatient.events
  );
  const rNormal = applyAction(m, { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "normal" } as any);
  check(
    "non-PATIENT unit of the SAME age swings the face (no attacker-cannot-attack)",
    !(rNormal.events ?? []).some((e: any) => e.type === "REJECTED"),
    rNormal.events
  );
}

// --- BUG 1: PATIENT cannot ATTACK_UNIT either -----------------------------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "patient", cardId: "tcg_32" })];
  m.players.P2.board.front = [unit({ instanceId: "victim", cardId: "tcg_test_vanilla" })];
  const r = applyAction(m, {
    type: "ATTACK_UNIT",
    player: "P1",
    attackerInstanceId: "patient",
    defenderInstanceId: "victim",
  } as any);
  check(
    "PATIENT unit is rejected from ATTACK_UNIT with attacker-cannot-attack",
    (r.events ?? []).some((e: any) => e.type === "REJECTED" && e.reason === "attacker-cannot-attack"),
    r.events
  );
}

// --- BUG 1 GUARDRAIL: Fear (defender PASSIVE RESTRICT_ATTACK) still works --------
{
  const m = arena();
  // A 1-cost (<= threshold 2) attacker vs a Fear defender -> attacker-feared, NOT
  // attacker-cannot-attack. Proves the STATIC gate didn't bleed into Fear.
  m.players.P1.board.front = [unit({ instanceId: "smallatk", cardId: "tcg_test_vanilla" })];
  m.players.P2.board.front = [unit({ instanceId: "feardef", cardId: "tcg_373" })];
  const r = applyAction(m, {
    type: "ATTACK_UNIT",
    player: "P1",
    attackerInstanceId: "smallatk",
    defenderInstanceId: "feardef",
  } as any);
  check(
    "Fear still rejects a low-cost attacker with attacker-feared (not attacker-cannot-attack)",
    (r.events ?? []).some((e: any) => e.type === "REJECTED" && e.reason === "attacker-feared"),
    r.events
  );
}

// --- BUG 2: damage spell vs a STEALTHED enemy is rejected; vs a normal enemy lands
{
  // Stealthed enemy target -> spell-target-stealthed reject, target untouched.
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "ghost", cardId: "tcg_test_vanilla", health: 6, maxHealth: 6, stealthed: true } as any)];
  m.players.P1.hand = ["spell_bolt", ...m.players.P1.hand];
  const r = applyAction(m, {
    type: "PLAY_SPELL",
    player: "P1",
    handIndex: 0,
    targetInstanceId: "ghost",
  } as any);
  check(
    "damage spell on a STEALTHED enemy is rejected with spell-target-stealthed",
    (r.events ?? []).some((e: any) => e.type === "REJECTED" && e.reason === "spell-target-stealthed"),
    r.events
  );
  const ghost = r.state.players.P2.board.front.find((u: any) => u.instanceId === "ghost");
  check("STEALTHED enemy took no damage (6 -> 6)", ghost?.health === 6, ghost?.health);
}
{
  // Same spell on a NON-stealthed enemy lands for 4.
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "open", cardId: "tcg_test_vanilla", health: 6, maxHealth: 6 })];
  m.players.P1.hand = ["spell_bolt", ...m.players.P1.hand];
  const r = applyAction(m, {
    type: "PLAY_SPELL",
    player: "P1",
    handIndex: 0,
    targetInstanceId: "open",
  } as any);
  check(
    "same spell on a NON-stealthed enemy is NOT rejected",
    !(r.events ?? []).some((e: any) => e.type === "REJECTED"),
    r.events
  );
  const open = r.state.players.P2.board.front.find((u: any) => u.instanceId === "open");
  check("NON-stealthed enemy took 4 damage (6 -> 2)", open?.health === 2, open?.health);
}

console.log(`\n=== PATIENT + STEALTH LEGALITY PROOF ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} patient/stealth check(s) failed.`);
  process.exit(1);
}
console.log("ALL PATIENT/STEALTH PROOFS PASSED");
