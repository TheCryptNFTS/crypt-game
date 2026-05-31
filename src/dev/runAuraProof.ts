/**
 * dev:auras — pins continuous faction stat-auras END-TO-END through
 * `applyAction`. These cards read "Other <Faction> gain +X/+Y while this is in
 * play"; the reducer's recomputeAuras pass applies the bonus to the controller's
 * OTHER same-faction units after every board change and strips it the moment the
 * source leaves play.
 *
 *   tcg_1491 STONE_KEEPERS    Ward.  "your other Stone Keepers gain +1/+1"
 *   tcg_4350 STONE_KEEPERS    Shield."your other Stone Keepers gain +1/+1"
 *   tcg_255  IRON_DEFENDERS   Taunt. "Other Iron Defenders ... gain +0/+1"
 *
 * Real ids drive the reducer's cardId -> ability + cardId -> faction lookups
 * exactly as in a match. Beneficiaries use real same-faction ids; off-faction
 * controls use a real card of a different faction.
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

function arena(seed = 2424): MatchState {
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

// --- Aura buffs OTHER same-faction allies; never self or off-faction. ---------
{
  const m = arena();
  m.players.P1.board.front = [
    // Stone Keeper aura source (+1/+1 to other Stone Keepers).
    unit({ instanceId: "src", cardId: "tcg_1491", attack: 0, health: 9, maxHealth: 9 }),
    // Real Stone Keeper ally -> should gain +1/+1.
    unit({ instanceId: "ally", cardId: "tcg_1", attack: 2, health: 5, maxHealth: 5 }),
    // Real Bronze Guardian -> off-faction, must be untouched.
    unit({ instanceId: "off", cardId: "tcg_14", attack: 2, health: 5, maxHealth: 5 }),
  ];
  // Any successful action triggers the recompute; END_TURN preserves membership.
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  const ally = find(r.state, "P1", "ally");
  const off = find(r.state, "P1", "off");
  const src = find(r.state, "P1", "src");
  check("aura grants +1/+1 to a same-faction ally (2/5 -> 3/6)", ally?.attack === 3 && ally?.health === 6 && ally?.maxHealth === 6, ally);
  check("aura ignores an off-faction unit (Bronze Guardian stays 2/5)", off?.attack === 2 && off?.health === 5, off);
  check("aura does NOT buff its own source ('other')", src?.attack === 0 && src?.health === 9, src);
}

// --- Two aura sources stack additively. ---------------------------------------
{
  const m = arena();
  m.players.P1.board.front = [
    unit({ instanceId: "src1", cardId: "tcg_1491", attack: 0, health: 9, maxHealth: 9 }),
    unit({ instanceId: "src2", cardId: "tcg_4350", attack: 0, health: 9, maxHealth: 9 }),
    unit({ instanceId: "ally", cardId: "tcg_1", attack: 2, health: 5, maxHealth: 5 }),
  ];
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  const ally = find(r.state, "P1", "ally");
  check("two Stone Keeper auras stack +2/+2 (2/5 -> 4/7)", ally?.attack === 4 && ally?.health === 7 && ally?.maxHealth === 7, ally);
}

// --- A +0/+1 aura grants health only. -----------------------------------------
{
  const m = arena();
  m.players.P1.board.front = [
    // Iron Defender aura source (+0/+1 to other Iron Defenders).
    unit({ instanceId: "src", cardId: "tcg_255", attack: 0, health: 9, maxHealth: 9 }),
    // Real Iron Defender filler (tcg_4006 ability is an inert GLOBAL stub).
    unit({ instanceId: "ally", cardId: "tcg_4006", attack: 2, health: 5, maxHealth: 5 }),
  ];
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  const ally = find(r.state, "P1", "ally");
  check("+0/+1 aura grants health only (2/5 -> 2/6)", ally?.attack === 2 && ally?.health === 6 && ally?.maxHealth === 6, ally);
}

// --- Aura is STRIPPED when its source leaves play. ----------------------------
{
  // Turn 1: P1 has the source + ally; ending the turn settles the aura on the
  // ally (3/6) and passes the turn to P2.
  const m = arena();
  m.players.P1.board.front = [
    unit({ instanceId: "src", cardId: "tcg_1491", attack: 0, health: 3, maxHealth: 3 }),
    unit({ instanceId: "ally", cardId: "tcg_1", attack: 2, health: 5, maxHealth: 5 }),
  ];
  m.players.P2.board.front = [unit({ instanceId: "killer", cardId: "tcg_test", attack: 5, health: 9, maxHealth: 9 })];
  const afterEnd = applyAction(m, { type: "END_TURN", player: "P1" });
  const buffed = find(afterEnd.state, "P1", "ally");
  check("setup: ally is buffed while source lives (3/6)", buffed?.attack === 3 && buffed?.health === 6, buffed);

  // Turn 2 (P2): kill the aura source. The outer recompute then strips the
  // ally's bonus back to base 2/5.
  const afterKill = applyAction(afterEnd.state, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "killer", defenderInstanceId: "src" });
  const src = find(afterKill.state, "P1", "src");
  const ally = find(afterKill.state, "P1", "ally");
  check("aura source died (removed from board)", src === undefined, src);
  check("aura is stripped when the source leaves (3/6 -> 2/5)", ally?.attack === 2 && ally?.health === 5 && ally?.maxHealth === 5, ally);
}

console.log(`\n=== AURA PROOF (continuous faction stat-auras via recomputeAuras) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} aura check(s) failed.`);
  process.exit(1);
}
console.log("ALL AURA PROOFS PASSED");
