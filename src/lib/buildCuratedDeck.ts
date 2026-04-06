import curatedCoreSet from "../data/curatedCoreSetV2.json";
import { COMMANDER_SPECS } from "../design/commanderSpecs";

type Card = {
  id: string;
  type: "unit" | "equipment" | "artifact";
  faction: string;
  rarity: string;
  cost: number;
  keywords?: string[];
};

type CuratedSet = {
  units: Card[];
  equipment: Card[];
  artifacts: Card[];
  all: Card[];
};

const data = curatedCoreSet as CuratedSet;
const MAX_COPIES = 2;

function rarityScore(rarity: string): number {
  switch (rarity) {
    case "god": return 8;
    case "one_of_one": return 7;
    case "legendary": return 6;
    case "epic": return 5;
    case "rare": return 4;
    case "uncommon": return 3;
    default: return 2;
  }
}

function keywordScore(card: Card): number {
  const keywords = card.keywords || [];
  let score = 0;

  for (const kw of keywords) {
    if (kw === "GUARD") score += 2;
    else if (kw === "ARCANE") score += 2;
    else if (kw === "CRUSH") score += 1.5;
    else if (kw === "RUSH") score += 1;
    else score += 1;
  }

  return score;
}

function cheapUnitPenalty(card: Card): number {
  if (card.type !== "unit") return 0;
  if (card.cost !== 2) return 0;

  const kw = (card.keywords || []).length;

  // cheap units were dominating selection, especially keyword-heavy ones
  return 6 + kw * 2;
}

function curveScore(card: Card): number {
  if (card.type !== "unit") return 0;

  // stop blindly preferring 2-drops
  switch (card.cost) {
    case 2: return 0;
    case 3: return 3;
    case 4: return 4;
    case 5: return 3;
    default: return 0;
  }
}

function factionBonus(card: Card, faction: string): number {
  const keywords = card.keywords || [];
  let score = 0;

  if (faction === "STONE") {
    if (keywords.includes("GUARD")) score += 3;
    if (card.type === "artifact") score += 1;
  }

  if (faction === "IRON") {
    if (card.type === "equipment") score += 3;
    if (keywords.includes("RUSH")) score += 1;
  }

  if (faction === "BRONZE") {
    if (keywords.includes("RUSH")) score += 2;
  }

  if (faction === "SILVER") {
    if (card.type === "artifact") score += 4;
    if (keywords.includes("ARCANE")) score += 3;
  }

  if (faction === "GOLD") {
    if (card.cost >= 4) score += 3;
    if (keywords.includes("CRUSH")) score += 2;
    if (keywords.includes("GUARD")) score += 1;
  }

  return score;
}

function scoreCard(card: Card, faction: string): number {
  return (
    rarityScore(card.rarity) * 8 +
    keywordScore(card) +
    curveScore(card) +
    factionBonus(card, faction) -
    cheapUnitPenalty(card)
  );
}

function sortedPool(cards: Card[], faction: string): Card[] {
  return [...cards].sort((a, b) => {
    const byScore = scoreCard(b, faction) - scoreCard(a, faction);
    if (byScore !== 0) return byScore;
    if (a.cost !== b.cost) return a.cost - b.cost;
    return a.id.localeCompare(b.id);
  });
}

function addCopiesFromPool(
  deck: string[],
  pool: Card[],
  target: number,
  counts: Map<string, number>,
  faction: string
) {
  const ordered = sortedPool(pool, faction);

  while (deck.length < target) {
    let added = false;

    for (const card of ordered) {
      const current = counts.get(card.id) || 0;
      if (current >= MAX_COPIES) continue;

      deck.push(card.id);
      counts.set(card.id, current + 1);
      added = true;

      if (deck.length >= target) break;
    }

    if (!added) break;
  }
}

function addUnitsByCurve(
  deck: string[],
  units: Card[],
  targetUnits: number,
  counts: Map<string, number>,
  faction: string
) {
  const curveTargets: Record<number, number> = {
    2: 4,
    3: 6,
    4: 6,
    5: 4
  };

  for (const cost of [2, 3, 4, 5]) {
    const pool = units.filter((c) => c.cost === cost);
    const currentUnits = deck.length;
    const desired = Math.min(targetUnits, currentUnits + (curveTargets[cost] || 0));
    addCopiesFromPool(deck, pool, desired, counts, faction);
  }

  if (deck.length < targetUnits) {
    const leftovers = units.filter((c) => ![2, 3, 4, 5].includes(c.cost));
    addCopiesFromPool(deck, leftovers, targetUnits, counts, faction);
  }

  if (deck.length < targetUnits) {
    addCopiesFromPool(deck, units, targetUnits, counts, faction);
  }
}

export function buildCuratedDeck(commanderId: string): string[] {
  const spec = COMMANDER_SPECS[commanderId];
  if (!spec) throw new Error(`Unknown commander: ${commanderId}`);

  const faction = spec.faction;

  const units = data.units.filter((c) => c.faction === faction);
  const equipment = data.equipment.filter((c) => c.faction === faction);
  const artifacts = data.artifacts.filter((c) => c.faction === faction);
  const gods = data.all.filter((c) => c.faction === "GOD");

  const counts = new Map<string, number>();
  const deck: string[] = [];

  const targetUnits = Math.max(20, spec.deckRules.minUnits);
  const targetEquipment = Math.max(6, spec.deckRules.minEquipment);
  const targetArtifacts = Math.max(4, spec.deckRules.minArtifacts);

  addUnitsByCurve(deck, units, targetUnits, counts, faction);
  addCopiesFromPool(deck, equipment, targetUnits + targetEquipment, counts, faction);
  addCopiesFromPool(deck, artifacts, targetUnits + targetEquipment + targetArtifacts, counts, faction);

  const allFactionCards = sortedPool(
    [...units, ...equipment, ...artifacts],
    faction
  );

  while (deck.length < spec.deckRules.deckSize) {
    let added = false;

    for (const card of allFactionCards) {
      const current = counts.get(card.id) || 0;
      if (current >= MAX_COPIES) continue;

      deck.push(card.id);
      counts.set(card.id, current + 1);
      added = true;

      if (deck.length >= spec.deckRules.deckSize) break;
    }

    if (!added) break;
  }

  if (
    deck.length < spec.deckRules.deckSize &&
    spec.deckRules.maxGodCards > 0 &&
    gods.length > 0
  ) {
    const god = sortedPool(gods, faction)[0];
    const current = counts.get(god.id) || 0;

    if (current < 1) {
      deck.push(god.id);
      counts.set(god.id, 1);
    }
  }

  while (deck.length < spec.deckRules.deckSize) {
    const filler = allFactionCards.find((card) => (counts.get(card.id) || 0) < MAX_COPIES);
    if (!filler) break;

    deck.push(filler.id);
    counts.set(filler.id, (counts.get(filler.id) || 0) + 1);
  }

  return deck.slice(0, spec.deckRules.deckSize);
}
