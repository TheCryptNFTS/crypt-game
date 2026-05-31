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
import { scryDeck } from "../engine/keywordEngine";
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

console.log(`\n=== KEYWORD MECHANICS PROOF ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} keyword mechanic check(s) failed.`);
  process.exit(1);
}
console.log("ALL KEYWORD MECHANIC PROOFS PASSED");
