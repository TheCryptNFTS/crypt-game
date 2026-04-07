import generatedTcgCards from "./generatedTcgCards.json";
import { normalizeFaction, Faction } from "../types/faction";

export type ArtifactCard = {
  id: string;
  name: string;
  type: "artifact";
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
  effectTags: string[];
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
  effectTags?: string[] | null;
};

const allArtifacts: ArtifactCard[] = ((generatedTcgCards as GeneratedTcgCard[]) ?? [])
  .filter((card) => String(card.cardClass ?? "").trim().toLowerCase() === "artifact")
  .map((card) => ({
    id: card.id,
    name: card.name ?? card.id,
    type: "artifact" as const,
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
    effectTags: Array.isArray(card.effectTags) ? card.effectTags : [],
  }));

const byId = new Map<string, ArtifactCard>(allArtifacts.map((card) => [card.id, card]));

export function getLoadedArtifactById(cardId: string): ArtifactCard {
  const card = byId.get(cardId);
  if (!card) {
    throw new Error(`Artifact card not found: ${cardId}`);
  }
  return card;
}

export function getAllLoadedArtifacts(): ArtifactCard[] {
  return allArtifacts;
}
