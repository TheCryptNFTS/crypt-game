import unitsJson from "./units.json";
import {
  buildUnitTraitProfile,
  estimateUnitBaseStats,
  UnitTraitProfile
} from "./unitArchetypes";

export interface UnitJsonRecord {
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
}

export interface LoadedUnit {
  id: string;
  name: string;
  type: "unit";
  faction: string;
  rarity: string;
  cost: number;
  baseStats: {
    attack: number;
    health: number;
    speed: number;
    armor: number;
  };
  derivedStats: {
    attack: number;
    health: number;
    speed: number;
    armor: number;
  };
  keywords: string[];
  profile: UnitTraitProfile;
  tags: string[];
  abilityText: string;
}

function validateUnitRecord(record: UnitJsonRecord): void {
  if (!record.id) throw new Error('Unit record is missing "id"');
  if (!record.name) throw new Error(`Unit ${record.id} is missing "name"`);
  if (record.type !== "unit") throw new Error(`Card ${record.id} is not a unit`);
  if (!record.faction) throw new Error(`Unit ${record.id} is missing "faction"`);
  if (!record.rarity) throw new Error(`Unit ${record.id} is missing "rarity"`);
  if (typeof record.cost !== "number") throw new Error(`Unit ${record.id} has invalid "cost"`);
  if (!record.stats) throw new Error(`Unit ${record.id} is missing "stats"`);
  if (!Array.isArray(record.keywords)) throw new Error(`Unit ${record.id} is missing "keywords" array`);
}

function buildAbilityText(profile: UnitTraitProfile): string {
  return [
    `Class: ${profile.cardClass}`,
    `Passive: ${profile.passive}`,
    `Subtype: ${profile.subtype}`,
    `Combat: ${profile.combatStyle}`
  ].join(" | ");
}

function loadOneUnit(record: UnitJsonRecord): LoadedUnit {
  validateUnitRecord(record);

  const profile = buildUnitTraitProfile({
    name: record.name,
    faction: record.faction,
    rarity: record.rarity,
    keywords: record.keywords
  });

  const derivedStats = estimateUnitBaseStats(profile);

  return {
    id: record.id,
    name: record.name,
    type: "unit",
    faction: record.faction,
    rarity: record.rarity,
    cost: record.cost,
    baseStats: {
      attack: record.stats.attack,
      health: record.stats.health,
      speed: record.stats.speed,
      armor: record.stats.armor
    },
    derivedStats,
    keywords: record.keywords,
    profile,
    tags: profile.tags,
    abilityText: buildAbilityText(profile)
  };
}

const rawUnits = unitsJson as UnitJsonRecord[];

export const LOADED_UNITS: LoadedUnit[] = rawUnits.map(loadOneUnit);

export const LOADED_UNITS_BY_ID: Record<string, LoadedUnit> = Object.fromEntries(
  LOADED_UNITS.map((unit) => [unit.id, unit])
);

export function getLoadedUnitById(id: string): LoadedUnit {
  const unit = LOADED_UNITS_BY_ID[id];

  if (!unit) {
    throw new Error(`Unknown unit id: ${id}`);
  }

  return unit;
}