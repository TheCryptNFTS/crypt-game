import generatedPlayableTcgArtifacts from "./generatedPlayableTcgArtifacts.json";

export type ArtifactCard = {
  id: string;
  name: string;
  type: "artifact";
  faction: string;
  rarity: string;
  cost: number;
  effectTags: string[];
};

const allArtifacts: ArtifactCard[] = [
  ...(generatedPlayableTcgArtifacts as ArtifactCard[])
];

export function getLoadedArtifactById(cardId: string): ArtifactCard {
  const card = allArtifacts.find((u) => u.id === cardId);

  if (!card) {
    throw new Error(`Artifact card not found: ${cardId}`);
  }

  return card;
}

export function getAllLoadedArtifacts(): ArtifactCard[] {
  return allArtifacts;
}
