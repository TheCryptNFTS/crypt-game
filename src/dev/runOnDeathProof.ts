/**
 * dev:ondeath — pins the ON_DEATH trigger wiring END-TO-END through
 * `applyAction`. When a unit with a compiled ON_DEATH spec dies in combat, the
 * reducer fires it during death resolution (before the corpse is cleared):
 *
 *   SUMMON-ON-DEATH  tcg_209   "When this unit dies, summon a 1/1 stonechild..."
 *   MARTYR + summon  tcg_1116  "Martyr. When this unit is destroyed, summon a 1/1 Iron Whelp."
 *
 * The minted token enters the dead unit's lane and is a fresh 1/1 that survives
 * the same death-resolution pass (it is not itself dead).
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

function arena(seed = 9123): MatchState {
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

// --- SUMMON-ON-DEATH: a dying unit mints its token into its own lane. ----------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "killer", cardId: "tcg_test", attack: 10, health: 10, maxHealth: 10 })];
  m.players.P2.board.front = [unit({ instanceId: "dier", cardId: "tcg_209", attack: 1, health: 1, maxHealth: 1 })];

  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "killer", defenderInstanceId: "dier" });
  const p2front = r.state.players.P2.board.front;
  const corpse = p2front.find((u) => u.instanceId === "dier");
  const token = p2front.find((u) => u.cardId.startsWith("token_stonechild"));

  check("dead unit's corpse is cleared from the board", corpse === undefined, p2front.map((u) => u.cardId));
  check("ON_DEATH summons a stonechild token into the dead unit's lane", !!token, p2front.map((u) => u.cardId));
  check("summoned token is a fresh 1/1", token?.attack === 1 && token?.health === 1 && token?.maxHealth === 1, token);
}

// --- MARTYR + summon: the on-death rider fires despite a leading keyword. -------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "exec", cardId: "tcg_test", attack: 10, health: 10, maxHealth: 10 })];
  m.players.P2.board.front = [unit({ instanceId: "mart", cardId: "tcg_1116", attack: 1, health: 1, maxHealth: 1 })];

  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "exec", defenderInstanceId: "mart" });
  const p2front = r.state.players.P2.board.front;
  check("Martyr unit's on-death summon fires (Iron Whelp token minted)", p2front.some((u) => u.cardId.startsWith("token_iron_whelp")), p2front.map((u) => u.cardId));
  check("Martyr corpse is cleared", p2front.every((u) => u.instanceId !== "mart"));
}

// --- A unit WITHOUT an on-death spec summons nothing. ---------------------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "k", cardId: "tcg_test", attack: 10, health: 10, maxHealth: 10 })];
  m.players.P2.board.front = [unit({ instanceId: "plain", cardId: "tcg_test", attack: 1, health: 1, maxHealth: 1 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "k", defenderInstanceId: "plain" });
  check("plain unit summons nothing on death (board empty)", r.state.players.P2.board.front.length === 0, r.state.players.P2.board.front.map((u) => u.cardId));
}

console.log(`\n=== ON-DEATH PROOF (Phase: ON_DEATH summon-on-death) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} on-death check(s) failed.`);
  process.exit(1);
}
console.log("ALL ON-DEATH PROOFS PASSED");
