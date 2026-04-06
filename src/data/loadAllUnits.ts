import baseUnits from "./units.json";
import generatedNftCards from "./generatedNftCards.json";
import generatedPlayableTcgUnits from "./generatedPlayableTcgUnits.json";

export type UnitCard = {
  id: string;
  name: string;
  type: "unit";
  faction: string;
  rarity: string;
  cost: number;
  stats: {
    attack: number;
    health: number;
    speed: number;
    armor: number;
  };
  keywords: string[];
};

const allUnits: UnitCard[] = [
  ...(baseUnits as UnitCard[]),
  ...(generatedNftCards as UnitCard[]),
  ...(generatedPlayableTcgUnits as UnitCard[])
];

export function getLoadedUnitById(cardId: string): UnitCard {
  const card = allUnits.find((u) => u.id === cardId);

  if (!card) {
    throw new Error(`Unit card not found: ${cardId}`);
  }

  return card;
}

export function getAllLoadedUnits(): UnitCard[] {
  return allUnits;
}
