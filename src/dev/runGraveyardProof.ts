/**
 * dev:graveyard — pins the GRAVEYARD zone and its two recursion ops END-TO-END
 * through `applyAction`.
 *
 * The graveyard is a per-player zone of slim records (cardId / attack / maxHealth
 * / keywords) for NON-TOKEN units that have died. It is distinct from `discard`
 * (an id-list for spent spells). Two ops consume it:
 *
 *   RESURRECT          — resummon the most-recent dead friendly unit onto the
 *                        controller's board at full health, popping that record.
 *   RETURN_FROM_GRAVE  — return the most-recent dead friendly unit's CARD to the
 *                        controller's hand, popping that record.
 *
 * Coverage:
 *   (a) a non-token unit dying records to its OWNER's graveyard;
 *   (b) a TOKEN dying does NOT enter the graveyard (it ceases to exist);
 *   (c) RESURRECT brings the dead unit back at full health and empties the slot;
 *   (d) RETURN_FROM_GRAVE puts the cardId in hand and empties the slot;
 *   (e) empty-graveyard RESURRECT / RETURN_FROM_GRAVE are clean no-ops.
 *
 * Deaths are driven through REAL combat (`ATTACK_UNIT` lethal), exactly like
 * `dev:ondeath`. The two ops are exercised both directly (resolveEffect) and via
 * a real on-summon battlecry card (tcg_6126: "Recalls a unit from your graveyard
 * ... to your hand").
 */

import { applyAction } from "../engine/reducer";
import { resolveEffect } from "../engine/effectResolver";
import { compileAbility } from "../engine/abilityCompiler";
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

function arena(seed = 9777): MatchState {
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

// --- (a) a non-token unit dying records to its OWNER's graveyard ---------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "killer", cardId: "tcg_test", attack: 10, health: 10, maxHealth: 10 })];
  m.players.P2.board.front = [
    unit({ instanceId: "dier", cardId: "tcg_19", attack: 3, health: 1, maxHealth: 4, keywords: ["LIFESTEAL"] }),
  ];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "killer", defenderInstanceId: "dier" });
  const grave = r.state.players.P2.graveyard;
  check("dead non-token unit is cleared from the board", !r.state.players.P2.board.front.some((u) => u.instanceId === "dier"));
  check("dead unit is recorded into its OWNER's graveyard", grave.length === 1 && grave[0].cardId === "tcg_19", grave);
  check("graveyard record carries the unit's stat line + keywords", grave[0]?.attack === 3 && grave[0]?.maxHealth === 4 && grave[0]?.keywords.includes("LIFESTEAL"), grave[0]);
  check("the KILLER (alive) did not enter any graveyard", r.state.players.P1.graveyard.length === 0, r.state.players.P1.graveyard);
}

// --- (b) a TOKEN dying does NOT enter the graveyard ----------------------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "killer", cardId: "tcg_test", attack: 10, health: 10, maxHealth: 10 })];
  m.players.P2.board.front = [unit({ instanceId: "tok", cardId: "token_stonechild", attack: 1, health: 1, maxHealth: 1 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "killer", defenderInstanceId: "tok" });
  check("dead token is removed from the board", !r.state.players.P2.board.front.some((u) => u.instanceId === "tok"));
  check("dead token does NOT enter the graveyard", r.state.players.P2.graveyard.length === 0, r.state.players.P2.graveyard);
}

// --- (c) RESURRECT brings the dead unit back at full health, empties the slot ---
{
  const m = arena();
  // Kill a unit so P1's graveyard holds one record (tcg_19, 4/4, damaged).
  m.players.P1.board.front = [unit({ instanceId: "victim", cardId: "tcg_19", attack: 4, health: 2, maxHealth: 6, keywords: ["GUARD"] })];
  m.players.P2.board.front = [unit({ instanceId: "exec", cardId: "tcg_test", attack: 10, health: 10, maxHealth: 10 })];
  // P2 attacks and kills P1's victim.
  m.activePlayer = "P2";
  let r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "exec", defenderInstanceId: "victim" });
  check("victim recorded to P1's graveyard before resurrect", r.state.players.P1.graveyard.length === 1, r.state.players.P1.graveyard);

  // Resurrect directly via the resolver (no real card resurrects-to-board in the
  // shipped corpus; the op itself is what we are pinning).
  const next = structuredClone(r.state);
  const before = next.players.P1.board.front.length;
  resolveEffect(
    { trigger: "ON_SUMMON", op: "RESURRECT", raw: "resurrect a friendly unit from your graveyard to play" },
    { state: next, controller: "P1", source: undefined, lane: "front" }
  );
  const board = next.players.P1.board.front;
  const revived = board[board.length - 1];
  check("RESURRECT puts a unit back on the controller's board", board.length === before + 1, board.map((u) => u.cardId));
  check("RESURRECT restores the dead unit (cardId tcg_19) at FULL health", revived?.cardId === "tcg_19" && revived?.health === 6 && revived?.maxHealth === 6, revived);
  check("RESURRECT preserves the unit's keywords", revived?.keywords.includes("GUARD"), revived?.keywords);
  check("RESURRECT empties that graveyard slot", next.players.P1.graveyard.length === 0, next.players.P1.graveyard);
  check("RESURRECT mints a deterministic unit_ id", typeof revived?.instanceId === "string" && revived!.instanceId.startsWith(`unit_${next.seed}_`), revived?.instanceId);
}

// --- (d) RETURN_FROM_GRAVE puts the cardId in hand, empties the slot ------------
// Driven through a REAL on-summon battlecry card: tcg_6126 "Recalls a unit from
// your graveyard with cost 1 or less to your hand." (compiles ON_SUMMON/RETURN_FROM_GRAVE)
{
  const compiled = compileAbility("Recalls a unit from your graveyard with cost 1 or less to your hand.");
  check("tcg_6126 text compiles to ON_SUMMON RETURN_FROM_GRAVE", compiled.specs.some((s) => s.op === "RETURN_FROM_GRAVE" && s.trigger === "ON_SUMMON") && compiled.recognized, compiled.specs);

  const m = arena();
  // Seed P1's graveyard with a dead unit's record directly.
  m.players.P1.graveyard = [{ cardId: "tcg_42", attack: 2, maxHealth: 3, keywords: [] }];
  m.players.P1.hand = ["tcg_6126"];
  const handBefore = m.players.P1.hand.length;
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  check("RETURN_FROM_GRAVE returns the dead unit's card to hand", r.state.players.P1.hand.includes("tcg_42"), r.state.players.P1.hand);
  check("hand net change: -1 (played tcg_6126) +1 (recalled tcg_42)", r.state.players.P1.hand.length === handBefore, r.state.players.P1.hand);
  check("RETURN_FROM_GRAVE empties that graveyard slot", r.state.players.P1.graveyard.length === 0, r.state.players.P1.graveyard);
}

// --- (e) empty-graveyard RESURRECT / RETURN_FROM_GRAVE are clean no-ops ---------
{
  const m = arena();
  const next = structuredClone(m);
  const boardBefore = next.players.P1.board.front.length;
  const handBefore = next.players.P1.hand.length;
  resolveEffect(
    { trigger: "ON_SUMMON", op: "RESURRECT", raw: "resurrect" },
    { state: next, controller: "P1", lane: "front" }
  );
  resolveEffect(
    { trigger: "ON_SUMMON", op: "RETURN_FROM_GRAVE", raw: "return from grave to hand" },
    { state: next, controller: "P1" }
  );
  check("empty-grave RESURRECT adds nothing to the board", next.players.P1.board.front.length === boardBefore, next.players.P1.board.front);
  check("empty-grave RETURN_FROM_GRAVE adds nothing to hand", next.players.P1.hand.length === handBefore, next.players.P1.hand);
  check("empty-grave ops leave the graveyard empty (no throw)", next.players.P1.graveyard.length === 0, next.players.P1.graveyard);
}

console.log(`\n=== GRAVEYARD PROOF (zone + RESURRECT + RETURN_FROM_GRAVE) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} graveyard check(s) failed.`);
  process.exit(1);
}
console.log("ALL GRAVEYARD PROOFS PASSED");
