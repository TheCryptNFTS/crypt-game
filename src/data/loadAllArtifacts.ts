import runtimeArtifacts from "./runtimeArtifacts.json";

export type ArtifactCard = {
  id: string;
  name: string;
  type: "artifact";
  faction: string;
  rarity: string;
  cost: number;
  effectTags: string[];
};

type RuntimeArtifactTuple = [
  string, // id
  number, // cost
  string[] // effectTags
];

const allArtifacts: ArtifactCard[] = (runtimeArtifacts as RuntimeArtifactTuple[]).map(
  ([id, cost, effectTags]) => ({
    id,
    name: id,
    type: "artifact",
    faction: "STONE",
    rarity: "common",
    cost: cost ?? 0,
    effectTags: Array.isArray(effectTags) ? effectTags : [],
  })
);

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
