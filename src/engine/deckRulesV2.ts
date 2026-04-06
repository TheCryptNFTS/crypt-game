import curatedCoreSet from "../data/curatedCoreSetV2.json";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { CORE_SET_TARGETS } from "../design/coreSetTargets";

type Card = {
  id: string;
  type: "unit" | "equipment" | "artifact";
  faction: string;
  rarity: string;
  cost: number;
};

const allCards = (curatedCoreSet as { all: Card[] }).all;
const byId = new Map(allCards.map((c) => [c.id, c]));

export function validateDeckV2(deck: string[], commanderId: string) {
  const spec = COMMANDER_SPECS[commanderId];
  if (!spec) throw new Error(`Unknown commander: ${commanderId}`);

  const errors: string[] = [];
  const warnings: string[] = [];

  if (deck.length !== spec.deckRules.deckSize) {
    errors.push(`Deck must contain exactly ${spec.deckRules.deckSize} cards`);
  }

  const cards = deck.map((id) => byId.get(id)).filter(Boolean) as Card[];

  if (cards.length !== deck.length) {
    errors.push("Deck contains unknown card ids");
  }

  const copyMap: Record<string, number> = {};
  const byType = { unit: 0, equipment: 0, artifact: 0 };
  const byFaction: Record<string, number> = {};
  const byCost: Record<string, number> = {};
  let godCount = 0;

  for (const id of deck) {
    copyMap[id] = (copyMap[id] || 0) + 1;
  }

  for (const [id, count] of Object.entries(copyMap)) {
    const card = byId.get(id);
    if (!card) continue;

    if (card.faction === "GOD") {
      if (count > 1) errors.push(`God card ${id} exceeds copy cap`);
      godCount += count;
      continue;
    }

    if (count > CORE_SET_TARGETS.maxCopiesPerCard) {
      errors.push(`Card ${id} exceeds max copies of ${CORE_SET_TARGETS.maxCopiesPerCard}`);
    }
  }

  if (godCount > spec.deckRules.maxGodCards) {
    errors.push(`Deck exceeds max GOD cards (${spec.deckRules.maxGodCards})`);
  }

  for (const card of cards) {
    byType[card.type] += 1;
    byFaction[card.faction] = (byFaction[card.faction] || 0) + 1;
    byCost[String(card.cost)] = (byCost[String(card.cost)] || 0) + 1;

    if (spec.deckRules.exactFaction && card.faction !== spec.faction && card.faction !== "GOD") {
      errors.push(`Off-faction card found: ${card.id} (${card.faction})`);
    }
  }

  if (byType.unit < spec.deckRules.minUnits) errors.push(`Deck needs at least ${spec.deckRules.minUnits} units`);
  if (byType.equipment < spec.deckRules.minEquipment) errors.push(`Deck needs at least ${spec.deckRules.minEquipment} equipment`);
  if (byType.artifact < spec.deckRules.minArtifacts) errors.push(`Deck needs at least ${spec.deckRules.minArtifacts} artifacts`);

  if ((byCost["2"] || 0) < 6) warnings.push("Curve too slow at cost 2");
  if ((byCost["5"] || 0) > 6) warnings.push("Too many expensive cards at cost 5+");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      total: deck.length,
      byType,
      byFaction,
      byCost
    }
  };
}
