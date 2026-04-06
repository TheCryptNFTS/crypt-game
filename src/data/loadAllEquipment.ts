import equipmentCards from "./equipment.json";
import generatedPlayableTcgEquipment from "./generatedPlayableTcgEquipment.json";

export type EquipmentCard = {
  id: string;
  name: string;
  type: "equipment";
  faction: string;
  rarity: string;
  cost: number;
  bonuses: {
    attack: number;
    health: number;
    armor: number;
    speed: number;
  };
  keywords: string[];
};

type LegacyEquipmentCard = {
  id: string;
  name: string;
  type: string;
  faction: string;
  rarity: string;
  cost: number;
  effect: {
    attack: number;
    health: number;
    armor: number;
    speed: number;
  };
};

function normalizeLegacyEquipment(card: LegacyEquipmentCard): EquipmentCard {
  return {
    id: card.id,
    name: card.name,
    type: "equipment",
    faction: card.faction,
    rarity: card.rarity,
    cost: card.cost,
    bonuses: {
      attack: card.effect?.attack ?? 0,
      health: card.effect?.health ?? 0,
      armor: card.effect?.armor ?? 0,
      speed: card.effect?.speed ?? 0
    },
    keywords: []
  };
}

const normalizedBaseEquipment: EquipmentCard[] = (equipmentCards as LegacyEquipmentCard[]).map(
  normalizeLegacyEquipment
);

const normalizedTcgEquipment: EquipmentCard[] =
  generatedPlayableTcgEquipment as EquipmentCard[];

const allEquipment: EquipmentCard[] = [
  ...normalizedBaseEquipment,
  ...normalizedTcgEquipment
];

export function getLoadedEquipmentById(cardId: string): EquipmentCard {
  const card = allEquipment.find((u) => u.id === cardId);

  if (!card) {
    throw new Error(`Equipment card not found: ${cardId}`);
  }

  return card;
}

export function getAllLoadedEquipment(): EquipmentCard[] {
  return allEquipment;
}
