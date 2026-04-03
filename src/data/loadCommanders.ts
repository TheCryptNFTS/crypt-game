import commandersJson from "./commanders.json";
import {
  buildCommanderTraitProfile,
  estimateCommanderBaseStats,
  CommanderTraitProfile
} from "./commanderArchetypes";

export interface CommanderTraits {
  skin: string;
  eyes: string;
  headwear: string;
  mouth: string;
}

export interface CommanderJsonRecord {
  id: string;
  name: string;
  traits: CommanderTraits;
  isLegendary?: boolean;
  oneOfOne?: string;
}

export interface LoadedCommander {
  id: string;
  name: string;
  skin: string;
  eyes: string;
  headwear: string;
  mouth: string;
  isLegendary: boolean;
  oneOfOne: string | null;
  profile: CommanderTraitProfile;
  attack: number;
  health: number;
  armor: number;
  abilityText: string;
  tags: string[];
}

function buildAbilityText(profile: CommanderTraitProfile): string {
  return [
    `Class: ${profile.cardClass}`,
    `Passive: ${profile.passive}`,
    `Subtype: ${profile.subtype}`,
    `Combat: ${profile.combatStyle}`
  ].join(" | ");
}

function validateCommanderRecord(record: CommanderJsonRecord): void {
  if (!record.id) {
    throw new Error('Commander record is missing "id"');
  }

  if (!record.name) {
    throw new Error(`Commander ${record.id} is missing "name"`);
  }

  if (!record.traits) {
    throw new Error(`Commander ${record.id} is missing "traits"`);
  }

  if (!record.traits.skin) {
    throw new Error(`Commander ${record.id} is missing trait "skin"`);
  }

  if (!record.traits.eyes) {
    throw new Error(`Commander ${record.id} is missing trait "eyes"`);
  }

  if (!record.traits.headwear) {
    throw new Error(`Commander ${record.id} is missing trait "headwear"`);
  }

  if (!record.traits.mouth) {
    throw new Error(`Commander ${record.id} is missing trait "mouth"`);
  }
}

function loadOneCommander(record: CommanderJsonRecord): LoadedCommander {
  validateCommanderRecord(record);

  const profile = buildCommanderTraitProfile({
    skin: record.traits.skin,
    eyes: record.traits.eyes,
    headwear: record.traits.headwear,
    mouth: record.traits.mouth,
    isLegendary: record.isLegendary ?? false,
    oneOfOne: record.oneOfOne ?? null
  });

  const stats = estimateCommanderBaseStats(profile);

  return {
    id: record.id,
    name: record.name,
    skin: record.traits.skin,
    eyes: record.traits.eyes,
    headwear: record.traits.headwear,
    mouth: record.traits.mouth,
    isLegendary: record.isLegendary ?? false,
    oneOfOne: record.oneOfOne ?? null,
    profile,
    attack: stats.attack,
    health: stats.health,
    armor: stats.armor,
    abilityText: buildAbilityText(profile),
    tags: profile.tags
  };
}

const rawCommanders = commandersJson as CommanderJsonRecord[];

export const LOADED_COMMANDERS: LoadedCommander[] = rawCommanders.map(loadOneCommander);

export const LOADED_COMMANDERS_BY_ID: Record<string, LoadedCommander> = Object.fromEntries(
  LOADED_COMMANDERS.map((commander) => [commander.id, commander])
);

export function getLoadedCommanderById(id: string): LoadedCommander {
  const commander = LOADED_COMMANDERS_BY_ID[id];

  if (!commander) {
    throw new Error(`Unknown commander id: ${id}`);
  }

  return commander;
}