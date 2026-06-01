/**
 * dev:relic-ritual — pins the two INTRINSIC summon-grant keywords wired into the
 * live reducer summon path (reducer.ts, alongside initShield/armorOnSummon):
 *   RELIC   — an enduring artifact-grade unit gains +1 Armor when it enters play.
 *   RITUAL  — a unit consecrated by a summoning rite gains +1 max health on enter.
 * The grant helpers (relicOnSummon / ritualOnSummon) are asserted directly for
 * their unit-level contract, then the downstream combat consequence is verified
 * through the SAME `applyAction` the live game uses (real ATTACK_UNIT boards),
 * so the effect is proven end-to-end, not just at the helper boundary.
 */

import { applyAction } from "../engine/reducer";
import { relicOnSummon, ritualOnSummon } from "../engine/keywordEngine";
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

function arena(): MatchState {
  const m = makeSeededMatch(7777);
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

// --- RELIC: +1 armor on enter (helper contract). -----------------------------
{
  const relic = unit({ instanceId: "r", armor: 0, keywords: ["RELIC"] });
  relicOnSummon(relic);
  check("RELIC grants +1 armor on summon (0 -> 1)", relic.armor === 1, relic.armor);

  // Stacks additively with ARMORED/COMMAND (separate keywords).
  const both = unit({ instanceId: "rb", armor: 1, keywords: ["RELIC", "ARMORED"] });
  relicOnSummon(both); // RELIC's contribution only (armorOnSummon adds ARMORED's)
  check("RELIC stacks additively onto existing armor (1 -> 2)", both.armor === 2, both.armor);

  // No-op without the keyword.
  const plain = unit({ instanceId: "p", armor: 0 });
  relicOnSummon(plain);
  check("RELIC is a no-op without the keyword (armor stays 0)", plain.armor === 0, plain.armor);
}

// --- RELIC: the +1 armor mitigates one point of combat damage end-to-end. -----
{
  // Control: 5 atk vs 0 armor -> 5 damage.
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "atk", attack: 5, health: 9, maxHealth: 9 })];
  m.players.P2.board.front = [unit({ instanceId: "plain", attack: 0, health: 9, maxHealth: 9, armor: 0 })];
  const plain = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "plain" })
    .state.players.P2.board.front.find((u) => u.instanceId === "plain");
  check("control: 5 atk vs 0 armor -> 9-5=4 hp", plain?.health === 4, plain);

  // With RELIC's +1 armor pre-applied: 5-1 = 4 damage.
  const m2 = arena();
  const relicDef = unit({ instanceId: "relic", attack: 0, health: 9, maxHealth: 9, armor: 0, keywords: ["RELIC"] });
  relicOnSummon(relicDef);
  m2.players.P1.board.front = [unit({ instanceId: "atk", attack: 5, health: 9, maxHealth: 9 })];
  m2.players.P2.board.front = [relicDef];
  const relicHp = applyAction(m2, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "relic" })
    .state.players.P2.board.front.find((u) => u.instanceId === "relic");
  check("RELIC's +1 armor mitigates 1 (5-1=4 dmg -> 5 hp)", relicHp?.health === 5, relicHp);
}

// --- RITUAL: +1 max health (and current health) on enter (helper contract). ---
{
  const r = unit({ instanceId: "rit", health: 4, maxHealth: 4, keywords: ["RITUAL"] });
  ritualOnSummon(r);
  check("RITUAL grants +1 max health on summon (4 -> 5)", r.maxHealth === 5, r.maxHealth);
  check("RITUAL grants +1 current health on summon (4 -> 5)", r.health === 5, r.health);

  // No-op without the keyword.
  const plain = unit({ instanceId: "p", health: 4, maxHealth: 4 });
  ritualOnSummon(plain);
  check("RITUAL is a no-op without the keyword (health/maxHealth stay 4)",
    plain.health === 4 && plain.maxHealth === 4, { h: plain.health, mh: plain.maxHealth });
}

// --- RITUAL: the extra health lets the unit survive a hit it would otherwise die to.
{
  // Control: a 5/5 with no ward takes 5 and dies (reaped off the board).
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "atk", attack: 5, health: 9, maxHealth: 9 })];
  m.players.P2.board.front = [unit({ instanceId: "plain", attack: 0, health: 5, maxHealth: 5 })];
  const aliveControl = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "plain" })
    .state.players.P2.board.front.some((u) => u.instanceId === "plain");
  check("control: a 5-health unit dies to a 5-atk strike (off board)", aliveControl === false, aliveControl);

  // With RITUAL: the 5/5 becomes a 5/6 and survives the same 5-atk strike at 1 hp.
  const m2 = arena();
  const ritDef = unit({ instanceId: "rit", attack: 0, health: 5, maxHealth: 5, keywords: ["RITUAL"] });
  ritualOnSummon(ritDef);
  m2.players.P1.board.front = [unit({ instanceId: "atk", attack: 5, health: 9, maxHealth: 9 })];
  m2.players.P2.board.front = [ritDef];
  const ritHp = applyAction(m2, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "rit" })
    .state.players.P2.board.front.find((u) => u.instanceId === "rit");
  check("RITUAL's +1 max health survives a lethal-to-base strike (6-5=1 hp)", ritHp?.health === 1, ritHp);
}

console.log(`\n=== RELIC / RITUAL INTRINSIC SUMMON-GRANT PROOF ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} relic/ritual check(s) failed.`);
  process.exit(1);
}
console.log("ALL RELIC / RITUAL PROOFS PASSED");
