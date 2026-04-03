import commanders from "../data/commanders.json";
import units from "../data/units.json";
import equipment from "../data/equipment.json";

const allCards = [...commanders, ...units, ...equipment];

export function getAllCards() {
  return allCards;
}

export function getCardById(cardId: string) {
  const card = allCards.find((c) => c.id === cardId);

  if (!card) {
    throw new Error(`Card not found: ${cardId}`);
  }

  return card;
}