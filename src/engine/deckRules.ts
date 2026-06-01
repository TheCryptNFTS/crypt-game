import { getPlayableCardById } from "./cards";
import { Faction, normalizeFaction } from "../types/faction";
import { Format, DEFAULT_FORMAT, isCardLegalInFormat } from "./formats";
const FACTION_CODE_TO_CANON_NAME: Record<string, string> = {
  STONE_KEEPERS: "Stone Keepers",
  IRON_DEFENDERS: "Iron Defenders",
  BRONZE_GUARDIANS: "Bronze Guardians",
  SILVER_SENTINELS: "Silver Sentinels",
  GOLDEN_SOVEREIGNS: "Golden Sovereigns",
  GODS: "Gods",
};

export type DeckCardLike =
  | string
  | {
      id?: string;
      faction?: string;
    };

export const FACTION_DISPLAY_NAMES = FACTION_CODE_TO_CANON_NAME;


export type DeckValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    deckSize: number;
    byFaction: Record<string, number>;
    copyCounts: Record<string, number>;
    maxCopiesExceeded: string[];
    godCount: number;
  };
};

export function getCardFaction(cardOrId: DeckCardLike): Faction {
  if (typeof cardOrId !== "string") {
    if (cardOrId.faction) {
      return normalizeFaction(cardOrId.faction);
    }

    if (cardOrId.id) {
      const fromRegistry = getPlayableCardById(cardOrId.id);
      if (fromRegistry) return fromRegistry.faction;

      return inferFactionFromIdFallback(cardOrId.id);
    }

    throw new Error("Cannot resolve faction from card object");
  }

  const fromRegistry = getPlayableCardById(cardOrId);
  if (fromRegistry) return fromRegistry.faction;

  return inferFactionFromIdFallback(cardOrId);
}

export function validateDeck(
  deck: DeckCardLike[],
  _commanderId: string,
  opts?: {
    deckSize?: number;
    maxCopies?: number;
    allowGodCards?: boolean;
    /**
     * FORMAT (PART 2) — curated legality filter. DEFAULTS to "Open", which is the historical
     * behavior (the full 4129-card pool is legal), so EVERY existing caller — none of which
     * pass `format` — validates exactly as before and the committed fixtures stay unmoved.
     * When "Core", any card NOT in the curated Core set is rejected (in addition to the
     * normal size / copy / faction rules). Open is the default precisely so Core is purely
     * additive and opt-in.
     */
    format?: Format;
  }
): DeckValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const expectedDeckSize = opts?.deckSize ?? 30;
  const maxCopies = opts?.maxCopies ?? 2;
  const allowGodCards = opts?.allowGodCards ?? true;
  const format: Format = opts?.format ?? DEFAULT_FORMAT;

  if (!Array.isArray(deck)) {
    return {
      valid: false,
      errors: ["Deck must be an array"],
      warnings: [],
      stats: {
        deckSize: 0,
        byFaction: {},
        copyCounts: {},
        maxCopiesExceeded: [],
        godCount: 0,
      },
    };
  }

  const copyCounts = new Map<string, number>();
  const byFaction = new Map<string, number>();

  if (deck.length !== expectedDeckSize) {
    errors.push(`Deck must contain exactly ${expectedDeckSize} cards, got ${deck.length}`);
  }

  for (const entry of deck) {
    const id = typeof entry === "string" ? entry : entry.id;

    if (!id) {
      errors.push("Deck contains a card without an id");
      continue;
    }

    copyCounts.set(id, (copyCounts.get(id) || 0) + 1);

    let faction: Faction;
    try {
      faction = getCardFaction(entry);
    } catch {
      errors.push(`Could not determine faction for card: ${id}`);
      continue;
    }

    byFaction.set(faction, (byFaction.get(faction) || 0) + 1);

    if (!allowGodCards && faction === "GODS") {
      errors.push(`Card ${id} is a GOD card but GOD cards are not allowed in this deck.`);
    }

    // FORMAT legality (PART 2). In "Open" this is always true (no-op); in "Core" a card
    // outside the curated Core set is rejected. Kept additive so the Open path is untouched.
    if (!isCardLegalInFormat(id, format)) {
      errors.push(`Card ${id} is not legal in the ${format} format.`);
    }
  }

  const maxCopiesExceeded: string[] = [];

  for (const [id, count] of copyCounts.entries()) {
    if (count > maxCopies) {
      const msg = `Card ${id} appears ${count} times (max ${maxCopies})`;
      errors.push(msg);
      maxCopiesExceeded.push(id);
    } else if (count === maxCopies) {
      warnings.push(`Card ${id} is at the copy cap (${maxCopies})`);
    }
  }

  const godCount = byFaction.get("GODS") || 0;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      deckSize: deck.length,
      byFaction: Object.fromEntries(byFaction),
      copyCounts: Object.fromEntries(copyCounts),
      maxCopiesExceeded,
      godCount,
    },
  };
}

function inferFactionFromIdFallback(id: string): Faction {
  const lower = id.toLowerCase();

  if (lower.includes("stone")) return "STONE_KEEPERS";
  if (lower.includes("iron")) return "IRON_DEFENDERS";
  if (lower.includes("bronze")) return "BRONZE_GUARDIANS";
  if (lower.includes("silver")) return "SILVER_SENTINELS";
  if (lower.includes("gold")) return "GOLDEN_SOVEREIGNS";
  if (lower.includes("god")) return "GODS";

  throw new Error(`Could not infer faction from id: ${id}`);
}

export function inferCommanderFaction(_commanderId: string): null {
  return null;
}
