/**
 * dev:track-a1 — pins the trigger→op routing for the "Track A1" coverage clusters
 * end-to-end, through the live reducer's combat + death-resolution path (the FIFO
 * triggerQueue), NOT just the compiler. Every assertion drives a real ATTACK_UNIT
 * so the effect fires exactly where it would in a match.
 *
 *   CLUSTER A — REGROW_SUMMON / DEATHRATTLE_SUMMON
 *     "Regrow. When this unit dies, summon a 1/1 X [with <keyword>]."
 *     -> on the unit's death (ON_DEATH, drained from the trigger queue) the token
 *        is minted via SUMMON_TOKEN into the dead unit's lane, with its keyword
 *        rider, while MAX_LANE_UNITS is respected.
 *
 *   CLUSTER B — TAUNT_SUMMON_DAMAGE
 *     "Taunt. When this unit takes damage, summon a 1/1 X."
 *     -> ON_DAMAGE (fired for the unit that took combat damage) routes to
 *        SUMMON_TOKEN. The "gain N health AND summon" variant fires BOTH ops.
 *
 *   CLUSTER C — REGROW_TIMING
 *     "Regrow. When this unit dies/upon death, return it to your hand ..."
 *     -> ON_DEATH routes to RETURN_FROM_GRAVE: the just-died unit's CARD is the
 *        most-recent graveyard record, popped back to the controller's hand.
 *
 * Negative / edge cases asserted: empty-board no-op, MAX_LANE_UNITS cap respected
 * (refused mint is a clean no-op), and no double-fire of a single death's summon.
 */

import { applyAction } from "../engine/reducer";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, UnitInPlay, MAX_LANE_UNITS } from "../engine/state";

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

const isToken = (u: UnitInPlay) => u.cardId.startsWith("token_") || u.cardId.startsWith("unit_");

// === CLUSTER A: ON_DEATH -> SUMMON_TOKEN (with keyword rider) ====================
// tcg_6564: "Regrow. When this unit dies, summon a 1/1 sapling with lifesteal."
// P2's big attacker kills P1's regrow unit; its ON_DEATH summon must mint a 1/1
// LIFESTEAL token into P1's lane via the drained trigger queue.
{
  const m = arena();
  m.activePlayer = "P2";
  m.players.P1.board.front = [unit({ instanceId: "regrow", cardId: "tcg_6564", attack: 1, health: 2, maxHealth: 2 })];
  m.players.P2.board.front = [unit({ instanceId: "killer", attack: 9, health: 9, maxHealth: 9 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "killer", defenderInstanceId: "regrow" });
  const lane = r.state.players.P1.board.front;
  const corpseGone = !lane.some((u) => u.instanceId === "regrow");
  const tokens = lane.filter(isToken);
  check("A: regrow unit died and was reaped off the board", corpseGone, lane.map((u) => u.instanceId));
  check("A: ON_DEATH minted exactly one 1/1 token into the dead unit's lane", tokens.length === 1, tokens);
  check("A: minted token is a 1/1", tokens[0]?.attack === 1 && tokens[0]?.health === 1, tokens[0]);
  check("A: keyword rider 'with lifesteal' rode onto the token", (tokens[0]?.keywords ?? []).includes("LIFESTEAL"), tokens[0]?.keywords);
  check("A: triggerQueue drained empty after the action", (r.state.triggerQueue ?? []).length === 0, r.state.triggerQueue);
}

// === CLUSTER A (negative): no double-fire — one death mints exactly one token ====
// A plain "dies, summon a 1/1 sapling" must mint ONE token, not two.
{
  const m = arena();
  m.activePlayer = "P2";
  m.players.P1.board.front = [unit({ instanceId: "regrow", cardId: "tcg_5893", attack: 1, health: 2, maxHealth: 2 })];
  m.players.P2.board.front = [unit({ instanceId: "killer", attack: 9, health: 9, maxHealth: 9 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "killer", defenderInstanceId: "regrow" });
  const tokens = r.state.players.P1.board.front.filter(isToken);
  check("A-neg: a single death mints exactly ONE token (no double-fire)", tokens.length === 1, tokens.length);
}

// === CLUSTER A (edge): MAX_LANE_UNITS cap makes the on-death mint a clean no-op ==
// Fill P1.front to the cap with survivors so the dead unit's lane is already full;
// the ON_DEATH summon must refuse to mint (no id consumed, nothing pushed).
{
  const m = arena();
  m.activePlayer = "P2";
  const filler: UnitInPlay[] = [];
  filler.push(unit({ instanceId: "regrow", cardId: "tcg_5893", attack: 1, health: 2, maxHealth: 2 }));
  for (let i = 0; i < MAX_LANE_UNITS - 1; i += 1) {
    filler.push(unit({ instanceId: `pad${i}`, attack: 1, health: 9, maxHealth: 9 }));
  }
  m.players.P1.board.front = filler; // exactly MAX_LANE_UNITS units
  m.players.P2.board.front = [unit({ instanceId: "killer", attack: 9, health: 9, maxHealth: 9 })];
  const idBefore = m.idCounter;
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "killer", defenderInstanceId: "regrow" });
  const lane = r.state.players.P1.board.front;
  // After the regrow unit dies the lane drops to MAX-1; the refused mint must NOT
  // push a token, so the lane stays at MAX-1 with zero tokens.
  const tokens = lane.filter(isToken);
  check("A-edge: full lane refuses the on-death mint (no token pushed)", tokens.length === 0, tokens);
  check("A-edge: lane is MAX-1 after the corpse leaves (one death, no mint)", lane.length === MAX_LANE_UNITS - 1, lane.length);
  check("A-edge: refused mint consumed no idCounter", r.state.idCounter === idBefore, { before: idBefore, after: r.state.idCounter });
}

// === CLUSTER B: ON_DAMAGE -> SUMMON_TOKEN ========================================
// tcg_6537: "Taunt. When this unit takes damage, summon a 1/1 stone wisp."
// P2 attacks P1's taunt unit (which survives). The defender took damage, so its
// ON_DAMAGE fires and mints a token into P1's lane.
{
  const m = arena();
  m.activePlayer = "P2";
  m.players.P1.board.front = [unit({ instanceId: "taunt", cardId: "tcg_6537", attack: 1, health: 9, maxHealth: 9 })];
  m.players.P2.board.front = [unit({ instanceId: "atk", attack: 3, health: 9, maxHealth: 9 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "atk", defenderInstanceId: "taunt" });
  const lane = r.state.players.P1.board.front;
  const survived = lane.some((u) => u.instanceId === "taunt");
  const tokens = lane.filter(isToken);
  check("B: taunt unit survived the hit (still on board)", survived, lane.map((u) => u.instanceId));
  check("B: ON_DAMAGE minted exactly one token for the damaged unit's controller", tokens.length === 1, tokens);
  check("B: token is a 1/1", tokens[0]?.attack === 1 && tokens[0]?.health === 1, tokens[0]);
}

// === CLUSTER B: a self-stat ON_DAMAGE rider co-exists with the on-damage summon ==
// tcg_4464: "Taunt. When this unit takes damage, gain ... and summon a 1/1 X."
// The unit's own ON_DAMAGE self-buff (BUFF_SELF +1/+1) must NOT swallow the summon
// — both ON_DAMAGE ops fire. (This pins the Track-A1 fix that previously let the
// already-claimed ON_DAMAGE buff block the summon rider entirely.)
{
  const m = arena();
  m.activePlayer = "P2";
  m.players.P1.board.front = [unit({ instanceId: "taunt", cardId: "tcg_4464", attack: 1, health: 9, maxHealth: 12 })];
  m.players.P2.board.front = [unit({ instanceId: "atk", attack: 3, health: 9, maxHealth: 9 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "atk", defenderInstanceId: "taunt" });
  const lane = r.state.players.P1.board.front;
  const taunt = lane.find((u) => u.instanceId === "taunt");
  const tokens = lane.filter(isToken);
  // Took 3 combat damage (9 -> 6), then the ON_DAMAGE self-buff adds +1 health -> 7.
  check("B-both: on-damage self-buff applied (6 after combat -> 7 after +1 health)", taunt?.health === 7, taunt?.health);
  check("B-both: on-damage self-buff added +1 attack (1 -> 2)", taunt?.attack === 2, taunt?.attack);
  check("B-both: on-damage summon ALSO fired alongside the self-buff", tokens.length === 1, tokens);
}

// === CLUSTER B (negative): an empty board / no-combat action mints nothing =======
// END_TURN with no damaged unit must not mint any ON_DAMAGE token (no false fire).
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "taunt", cardId: "tcg_6537", attack: 1, health: 9, maxHealth: 9 })];
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  const tokens = r.state.players.P1.board.front.filter(isToken);
  check("B-neg: no combat -> no ON_DAMAGE summon fires", tokens.length === 0, tokens);
}

// === CLUSTER C: ON_DEATH -> RETURN_FROM_GRAVE (regrow return-to-hand) ============
// tcg_6616: "Regrow. When this unit dies, return it to your hand at the end of turn."
// On death the unit's own card is the most-recent grave record, popped back to hand.
{
  const m = arena();
  m.activePlayer = "P2";
  m.players.P1.board.front = [unit({ instanceId: "regrow", cardId: "tcg_6616", attack: 1, health: 2, maxHealth: 2 })];
  m.players.P2.board.front = [unit({ instanceId: "killer", attack: 9, health: 9, maxHealth: 9 })];
  const handBefore = [...m.players.P1.hand];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "killer", defenderInstanceId: "regrow" });
  const corpseGone = !r.state.players.P1.board.front.some((u) => u.instanceId === "regrow");
  const handHasCard = r.state.players.P1.hand.includes("tcg_6616");
  const handGrew = r.state.players.P1.hand.length === handBefore.length + 1;
  // RETURN_FROM_GRAVE popped the just-died record, so the grave is back to empty.
  const graveEmpty = (r.state.players.P1.graveyard ?? []).length === 0;
  check("C: regrow unit died and left the board", corpseGone, r.state.players.P1.board.front.map((u) => u.instanceId));
  check("C: ON_DEATH returned the unit's CARD to its controller's hand", handHasCard, r.state.players.P1.hand);
  check("C: exactly one card was returned (no extra)", handGrew, { before: handBefore.length, after: r.state.players.P1.hand.length });
  check("C: the popped grave record left the graveyard empty", graveEmpty, r.state.players.P1.graveyard);
}

// === CLUSTER C: "Upon death, return this unit to your hand" variant ==============
// tcg_4521 uses "Upon death, return this unit to your hand" (the broadened ON_DEATH
// + 'return this unit' phrasing). Same end-to-end behavior as the canonical form.
{
  const m = arena();
  m.activePlayer = "P2";
  m.players.P1.board.front = [unit({ instanceId: "regrow", cardId: "tcg_4521", attack: 1, health: 2, maxHealth: 2 })];
  m.players.P2.board.front = [unit({ instanceId: "killer", attack: 9, health: 9, maxHealth: 9 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "killer", defenderInstanceId: "regrow" });
  check("C-variant: 'Upon death, return this unit' returns the card to hand", r.state.players.P1.hand.includes("tcg_4521"), r.state.players.P1.hand);
}

console.log(`\n=== TRACK A1 ROUTING PROOF (ON_DEATH/ON_DAMAGE -> SUMMON_TOKEN / RETURN_FROM_GRAVE) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} Track A1 routing check(s) failed.`);
  process.exit(1);
}
console.log("ALL TRACK A1 ROUTING PROOFS PASSED");
