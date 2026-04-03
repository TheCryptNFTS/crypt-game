export type UnitClass =
  | "TANK"
  | "BRUISER"
  | "ASSASSIN"
  | "CONTROL"
  | "SUPPORT"
  | "RANGER"
  | "NECRO"
  | "MYTHIC";

export type UnitPassive =
  | "NONE"
  | "TAUNT"
  | "RUSH"
  | "GUARD"
  | "BURN"
  | "HEAL_ON_PLAY"
  | "DRAW_ON_PLAY"
  | "ARMOR_GAIN"
  | "EXECUTE_PRESSURE"
  | "GRAVE_POWER"
  | "BUFF_ALLY"
  | "PING"
  | "STEALTH"
  | "LIFESTEAL"
  | "DEATH_BLAST"
  | "BATTLECRY_HERO_HIT";

export type UnitSubtype =
  | "NONE"
  | "STONE"
  | "BRONZE"
  | "IRON"
  | "SILVER"
  | "GOLD"
  | "OCCULT"
  | "DIVINE"
  | "WILD"
  | "TECH";

export type UnitCombatStyle =
  | "NONE"
  | "MELEE"
  | "HEAVY"
  | "DEFENSIVE"
  | "FAST"
  | "RANGED"
  | "ARCANE"
  | "SACRIFICE";

export interface UnitTraitProfile {
  cardClass: UnitClass;
  passive: UnitPassive;
  subtype: UnitSubtype;
  combatStyle: UnitCombatStyle;
  tags: string[];
}

export const DEFAULT_UNIT_PROFILE: UnitTraitProfile = {
  cardClass: "BRUISER",
  passive: "NONE",
  subtype: "NONE",
  combatStyle: "MELEE",
  tags: []
};

const NORMALIZED_FACTION_TO_SUBTYPE: Record<string, UnitSubtype> = {
  stone: "STONE",
  "stone keepers": "STONE",

  bronze: "BRONZE",
  "bronze guardians": "BRONZE",

  iron: "IRON",
  "iron defenders": "IRON",

  silver: "SILVER",
  "silver sentinels": "SILVER",

  gold: "GOLD",
  golden: "GOLD",
  "golden sovereigns": "GOLD",

  gods: "DIVINE",
  divine: "DIVINE",

  occult: "OCCULT",
  wild: "WILD",
  tech: "TECH"
};

export const NAME_TO_CLASS: Record<string, UnitClass> = {
  "Stone Guard": "TANK",
  "Shield Bearer": "TANK",
  "Stone Brute": "BRUISER",
  "Bronze Scout": "RANGER",
  "Blade Striker": "ASSASSIN",
  Berserker: "BRUISER",
  "Bomb Skull": "NECRO",
  "Shock Raider": "CONTROL"
};

export const NAME_TO_PASSIVE: Record<string, UnitPassive> = {
  "Stone Guard": "GUARD",
  "Shield Bearer": "TAUNT",
  "Stone Brute": "ARMOR_GAIN",
  "Bronze Scout": "RUSH",
  "Blade Striker": "EXECUTE_PRESSURE",
  Berserker: "LIFESTEAL",
  "Bomb Skull": "DEATH_BLAST",
  "Shock Raider": "BATTLECRY_HERO_HIT"
};

export const NAME_TO_COMBAT_STYLE: Record<string, UnitCombatStyle> = {
  "Stone Guard": "DEFENSIVE",
  "Shield Bearer": "DEFENSIVE",
  "Stone Brute": "HEAVY",
  "Bronze Scout": "FAST",
  "Blade Striker": "MELEE",
  Berserker: "HEAVY",
  "Bomb Skull": "SACRIFICE",
  "Shock Raider": "FAST"
};

function normalizeText(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

export function getUnitSubtypeFromFaction(faction?: string): UnitSubtype {
  const normalized = normalizeText(faction);
  if (!normalized) return DEFAULT_UNIT_PROFILE.subtype;
  return NORMALIZED_FACTION_TO_SUBTYPE[normalized] ?? DEFAULT_UNIT_PROFILE.subtype;
}

export function getUnitClassFromName(name?: string): UnitClass {
  if (!name) return DEFAULT_UNIT_PROFILE.cardClass;
  return NAME_TO_CLASS[name] ?? DEFAULT_UNIT_PROFILE.cardClass;
}

export function getUnitPassiveFromName(name?: string): UnitPassive {
  if (!name) return DEFAULT_UNIT_PROFILE.passive;
  return NAME_TO_PASSIVE[name] ?? DEFAULT_UNIT_PROFILE.passive;
}

export function getUnitCombatStyleFromName(name?: string): UnitCombatStyle {
  if (!name) return DEFAULT_UNIT_PROFILE.combatStyle;
  return NAME_TO_COMBAT_STYLE[name] ?? DEFAULT_UNIT_PROFILE.combatStyle;
}

export interface UnitTraitInput {
  name?: string;
  faction?: string;
  rarity?: string;
  keywords?: string[];
}

export function buildUnitTraitProfile(input: UnitTraitInput): UnitTraitProfile {
  const cardClass = getUnitClassFromName(input.name);
  const passiveFromName = getUnitPassiveFromName(input.name);
  const subtype = getUnitSubtypeFromFaction(input.faction);
  const combatStyle = getUnitCombatStyleFromName(input.name);

  let passive = passiveFromName;

  if (input.keywords?.includes("TAUNT")) passive = "TAUNT";
  if (input.keywords?.includes("RUSH")) passive = "RUSH";

  const tags: string[] = [];

  if (input.name) tags.push(`NAME:${input.name}`);
  if (input.faction) tags.push(`FACTION:${input.faction}`);
  if (input.rarity) tags.push(`RARITY:${input.rarity}`);
  for (const keyword of input.keywords ?? []) {
    tags.push(`KEYWORD:${keyword}`);
  }

  return {
    cardClass,
    passive,
    subtype,
    combatStyle,
    tags
  };
}

export function estimateUnitBaseStats(profile: UnitTraitProfile): {
  attack: number;
  health: number;
  speed: number;
  armor: number;
} {
  let attack = 3;
  let health = 8;
  let speed = 2;
  let armor = 0;

  switch (profile.cardClass) {
    case "TANK":
      attack -= 1;
      health += 4;
      armor += 1;
      break;
    case "BRUISER":
      attack += 1;
      health += 2;
      break;
    case "ASSASSIN":
      attack += 2;
      speed += 1;
      health -= 1;
      break;
    case "CONTROL":
      health += 1;
      armor += 1;
      break;
    case "SUPPORT":
      health += 2;
      break;
    case "RANGER":
      attack += 1;
      speed += 2;
      health -= 1;
      break;
    case "NECRO":
      attack += 1;
      break;
    case "MYTHIC":
      attack += 2;
      health += 3;
      armor += 1;
      break;
  }

  switch (profile.combatStyle) {
    case "HEAVY":
      attack += 1;
      speed -= 1;
      break;
    case "DEFENSIVE":
      health += 2;
      armor += 1;
      speed -= 1;
      break;
    case "FAST":
      speed += 1;
      break;
    case "RANGED":
      attack += 1;
      speed += 1;
      break;
    case "ARCANE":
      attack += 1;
      break;
    case "SACRIFICE":
      attack += 1;
      health -= 1;
      break;
    case "MELEE":
    case "NONE":
    default:
      break;
  }

  switch (profile.subtype) {
    case "STONE":
      health += 2;
      armor += 1;
      break;
    case "BRONZE":
      speed += 1;
      break;
    case "IRON":
      armor += 1;
      break;
    case "SILVER":
      attack += 1;
      break;
    case "GOLD":
      attack += 1;
      health += 1;
      break;
    case "DIVINE":
      health += 1;
      break;
    case "TECH":
      armor += 1;
      speed += 1;
      break;
    case "WILD":
      attack += 1;
      break;
    case "OCCULT":
      attack += 1;
      break;
    case "NONE":
    default:
      break;
  }

  if (attack < 1) attack = 1;
  if (health < 1) health = 1;
  if (speed < 1) speed = 1;
  if (armor < 0) armor = 0;

  return { attack, health, speed, armor };
}