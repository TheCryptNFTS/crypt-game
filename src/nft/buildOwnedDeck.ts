/**
 * Single source of truth for turning a wallet's owned Combat Archives card ids
 * into a playable deck — shared by the live match (`useLocalCryptMatch`) and
 * the pre-match "Your Deck" preview so the two can never disagree about what
 * you'll actually play.
 *
 * "You play what you own" — but a raw first-30 slice (or a "30 cheapest units"
 * slice) produces un-fun decks: a curveless wall of 1-drops with no top-end, where
 * cost>=5 payoffs (GOLD Largesse, the faction archetypes) and Resonance's varied
 * keywords can never show up. So we construct a deck along a DESIGNED MANA CURVE:
 *   1. UNITS filling a curve (most cards mid-cost, a real 6+ top-end) — `UNIT_CURVE`.
 *   2. A few EQUIPMENT then ARTIFACTS (TARGET_* counts, hard-capped by MAX_*).
 *   3. Backfill any unfilled slots cheapest-first (units preferred) so a sparse
 *      OWNED pool still reaches 30 — the curve is a preference, not a hard gate.
 * Deterministic and only ever contains cards the wallet owns.
 *
 * Falls back to the shared demo deck (source: "demo") when not connected, the
 * wallet owns no playable cards, or owns NO playable UNITS (a body-less deck
 * can't play). We never BLOCK play — it's a game we want people to try, and
 * client-side ownership is connection, not authentication, so a hard gate
 * would give false security anyway. Instead the source is surfaced honestly.
 */
import { allPlayableCards } from "../engine/cards";
import { liveSpells } from "../engine/spellCards";
import curatedCoreSetV2 from "../data/curatedCoreSetV2.json";

export const DECK_SIZE = 30;

/**
 * Spell deck-legality for the LIVE match path (#10). `liveSpells` are engine-legal
 * (merged into allPlayableCards, resolved by PLAY_SPELL) but `composeDeck` — the
 * single source of truth for the live local match (useLocalCryptMatch) AND the
 * owned/demo deck preview — historically only ever bucketed unit/equipment/artifact,
 * so a spell could never enter a real match's deck, never be drawn, and PLAY_SPELL
 * never fired in actual play (Hokusai's AURA_SPELL_COST discount was unobservable).
 *
 * We now reserve a small, capped set of SAFE-tier spell slots in the FLEX above the
 * unit core, exactly mirroring buildCuratedDeck's policy: only "safe" spells are ever
 * auto-included (no removal / face-burn), the unit core is never starved, and the
 * deck stays the same size. Deterministic: cheapest-then-id ordering.
 *
 * SPELL ALLOTMENT (2026.06.01): now that there is a real per-faction spell SUITE
 * (removal/draw/tempo/combat-trick across the curve, see spellCards.ts), 4 slots
 * was too few to express a spell game-plan — a deck would draft only the four
 * cheapest safe spells and never see a faction's draw/anthem/tempo mix. Raised to
 * 6 so decks carry a real spell sub-package while the 25-card unit curve (which the
 * spell tail is reserved ABOVE, so it is never starved) stays intact. Still capped,
 * still SAFE-only (no auto-drafted removal), still deterministic.
 */
export const MAX_SPELLS = 6;

/** Deterministic, capped list of SAFE live spells (cheapest-then-id). The live
 *  decks draft from this; restricted (removal/burn) spells are never auto-drafted. */
const SAFE_SPELLS: any[] = liveSpells
  .filter((s) => (s as { tier?: string }).tier === "safe")
  // Exclude DISCOVER spells: they raise a mid-resolution pendingChoice the live
  // match has no on-screen picker for, so auto-drafting one risks a wedged match
  // (every later action rejects 'choice-pending'; only RESET escapes). Match the
  // engine's own DISCOVER verb (effectResolver's DISCOVER_RE keys on "discover").
  // The live hook ALSO self-heals a stray pendingChoice; this keeps them out of
  // drafted decks entirely. (2026-06-14 red-team latent dead-end.)
  .filter((s) => !/\bdiscover\b/i.test(String((s as { rawTraits?: { Ability?: string } }).rawTraits?.Ability ?? "")))
  .slice()
  .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0) || String(a.id).localeCompare(String(b.id)));
/** Equipment with no unit to equip is a dead hand; artifacts are powerful but
 *  situational — so non-units are capped to keep the deck playable. */
export const MAX_EQUIPMENT = 8;
export const MAX_ARTIFACTS = 3;

/**
 * The designed mana curve for the 25 unit slots: `[cost, count, orMore?]`. Most
 * cards sit at cost 2-4 with a real 6+ top-end (the final, `orMore` bucket absorbs
 * the rarer 6-10 drops). 3+5+5+5+4+3 = 25 units; with TARGET_EQUIPMENT (3) +
 * TARGET_ARTIFACTS (2) that's a full 30-card deck with a curve, a payoff ceiling
 * (so GOLD Largesse / archetypes can fire), and varied keywords for Resonance.
 */
const UNIT_CURVE: Array<[cost: number, count: number, orMore?: boolean]> = [
  [1, 3],
  [2, 5],
  [3, 5],
  [4, 5],
  [5, 4],
  [6, 3, true],
];
const TARGET_EQUIPMENT = 3;
// ARTIFACTS CUT FROM V1 (teardown §11 P1): artifacts do nothing for their cost
// and wipe friendly buffs on play (D3), so no deck drafts them. The unit curve +
// equipment + units-preferred backfill below still fill all 30 slots.
const TARGET_ARTIFACTS = 0;

export type DeckSource = "owned" | "demo";

export type BuiltDeck = {
  deck: string[];
  source: DeckSource;
  /** How many distinct cards the wallet owns that are actually PLAYABLE (resolve
   *  to a real card in the catalog). Lets the UI say the truth out loud — "you
   *  own N playable cards, 30 needed" — instead of silently swapping in the demo
   *  deck. 0 = no wallet / no playable cards owned. */
  ownedPlayable: number;
};

const CARD_BY_ID = new Map<string, any>(
  allPlayableCards.map((c: any) => [c.id, c]),
);

/**
 * The faction the DEMO/STARTER deck commits to, and the curated commander whose
 * identity rewards it. With `factionIdentities` + `factionArchetypes` ON in the
 * CORE ruleset, a newcomer's first match should visibly express ONE identity.
 *
 * IRON (teardown §4/§5, director ruling 2026-06-10): the demo was BRONZE — the
 * faction the real-engine playtest put at a 26% win rate (walls whose commander
 * and identity both grant the same redundant RUSH). Handing newcomers the
 * structurally weakest deck was a hazing. Iron's defensive gear identity
 * (Tempered/Warmonger) naturally surfaces GUARD — the tutorial's key keyword —
 * and sits mid-band (~46%). Revisit after the Bronze rescue pass (P4).
 * The matching curated commander is exported so the demo path
 * (useLocalCryptMatch) pairs the deck with the commander that actually fires
 * the identity (a generated `cmd_6xxx` commander has NO faction identity).
 * Owned/explicit decks are untouched — they keep their faction-agnostic build.
 */
const DEMO_FACTION = "IRON_DEFENDERS";
export const DEMO_COMMANDER_ID = "cmd_iron_warlord";

/** Stable cost-then-id ordering so a given wallet always yields the same deck. */
function byCurve(a: any, b: any): number {
  const ca = a?.cost ?? 0;
  const cb = b?.cost ?? 0;
  if (ca !== cb) return ca - cb;
  return String(a?.id).localeCompare(String(b?.id));
}

/**
 * Faction-biased ordering: same as `byCurve` but, WITHIN a cost bucket, units of
 * `faction` sort ahead of off-faction ones. Used ONLY by the demo build so the
 * starter deck leans mono-faction (and crosses the archetype thresholds) while
 * still honoring the designed curve — off-faction cards remain as backfill so the
 * deck always reaches a legal 30 even if the faction is thin at some cost.
 */
function byFactionThenCurve(faction: string) {
  return (a: any, b: any): number => {
    const ca = a?.cost ?? 0;
    const cb = b?.cost ?? 0;
    if (ca !== cb) return ca - cb;
    const fa = a?.faction === faction ? 0 : 1;
    const fb = b?.faction === faction ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return String(a?.id).localeCompare(String(b?.id));
  };
}

/**
 * Compose a 30-card deck from a pool of cards along the designed mana curve: UNITS
 * filling `UNIT_CURVE` (cheapest-id within each cost bucket), then a few EQUIPMENT +
 * ARTIFACTS (TARGET_* counts, hard-capped by MAX_*), then a cheapest-first backfill
 * for any slot the pool couldn't fill (units preferred for playability). Returns
 * null when the pool has no units (a body-less deck can't play). Deterministic and
 * shared by the owned and demo paths so they construct decks identically.
 *
 * `preferFaction` (demo-only) biases the within-bucket SELECTION toward one faction
 * so the starter deck reads as a single identity — it adds NO cards/keywords and
 * never changes the curve, cap, or 30-card size; it only reorders which legal
 * candidates are drafted first. Omitted (owned/explicit path) -> identical to before.
 */
function composeDeck(pool: any[], preferFaction?: string): string[] | null {
  // Drop soft-banned (disabled) cards at intake. An owned collection containing a
  // disabled unit would otherwise build a 30-card "owned" deck that
  // createMatchFromDecks REJECTS ("deck contains a disabled card"); that throw
  // escapes useState in useLocalCryptMatch → WHITE-SCREENS the board for the
  // holder. 35 unit cards are disabled in cardOverrides; filtering here mirrors
  // the isCardDisabled guard every other deck path uses. (2026-06-14 red-team CRASH.)
  pool = pool.filter((c) => c && c.disabled !== true);
  const order = preferFaction ? byFactionThenCurve(preferFaction) : byCurve;
  const units = pool.filter((c) => c.type === "unit").sort(order);
  if (units.length === 0) return null;
  // Owned decks need a real unit core — an equipment/spell-heavy collection could
  // otherwise build a "legal" 30 with as few as 1 unit (a near-empty board that
  // reads as broken). Below the floor, return null so buildPlayerDeck falls back
  // to the demo deck and the owned-cards bar shows the honest "X playable — 30
  // needed" message. The demo path (preferFaction) is exempt: its curated core
  // always clears the floor, so this never breaks the starter deck.
  if (!preferFaction && units.length < 12) return null;
  const equipment = pool.filter((c) => c.type === "equipment").sort(order);
  const artifacts = pool.filter((c) => c.type === "artifact").sort(order);
  // SAFE spells eligible to draft: those present in the pool (so an owned deck only
  // includes spells you were given), cheapest-then-id, capped at MAX_SPELLS. These
  // ride the FLEX above the unit core — reserved BEFORE filling so the curve isn't
  // starved — making spells deck-legal in the live match path (PLAY_SPELL reachable).
  const poolIds = new Set(pool.map((c) => c.id));
  const spells = SAFE_SPELLS.filter((s) => poolIds.has(s.id)).slice(0, MAX_SPELLS);
  // Reserve `spells.length` flex slots: the non-spell fill is capped at this budget
  // so the unit/equip/artifact core is drafted normally, then spells take the tail.
  const nonSpellBudget = DECK_SIZE - spells.length;

  const deck: string[] = [];
  const used = new Set<string>();
  const add = (c: any): void => {
    if (used.has(c.id) || deck.length >= nonSpellBudget) return;
    used.add(c.id);
    deck.push(c.id);
  };

  // 1) Units across the designed curve. Within each cost bucket, take the cheapest-id
  //    units (the pre-sorted order) up to that bucket's count.
  for (const [cost, count, orMore] of UNIT_CURVE) {
    let taken = 0;
    for (const u of units) {
      if (taken >= count) break;
      if (used.has(u.id)) continue;
      if (orMore ? u.cost >= cost : u.cost === cost) {
        add(u);
        taken += 1;
      }
    }
  }
  // 2) A few equipment then artifacts (target counts, never exceeding the hard caps).
  for (const c of equipment.slice(0, Math.min(TARGET_EQUIPMENT, MAX_EQUIPMENT))) add(c);
  for (const c of artifacts.slice(0, Math.min(TARGET_ARTIFACTS, MAX_ARTIFACTS))) add(c);
  // 3) Backfill any slots the curve / targets couldn't fill (short buckets, a sparse
  //    owned pool), cheapest-first and units-preferred, until the deck reaches 30 or
  //    the pool is exhausted. Artifacts are excluded (cut from V1, see above).
  for (const c of [...units, ...equipment]) {
    if (deck.length >= nonSpellBudget) break;
    add(c);
  }
  // 4) Fill the reserved tail with the SAFE spells present in the pool. Spells are
  //    engine-legal (allPlayableCards / PLAY_SPELL) — this is what finally makes them
  //    DRAWABLE in the live match path so PLAY_SPELL fires in real play.
  for (const s of spells) {
    if (deck.length >= DECK_SIZE) break;
    if (used.has(s.id)) continue;
    used.add(s.id);
    deck.push(s.id);
  }
  return deck;
}

/**
 * TIGHT-CUT default deck: the newcomer / not-connected experience plays from the
 * CURATED CORE SET (src/data/curatedCoreSetV2.json), not a raw first-30 slice of
 * the whole ~4k-card catalog. This keeps the default match small, designed, and
 * readable — the single biggest lever on "too much stuff to understand" — while
 * the full catalog stays available for owned decks and the engine's lookups.
 */
const CORE_POOL: any[] = [
  ...(curatedCoreSetV2.primaryCardIds as string[])
    .map((id) => CARD_BY_ID.get(id))
    .filter((c): c is any => !!c),
  // Safe spells are not in primaryCardIds (they're a separate, non-NFT category),
  // so add them to the demo pool — composeDeck reserves the spell tail from these,
  // making the default match's deck actually contain (and draw, and cast) spells.
  ...SAFE_SPELLS.map((s) => CARD_BY_ID.get(s.id)).filter((c): c is any => !!c),
];

// Demo deck leans BRONZE so a newcomer's first game expresses ONE identity (an
// Onslaught/Rush aggro plan that snowballs once 3+ Bronze are live). Bias is
// SELECTION-only — same curve, same 30 cards, no new keywords. Paired with
// DEMO_COMMANDER_ID in the demo match path so the identity actually fires.
const DEMO_DECK = composeDeck(CORE_POOL, DEMO_FACTION) ?? [];

export function buildPlayerDeck(ownedCardIds?: string[]): BuiltDeck {
  if (!ownedCardIds || ownedCardIds.length === 0) {
    return { deck: DEMO_DECK, source: "demo", ownedPlayable: 0 };
  }

  // Distinct owned ids that resolve to a real playable card — the honest count
  // the UI shows. (Spells below are granted, not owned, so they're not counted.)
  const ownedPlayable = [...new Set(ownedCardIds)].filter((id) => CARD_BY_ID.has(id)).length;

  const owned = [
    ...[...new Set(ownedCardIds)]
      .map((id) => CARD_BY_ID.get(id))
      .filter((c): c is any => !!c),
    // Spells are a granted category, not NFT-owned, so make the SAFE pool available
    // to every owned deck too (composeDeck still only drafts MAX_SPELLS of them into
    // the reserved tail, and only if the deck has a unit core).
    ...SAFE_SPELLS.map((s) => CARD_BY_ID.get(s.id)).filter((c): c is any => !!c),
  ];

  const deck = composeDeck(owned);
  // composeDeck never duplicates a card, so a wallet owning FEWER than DECK_SIZE
  // distinct playable cards yields a SHORT deck (not null). A short deck throws
  // in createMatchFromDecks ("Deck must contain exactly 30 cards"), and that
  // throw happens inside useState in useLocalCryptMatch — bubbling to the root
  // error boundary and WHITE-SCREENING the whole app. Guard it here: any deck
  // that isn't a legal 30 falls back to the demo deck so the match always boots.
  if (deck === null || deck.length !== DECK_SIZE) {
    return { deck: DEMO_DECK, source: "demo", ownedPlayable };
  }
  return { deck, source: "owned", ownedPlayable };
}
