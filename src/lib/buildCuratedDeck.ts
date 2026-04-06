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

function scoreCard(card: Card): number {
  const kw = (card.keywords || []).length;
  const curveBias =
    card.cost === 2 ? 4 :
    card.cost === 3 ? 3 :
    card.cost === 4 ? 2 :
    card.cost === 5 ? 1 :
    0;

  return rarityScore(card.rarity) * 10 + kw * 3 + curveBias;
}

function sortedPool(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const byScore = scoreCard(b) - scoreCard(a);
    if (byScore !== 0) return byScore;
    return a.id.localeCompare(b.id);
  });
}

function addCopies(
  deck: string[],
  pool: Card[],
  target: number,
  counts: Map<string, number>
) {
  const ordered = sortedPool(pool);

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

  // practical legal targets
  const targetUnits = Math.max(20, spec.deckRules.minUnits);
  const targetEquipment = Math.max(6, spec.deckRules.minEquipment);
  const targetArtifacts = Math.max(4, spec.deckRules.minArtifacts);

  addCopies(deck, units, targetUnits, counts);
  addCopies(deck, equipment, targetUnits + targetEquipment, counts);
  addCopies(deck, artifacts, targetUnits + targetEquipment + targetArtifacts, counts);

  // if still short, fill from best faction cards first, then optional one GOD
  const allFactionCards = sortedPool([
    ...units,
    ...equipment,
    ...artifacts
  ]);

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
    const god = sortedPool(gods)[0];
    const current = counts.get(god.id) || 0;

    if (current < 1) {
      deck.push(god.id);
      counts.set(god.id, 1);
    }
  }

  // final emergency fill
  while (deck.length < spec.deckRules.deckSize) {
    const filler = allFactionCards.find((card) => (counts.get(card.id) || 0) < MAX_COPIES);
    if (!filler) break;

    deck.push(filler.id);
    counts.set(filler.id, (counts.get(filler.id) || 0) + 1);
  }

  return deck.slice(0, spec.deckRules.deckSize);
}
