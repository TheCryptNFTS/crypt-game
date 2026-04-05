import { getAllLoadedUnits } from "../data/loadAllUnits";
import { getOwnedNftCardIds } from "./getOwnedNftCardIds";

export function buildNftDeck(
  tokenIds: Array<string | number>,
  maxCards = 30
): string[] {
  const ownedCardIds = getOwnedNftCardIds(tokenIds);
  const allUnits = getAllLoadedUnits();

  const ownedExistingCards = ownedCardIds.filter((cardId) =>
    allUnits.some((unit) => unit.id === cardId)
  );

  return ownedExistingCards.slice(0, maxCards);
}
