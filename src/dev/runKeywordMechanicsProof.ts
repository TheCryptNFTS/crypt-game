/**
 * dev:keywords — pins the live-reducer keyword mechanics added in the canonical
 * pass: WARD / DIVINE_SHIELD (one-shot damage shield), EXECUTE (finish wounded),
 * DEATHRATTLE (nexus burst on death), REGROW (start-of-turn regen), and SCRY
 * (deterministic deck smoothing).
 *
 * These drive the SAME `applyAction` the live game uses, on crafted board states,
 * so a regression in the reducer's combat / turn flow trips here.
 */

import { applyAction } from "../engine/reducer";
import { scryDeck, applyDamageInstance } from "../engine/keywordEngine";
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

function unit(overrides: Partial<UnitInPlay> & { instanceId: string }): UnitInPlay {
  return {
    cardId: "tcg_test",
    lane: "front",
    attack: 1,
    health: 1,
    maxHealth: 1,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: false,
    summoningSick: false,
    ...overrides,
  };
}

/** A clean match with both boards emptied and P1 to act with full energy. */
function arena(): MatchState {
  const m = makeSeededMatch(4242);
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

// --- WARD: first instance of damage absorbed, then the unit is mortal. -------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "atk", attack: 5, health: 5, maxHealth: 5 })];
  m.players.P2.board.front = [
    unit({ instanceId: "def", attack: 0, health: 3, maxHealth: 3, keywords: ["WARD"], shielded: true }),
  ];
  const r1 = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "def" });
  const def1 = r1.state.players.P2.board.front.find((u) => u.instanceId === "def");
  check("WARD absorbs lethal first hit (defender survives at full)", def1?.health === 3 && def1?.shielded === false, def1);

  // Refresh the attacker and swing again — shield is gone, damage lands.
  const m2 = r1.state;
  const atk = m2.players.P1.board.front.find((u) => u.instanceId === "atk")!;
  atk.exhausted = false;
  const r2 = applyAction(m2, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "def" });
  const def2 = r2.state.players.P2.board.front.find((u) => u.instanceId === "def");
  check("WARD broken: second hit kills the unit", def2 === undefined, def2);
}

// --- EXECUTE: a non-lethal hit that leaves the target <= half max finishes it.
{
  const m = arena();
  // attacker deals 3 to a 6-max / 6-hp unit -> leaves 3 (== half of 6) -> executed.
  m.players.P1.board.front = [unit({ instanceId: "ex", attack: 3, health: 5, maxHealth: 5, keywords: ["EXECUTE"] })];
  m.players.P2.board.front = [unit({ instanceId: "tgt", attack: 0, health: 6, maxHealth: 6 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "ex", defenderInstanceId: "tgt" });
  const tgt = r.state.players.P2.board.front.find((u) => u.instanceId === "tgt");
  check("EXECUTE finishes a defender left at/below half HP", tgt === undefined, tgt);

  // Control: same hit WITHOUT execute leaves the wounded survivor on board.
  const m2 = arena();
  m2.players.P1.board.front = [unit({ instanceId: "ex", attack: 3, health: 5, maxHealth: 5 })];
  m2.players.P2.board.front = [unit({ instanceId: "tgt", attack: 0, health: 6, maxHealth: 6 })];
  const r2 = applyAction(m2, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "ex", defenderInstanceId: "tgt" });
  const tgt2 = r2.state.players.P2.board.front.find((u) => u.instanceId === "tgt");
  check("no EXECUTE: wounded survivor stays at 3 HP", tgt2?.health === 3, tgt2);
}

// --- EXECUTE vs DIVINE_SHIELD: a shield that ABSORBS the hit also blocks the
//     finisher. The defender "survived the hit" untouched (mitigated === 0), so a
//     1-attack EXECUTE attacker cannot snipe a shielded, already-wounded body. This
//     pins the fix to the "EXECUTE bypasses shield" hole (the shield's "first
//     instance of damage absorbed" contract must hold against the finisher too).
{
  const m = arena();
  // EXECUTE attacker with TINY attack; defender shielded AND already at/below half.
  m.players.P1.board.front = [unit({ instanceId: "exs", attack: 1, health: 5, maxHealth: 5, keywords: ["EXECUTE"] })];
  m.players.P2.board.front = [
    unit({ instanceId: "shd", attack: 0, health: 2, maxHealth: 6, keywords: ["DIVINE_SHIELD"], shielded: true }),
  ];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "exs", defenderInstanceId: "shd" });
  const shd = r.state.players.P2.board.front.find((u) => u.instanceId === "shd");
  check("EXECUTE does NOT fire when DIVINE_SHIELD absorbed the hit (defender survives)", shd?.health === 2, shd);
  check("DIVINE_SHIELD was consumed by the absorbed swing", shd?.shielded === false, shd);

  // Follow-up: shield now down, a second EXECUTE swing DOES finish the half-HP body.
  const m2 = r.state;
  const exs = m2.players.P1.board.front.find((u) => u.instanceId === "exs")!;
  exs.exhausted = false;
  const r2 = applyAction(m2, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "exs", defenderInstanceId: "shd" });
  const shd2 = r2.state.players.P2.board.front.find((u) => u.instanceId === "shd");
  check("EXECUTE fires once the shield is gone (defender finished)", shd2 === undefined, shd2);
}

// --- DEATHRATTLE: a unit dying in combat burns the enemy nexus for 2. --------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "atk", attack: 5, health: 5, maxHealth: 5 })];
  m.players.P2.board.front = [unit({ instanceId: "dr", attack: 0, health: 2, maxHealth: 2, keywords: ["DEATHRATTLE"] })];
  const before = m.players.P1.nexusHealth; // P1 is the enemy of the dying P2 unit
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "dr" });
  const dead = r.state.players.P2.board.front.find((u) => u.instanceId === "dr");
  check("DEATHRATTLE unit is removed after dying", dead === undefined);
  check("DEATHRATTLE burns the dead owner's enemy nexus for 2", r.state.players.P1.nexusHealth === before - 2, {
    before,
    after: r.state.players.P1.nexusHealth,
  });
}

// --- REGROW: a wounded unit regenerates to full at the start of its turn. -----
{
  const m = arena();
  m.activePlayer = "P2"; // ending P2 hands the turn to P1, whose board regrows
  m.players.P1.board.front = [unit({ instanceId: "rg", attack: 1, health: 1, maxHealth: 6, keywords: ["REGROW"] })];
  const r = applyAction(m, { type: "END_TURN", player: "P2" });
  const rg = r.state.players.P1.board.front.find((u) => u.instanceId === "rg");
  check("REGROW heals to full at start of controller's turn", rg?.health === 6, rg);
}

// --- SCRY: deterministic top-of-deck smoothing (pure helper). -----------------
{
  const costOf = (id: string) => ({ a: 5, b: 1, c: 3, d: 9 }[id] ?? 0);
  const smoothed = scryDeck(["a", "b", "c", "d"], costOf, 3);
  check("SCRY reorders top N by ascending cost", JSON.stringify(smoothed) === JSON.stringify(["b", "c", "a", "d"]), smoothed);
  const stable = scryDeck(["x", "y"], (id) => ({ x: 2, y: 2 }[id] ?? 0));
  check("SCRY tie-break is deterministic (stable by id)", JSON.stringify(stable) === JSON.stringify(["x", "y"]), stable);
}

// --- BUG 1: SPELL / ABILITY DAMAGE CONSUMES A ONE-SHOT SHIELD ----------------
//     A real catalog-style burn ("deal N damage to target enemy unit") fired at a
//     shielded unit must be ABSORBED (health unchanged) and break the shield, so a
//     SECOND cast then lands. Pins the fix: damageUnit now routes through the same
//     applyDamageInstance layer combat uses, instead of raw `health -= amount`.
{
  const compiled = compileAbility("Charge. When this unit enters play, deal 1 damage to target enemy unit.");
  const spec = compiled.specs.find((s) => s.op === "DEAL_DAMAGE");
  check("catalog burn compiled to DEAL_DAMAGE", !!spec, compiled.specs.map((s) => s.op));

  const m = arena();
  const shielded = unit({
    instanceId: "shd",
    cardId: "tcg_burn_target",
    health: 1,
    maxHealth: 1,
    keywords: ["DIVINE_SHIELD"],
    shielded: true,
  });
  m.players.P2.board.front = [shielded];

  // First cast: shield eats the burn — health unchanged, shield consumed.
  resolveEffect(spec!, { state: m, controller: "P1", target: shielded });
  check("spell damage is absorbed by the shield (health unchanged)", shielded.health === 1, shielded.health);
  check("spell damage CONSUMES the one-shot shield", shielded.shielded === false, shielded);

  // Second cast: shield gone — the 1-HP unit now dies (health drops to 0).
  resolveEffect(spec!, { state: m, controller: "P1", target: shielded });
  check("second spell cast lands and kills the now-unshielded unit", shielded.health <= 0, shielded.health);
}

// --- BUG 2: "health cannot drop below 1" COMPILES TO PASSIVE_FLOOR_HP ---------
//     The plainer phrasing (tcg_6) previously matched only MITIGATE_DAMAGE, so the
//     printed floor never armed. Verify both the compile and the runtime survival.
{
  const compiled = compileAbility("Guard. This unit's health cannot drop below 1.");
  const hasFloor = compiled.specs.some((s) => s.op === "PASSIVE_FLOOR_HP");
  check('"health cannot drop below 1" compiles with PASSIVE_FLOOR_HP', hasFloor, compiled.specs.map((s) => s.op));

  // Runtime: a unit ABOVE 1 carrying the floor survives a big single hit, clamped
  // to exactly 1. NOTE the precise (intended) semantics shared with combat
  // (applyCombatDamage): the floor protects a unit whose health is currently > 1
  // from being driven below 1 by ONE instance — it does NOT make an already-1-HP
  // unit immortal (a unit at/below 1 is untouched by the floor, never healed up).
  const floored = unit({ instanceId: "floor", health: 8, maxHealth: 8 });
  applyDamageInstance(floored, 99, { floorHp: true });
  check("PASSIVE_FLOOR_HP survives a big single hit (clamped to exactly 1)", floored.health === 1, floored.health);
  // Control: WITHOUT the floor, the same hit kills it.
  const mortal = unit({ instanceId: "mortal", health: 8, maxHealth: 8 });
  applyDamageInstance(mortal, 99, {});
  check("no PASSIVE_FLOOR_HP: same big hit is lethal", mortal.health <= 0, mortal.health);
  // Documented edge: a unit ALREADY at 1 HP is NOT protected (matches combat).
  const atOne = unit({ instanceId: "atone", health: 1, maxHealth: 8 });
  applyDamageInstance(atOne, 99, { floorHp: true });
  check("PASSIVE_FLOOR_HP does NOT shield a unit already at 1 HP", atOne.health < 1, atOne.health);
}

// --- BUG 3: CRUSH OVERFLOW IS COMPUTED ON LANDED (POST-FLAT-MITIGATION) DAMAGE -
//     applyDamageInstance returns the post-mitigation points that actually landed.
//     CRUSH overflow = max(0, landed - defHpBefore). A 5-attack swing into a 2-HP
//     defender with 2 flat MITIGATE_DAMAGE lands 3, leaving overflow = 3 - 2 = 1
//     (NOT the old pre-mitigation 5 - 2 = 3). This is the exact over-count the bug
//     produced; we assert the corrected math at the single-source-of-truth layer.
{
  const defHpBefore = 2;
  const defender = unit({ instanceId: "crushed", health: defHpBefore, maxHealth: 2 });
  const landed = applyDamageInstance(defender, 5, { mitigation: 2 });
  check("flat mitigation reduces landed damage (5 - 2 = 3)", landed === 3, landed);
  check("flat-mitigation defender is dead after the swing", defender.health <= 0, defender.health);
  const overflow = Math.max(0, landed - Math.max(0, defHpBefore));
  check("CRUSH overflow uses LANDED minus HP (3 - 2 = 1)", overflow === 1, overflow);

  // Control (no mitigation): same swing lands 5, overflow = 5 - 2 = 3 (unchanged).
  const plain = unit({ instanceId: "plain", health: 2, maxHealth: 2 });
  const plainLanded = applyDamageInstance(plain, 5, {});
  const plainOverflow = Math.max(0, plainLanded - 2);
  check("no mitigation: overflow is the full pre-mitigation value (3)", plainOverflow === 3, plainOverflow);

  // CRUSH vs SHIELD: shield absorbs the whole instance, nothing lands, no overflow.
  const warded = unit({ instanceId: "ward", health: 2, maxHealth: 2, shielded: true });
  const wardLanded = applyDamageInstance(warded, 5, {});
  check("CRUSH vs shield: nothing lands, zero overflow", Math.max(0, wardLanded - 2) === 0 && warded.health === 2, {
    wardLanded,
    health: warded.health,
  });
}

console.log(`\n=== KEYWORD MECHANICS PROOF ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} keyword mechanic check(s) failed.`);
  process.exit(1);
}
console.log("ALL KEYWORD MECHANIC PROOFS PASSED");
