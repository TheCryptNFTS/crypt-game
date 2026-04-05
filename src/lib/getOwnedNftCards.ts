import generatedNftCards from "../data/generatedNftCards.json";
import { getOwnedNftCardIds } from "../nft/getOwnedNftCardIds";

type NftCard = {
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

export function getOwnedNftCards(tokenIds: Array<string | number>): NftCard[] {
  const ownedIds = new Set(getOwnedNftCardIds(tokenIds));

  return (generatedNftCards as NftCard[]).filter((card) => ownedIds.has(card.id));
}
