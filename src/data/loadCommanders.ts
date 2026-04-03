import commanders from "./commanders.json";
import {
  CommanderDerivedProfile,
  CommanderTraits,
  deriveCommanderProfile,
  deriveCommanderStats,
  getCommanderPowerBand,
  getCommanderTraitRarityScore
} from "../engine/traitEngine";

type RawCommander = {
  id: string;
  name: string;
  isLegendary?: boolean;
  oneOfOne?: string;
  traits: {
    skin: string;
    eyes: string;
    headwear: string;
    mouth: string;
  };
};

export type LoadedCommander = {
  id: string;
  name: string;
  skin: string;
  eyes: string;
  headwear: string;
  mouth: string;
  isLegendary: boolean;
  oneOfOne: string | null;
  profile: CommanderDerivedProfile;
  attack: number;
  health: number;
  armor: number;
  abilityText: string;
  tags: string[];
  rarityScore: number;
  powerBand: string;
};

const rawCommanders = commanders as RawCommander[];

function toLoadedCommander(raw: RawCommander): LoadedCommander {
  const traits: CommanderTraits = {
    skin: raw.traits.skin,
    eyes: raw.traits.eyes,
    headwear: raw.traits.headwear,
    mouth: raw.traits.mouth
  };

  const flags = {
    isLegendary: Boolean(raw.isLegendary),
    oneOfOne: raw.oneOfOne ?? null
  };

  const profile = deriveCommanderProfile(traits, flags);
  const rarityScore = getCommanderTraitRarityScore(traits, flags);
  const stats = deriveCommanderStats(profile, rarityScore, flags);
  const powerBand = getCommanderPowerBand(rarityScore);

  return {
    id: raw.id,
    name: raw.name,
    skin: traits.skin,
    eyes: traits.eyes,
    headwear: traits.headwear,
    mouth: traits.mouth,
    isLegendary: Boolean(raw.isLegendary),
    oneOfOne: raw.oneOfOne ?? null,
    profile,
    attack: stats.attack,
    health: stats.health,
    armor: stats.armor,
    abilityText: `Class: ${profile.cardClass} | Passive: ${profile.passive} | Subtype: ${profile.subtype} | Combat: ${profile.combatStyle}`,
    tags: profile.tags,
    rarityScore,
    powerBand
  };
}

export function loadAllCommanders(): LoadedCommander[] {
  return rawCommanders.map(toLoadedCommander);
}

export function loadCommanderById(commanderId: string): LoadedCommander | undefined {
  const raw = rawCommanders.find((commander) => commander.id === commanderId);

  if (!raw) {
    return undefined;
  }

  return toLoadedCommander(raw);
}