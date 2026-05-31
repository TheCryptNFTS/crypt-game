/**
 * Single source of truth for turning a wallet's owned Combat Archives card ids
 * into a playable deck — shared by the live match (`useLocalCryptMatch`) and
 * the pre-match "Your Deck" preview so the two can never disagree about what
 * you'll actually play.
 *
 * "You play what you own" — but a raw first-30 slice produces un-fun decks
 * (e.g. all equipment and no units to equip). So we construct a sane deck:
 *   1. UNITS FIRST, ordered by cost so there's a curve, up to 30.
 *   2. Backfill remaining slots with EQUIPMENT (cap 8) then ARTIFACTS (cap 3),
 *      also cheapest-first.
 * Deterministic and only ever contains cards the wallet owns.
 *
 * Falls back to the shared demo deck (source: "demo") when not connected, the
 * wallet owns no playable cards, or owns NO playable UNITS (a body-less deck
 * can't play). We never BLOCK play — it's a game we want people to try, and
 * client-side ownership is connection, not authentication, so a hard gate
 * would give false security anyway. Instead the source is surfaced honestly.
 */
import { allPlayableCards } from "../engine/cards";

export const DECK_SIZE = 30;
/** Equipment with no unit to equip is a dead hand; artifacts are powerful but
 *  situational — so non-units are capped to keep the deck playable. */
export const MAX_EQUIPMENT = 8;
export const MAX_ARTIFACTS = 3;

export type DeckSource = "owned" | "demo";

export type BuiltDeck = {
  deck: string[];
  source: DeckSource;
};

const CARD_BY_ID = new Map<string, any>(
  allPlayableCards.map((c: any) => [c.id, c]),
);

const DEMO_DECK = [...new Set(allPlayableCards.map((c: any) => c.id))].slice(
  0,
  DECK_SIZE,
);

/** Stable cost-then-id ordering so a given wallet always yields the same deck. */
function byCurve(a: any, b: any): number {
  const ca = a?.cost ?? 0;
  const cb = b?.cost ?? 0;
  if (ca !== cb) return ca - cb;
  return String(a?.id).localeCompare(String(b?.id));
}

export function buildPlayerDeck(ownedCardIds?: string[]): BuiltDeck {
  if (!ownedCardIds || ownedCardIds.length === 0) {
    return { deck: DEMO_DECK, source: "demo" };
  }

  const owned = [...new Set(ownedCardIds)]
    .map((id) => CARD_BY_ID.get(id))
    .filter((c): c is any => !!c);

  const units = owned.filter((c) => c.type === "unit").sort(byCurve);
  if (units.length === 0) return { deck: DEMO_DECK, source: "demo" };

  const equipment = owned.filter((c) => c.type === "equipment").sort(byCurve);
  const artifacts = owned.filter((c) => c.type === "artifact").sort(byCurve);

  const deck: string[] = units.slice(0, DECK_SIZE).map((c) => c.id);
  for (const c of equipment.slice(0, MAX_EQUIPMENT)) {
    if (deck.length >= DECK_SIZE) break;
    deck.push(c.id);
  }
  for (const c of artifacts.slice(0, MAX_ARTIFACTS)) {
    if (deck.length >= DECK_SIZE) break;
    deck.push(c.id);
  }
  return { deck, source: "owned" };
}
