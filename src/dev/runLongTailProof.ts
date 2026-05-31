/**
 * dev:longtail — pins the long-tail battlecry specs wired from the effect
 * proposal (docs/effect-longtail-and-spells-proposal.md, Task 1 "immediate
 * wins") END-TO-END through `applyAction`. These cards carry NO leading keyword
 * (Oath/Vow/Martyr); they are classified by the natural-language compile riders:
 *
 *   FACTION-SCALED SUMMON BUFF  tcg_241  "When summoned, gain +1/+1 for each Stone Keeper you control."
 *   ... with "other" exclusion   tcg_3446 "...for each OTHER Stone Keeper you control."
 *   ATTACK-ONLY scaled buff      tcg_1426 "...gain +1 Attack for each Iron Defender you control."
 *   ON-DAMAGE token summon       tcg_412  "When this unit takes damage, summon a 1/1 frost spirit."
 *   ON-DAMAGE draw               tcg_2427 "When this unit is damaged, draw a card."
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

function arena(seed = 4747): MatchState {
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

/** Play `cardId` with `allies` already on the board; return the summoned unit's
 *  post-buff stats. Identical harness to the faction-scaling proof. */
function playWith(cardId: string, allies: UnitInPlay[]): { attack: number; health: number } {
  const m = arena();
  m.players.P1.board.front = allies;
  m.players.P1.hand = [cardId, ...m.players.P1.hand];
  const fillerIds = new Set(allies.map((u) => u.instanceId));
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const summoned = r.state.players.P1.board.front.find((u) => u.cardId === cardId && !fillerIds.has(u.instanceId));
  if (!summoned) throw new Error(`summoned ${cardId} not found on board`);
  return { attack: summoned.attack, health: summoned.health };
}

const sk = (id: string, n: number) => unit({ instanceId: `sk_${n}`, cardId: id, attack: 0, health: 5, maxHealth: 5 });
const id_ = (id: string, n: number) => unit({ instanceId: `id_${n}`, cardId: id, attack: 0, health: 5, maxHealth: 5 });

// --- tcg_241: "+1/+1 for each Stone Keeper you control" (INCLUDES self) ---------
{
  // tcg_241 is itself a Stone Keeper and the text has no "other": empty board
  // already counts the source -> mult 1 -> +1/+1 baked in.
  const selfOnly = playWith("tcg_241", []);
  // +2 other Stone Keepers -> mult 3 -> +3/+3: that is +2/+2 OVER the self-only baseline.
  const withTwo = playWith("tcg_241", [sk("tcg_1", 1), sk("tcg_2", 2)]);
  check("tcg_241 scales +1/+1 per Stone Keeper incl. self (atk +2 over base)", withTwo.attack === selfOnly.attack + 2, { selfOnly, withTwo });
  check("tcg_241 scales +1/+1 per Stone Keeper incl. self (hp +2 over base)", withTwo.health === selfOnly.health + 2, { selfOnly, withTwo });
}

// --- tcg_3446: "+1/+1 for each OTHER Stone Keeper" (EXCLUDES self) --------------
{
  const base = playWith("tcg_3446", []); // mult 0 -> no buff
  const scaled = playWith("tcg_3446", [sk("tcg_1", 1), sk("tcg_2", 2), sk("tcg_3", 3)]); // mult 3
  check("tcg_3446 scales per OTHER Stone Keeper (atk +3)", scaled.attack === base.attack + 3, { base, scaled });
  check("tcg_3446 scales per OTHER Stone Keeper (hp +3)", scaled.health === base.health + 3, { base, scaled });
}

// --- tcg_1426: "+1 Attack for each Iron Defender" (attack only) -----------------
{
  const base = playWith("tcg_1426", []);
  const scaled = playWith("tcg_1426", [id_("tcg_1426", 1), id_("tcg_1426", 2)]); // 2 Iron Defenders
  check("tcg_1426 scales ATTACK only per Iron Defender (atk +2)", scaled.attack === base.attack + 2, { base, scaled });
  check("tcg_1426 grants NO health from the scaled buff", scaled.health === base.health, { base, scaled });
}

// --- tcg_412: on-damage token summon (unit survives the hit) --------------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "atk", cardId: "tcg_test", attack: 2, health: 10, maxHealth: 10 })];
  m.players.P2.board.front = [unit({ instanceId: "spawner", cardId: "tcg_412", attack: 1, health: 10, maxHealth: 10 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "atk", defenderInstanceId: "spawner" });
  const p2 = r.state.players.P2.board.front;
  check("tcg_412 survives the hit (10 -> 8)", p2.find((u) => u.instanceId === "spawner")?.health === 8, p2.map((u) => [u.instanceId, u.health]));
  check("tcg_412 summons a frost-spirit token on taking damage", p2.some((u) => u.cardId.startsWith("token_frost_spirit")), p2.map((u) => u.cardId));
}

// --- tcg_2427: on-damage draw --------------------------------------------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "hit", cardId: "tcg_test", attack: 2, health: 10, maxHealth: 10 })];
  m.players.P2.board.front = [unit({ instanceId: "scholar", cardId: "tcg_2427", attack: 1, health: 10, maxHealth: 10 })];
  m.players.P2.deck = ["tcg_test", "tcg_test"];
  m.players.P2.deckCount = 2;
  const handBefore = m.players.P2.hand.length;
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hit", defenderInstanceId: "scholar" });
  check("tcg_2427 draws a card when damaged (hand +1)", r.state.players.P2.hand.length === handBefore + 1, { before: handBefore, after: r.state.players.P2.hand.length });
}

console.log(`\n=== LONG-TAIL PROOF (no-keyword scaled buffs + on-damage reactions) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} long-tail check(s) failed.`);
  process.exit(1);
}
console.log("ALL LONG-TAIL PROOFS PASSED");
