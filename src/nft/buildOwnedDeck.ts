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
import curatedCoreSetV2 from "../data/curatedCoreSetV2.json";

export const DECK_SIZE = 30;
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
const TARGET_ARTIFACTS = 2;

export type DeckSource = "owned" | "demo";

export type BuiltDeck = {
  deck: string[];
  source: DeckSource;
};

const CARD_BY_ID = new Map<string, any>(
  allPlayableCards.map((c: any) => [c.id, c]),
);

/** Stable cost-then-id ordering so a given wallet always yields the same deck. */
function byCurve(a: any, b: any): number {
  const ca = a?.cost ?? 0;
  const cb = b?.cost ?? 0;
  if (ca !== cb) return ca - cb;
  return String(a?.id).localeCompare(String(b?.id));
}

/**
 * Compose a 30-card deck from a pool of cards along the designed mana curve: UNITS
 * filling `UNIT_CURVE` (cheapest-id within each cost bucket), then a few EQUIPMENT +
 * ARTIFACTS (TARGET_* counts, hard-capped by MAX_*), then a cheapest-first backfill
 * for any slot the pool couldn't fill (units preferred for playability). Returns
 * null when the pool has no units (a body-less deck can't play). Deterministic and
 * shared by the owned and demo paths so they construct decks identically.
 */
function composeDeck(pool: any[]): string[] | null {
  const units = pool.filter((c) => c.type === "unit").sort(byCurve);
  if (units.length === 0) return null;
  const equipment = pool.filter((c) => c.type === "equipment").sort(byCurve);
  const artifacts = pool.filter((c) => c.type === "artifact").sort(byCurve);

  const deck: string[] = [];
  const used = new Set<string>();
  const add = (c: any): void => {
    if (used.has(c.id) || deck.length >= DECK_SIZE) return;
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
  //    the pool is exhausted.
  for (const c of [...units, ...equipment, ...artifacts]) {
    if (deck.length >= DECK_SIZE) break;
    add(c);
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
const CORE_POOL: any[] = (curatedCoreSetV2.primaryCardIds as string[])
  .map((id) => CARD_BY_ID.get(id))
  .filter((c): c is any => !!c);

const DEMO_DECK = composeDeck(CORE_POOL) ?? [];

export function buildPlayerDeck(ownedCardIds?: string[]): BuiltDeck {
  if (!ownedCardIds || ownedCardIds.length === 0) {
    return { deck: DEMO_DECK, source: "demo" };
  }

  const owned = [...new Set(ownedCardIds)]
    .map((id) => CARD_BY_ID.get(id))
    .filter((c): c is any => !!c);

  const deck = composeDeck(owned);
  if (deck === null) return { deck: DEMO_DECK, source: "demo" };
  return { deck, source: "owned" };
}
