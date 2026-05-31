/**
 * dev:spell-archetype — pins the LIVE SPELL archetype + deck-manipulation depth.
 *
 * This closes the coverage gap the marquee-aura proof called out: the shipped
 * catalog now contains real type:"spell" cards (src/engine/spellCards.ts ->
 * liveSpells, merged into allPlayableCards), so the SPELL category and
 * AURA_SPELL_COST cost reduction are exercisable END-TO-END through the REAL
 * `applyAction` PLAY_SPELL path — not just via a fixture lookup.
 *
 * What is proven (concrete, exact numbers):
 *   (a) A damage spell (spell_bolt, "deal 4") kills/damages an ENEMY UNIT and
 *       NEVER touches the enemy nexus (the hard burn constraint).
 *   (b) AURA_SPELL_COST (Hokusai tcg_2256, "spells cost 1 less") actually reduces
 *       a spell's energy cost when the source is in play, and the spell pays FULL
 *       cost when it is not.
 *   (c) Each new deck-manipulation op does what it says AND no-ops cleanly on an
 *       empty deck:
 *         - TUTOR_FROM_DECK   (spell_seek) pulls the lowest-cost unit to hand.
 *         - DRAW_FILTERED     draws only the requested type from the deck top.
 *         - SCRY_DYNAMIC      reorders the top N of the deck (ascending cost).
 *         - MILL_FROM_DECK    moves the top N cards to discard (never hand).
 *
 * Deterministic: matches are built from an explicit seed; the deck-manip ops use
 * deck order / cost ordering only (no RNG, no Date).
 */

import { applyAction } from "../engine/reducer";
import { compileAbility } from "../engine/abilityCompiler";
import { getPlayableCardById } from "../engine/cards";
import { resolveEffect, EffectContext } from "../engine/effectResolver";
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

function arena(seed = 9700): MatchState {
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
    m.players[p].deck = [];
    m.players[p].deckCount = 0;
    m.players[p].discard = [];
    m.players[p].graveyard = [];
  }
  return m;
}

// Deterministic deck-manip context that mirrors what the reducer threads into
// resolveEffect (own-deck ops need controller + costOf + cardTypeOf only).
function deckCtx(state: MatchState, controller: "P1" | "P2"): EffectContext {
  return {
    state,
    controller,
    costOf: (id) => getPlayableCardById(id)?.cost ?? 0,
    cardTypeOf: (id) => getPlayableCardById(id)?.type ?? null,
  };
}

// Concrete catalog ids with known costs/types (verified live):
//   tcg_33  unit cost 1     tcg_2 unit cost 2     tcg_4655 unit cost 10
//   spell_bolt spell cost 3  spell_foresight spell cost 2  tcg_2256 Hokusai unit
const U1 = "tcg_33"; // cost 1
const U2 = "tcg_2"; // cost 2
const U10 = "tcg_4655"; // cost 10
const SPELL_A = "spell_bolt"; // cost 3
const SPELL_B = "spell_foresight"; // cost 2

// === Sanity: the live SPELL archetype is actually in the catalog ===============
{
  const live = ["spell_bolt", "spell_mendwave", "spell_foresight", "spell_rally_cry", "spell_seek", "spell_reclaim"];
  for (const id of live) {
    check(`live spell ${id} is in the catalog as type spell`, getPlayableCardById(id)?.type === "spell", getPlayableCardById(id)?.type);
  }
  // Each compiles to a recognized, non-empty spec set.
  for (const id of live) {
    const c = compileAbility(getPlayableCardById(id)?.rawTraits?.Ability);
    check(`live spell ${id} compiles (recognized, >=1 spec)`, c.recognized && c.specs.length >= 1, { ops: c.specs.map((s) => s.op) });
  }
}

// === (a) Damage spell kills an ENEMY UNIT and NEVER touches the enemy nexus ====
{
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "foe", health: 4, maxHealth: 4, armor: 9 })];
  m.players.P2.nexusHealth = 20;
  m.players.P1.hand = [SPELL_A]; // deal 4
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "foe" });
  check("spell_bolt deal-4 kills the 4-HP enemy unit (armor ignored)", !r.state.players.P2.board.front.some((u) => u.instanceId === "foe"), r.state.players.P2.board.front.map((u) => u.instanceId));
  check("spell_bolt NEVER damages the enemy nexus (stays 20)", r.state.players.P2.nexusHealth === 20, r.state.players.P2.nexusHealth);
  check("spell_bolt NEVER damages the caster's own nexus (stays 20)", r.state.players.P1.nexusHealth === 20, r.state.players.P1.nexusHealth);
}
{
  // Non-lethal: a 7-HP enemy survives at 3, nexus untouched.
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "foe", health: 7, maxHealth: 7 })];
  m.players.P1.hand = [SPELL_A];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "foe" });
  const f = r.state.players.P2.board.front.find((u) => u.instanceId === "foe");
  check("spell_bolt deals exactly 4 to the enemy unit (7 -> 3)", f?.health === 3, f?.health);
  check("spell_bolt non-lethal still leaves enemy nexus at 20", r.state.players.P2.nexusHealth === 20, r.state.players.P2.nexusHealth);
}

// === (b) AURA_SPELL_COST reduces a spell's energy cost end-to-end ==============
{
  // Confirm Hokusai's compiled op first (regression guard).
  const hok = compileAbility(getPlayableCardById("tcg_2256")?.rawTraits?.Ability);
  const aura = hok.specs.find((s) => s.op === "AURA_SPELL_COST");
  check("tcg_2256 (Hokusai) compiles to AURA_SPELL_COST amount 1", aura?.amount === 1, hok.specs.map((s) => s.op + ":" + (s.amount ?? "")));

  // WITHOUT the aura source: spell_bolt (cost 3) pays full 3.
  const noAura = arena();
  noAura.players.P1.energy = 3; // exactly full cost
  noAura.players.P2.board.front = [unit({ instanceId: "foe", health: 9, maxHealth: 9 })];
  noAura.players.P1.hand = [SPELL_A];
  const r0 = applyAction(noAura, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "foe" });
  check("no-aura: spell_bolt pays full cost 3 (energy 3 -> 0)", r0.state.players.P1.energy === 0, r0.state.players.P1.energy);

  // Same energy budget of 2, NO aura: cost 3 > 2 -> rejected (full cost enforced).
  const noAuraReject = arena();
  noAuraReject.players.P1.energy = 2;
  noAuraReject.players.P2.board.front = [unit({ instanceId: "foe", health: 9, maxHealth: 9 })];
  noAuraReject.players.P1.hand = [SPELL_A];
  const rRej = applyAction(noAuraReject, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "foe" });
  check("no-aura: spell_bolt with only 2 energy is rejected (cost 3)", rRej.state === noAuraReject && rRej.events.some((e) => e.type === "REJECTED"), rRej.events);

  // WITH Hokusai on the caster's board: cost reduced by 1 -> effective 2.
  const withAura = arena();
  withAura.players.P1.energy = 2; // would be too little at full cost 3
  withAura.players.P1.board.front = [unit({ instanceId: "hokusai", cardId: "tcg_2256" })];
  withAura.players.P2.board.front = [unit({ instanceId: "foe", health: 9, maxHealth: 9 })];
  withAura.players.P1.hand = [SPELL_A];
  const r1 = applyAction(withAura, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId: "foe" });
  check("aura: spell_bolt is castable at 2 energy and the spell resolved", r1.state.players.P1.hand.length === 0 && r1.state.players.P1.discard.includes(SPELL_A), { hand: r1.state.players.P1.hand, discard: r1.state.players.P1.discard });
  check("aura: spell_bolt costs 1 less (energy 2 -> 0, i.e. effective cost 2)", r1.state.players.P1.energy === 0, r1.state.players.P1.energy);
  check("aura: the reduced cast still hit the enemy unit (9 -> 5), not the nexus", r1.state.players.P2.board.front.find((u) => u.instanceId === "foe")?.health === 5 && r1.state.players.P2.nexusHealth === 20, { foe: r1.state.players.P2.board.front.find((u) => u.instanceId === "foe")?.health, nexus: r1.state.players.P2.nexusHealth });
}

// === (c1) TUTOR_FROM_DECK: pull the lowest-cost unit to hand ===================
{
  // spell_seek -> TUTOR_FROM_DECK LOWEST_COST_UNIT. Deck has a spell, a 10-cost
  // unit, and a 1-cost unit. The 1-cost unit (U1) must be pulled; the spell is
  // skipped (wrong type), and the 10-cost unit is not the lowest.
  const m = arena();
  m.players.P1.deck = [SPELL_B, U10, U1, U2];
  m.players.P1.deckCount = 4;
  m.players.P1.hand = ["spell_seek"];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0 });
  check("spell_seek pulls the lowest-cost UNIT (tcg_33, cost 1) to hand", r.state.players.P1.hand.includes(U1), r.state.players.P1.hand);
  check("spell_seek removed exactly that card from the deck (4 -> 3)", r.state.players.P1.deck.length === 3 && !r.state.players.P1.deck.includes(U1), r.state.players.P1.deck);
  check("spell_seek did NOT pull the spell or the 10-cost unit", !r.state.players.P1.hand.includes(SPELL_B) && !r.state.players.P1.hand.includes(U10), r.state.players.P1.hand);
}
{
  // Tutor with NO unit in deck (only spells) -> clean no-op.
  const m = arena();
  m.players.P1.deck = [SPELL_A, SPELL_B];
  m.players.P1.deckCount = 2;
  m.players.P1.hand = ["spell_seek"];
  const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0 });
  check("spell_seek no-ops when the deck has no unit (deck unchanged, nothing tutored)", r.state.players.P1.deck.length === 2 && r.state.players.P1.hand.length === 0, { deck: r.state.players.P1.deck, hand: r.state.players.P1.hand });
}
{
  // Tutor on an EMPTY deck -> clean no-op (direct resolver drive).
  const m = arena();
  m.players.P1.deck = [];
  const ctx = deckCtx(m, "P1");
  resolveEffect({ trigger: "ON_SUMMON", op: "TUTOR_FROM_DECK", tutorSelector: "LOWEST_COST_UNIT", raw: "" }, ctx);
  check("TUTOR_FROM_DECK empty-deck no-op (deck stays empty, no hand add)", m.players.P1.deck.length === 0 && m.players.P1.hand.length === 0);
}
{
  // HIGHEST_COST_UNIT selector picks the 10-cost unit; LOWEST tie-break by deck index.
  const m = arena();
  m.players.P1.deck = [U2, U10, U1];
  const ctx = deckCtx(m, "P1");
  resolveEffect({ trigger: "ON_SUMMON", op: "TUTOR_FROM_DECK", tutorSelector: "HIGHEST_COST_UNIT", raw: "" }, ctx);
  check("TUTOR HIGHEST_COST_UNIT pulls the 10-cost unit (tcg_4655)", m.players.P1.hand.includes(U10) && !m.players.P1.deck.includes(U10), { hand: m.players.P1.hand, deck: m.players.P1.deck });
}
{
  // Tie-break determinism: two cost-2 units, earliest deck index wins for LOWEST.
  const m = arena();
  m.players.P1.deck = [U2, "tcg_6", U1]; // tcg_6 is also cost 2; U1 cost 1 is the true lowest
  const ctx = deckCtx(m, "P1");
  resolveEffect({ trigger: "ON_SUMMON", op: "TUTOR_FROM_DECK", tutorSelector: "LOWEST_COST_UNIT", raw: "" }, ctx);
  check("TUTOR LOWEST tie-break: the cost-1 unit (tcg_33) wins over the cost-2 pair", m.players.P1.hand.includes(U1), m.players.P1.hand);
}

// === (c2) DRAW_FILTERED: draw only the requested type from the deck top ========
{
  // Deck top: spell, unit, unit, spell, unit. Draw 2 UNITS -> first two units only.
  const m = arena();
  m.players.P1.deck = [SPELL_A, U1, U2, SPELL_B, U10];
  m.players.P1.deckCount = 5;
  const ctx = deckCtx(m, "P1");
  resolveEffect({ trigger: "ON_SUMMON", op: "DRAW_FILTERED", drawType: "UNIT", amount: 2, raw: "" }, ctx);
  check("DRAW_FILTERED UNIT 2 drew exactly the first two units (tcg_33, tcg_2)", m.players.P1.hand.length === 2 && m.players.P1.hand.includes(U1) && m.players.P1.hand.includes(U2), m.players.P1.hand);
  check("DRAW_FILTERED skipped spells and left them + the un-drawn unit in deck", m.players.P1.deck.length === 3 && m.players.P1.deck.includes(SPELL_A) && m.players.P1.deck.includes(SPELL_B) && m.players.P1.deck.includes(U10), m.players.P1.deck);
}
{
  // Draw 1 SPELL from a mixed deck -> only the first spell, units untouched.
  const m = arena();
  m.players.P1.deck = [U1, SPELL_A, U2, SPELL_B];
  const ctx = deckCtx(m, "P1");
  resolveEffect({ trigger: "ON_SUMMON", op: "DRAW_FILTERED", drawType: "SPELL", amount: 1, raw: "" }, ctx);
  check("DRAW_FILTERED SPELL 1 drew only the first spell (spell_bolt)", m.players.P1.hand.length === 1 && m.players.P1.hand[0] === SPELL_A, m.players.P1.hand);
  check("DRAW_FILTERED SPELL left both units + the second spell in deck", m.players.P1.deck.length === 3 && m.players.P1.deck.includes(U1) && m.players.P1.deck.includes(U2) && m.players.P1.deck.includes(SPELL_B), m.players.P1.deck);
}
{
  // Empty deck -> clean no-op.
  const m = arena();
  const ctx = deckCtx(m, "P1");
  resolveEffect({ trigger: "ON_SUMMON", op: "DRAW_FILTERED", drawType: "UNIT", amount: 3, raw: "" }, ctx);
  check("DRAW_FILTERED empty-deck no-op (no hand add, deck stays empty)", m.players.P1.hand.length === 0 && m.players.P1.deck.length === 0);
}

// === (c3) SCRY_DYNAMIC: reorder the top N (ascending cost) =====================
{
  // Top 3 = [10, 1, 2] by cost -> scry 3 reorders to ascending [1, 2, 10]; the
  // tail is untouched.
  const m = arena();
  m.players.P1.deck = [U10, U1, U2, SPELL_A];
  const ctx = deckCtx(m, "P1");
  resolveEffect({ trigger: "ON_SUMMON", op: "SCRY_DYNAMIC", amount: 3, raw: "" }, ctx);
  check("SCRY_DYNAMIC 3 reorders the top 3 by ascending cost (1,2,10)", m.players.P1.deck[0] === U1 && m.players.P1.deck[1] === U2 && m.players.P1.deck[2] === U10, m.players.P1.deck);
  check("SCRY_DYNAMIC leaves the tail (and deck size) untouched", m.players.P1.deck.length === 4 && m.players.P1.deck[3] === SPELL_A, m.players.P1.deck);
}
{
  // Depth 2 only touches the top two; the 1-cost stays deeper.
  const m = arena();
  m.players.P1.deck = [U10, U2, U1];
  const ctx = deckCtx(m, "P1");
  resolveEffect({ trigger: "ON_SUMMON", op: "SCRY_DYNAMIC", amount: 2, raw: "" }, ctx);
  check("SCRY_DYNAMIC 2 sorts only the top two (2,10) and leaves index 2 (1)", m.players.P1.deck[0] === U2 && m.players.P1.deck[1] === U10 && m.players.P1.deck[2] === U1, m.players.P1.deck);
}
{
  // Empty / single-card deck -> no-op (scryDeck guards length < 2).
  const m = arena();
  m.players.P1.deck = [U1];
  const ctx = deckCtx(m, "P1");
  resolveEffect({ trigger: "ON_SUMMON", op: "SCRY_DYNAMIC", amount: 3, raw: "" }, ctx);
  check("SCRY_DYNAMIC single-card no-op (deck unchanged)", m.players.P1.deck.length === 1 && m.players.P1.deck[0] === U1);
}

// === (c4) MILL_FROM_DECK: top N -> discard, never hand =========================
{
  const m = arena();
  m.players.P1.deck = [U1, U2, U10, SPELL_A];
  m.players.P1.deckCount = 4;
  const ctx = deckCtx(m, "P1");
  resolveEffect({ trigger: "ON_SUMMON", op: "MILL_FROM_DECK", amount: 2, raw: "" }, ctx);
  check("MILL_FROM_DECK 2 moved the top 2 to discard (tcg_33, tcg_2)", m.players.P1.discard.includes(U1) && m.players.P1.discard.includes(U2), m.players.P1.discard);
  check("MILL_FROM_DECK 2 shrank the deck (4 -> 2) and added NOTHING to hand", m.players.P1.deck.length === 2 && m.players.P1.deckCount === 2 && m.players.P1.hand.length === 0, { deck: m.players.P1.deck, hand: m.players.P1.hand });
  check("MILL_FROM_DECK left the un-milled cards on top (tcg_4655, spell_bolt)", m.players.P1.deck[0] === U10 && m.players.P1.deck[1] === SPELL_A, m.players.P1.deck);
}
{
  // Mill beyond deck size -> mills what remains, no throw.
  const m = arena();
  m.players.P1.deck = [U1];
  const ctx = deckCtx(m, "P1");
  resolveEffect({ trigger: "ON_SUMMON", op: "MILL_FROM_DECK", amount: 5, raw: "" }, ctx);
  check("MILL_FROM_DECK beyond size mills the remaining 1 card (deck empty, discard +1)", m.players.P1.deck.length === 0 && m.players.P1.discard.length === 1 && m.players.P1.discard[0] === U1, { deck: m.players.P1.deck, discard: m.players.P1.discard });
}
{
  // Empty deck -> clean no-op.
  const m = arena();
  const ctx = deckCtx(m, "P1");
  resolveEffect({ trigger: "ON_SUMMON", op: "MILL_FROM_DECK", amount: 3, raw: "" }, ctx);
  check("MILL_FROM_DECK empty-deck no-op (no discard add)", m.players.P1.deck.length === 0 && m.players.P1.discard.length === 0);
}

// === Determinism: same seed + same ops -> byte-identical deck state ============
{
  const run = () => {
    const m = arena(4242);
    m.players.P1.deck = [U10, U1, U2, SPELL_A, SPELL_B];
    const ctx = deckCtx(m, "P1");
    resolveEffect({ trigger: "ON_SUMMON", op: "SCRY_DYNAMIC", amount: 3, raw: "" }, ctx);
    resolveEffect({ trigger: "ON_SUMMON", op: "TUTOR_FROM_DECK", tutorSelector: "LOWEST_COST_UNIT", raw: "" }, ctx);
    resolveEffect({ trigger: "ON_SUMMON", op: "MILL_FROM_DECK", amount: 1, raw: "" }, ctx);
    return JSON.stringify({ deck: m.players.P1.deck, hand: m.players.P1.hand, discard: m.players.P1.discard });
  };
  const a = run();
  const b = run();
  check("deck-manip ops are deterministic (two runs byte-identical)", a === b, { a, b });
}

console.log(`\n=== SPELL ARCHETYPE PROOF (live spells + AURA_SPELL_COST + 4 deck-manip ops) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} spell-archetype check(s) failed.`);
  process.exit(1);
}
console.log("ALL SPELL ARCHETYPE PROOFS PASSED");
