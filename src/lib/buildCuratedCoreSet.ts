import allUnits from "../data/generatedPlayableTcgUnits.json";
import allEquipment from "../data/generatedPlayableTcgEquipment.json";
import allArtifacts from "../data/generatedPlayableTcgArtifacts.json";

type AnyCard = {
  id: string;
  faction: string;
  rarity: string;
  cost: number;
  type?: string;
};

type CoreSet = {
  units: AnyCard[];
  equipment: AnyCard[];
  artifacts: AnyCard[];
  all: AnyCard[];
};

const FACTIONS = ["STONE", "IRON", "BRONZE", "SILVER", "GOLD", "GOD"];

function byFaction<T extends AnyCard>(cards: T[], faction: string) {
  return cards.filter((card) => card.faction === faction);
}

function sortCards<T extends AnyCard>(cards: T[]) {
  return [...cards].sort((a, b) => {
    if ((a.cost ?? 0) !== (b.cost ?? 0)) return (a.cost ?? 0) - (b.cost ?? 0);
    if ((a.rarity ?? "") !== (b.rarity ?? "")) return String(a.rarity).localeCompare(String(b.rarity));
    return String(a.id).localeCompare(String(b.id));
  });
}

export function buildCuratedCoreSet(): CoreSet {
  const units = allUnits as AnyCard[];
  const equipment = allEquipment as AnyCard[];
  const artifacts = allArtifacts as AnyCard[];

  const chosenUnits: AnyCard[] = [];
  const chosenEquipment: AnyCard[] = [];
  const chosenArtifacts: AnyCard[] = [];

  for (const faction of FACTIONS) {
    chosenUnits.push(...sortCards(byFaction(units, faction)).slice(0, faction === "GOD" ? 4 : 16));
    chosenEquipment.push(...sortCards(byFaction(equipment, faction)).slice(0, faction === "GOD" ? 2 : 3));
    chosenArtifacts.push(...sortCards(byFaction(artifacts, faction)).slice(0, faction === "GOD" ? 1 : 2));
  }

  const all = [...chosenUnits, ...chosenEquipment, ...chosenArtifacts];

  return {
    units: chosenUnits,
    equipment: chosenEquipment,
    artifacts: chosenArtifacts,
    all
  };
}
