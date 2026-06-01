/**
 * FORMATS (PART 2) — curated, rotating deckbuilding legality.
 *
 * Two formats today:
 *   - "Open"  — the FULL pool of 4129 playable cards is legal. This is the historical
 *               behavior and the DEFAULT: `validateDeck(deck, commanderId, opts)` with no
 *               format (or format === "Open") is byte-identical to before, so every existing
 *               caller and the committed fixtures are unmoved.
 *   - "Core"  — a designed ~200-card curated subset. A deck is Core-legal only if EVERY card
 *               is in the Core set (on top of the normal size / copy / faction rules). This is
 *               the lever for a smaller, more legible, rotatable constructed environment.
 *
 * The Core set is DERIVED BY RULE (not a hand-maintained id list) from `allPlayableCards`, so
 * it stays correct as the catalog evolves and is fully deterministic (pure function of the
 * catalog + a fixed, sorted-by-id selection). See `CORE_SELECTION` below for the exact rule.
 */

import { allPlayableCards, PlayableCard, getPlayableCardById } from "./cards";

export type Format = "Open" | "Core";

/** The default format — Open keeps today's behavior exactly. */
export const DEFAULT_FORMAT: Format = "Open";

const FACTIONS = [
  "STONE_KEEPERS",
  "IRON_DEFENDERS",
  "BRONZE_GUARDIANS",
  "SILVER_SENTINELS",
  "GOLDEN_SOVEREIGNS",
  "GODS",
] as const;

const RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"] as const;

/**
 * CORE SELECTION RULE (the IP is the rule, not a frozen list):
 *
 *   For each (faction × rarity) bucket, sorted by card id for determinism, take up to:
 *     - INTERESTING_QUOTA[rarity] cards that carry at least one KEYWORD ("non-vanilla" —
 *       these are the mechanically interesting bodies: Taunt/Deathrattle/Lifesteal/etc.),
 *       FIRST, because Core should favor decisions over french-vanilla stat sticks; then
 *     - VANILLA_QUOTA[rarity] keyword-less stat cards, a deliberate SMALL sampling so the
 *       curve still has clean, beginner-legible bodies at each faction/rarity.
 *
 *   Soft-banned (`disabled`) cards and non-deck card types (spells) are never eligible. The
 *   per-bucket caps keep the set balanced across faction and rarity rather than dominated by
 *   the huge STONE/IRON pools, and land the total comfortably inside the 150–300 design band.
 *
 * Because the rule is a pure, sorted, capped scan of the catalog, the resulting Core set is
 * identical on every run (server and client agree) and shifts only when the catalog itself
 * changes — exactly the "rotating legality" knob a curated format wants.
 */
const INTERESTING_QUOTA: Record<string, number> = {
  COMMON: 10,
  RARE: 10,
  EPIC: 8,
  LEGENDARY: 6,
  MYTHIC: 4,
};
const VANILLA_QUOTA: Record<string, number> = {
  COMMON: 3,
  RARE: 2,
  EPIC: 1,
  LEGENDARY: 1,
  MYTHIC: 0,
};

/** A card is "vanilla" iff it carries NO keyword (its ability, if any, is just a stat line). */
function isVanilla(card: PlayableCard): boolean {
  return !Array.isArray(card.keywords) || card.keywords.length === 0;
}

/** Deck-eligible base types only (spells are intentionally outside constructed deck legality
 *  here, matching the unit/equipment/artifact deck builders), and never a soft-banned card. */
function coreEligible(card: PlayableCard): boolean {
  if (card.disabled === true) return false;
  return card.type === "unit" || card.type === "equipment" || card.type === "artifact";
}

/** Build the Core id set once, deterministically, from the live catalog. */
function buildCoreSet(): Set<string> {
  const pool = allPlayableCards.filter(coreEligible);
  const ids = new Set<string>();
  for (const faction of FACTIONS) {
    for (const rarity of RARITIES) {
      // Sort by id so the scan — and therefore the chosen subset — is fully deterministic.
      const bucket = pool
        .filter((c) => c.faction === faction && c.rarity === rarity)
        .sort((a, b) => a.id.localeCompare(b.id));
      const interesting = bucket.filter((c) => !isVanilla(c)).slice(0, INTERESTING_QUOTA[rarity] ?? 0);
      const vanilla = bucket.filter(isVanilla).slice(0, VANILLA_QUOTA[rarity] ?? 0);
      for (const c of interesting) ids.add(c.id);
      for (const c of vanilla) ids.add(c.id);
    }
  }
  return ids;
}

/** The curated Core legality set (card ids). Frozen at module load (pure over the catalog). */
export const CORE_SET: ReadonlySet<string> = buildCoreSet();

/** All Core-legal card ids, sorted — handy for proofs, deck builders, and reporting. */
export const CORE_CARD_IDS: readonly string[] = [...CORE_SET].sort();

/** True if a card id is legal in the given format. Open = everything (DEFAULT); Core = only
 *  cards in CORE_SET. An unknown id is illegal in Core (it isn't in the curated set) and, in
 *  Open, defers to whatever the caller's deck validation already does about unknown ids. */
export function isCardLegalInFormat(cardId: string, format: Format = DEFAULT_FORMAT): boolean {
  if (format === "Open") return true;
  return CORE_SET.has(cardId);
}

/** Count of Core cards broken down by faction (for reporting / proofs). */
export function coreCountsByFaction(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of CORE_SET) {
    const f = getPlayableCardById(id)?.faction ?? "UNKNOWN";
    out[f] = (out[f] ?? 0) + 1;
  }
  return out;
}

/** Count of Core cards broken down by rarity (for reporting / proofs). */
export function coreCountsByRarity(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of CORE_SET) {
    const r = getPlayableCardById(id)?.rarity ?? "UNKNOWN";
    out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}
