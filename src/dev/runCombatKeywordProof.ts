/**
 * dev:combatkw — pins the combat-targeting keywords wired into the live reducer:
 * GUARD (taunt), FLYING (evasion), and CRUSH (trample overflow). RUSH is NOT
 * tested here: the reducer's lived model has no summoning sickness (see the
 * reducer contract), so RUSH has nothing to gate against and is intentionally
 * inert. Everything below drives the SAME `applyAction` the live game uses.
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

// --- GUARD: blocks face and protects non-GUARD allies. -----------------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "atk", attack: 4, health: 5, maxHealth: 5 })];
  m.players.P2.board.front = [
    unit({ instanceId: "wall", attack: 0, health: 6, maxHealth: 6, keywords: ["GUARD"] }),
    unit({ instanceId: "vip", attack: 0, health: 3, maxHealth: 3 }),
  ];

  const face = applyAction(m, { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "atk" });
  check("GUARD blocks face (nexus untouched, action rejected)",
    face.state.players.P2.nexusHealth === 20 && face.events.some((e) => e.type === "REJECTED"),
    { nexus: face.state.players.P2.nexusHealth });

  const onVip = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "vip" });
  const vip = onVip.state.players.P2.board.front.find((u) => u.instanceId === "vip");
  check("GUARD protects non-GUARD ally (attack on vip rejected)",
    vip?.health === 3 && onVip.events.some((e) => e.type === "REJECTED"), vip);

  const onWall = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "wall" });
  const wall = onWall.state.players.P2.board.front.find((u) => u.instanceId === "wall");
  check("GUARD itself is a legal target (takes 4, 6->2)", wall?.health === 2, wall);
}

// --- FLYING: only flyers / RANGED attackers can hit a flyer. ------------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "ground", attack: 3, health: 5, maxHealth: 5 })];
  m.players.P2.board.front = [unit({ instanceId: "bird", attack: 0, health: 4, maxHealth: 4, keywords: ["FLYING"] })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "ground", defenderInstanceId: "bird" });
  const bird = r.state.players.P2.board.front.find((u) => u.instanceId === "bird");
  check("FLYING evades a ground attacker (rejected, full HP)",
    bird?.health === 4 && r.events.some((e) => e.type === "REJECTED"), bird);

  // A RANGED attacker CAN hit the flyer.
  const m2 = arena();
  m2.players.P1.board.front = [unit({ instanceId: "archer", attack: 3, health: 5, maxHealth: 5, keywords: ["RANGED"] })];
  m2.players.P2.board.front = [unit({ instanceId: "bird", attack: 0, health: 4, maxHealth: 4, keywords: ["FLYING"] })];
  const r2 = applyAction(m2, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "archer", defenderInstanceId: "bird" });
  const bird2 = r2.state.players.P2.board.front.find((u) => u.instanceId === "bird");
  check("RANGED can shoot down a flyer (4->1)", bird2?.health === 1, bird2);
}

// --- CRUSH: lethal overflow spills to the defending nexus. --------------------
{
  const m = arena();
  // 7 attack into a 2-hp blocker -> 5 overflow to nexus (20 -> 15).
  m.players.P1.board.front = [unit({ instanceId: "tramp", attack: 7, health: 8, maxHealth: 8, keywords: ["CRUSH"] })];
  m.players.P2.board.front = [unit({ instanceId: "chump", attack: 0, health: 2, maxHealth: 2 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "tramp", defenderInstanceId: "chump" });
  const chump = r.state.players.P2.board.front.find((u) => u.instanceId === "chump");
  check("CRUSH kills the blocker", chump === undefined);
  check("CRUSH spills 5 overflow to nexus (20 -> 15)", r.state.players.P2.nexusHealth === 15, {
    nexus: r.state.players.P2.nexusHealth,
  });

  // Control: same swing WITHOUT crush leaves the nexus untouched.
  const m2 = arena();
  m2.players.P1.board.front = [unit({ instanceId: "tramp", attack: 7, health: 8, maxHealth: 8 })];
  m2.players.P2.board.front = [unit({ instanceId: "chump", attack: 0, health: 2, maxHealth: 2 })];
  const r2 = applyAction(m2, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "tramp", defenderInstanceId: "chump" });
  check("no CRUSH: overflow is wasted (nexus stays 20)", r2.state.players.P2.nexusHealth === 20, {
    nexus: r2.state.players.P2.nexusHealth,
  });

  // Armor reduces the overflow (post-mitigation): 7 vs 2-armor blocker (2hp)
  // -> 5 lands, 3 overflow (20 -> 17).
  const m3 = arena();
  m3.players.P1.board.front = [unit({ instanceId: "tramp", attack: 7, health: 8, maxHealth: 8, keywords: ["CRUSH"] })];
  m3.players.P2.board.front = [unit({ instanceId: "chump", attack: 0, health: 2, maxHealth: 2, armor: 2 })];
  const r3 = applyAction(m3, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "tramp", defenderInstanceId: "chump" });
  check("CRUSH overflow respects armor (3 overflow -> nexus 17)", r3.state.players.P2.nexusHealth === 17, {
    nexus: r3.state.players.P2.nexusHealth,
  });
}

console.log(`\n=== COMBAT KEYWORD PROOF (GUARD / FLYING / CRUSH) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} combat-keyword check(s) failed.`);
  process.exit(1);
}
console.log("ALL COMBAT KEYWORD PROOFS PASSED");
