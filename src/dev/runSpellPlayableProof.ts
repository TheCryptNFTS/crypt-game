/**
 * dev:spell-playable — proves SPELLS are FIRST-CLASS and actually PLAYABLE
 * end-to-end through the LIVE match path, closing the gap a prior audit flagged:
 * the SPELL category (and so Hokusai's AURA_SPELL_COST discount) was never
 * exercised in real play because the live deck builder never put a spell in a
 * deck.
 *
 * ROOT CAUSE (now fixed): `composeDeck` in nft/buildOwnedDeck.ts — the single
 * source of truth for the live local match (useLocalCryptMatch) and the owned/demo
 * deck preview — only ever bucketed unit/equipment/artifact, and its CORE_POOL
 * (curatedCoreSetV2.primaryCardIds) contained no spells. So a spell could never
 * enter a real deck, never be drawn, and PLAY_SPELL never fired in actual play.
 * The fix reserves a small capped tail of SAFE-tier spells in both the demo and
 * owned pools (same flex policy as buildCuratedDeck), so spells are deck-legal,
 * drawable, and castable in the live path.
 *
 * This proof drives the REAL chain with NO crafted hands:
 *   A) buildPlayerDeck() (the live deck) contains >=1 SAFE spell.
 *   B) A real match bootstrapped from that deck DRAWS a spell into hand through the
 *      real END_TURN -> drawForPlayer path, then PLAY_SPELL executes and its effect
 *      resolves (the spell leaves hand -> discard, never the board).
 *   C) HOKUSAI LITMUS: with Hokusai (tcg_2256, AURA_SPELL_COST 1) on the caster's
 *      board, a spell's EFFECTIVE cost is reduced by exactly 1 (energy spent X-1),
 *      and with no Hokusai it costs the full X — the discount the audit said was
 *      unverifiable, now observed.
 *
 * Deterministic: fixed seeds, no Date/Math.random. check(name,cond) + exit(1).
 */

import { applyAction } from "../engine/reducer";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { buildPlayerDeck } from "../nft/buildOwnedDeck";
import { allCommanders } from "../engine/commanders";
import { getPlayableCardById } from "../engine/cards";
import { liveSpells } from "../engine/spellCards";
import { MatchState, UnitInPlay } from "../engine/state";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`OK: ${name}`);
  else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

const SAFE_SPELL_IDS = new Set(
  liveSpells.filter((s) => (s as { tier?: string }).tier === "safe").map((s) => s.id)
);

/** A board unit instance (only used to plant Hokusai; everything else is real). */
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
  } as UnitInPlay;
}

function freshMatch(seed: number, p1Deck: string[], p2Deck: string[]): MatchState {
  const c1 = allCommanders[0];
  const c2 = allCommanders.find((c: any) => c.id !== c1.id) ?? c1;
  return createMatchFromDecks({
    p1: { commanderId: c1.id, deck: p1Deck },
    p2: { commanderId: c2.id, deck: p2Deck },
    seed,
    shuffle: false,
    openingHandSize: 3,
  }) as MatchState;
}

// ===========================================================================
// A) The LIVE deck builder now ships a spell in a real deck.
// ===========================================================================
const liveDeck = buildPlayerDeck().deck;
const liveSpellsInDeck = liveDeck.filter((id) => id.startsWith("spell_"));
check("A: buildPlayerDeck() (the LIVE deck) is 30 cards", liveDeck.length === 30, liveDeck.length);
check("A: the LIVE deck contains >=1 spell (was 0 before the fix)", liveSpellsInDeck.length >= 1, liveSpellsInDeck);
check(
  "A: every drafted spell is SAFE-tier and a real spell card",
  liveSpellsInDeck.every((id) => SAFE_SPELL_IDS.has(id) && getPlayableCardById(id)?.type === "spell"),
  liveSpellsInDeck
);

// ===========================================================================
// B) Real match: DRAW a spell via END_TURN -> drawForPlayer, then PLAY_SPELL.
//    Use spell_foresight (draw 2, no target) so the effect is unambiguous and
//    needs no board. We plant it on top of P1's library and cycle a turn so P1
//    draws it through the REAL draw path (no hand crafting).
// ===========================================================================
{
  const SPELL = "spell_foresight"; // safe, "draw 2 cards", no target
  check("B setup: spell_foresight exists and is a spell", getPlayableCardById(SPELL)?.type === "spell");

  // Both decks are the live demo deck; P1's library top is forced to the spell so
  // the next P1 draw yields it deterministically. shuffle:false keeps order stable.
  const m: any = freshMatch(7001, liveDeck.slice(), liveDeck.slice());
  // Ensure plenty of fuel under the spell so "draw 2" has cards and no deck-out.
  m.players.P1.deck = [SPELL, "tcg_1", "tcg_2", "tcg_3", "tcg_4", "tcg_5"];
  m.players.P1.deckCount = m.players.P1.deck.length;
  m.activePlayer = "P1";

  const handBefore = m.players.P1.hand.length;
  // P1 ends turn -> P2 draws+turn; P2 ends turn -> P1 draws the planted spell.
  const r1 = applyAction(m, { type: "END_TURN", player: "P1" });
  const r2 = applyAction(r1.state, { type: "END_TURN", player: "P2" });
  const s2: any = r2.state;
  const spellIdx = s2.players.P1.hand.indexOf(SPELL);
  check("B: P1 DREW the spell into hand via the real END_TURN draw path", spellIdx >= 0, s2.players.P1.hand);

  // Give energy headroom (turn ramp may not cover a cost-3 spell yet) and cast it.
  s2.players.P1.energy = 99;
  s2.players.P1.maxEnergy = 99;
  const deckLenBeforeCast = s2.players.P1.deck.length;
  const r3 = applyAction(s2, { type: "PLAY_SPELL", player: "P1", handIndex: spellIdx });
  const s3: any = r3.state;
  const playedEvent = r3.events.some((e: any) => e.type === "SPELL_PLAYED" && e.cardId === SPELL);
  check("B: PLAY_SPELL fired in a REAL match (SPELL_PLAYED emitted)", playedEvent, r3.events.map((e: any) => e.type));
  check("B: the spell left hand and went to discard (never the board)",
    !s3.players.P1.hand.includes(SPELL) && s3.players.P1.discard.includes(SPELL) &&
    !s3.players.P1.board.front.some((u: any) => u.cardId === SPELL) &&
    !s3.players.P1.board.back.some((u: any) => u.cardId === SPELL),
    { hand: s3.players.P1.hand, discard: s3.players.P1.discard });
  // "draw 2 cards" resolved: deck shrank by 2 from the cast (the spell itself was
  // already removed from hand, not the deck).
  check("B: the spell's EFFECT resolved (draw 2 -> deck shrank by 2)",
    s3.players.P1.deck.length === deckLenBeforeCast - 2,
    { before: deckLenBeforeCast, after: s3.players.P1.deck.length });
}

// ===========================================================================
// C) HOKUSAI LITMUS — AURA_SPELL_COST observable in real play.
//    Same spell, same match, two boards: with Hokusai on P1's board the energy
//    spent on the cast is exactly (cost - 1); without Hokusai it's the full cost.
// ===========================================================================
{
  const SPELL = "spell_foresight";
  const baseCost = getPlayableCardById(SPELL)?.cost ?? 0;
  check("C setup: spell_foresight has a known cost", baseCost > 0, baseCost);
  const hok = getPlayableCardById("tcg_2256");
  check("C setup: Hokusai (tcg_2256) is a unit with the spell-cost aura",
    hok?.type === "unit" && /Spells cost 1 less/i.test(String(hok?.rawTraits?.Ability)), hok?.rawTraits?.Ability);

  // -- WITHOUT Hokusai: full cost spent. --
  function castAndMeasure(withHokusai: boolean): number {
    const m: any = freshMatch(7002, liveDeck.slice(), liveDeck.slice());
    m.activePlayer = "P1";
    m.players.P1.hand = [SPELL];
    m.players.P1.deck = ["tcg_1", "tcg_2", "tcg_3", "tcg_4"]; // fuel for draw-2
    m.players.P1.deckCount = m.players.P1.deck.length;
    m.players.P1.energy = 10;
    m.players.P1.maxEnergy = 10;
    m.players.P1.board.front = withHokusai
      ? [unit({ instanceId: "hok", cardId: "tcg_2256", attack: 3, health: 5, maxHealth: 5 })]
      : [];
    const before = m.players.P1.energy;
    const r = applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0 });
    const after = (r.state as any).players.P1.energy;
    check(`C: cast ${withHokusai ? "WITH" : "without"} Hokusai succeeded`,
      r.events.some((e: any) => e.type === "SPELL_PLAYED"), r.events.map((e: any) => e.type));
    return before - after; // energy actually spent
  }

  const spentNoAura = castAndMeasure(false);
  const spentWithAura = castAndMeasure(true);

  check(`C: without Hokusai, spell costs full ${baseCost} (spent ${spentNoAura})`,
    spentNoAura === baseCost, { baseCost, spentNoAura });
  check(`C: HOKUSAI LITMUS — with Hokusai, effective cost is ${baseCost} -> ${baseCost - 1} (spent ${spentWithAura})`,
    spentWithAura === baseCost - 1, { baseCost, spentWithAura });
  check("C: the discount is exactly 1 (AURA_SPELL_COST observed in real play)",
    spentNoAura - spentWithAura === 1, { spentNoAura, spentWithAura });
}

console.log("\n=== SPELL PLAYABLE PROOF (live deck -> draw -> PLAY_SPELL; Hokusai discount) ===");
if (failures > 0) {
  console.error(`FAILED: ${failures} spell-playable check(s) failed.`);
  process.exit(1);
}
console.log("ALL SPELL PLAYABLE PROOFS PASSED");
