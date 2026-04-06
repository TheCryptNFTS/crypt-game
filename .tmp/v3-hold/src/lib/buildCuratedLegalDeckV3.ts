import curatedDecks from "../data/curatedLegalDecksV3.json";

type CuratedDeckMap = Record<
  string,
  {
    commanderId: string;
    faction: string;
    cards: string[];
  }
>;

const data = curatedDecks as CuratedDeckMap;

export function buildCuratedLegalDeckV3(commanderId: string): string[] {
  const deck = data[commanderId];
  if (!deck) {
    throw new Error(`No curated V3 deck found for commander: ${commanderId}`);
  }
  return [...deck.cards];
}
