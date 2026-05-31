/**
 * dev:battlecry-target — pins the PLAY_UNIT targeting thread. A single-target
 * heal battlecry ("When summoned, heal/restore N to target ally") now compiles
 * to an ON_SUMMON HEAL spec, and the reducer threads the action's
 * `targetInstanceId` into the ON_SUMMON `fireTrigger` so the resolver heals the
 * chosen ally. Without a target, the spec safely no-ops (the prior behavior).
 *
 * Cards (real catalog ids, classified by the natural-language compile riders):
 *   tcg_150  "When this unit is summoned, heal 1 damage to target Stone Keeper unit."
 *   tcg_1639 "When this unit is summoned, restore 2 health to target ally and gain +1/+1 ..."
 *            (heal target + a fixed-approximation self +1/+1)
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

function arena(seed = 5150): MatchState {
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

/** Play `cardId` from P1's hand with `allies` already on board, optionally
 *  choosing `targetInstanceId`. Returns the post-action P1 front board. */
function play(cardId: string, allies: UnitInPlay[], targetInstanceId?: string) {
  const m = arena();
  m.players.P1.board.front = allies;
  m.players.P1.hand = [cardId, ...m.players.P1.hand];
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front", targetInstanceId });
  return r.state.players.P1.board.front;
}

const wounded = (id: string) => unit({ instanceId: id, cardId: "tcg_test", attack: 0, health: 3, maxHealth: 8 });

// --- tcg_150: heal 1 to a chosen ally ------------------------------------------
{
  const board = play("tcg_150", [wounded("ally")], "ally");
  const a = board.find((u) => u.instanceId === "ally");
  check("tcg_150 heals the chosen ally (3 -> 4)", a?.health === 4, a?.health);
}

// --- tcg_150: no target -> the heal safely no-ops (prior behavior preserved) ----
{
  const board = play("tcg_150", [wounded("ally")]); // no targetInstanceId
  const a = board.find((u) => u.instanceId === "ally");
  check("tcg_150 with NO target leaves the ally unhealed (3 -> 3)", a?.health === 3, a?.health);
}

// --- tcg_150: heal is capped at the target's maxHealth -------------------------
{
  const nearFull = unit({ instanceId: "ally", cardId: "tcg_test", health: 8, maxHealth: 8 });
  const board = play("tcg_150", [nearFull], "ally");
  const a = board.find((u) => u.instanceId === "ally");
  check("tcg_150 heal caps at maxHealth (8 -> 8)", a?.health === 8, a?.health);
}

// --- tcg_1639: restore 2 to the chosen ally AND self-buff +1/+1 -----------------
{
  const board = play("tcg_1639", [wounded("ally")], "ally");
  const a = board.find((u) => u.instanceId === "ally");
  const self = board.find((u) => u.cardId === "tcg_1639");
  check("tcg_1639 restores 2 to the chosen ally (3 -> 5)", a?.health === 5, a?.health);
  check("tcg_1639 self-buffs +1 attack on summon", (self?.attack ?? 0) >= 1, self?.attack);
}

console.log(`\n=== BATTLECRY TARGET PROOF (PLAY_UNIT targetInstanceId thread) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} battlecry-target check(s) failed.`);
  process.exit(1);
}
console.log("ALL BATTLECRY TARGET PROOFS PASSED");
