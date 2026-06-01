/**
 * The one auto-equipped STARTER deck a brand-new pilot plays with — zero
 * deckbuilding required. We pick a single solid, easy-to-read identity
 * (STONE_KEEPERS "Endurance Wall": GUARD walls + a clean curve) and reuse the
 * existing curated deck builder so this is real, balanced card content, not new
 * cards. Seeding writes the curated deck into the SAME deck-builder storage the
 * Play hub / live match read from, so "Play" just works on first run.
 */
import { buildCuratedDeck } from "./buildCuratedDeck";
import {
  LS_DECK_BUILDER_COMMANDER,
  LS_DECK_BUILDER_MAIN_DECK,
  loadStoredMainDeckCardIds,
} from "./deckBuilderStorage";

/** STONE_KEEPERS warden — GUARD walls, forgiving curve: the newcomer identity. */
export const STARTER_COMMANDER_ID = "cmd_stone_warden";
export const STARTER_DECK_NAME = "Endurance Wall";

/** The fixed 30-card starter list, derived once from the curated builder. */
export function buildStarterDeck(): string[] {
  return buildCuratedDeck(STARTER_COMMANDER_ID);
}

/**
 * Ensure the newcomer has a playable deck equipped. Only writes when the deck-
 * builder storage is empty, so it NEVER stomps a returning player's saved deck.
 * Idempotent and safe to call on every entry.
 */
export function ensureStarterDeckEquipped(): void {
  const existing = loadStoredMainDeckCardIds();
  if (existing.length > 0) return;
  try {
    localStorage.setItem(LS_DECK_BUILDER_COMMANDER, STARTER_COMMANDER_ID);
    localStorage.setItem(
      LS_DECK_BUILDER_MAIN_DECK,
      JSON.stringify(buildStarterDeck()),
    );
  } catch {
    /* private mode — the live match still falls back to the demo deck */
  }
}
