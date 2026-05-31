/**
 * dev:marquee-combat — pins the COMBAT-LEGALITY / ON_ATTACK marquee passives.
 * These are PASSIVE / combat-time ops (consumed by the reducer, not one-shot
 * battlecries), so the OP SOURCE is a crafted board unit (its cardId carries the
 * compiled passive). ATTACKS are driven through the REAL ATTACK_UNIT / ATTACK_FACE
 * reducer path. Rejections are asserted by SAME-state-ref + a REJECTED event.
 *
 *   COMMANDER_SHIELD (tcg_3405 "Skull Island") an ATTACK_FACE against its
 *                     controller is rejected while it is in play.
 *   MIRROR_ATTACK    (tcg_3410 "T2") the defender is struck TWICE; the phantom
 *                     leaves no extra unit on the board.
 *   PASSIVE_FLOOR_HP (tcg_3420 "Walter") one big damage instance cannot drop it
 *                     below 1 HP (survives at 1).
 *   DOUBLE_ATTACK    (tcg_3345 "Harley") may attack twice in a turn; a third
 *                     ATTACK_UNIT is rejected.
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

function arena(seed = 9400): MatchState {
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

// --- COMMANDER_SHIELD: an ATTACK_FACE against Skull Island's controller is
// rejected (state unchanged + REJECTED), but a face hit on an UNSHIELDED player
// lands normally. -----------------------------------------------------------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "atk", cardId: "tcg_test", attack: 4, health: 9, maxHealth: 9 })];
  m.players.P2.board.front = [unit({ instanceId: "shield", cardId: "tcg_3405", attack: 12, health: 17, maxHealth: 17, keywords: ["GUARD"] })];
  // Note: Skull Island also has GUARD; remove GUARD here so the reject is from the
  // COMMANDER_SHIELD path, not the guard-blocks-face path. (cardId still carries
  // the COMMANDER_SHIELD passive.)
  m.players.P2.board.front[0].keywords = [];
  const r = applyAction(m, { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "atk" });
  check("COMMANDER_SHIELD rejects the face attack (state ref unchanged)", r.state === m, r.state === m);
  check("COMMANDER_SHIELD reject emits a REJECTED event", r.events.some((e) => e.type === "REJECTED"), r.events);
  check("COMMANDER_SHIELD: enemy nexus took NO damage (still 20)", m.players.P2.nexusHealth === 20, m.players.P2.nexusHealth);

  // Guard removed (no COMMANDER_SHIELD source): the same face attack now lands.
  const m2 = arena();
  m2.players.P1.board.front = [unit({ instanceId: "atk", cardId: "tcg_test", attack: 4, health: 9, maxHealth: 9 })];
  const r2 = applyAction(m2, { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "atk" });
  check("aura source removed: face attack lands (nexus 20 -> 16)", r2.state.players.P2.nexusHealth === 16, r2.state.players.P2.nexusHealth);
}

// --- MIRROR_ATTACK: T2 strikes the defender TWICE; no phantom unit is left. -----
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "t2", cardId: "tcg_3410", attack: 4, health: 8, maxHealth: 8 })];
  m.players.P2.board.front = [unit({ instanceId: "def", cardId: "tcg_test", attack: 1, health: 20, maxHealth: 20 })];
  const p2BoardLenBefore = m.players.P2.board.front.length;
  const p1BoardLenBefore = m.players.P1.board.front.length;
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "t2", defenderInstanceId: "def" });
  const def = r.state.players.P2.board.front.find((u) => u.instanceId === "def");
  check("MIRROR_ATTACK strikes the defender TWICE (20 - 4 - 4 = 12)", def?.health === 12, def?.health);
  check("MIRROR_ATTACK leaves NO extra unit on attacker board", r.state.players.P1.board.front.length === p1BoardLenBefore, r.state.players.P1.board.front.map((u) => u.instanceId));
  check("MIRROR_ATTACK leaves NO extra unit on defender board", r.state.players.P2.board.front.length === p2BoardLenBefore, r.state.players.P2.board.front.map((u) => u.instanceId));
  check("MIRROR_ATTACK deals NO stray face damage to enemy nexus", r.state.players.P2.nexusHealth === 20, r.state.players.P2.nexusHealth);
}

// --- MIRROR_ATTACK: the phantom does NOT swing again if the first strike kills.
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "t2", cardId: "tcg_3410", attack: 6, health: 8, maxHealth: 8 })];
  m.players.P2.board.front = [unit({ instanceId: "def", cardId: "tcg_test", attack: 1, health: 5, maxHealth: 5 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "t2", defenderInstanceId: "def" });
  check("MIRROR_ATTACK on a lethal first strike just kills (no second-strike spillover)", !r.state.players.P2.board.front.some((u) => u.instanceId === "def"), r.state.players.P2.board.front.map((u) => u.instanceId));
  check("MIRROR_ATTACK lethal: enemy nexus untouched (no phantom face leak)", r.state.players.P2.nexusHealth === 20, r.state.players.P2.nexusHealth);
}

// --- PASSIVE_FLOOR_HP: Walter cannot be dropped below 1 by one damage instance.
{
  const m = arena();
  // Big attacker deals 99 combat damage to Walter (12 HP). Floor holds it at 1.
  m.players.P1.board.front = [unit({ instanceId: "big", cardId: "tcg_test", attack: 99, health: 99, maxHealth: 99 })];
  m.players.P2.board.front = [unit({ instanceId: "walter", cardId: "tcg_3420", attack: 5, health: 12, maxHealth: 12, keywords: ["GUARD"] })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "big", defenderInstanceId: "walter" });
  const walter = r.state.players.P2.board.front.find((u) => u.instanceId === "walter");
  check("PASSIVE_FLOOR_HP: Walter SURVIVES a 99-damage instance at exactly 1 HP", walter?.health === 1, walter?.health);
  check("PASSIVE_FLOOR_HP: surviving Walter is NOT reaped to graveyard", r.state.players.P2.graveyard.length === 0, r.state.players.P2.graveyard);

  // Guard: a NON-floor vanilla unit at 12 HP taking 99 actually dies (control).
  const m2 = arena();
  m2.players.P1.board.front = [unit({ instanceId: "big", cardId: "tcg_test", attack: 99, health: 99, maxHealth: 99 })];
  m2.players.P2.board.front = [unit({ instanceId: "soft", cardId: "tcg_test", attack: 5, health: 12, maxHealth: 12 })];
  const r2 = applyAction(m2, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "big", defenderInstanceId: "soft" });
  check("control: a unit WITHOUT the floor passive dies to the 99-damage instance", !r2.state.players.P2.board.front.some((u) => u.instanceId === "soft"), r2.state.players.P2.board.front.map((u) => u.instanceId));
}

// --- DOUBLE_ATTACK: Harley may strike twice; a third ATTACK_UNIT is rejected. ----
{
  const m = arena();
  // Harley (atk 3). Two defenders with 20 HP so neither dies, and Harley survives
  // (def atk 0) so we can test the third (illegal) swing on the same turn.
  m.players.P1.board.front = [unit({ instanceId: "harley", cardId: "tcg_3345", attack: 3, health: 9, maxHealth: 9 })];
  m.players.P2.board.front = [
    unit({ instanceId: "d1", cardId: "tcg_test", attack: 0, health: 20, maxHealth: 20 }),
    unit({ instanceId: "d2", cardId: "tcg_test", attack: 0, health: 20, maxHealth: 20 }),
    unit({ instanceId: "d3", cardId: "tcg_test", attack: 0, health: 20, maxHealth: 20 }),
  ];
  const r1 = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "harley", defenderInstanceId: "d1" });
  const h1 = r1.state.players.P1.board.front.find((u) => u.instanceId === "harley");
  check("DOUBLE_ATTACK: after the FIRST swing Harley is still ready (not exhausted)", h1?.exhausted === false, h1?.exhausted);

  const r2 = applyAction(r1.state, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "harley", defenderInstanceId: "d2" });
  const h2 = r2.state.players.P1.board.front.find((u) => u.instanceId === "harley");
  check("DOUBLE_ATTACK: the SECOND ATTACK_UNIT is legal (d2 took 3: 20 -> 17)", r2.state.players.P2.board.front.find((u) => u.instanceId === "d2")?.health === 17, r2.state.players.P2.board.front.find((u) => u.instanceId === "d2")?.health);
  check("DOUBLE_ATTACK: after the SECOND swing Harley is exhausted", h2?.exhausted === true, h2?.exhausted);

  const r3 = applyAction(r2.state, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "harley", defenderInstanceId: "d3" });
  check("DOUBLE_ATTACK: the THIRD ATTACK_UNIT is rejected (state ref unchanged)", r3.state === r2.state, r3.state === r2.state);
  check("DOUBLE_ATTACK: third-swing reject emits REJECTED", r3.events.some((e) => e.type === "REJECTED"), r3.events);
  check("DOUBLE_ATTACK: d3 untouched after rejected third swing (still 20)", r2.state.players.P2.board.front.find((u) => u.instanceId === "d3")?.health === 20, r2.state.players.P2.board.front.find((u) => u.instanceId === "d3")?.health);
}

console.log(`\n=== MARQUEE COMBAT PROOF (COMMANDER_SHIELD / MIRROR_ATTACK / PASSIVE_FLOOR_HP / DOUBLE_ATTACK) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} marquee-combat check(s) failed.`);
  process.exit(1);
}
console.log("ALL MARQUEE COMBAT PROOFS PASSED");
