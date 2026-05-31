/**
 * dev:triggers — pins the Phase C reducer trigger wiring END-TO-END. Each block
 * crafts a board with REAL card ids whose ability text drives a trigger, then
 * dispatches a real action through `applyAction` (the live path) and asserts the
 * trigger fired on live state. Uses real ids so the cardId -> ability lookup the
 * reducer performs is exercised exactly as in a match.
 *
 *   ON_ATTACK  Rally          tcg_402  "Other allies gain +1 attack when this attacks."
 *   ON_SUMMON  Summon token   tcg_192  "Create a 1/1 Revenant token."
 *   ON_DAMAGE  Taunt retaliate tcg_382 "When this unit takes damage, deal 2 damage to the attacker."
 *   ON_DAMAGE  Taunt selfbuff tcg_8    "When this unit takes damage, gain +1/+0 until end of turn."
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

function arena(seed = 7777): MatchState {
  const m = makeSeededMatch(seed);
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

// --- ON_ATTACK Rally: attacker buffs OTHER allies when it swings. -------------
{
  const m = arena();
  m.players.P1.board.front = [
    unit({ instanceId: "rally", cardId: "tcg_402", attack: 6, health: 5, maxHealth: 5 }),
    unit({ instanceId: "ally", cardId: "tcg_test", attack: 2, health: 4, maxHealth: 4 }),
  ];
  m.players.P2.board.front = [unit({ instanceId: "wall", cardId: "tcg_test", attack: 0, health: 9, maxHealth: 9 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "rally", defenderInstanceId: "wall" });
  const ally = r.state.players.P1.board.front.find((u) => u.instanceId === "ally");
  const rally = r.state.players.P1.board.front.find((u) => u.instanceId === "rally");
  check("ON_ATTACK Rally buffs the OTHER ally (+1 atk: 2 -> 3)", ally?.attack === 3, ally);
  check("ON_ATTACK Rally does NOT buff the attacker itself (stays 6)", rally?.attack === 6, rally);
}

// Rally also fires on a FACE swing.
{
  const m = arena();
  m.players.P1.board.front = [
    unit({ instanceId: "rally", cardId: "tcg_402", attack: 6, health: 5, maxHealth: 5 }),
    unit({ instanceId: "ally", cardId: "tcg_test", attack: 2, health: 4, maxHealth: 4 }),
  ];
  const r = applyAction(m, { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "rally" });
  const ally = r.state.players.P1.board.front.find((u) => u.instanceId === "ally");
  check("ON_ATTACK Rally fires on ATTACK_FACE too (ally 2 -> 3)", ally?.attack === 3, ally);
}

// --- ON_DAMAGE Taunt retaliate: defender deals 2 back to its attacker. --------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "atk", cardId: "tcg_test", attack: 3, health: 8, maxHealth: 8 })];
  m.players.P2.board.front = [unit({ instanceId: "thorns", cardId: "tcg_382", attack: 0, health: 9, maxHealth: 9 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "thorns" });
  const atk = r.state.players.P1.board.front.find((u) => u.instanceId === "atk");
  // Attacker has 0 attack from defender? defender attack 0 so no combat counter.
  // The 2 dmg comes purely from the ON_DAMAGE retaliate (8 -> 6).
  check("ON_DAMAGE retaliate deals 2 to the attacker (8 -> 6)", atk?.health === 6, atk);
}

// Retaliate only fires when the defender actually took damage (mitigated > 0).
{
  const m = arena();
  // Attacker with 0 attack: defender takes no damage, so no retaliate.
  m.players.P1.board.front = [unit({ instanceId: "atk", cardId: "tcg_test", attack: 0, health: 8, maxHealth: 8 })];
  m.players.P2.board.front = [unit({ instanceId: "thorns", cardId: "tcg_382", attack: 0, health: 9, maxHealth: 9 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "thorns" });
  const atk = r.state.players.P1.board.front.find((u) => u.instanceId === "atk");
  check("ON_DAMAGE retaliate does NOT fire when no damage dealt (8 -> 8)", atk?.health === 8, atk);
}

// --- ON_DAMAGE Taunt self-buff: defender that takes damage gains +1/+0. --------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "atk", cardId: "tcg_test", attack: 3, health: 8, maxHealth: 8 })];
  m.players.P2.board.front = [unit({ instanceId: "rager", cardId: "tcg_8", attack: 3, health: 6, maxHealth: 6 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "rager" });
  const rager = r.state.players.P2.board.front.find((u) => u.instanceId === "rager");
  // Took 3 combat damage (6 -> 3 hp), then ON_DAMAGE BUFF_SELF +1/+0 -> attack 3 -> 4.
  check("ON_DAMAGE self-buff raises defender attack (3 -> 4)", rager?.attack === 4, rager);
  check("ON_DAMAGE self-buff leaves health at combat value (6-3=3)", rager?.health === 3, rager);
}

// --- ON_SUMMON Summon token: playing the card mints a 1/1 on the board. --------
{
  const m = arena();
  m.players.P1.board.front = [];
  // Put the Summon unit (tcg_192) at the front of hand and play it.
  m.players.P1.hand = ["tcg_192", ...m.players.P1.hand];
  const boardBefore = m.players.P1.board.front.length;
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const front = r.state.players.P1.board.front;
  const token = front.find((u) => u.cardId === "token_revenant");
  check("ON_SUMMON played the unit AND minted its token", front.length === boardBefore + 2, { len: front.length });
  check("ON_SUMMON token is a 1/1", !!token && token.attack === 1 && token.health === 1, token);
}

console.log(`\n=== EFFECT TRIGGER PROOF (Phase C: ON_SUMMON / ON_ATTACK / ON_DAMAGE) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} trigger check(s) failed.`);
  process.exit(1);
}
console.log("ALL EFFECT TRIGGER PROOFS PASSED");
