/**
 * dev:spells — pins the SPELL category END-TO-END through `applyAction`.
 *
 * Spells are the five conservative golden fixtures (src/engine/spellCards.ts),
 * deliberately kept OUT of the shipped catalog. A spell:
 *   - validates like a unit (hand index, type === "spell", energy),
 *   - resolves its compiled specs immediately (cast == ON_SUMMON),
 *   - threads `targetInstanceId` for single-target spells (damage/debuff hit the
 *     opponent's board; heal/buff hit the caster's own board),
 *   - then goes to the discard pile (graveyard), never the board.
 *
 * Fixtures:
 *   spell_mend     heal 3        (safe)       targets an ally
 *   spell_insight  draw 2        (safe)       no target
 *   spell_embolden +2/+2 buff    (safe)       targets an ally (BUFF_SELF on source)
 *   spell_strike   deal 3        (restricted) targets an enemy
 *   spell_sap      enemy -2 atk  (restricted) targets an enemy
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

function arena(seed = 9001): MatchState {
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
  }
  return m;
}

// --- spell_mend: heal a chosen ally -------------------------------------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "ally", health: 3, maxHealth: 8 })];
  m.players.P1.hand = ["spell_mend"];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "ally" });
  const a = r.state.players.P1.board.front.find((u) => u.instanceId === "ally");
  check("spell_mend heals the chosen ally (3 -> 6)", a?.health === 6, a?.health);
  check("spell_mend leaves hand and enters discard", r.state.players.P1.hand.length === 0 && r.state.players.P1.discard.includes("spell_mend"), { hand: r.state.players.P1.hand, discard: r.state.players.P1.discard });
  check("spell_mend never goes to the board", !r.state.players.P1.board.front.some((u) => u.cardId === "spell_mend"));
}

// --- spell_mend: missing target is a clean reject -----------------------------
{
  const m = arena();
  m.players.P1.hand = ["spell_mend"];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0 });
  check("spell_mend with no target is rejected (state unchanged)", r.state === m && r.events.some((e) => e.type === "REJECTED"), r.events);
}

// --- spell_insight: draw 2, no target -----------------------------------------
{
  const m = arena();
  m.players.P1.hand = ["spell_insight"];
  m.players.P1.deck = ["tcg_test", "tcg_test", "tcg_test"];
  m.players.P1.deckCount = 3;
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0 });
  check("spell_insight draws 2 (hand 0->2 after the spell leaves)", r.state.players.P1.hand.length === 2, r.state.players.P1.hand);
  check("spell_insight draws from the deck (3 -> 1)", r.state.players.P1.deck.length === 1, r.state.players.P1.deck);
}

// --- spell_embolden: +2/+2 to a chosen ally (BUFF_SELF wired on source) --------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "ally", attack: 2, health: 4, maxHealth: 4 })];
  m.players.P1.hand = ["spell_embolden"];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "ally" });
  const a = r.state.players.P1.board.front.find((u) => u.instanceId === "ally");
  check("spell_embolden buffs the chosen ally +2/+2 (2/4 -> 4/6)", a?.attack === 4 && a?.health === 6 && a?.maxHealth === 6, a);
}

// --- spell_strike: deal 3 to a chosen enemy (armor-ignoring ability damage) ----
{
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "foe", health: 5, maxHealth: 5, armor: 4 })];
  m.players.P1.hand = ["spell_strike"];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "foe" });
  const f = r.state.players.P2.board.front.find((u) => u.instanceId === "foe");
  check("spell_strike deals 3 ignoring armor (5 -> 2)", f?.health === 2, f?.health);
}

// --- spell_strike: lethal removes the enemy from the board --------------------
{
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "foe", health: 3, maxHealth: 3 })];
  m.players.P1.hand = ["spell_strike"];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "foe" });
  check("spell_strike lethal clears the enemy from the board", !r.state.players.P2.board.front.some((u) => u.instanceId === "foe"), r.state.players.P2.board.front.map((u) => u.instanceId));
}

// --- spell_sap: enemy loses 2 attack (floored at 0) ---------------------------
{
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "foe", attack: 1, health: 5, maxHealth: 5 })];
  m.players.P1.hand = ["spell_sap"];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "foe" });
  const f = r.state.players.P2.board.front.find((u) => u.instanceId === "foe");
  check("spell_sap floors enemy attack at 0 (1 - 2 -> 0)", f?.attack === 0, f?.attack);
}

// --- guard rails: type + energy + ownership -----------------------------------
{
  const m = arena();
  m.players.P1.hand = ["tcg_test"]; // a unit id, not a spell
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0 });
  check("PLAY_SPELL rejects a non-spell card", r.state === m && r.events.some((e) => e.type === "REJECTED"), r.events);

  const m2 = arena();
  m2.players.P1.hand = ["spell_strike"];
  m2.players.P1.energy = 0; // cannot afford
  const r2 = applyAction(m2, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "x" });
  check("PLAY_SPELL rejects when energy is insufficient", r2.state === m2 && r2.events.some((e) => e.type === "REJECTED"), r2.events);
}

// --- spell_annihilate: destroy a chosen enemy (fires its deathrattle) ----------
{
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "foe", health: 9, maxHealth: 9, armor: 5 })];
  m.players.P1.hand = ["spell_annihilate"];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "foe" });
  check("spell_annihilate destroys the chosen enemy regardless of HP/armor", !r.state.players.P2.board.front.some((u) => u.instanceId === "foe"), r.state.players.P2.board.front.map((u) => u.instanceId));
}

// --- spell_recall: bounce an enemy unit back to its owner's hand ----------------
{
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "foe", cardId: "tcg_19", attack: 4, health: 4, maxHealth: 4 })];
  const handBefore = m.players.P2.hand.length;
  m.players.P1.hand = ["spell_recall"];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "foe" });
  check("spell_recall removes the enemy from the board", !r.state.players.P2.board.front.some((u) => u.instanceId === "foe"), r.state.players.P2.board.front.map((u) => u.instanceId));
  check("spell_recall returns the card to its OWNER's hand (P2 hand +1, incl. tcg_19)", r.state.players.P2.hand.length === handBefore + 1 && r.state.players.P2.hand.includes("tcg_19"), r.state.players.P2.hand);
}

// --- spell_recall: a token vanishes (no card to return) ------------------------
{
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "tok", cardId: "token_stonechild", attack: 1, health: 1, maxHealth: 1 })];
  const handBefore = m.players.P2.hand.length;
  m.players.P1.hand = ["spell_recall"];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "tok" });
  check("spell_recall on a token removes it and adds NOTHING to hand", !r.state.players.P2.board.front.some((u) => u.instanceId === "tok") && r.state.players.P2.hand.length === handBefore, { board: r.state.players.P2.board.front.map((u) => u.instanceId), hand: r.state.players.P2.hand.length });
}

// --- spell_renew: restore the caster's own nexus, capped at 20 -----------------
{
  const m = arena();
  m.players.P1.nexusHealth = 12;
  m.players.P1.hand = ["spell_renew"];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0 });
  check("spell_renew restores 4 to own nexus (12 -> 16)", r.state.players.P1.nexusHealth === 16, r.state.players.P1.nexusHealth);

  const m2 = arena();
  m2.players.P1.nexusHealth = 18;
  m2.players.P1.hand = ["spell_renew"];
  const r2 = applyAction(m2, { type: "PLAY_SPELL", player: "P1", handIndex: 0 });
  check("spell_renew caps nexus heal at 20 (18 + 4 -> 20)", r2.state.players.P1.nexusHealth === 20, r2.state.players.P1.nexusHealth);
}

console.log(`\n=== SPELL PROOF (PLAY_SPELL: 8 templates incl. destroy/bounce/nexus-heal) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} spell check(s) failed.`);
  process.exit(1);
}
console.log("ALL SPELL PROOFS PASSED");
