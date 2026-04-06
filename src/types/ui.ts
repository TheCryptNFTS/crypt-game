import type { Faction } from "./faction";

export type Screen = "home" | "collection" | "deck-builder" | "match" | "profile";

export type CardRarity = "common" | "rare" | "epic" | "legendary" | "commander" | "unknown";

export interface CardStats {
  attack: number;
  health: number;
  speed: number;
  armor: number;
}

export interface DisplayCard {
  id: string;
  name: string;
  type: "unit" | "equipment" | "artifact" | "commander";
  faction: Faction;
  rarity: CardRarity;
  cost?: number;
  stats?: CardStats;
  keywords?: string[];
  imageUrl?: string | null;
  description?: string;
}

export interface DeckSlot {
  cardId: string;
  count: number;
}

export interface Deck {
  id: string;
  name: string;
  commanderId: string;
  cards: DeckSlot[];
  faction: Faction;
}

export interface PlayerProfile {
  id: string;
  username: string;
  avatar?: string;
  wins: number;
  losses: number;
  rank: string;
  decks: Deck[];
}
