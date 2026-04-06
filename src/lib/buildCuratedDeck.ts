import curatedCoreSet from "../data/curatedCoreSetV2.json";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { CORE_SET_TARGETS } from "../design/coreSetTargets";

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

function scoreCard(card: Card): number {
  const rarityScore =
    card.rarity === "god" ? 8 :
    card.rarity === "one_of_one" ? 7 :
    card.rarity === "legendary" ? 6 :
    card.rarity === "epic" ? 5 :
    card.rarity === "rare" ? 4 :
    card.rarity === "uncommon" ? 3 :
    2;

  const keywordScore = (card.keywords || []).length;
  return rarityScore + keywordScore;
}

function chooseWithCurve(cards: Card[], desiredCosts: number[], limit: number): Card[] {
  const taken: Card[] = [];
  const used = new Set<string>();

  for (const cost of desiredCosts) {
    const candidate = cards
      .filter((c) => !used.has(c.id) && c.cost === cost)
      .sort((a, b) => scoreCard(b) - scoreCard(a))[0];

    if (candidate) {
      taken.push(candidate);
      used.add(candidate.id);
      if (taken.length >= limit) return taken;
    }
  }

  for (const candidate of cards.sort((a, b) => scoreCard(b) - scoreCard(a))) {
    if (used.has(candidate.id)) continue;
    taken.push(candidate);
    used.add(candidate.id);
    if (taken.length >= limit) break;
  }

  return taken;
}

export function buildCuratedDeck(commanderId: string): string[] {
  const spec = COMMANDER_SPECS[commanderId];
  if (!spec) throw new Error(`Unknown commander: ${commanderId}`);

  const faction = spec.faction;

  const units = data.units.filter((c) => c.faction === faction);
  const equipment = data.equipment.filter((c) => c.faction === faction);
  const artifacts = data.artifacts.filter((c) => c.faction === faction);
  const godCards = data.all.filter((c) => c.faction === "GOD");

  const desiredCurve = [
    2,2,2,2,2,2,2,2,
    3,3,3,3,3,3,3,3,
    4,4,4,4,4,4,4,
    5,5,5,5,5,
    6,6
  ];

  const chosenUnits = chooseWithCurve(units, desiredCurve, CORE_SET_TARGETS.idealDeckMix.units);
  const chosenEquipment = chooseWithCurve(equipment, [2,2,3,3,4,4], CORE_SET_TARGETS.idealDeckMix.equipment);
  const chosenArtifacts = chooseWithCurve(artifacts, [3,4,4,5], CORE_SET_TARGETS.idealDeckMix.artifacts);

  const deck = [
    ...chosenUnits.map((c) => c.id),
    ...chosenEquipment.map((c) => c.id),
    ...chosenArtifacts.map((c) => c.id)
  ];

  if (deck.length < spec.deckRules.deckSize && godCards.length > 0 && spec.deckRules.maxGodCards > 0) {
    deck.push(godCards[0].id);
  }

  return deck.slice(0, spec.deckRules.deckSize);
}
