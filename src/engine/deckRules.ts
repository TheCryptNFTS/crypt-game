import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { getPlayableCardById } from "./cards";
import { Faction, normalizeFaction } from "../types/faction";

export type DeckCardLike =
  | string
  | {
      id?: string;
      faction?: string;
    };

export type DeckValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    deckSize: number;
    commanderFaction: Faction;
    byFaction: Record<string, number>;
    copyCounts: Record<string, number>;
    maxCopiesExceeded: string[];
  };
};

export function inferCommanderFaction(commanderId: string): Faction {
  const spec = COMMANDER_SPECS[commanderId];
  if (!spec) {
    throw new Error(`Unknown commander: ${commanderId}`);
  }

  return normalizeFaction(String(spec.faction));
}

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
  commanderId: string,
  opts?: {
    deckSize?: number;
    maxCopies?: number;
    allowGodCards?: boolean;
  }
): DeckValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const expectedDeckSize = opts?.deckSize ?? 30;
  const maxCopies = opts?.maxCopies ?? 2;
  const allowGodCards = opts?.allowGodCards ?? true;

  if (!Array.isArray(deck)) {
    return {
      valid: false,
      errors: ["Deck must be an array"],
      warnings: [],
      stats: {
        deckSize: 0,
        commanderFaction: inferCommanderFaction(commanderId),
        byFaction: {},
        copyCounts: {},
        maxCopiesExceeded: [],
      },
    };
  }

  const commanderFaction = inferCommanderFaction(commanderId);
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

    if (faction !== commanderFaction) {
      if (!(allowGodCards && faction === "GOD")) {
        errors.push(
          `Card ${id} has faction ${faction} but commander faction is ${commanderFaction}`
        );
      }
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

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      deckSize: deck.length,
      commanderFaction,
      byFaction: Object.fromEntries(byFaction),
      copyCounts: Object.fromEntries(copyCounts),
      maxCopiesExceeded,
    },
  };
}

function inferFactionFromIdFallback(id: string): Faction {
  const lower = id.toLowerCase();

  if (lower.includes("stone")) return "STONE";
  if (lower.includes("iron")) return "IRON";
  if (lower.includes("bronze")) return "BRONZE";
  if (lower.includes("silver")) return "SILVER";
  if (lower.includes("gold")) return "GOLD";
  if (lower.includes("god")) return "GOD";

  throw new Error(`Could not infer faction from id: ${id}`);
}
