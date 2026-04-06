import commanders from "../data/commanders.json";
import units from "../data/generatedPlayableTcgUnits.json";
import equipment from "../data/generatedPlayableTcgEquipment.json";
import artifacts from "../data/generatedPlayableTcgArtifacts.json";
import { Faction, normalizeFaction } from "../types/faction";

type RawCard = Record<string, unknown> & {
  id: string;
  name?: string;
  faction?: string;
  type?: string;
};

export type CommanderCard = RawCard & {
  id: string;
  type: "commander";
  faction: Faction;
};

export type PlayableCard = RawCard & {
  id: string;
  type: "unit" | "equipment" | "artifact";
  faction: Faction;
};

function withCommanderType(card: RawCard): CommanderCard {
  return {
    ...card,
    type: "commander",
    faction: normalizeFaction(String(card.faction ?? "GOD")),
  };
}

function withPlayableType(card: RawCard, type: PlayableCard["type"]): PlayableCard {
  return {
    ...card,
    type,
    faction: normalizeFaction(String(card.faction ?? "GOD")),
  };
}

/**
 * Commanders are NOT part of the playable draw/deck pool.
 * They live in their own commander registry and should be resolved separately.
 */
export const allCommanderCards: CommanderCard[] = (commanders as RawCard[]).map(withCommanderType);

/**
 * These are the actual playable TCG cards that can appear in decks, hands, draws, board, etc.
 */
export const allPlayableCards: PlayableCard[] = [
  ...(units as RawCard[]).map((card) => withPlayableType(card, "unit")),
  ...(equipment as RawCard[]).map((card) => withPlayableType(card, "equipment")),
  ...(artifacts as RawCard[]).map((card) => withPlayableType(card, "artifact")),
];

/**
 * Backward-compatible export name.
 * IMPORTANT: this is now PLAYABLE cards only.
 */
export const allCards: PlayableCard[] = allPlayableCards;

const playableCardIndex = new Map<string, PlayableCard>(
  allPlayableCards.map((card) => [card.id, card])
);

const commanderCardIndex = new Map<string, CommanderCard>(
  allCommanderCards.map((card) => [card.id, card])
);

export function getPlayableCardById(id: string): PlayableCard | null {
  return playableCardIndex.get(id) ?? null;
}

export function getCommanderCardById(id: string): CommanderCard | null {
  return commanderCardIndex.get(id) ?? null;
}

export function getAnyCardById(id: string): PlayableCard | CommanderCard | null {
  return getPlayableCardById(id) ?? getCommanderCardById(id);
}

export function isPlayableCardId(id: string): boolean {
  return playableCardIndex.has(id);
}

export function isCommanderCardId(id: string): boolean {
  return commanderCardIndex.has(id);
}
