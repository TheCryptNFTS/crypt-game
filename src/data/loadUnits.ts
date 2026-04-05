import units from "./units.json";
import {
  buildUnitTraitProfile,
  UnitTraitProfile
} from "./unitArchetypes";

type RawUnit = {
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
  keywords?: string[];
  generated?: {
    source?: string;
    rarityScore?: number;
  };
};

export type LoadedUnit = RawUnit & {
  profile: UnitTraitProfile;
  tags: string[];
};

const rawUnits = units as RawUnit[];

const loadedUnits: LoadedUnit[] = rawUnits.map((unit) => {
  const profile = buildUnitTraitProfile({
    name: unit.name,
    faction: unit.faction,
    rarity: unit.rarity,
    keywords: unit.keywords ?? []
  });

  return {
    ...unit,
    keywords: unit.keywords ?? [],
    profile,
    tags: profile.tags
  };
});

export function loadUnits(): LoadedUnit[] {
  return loadedUnits;
}

export function getLoadedUnitById(id: string): LoadedUnit {
  const unit = loadedUnits.find((item) => item.id === id);

  if (!unit) {
    throw new Error(`Unit not found: ${id}`);
  }

  return unit;
}

export default loadedUnits;