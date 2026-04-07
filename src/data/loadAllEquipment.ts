import generatedTcgCards from "./generatedTcgCards.json";
import { normalizeFaction, Faction } from "../types/faction";

export type EquipmentCard = {
  id: string;
  name: string;
  type: "equipment";
  faction: Faction;
  rarity: string;
  cost: number;
  effect: {
    attack: number;
    health: number;
    speed: number;
    armor: number;
  };
  keywords: string[];
  rawTraits: Record<string, string>;
  subtype: string | null;
};

type GeneratedTcgCard = {
  id: string;
  name?: string;
  faction?: string;
  rarity?: string;
  cardClass?: string | null;
  subtype?: string | null;
  cost?: number;
  stats?: {
    attack?: number;
    health?: number;
    speed?: number;
    armor?: number;
  };
  keywords?: string[];
  rawTraits?: Record<string, string> | null;
};

const allEquipment: EquipmentCard[] = ((generatedTcgCards as GeneratedTcgCard[]) ?? [])
  .filter((card) => String(card.cardClass ?? "").trim().toLowerCase() === "equipment")
  .map((card) => ({
    id: card.id,
    name: card.name ?? card.id,
    type: "equipment" as const,
    faction: normalizeFaction(card.faction ?? "STONE_KEEPERS"),
    rarity: card.rarity ?? "COMMON",
    cost: card.cost ?? 0,
    effect: {
      attack: card.stats?.attack ?? 0,
      health: card.stats?.health ?? 0,
      speed: card.stats?.speed ?? 0,
      armor: card.stats?.armor ?? 0,
    },
    keywords: Array.isArray(card.keywords) ? card.keywords : [],
    rawTraits: (card.rawTraits as Record<string, string> | undefined) ?? {},
    subtype: card.subtype ?? null,
  }));

const byId = new Map<string, EquipmentCard>(allEquipment.map((card) => [card.id, card]));

export function getLoadedEquipmentById(cardId: string): EquipmentCard {
  const card = byId.get(cardId);
  if (!card) {
    throw new Error(`Equipment card not found: ${cardId}`);
  }
  return card;
}

export function getAllLoadedEquipment(): EquipmentCard[] {
  return allEquipment;
}
