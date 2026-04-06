import { getAllLoadedUnits } from "../data/loadAllUnits";
import { getAllLoadedEquipment } from "../data/loadAllEquipment";
import { getAllLoadedArtifacts } from "../data/loadAllArtifacts";

type AnyCard = any;

export type DeckValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    total: number;
    units: number;
    equipment: number;
    artifacts: number;
    byCost: Record<string, number>;
    byRarity: Record<string, number>;
    byFaction: Record<string, number>;
  };
};

export function inferCommanderFaction(commanderId: string): string {
  const id = (commanderId || "").toLowerCase();

  if (id.includes("stone")) return "STONE";
  if (id.includes("iron")) return "IRON";
  if (id.includes("bronze")) return "BRONZE";
  if (id.includes("silver")) return "SILVER";
  if (id.includes("gold")) return "GOLD";
  if (id.includes("god")) return "GOD";

  return "UNKNOWN";
}

export function getAllLoadedCards(): AnyCard[] {
  return [
    ...getAllLoadedUnits(),
    ...getAllLoadedEquipment(),
    ...getAllLoadedArtifacts()
  ];
}

export function resolveCard(cardId: string): AnyCard | null {
  const all = getAllLoadedCards();
  return all.find((card) => card.id === cardId) || null;
}

export function getDeckStats(deckIds: string[]) {
  const stats = {
    total: deckIds.length,
    units: 0,
    equipment: 0,
    artifacts: 0,
    byCost: {} as Record<string, number>,
    byRarity: {} as Record<string, number>,
    byFaction: {} as Record<string, number>
  };

  for (const id of deckIds) {
    const card = resolveCard(id);
    if (!card) continue;

    if (card.type === "unit") stats.units += 1;
    if (card.type === "equipment") stats.equipment += 1;
    if (card.type === "artifact") stats.artifacts += 1;

    const costKey = String(card.cost ?? "unknown");
    const rarityKey = String(card.rarity ?? "unknown");
    const factionKey = String(card.faction ?? "unknown");

    stats.byCost[costKey] = (stats.byCost[costKey] || 0) + 1;
    stats.byRarity[rarityKey] = (stats.byRarity[rarityKey] || 0) + 1;
    stats.byFaction[factionKey] = (stats.byFaction[factionKey] || 0) + 1;
  }

  return stats;
}

function getCopyLimit(card: AnyCard): number {
  const rarity = String(card?.rarity || "").toLowerCase();

  if (rarity === "legendary") return 1;
  if (rarity === "one_of_one") return 1;
  if (rarity === "god") return 1;

  return 2;
}

export function validateDeck(deckIds: string[], commanderId: string): DeckValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const commanderFaction = inferCommanderFaction(commanderId);
  const copyMap: Record<string, number> = {};

  for (const cardId of deckIds) {
    copyMap[cardId] = (copyMap[cardId] || 0) + 1;
  }

  if (deckIds.length !== 30) {
    errors.push(`Deck must contain exactly 30 cards. Got ${deckIds.length}.`);
  }

  const resolvedCards: AnyCard[] = [];

  for (const cardId of deckIds) {
    const card = resolveCard(cardId);

    if (!card) {
      errors.push(`Card not found in loaders: ${cardId}`);
      continue;
    }

    resolvedCards.push(card);

    const allowedFaction =
      card.faction === commanderFaction ||
      card.faction === "GOD" ||
      commanderFaction === "UNKNOWN";

    if (!allowedFaction) {
      errors.push(
        `Faction mismatch: ${card.id} is ${card.faction}, commander faction is ${commanderFaction}.`
      );
    }
  }

  for (const [cardId, count] of Object.entries(copyMap)) {
    const card = resolveCard(cardId);

    if (!card) continue;

    const limit = getCopyLimit(card);

    if (count > limit) {
      errors.push(`Too many copies of ${cardId}. Limit ${limit}, got ${count}.`);
    }
  }

  const stats = getDeckStats(deckIds);

  if (stats.units < 14) {
    errors.push(`Deck must contain at least 14 units. Got ${stats.units}.`);
  }

  if (stats.equipment > 10) {
    errors.push(`Deck can contain at most 10 equipment cards. Got ${stats.equipment}.`);
  }

  if (stats.artifacts > 6) {
    errors.push(`Deck can contain at most 6 artifacts. Got ${stats.artifacts}.`);
  }

  if ((stats.byCost["2"] || 0) < 6) {
    warnings.push(`Low early curve: fewer than 6 cards costing 2.`);
  }

  if ((stats.byCost["5"] || 0) + (stats.byCost["6"] || 0) + (stats.byCost["8"] || 0) > 10) {
    warnings.push(`Top end looks heavy. High-cost cards may clog hands.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats
  };
}
