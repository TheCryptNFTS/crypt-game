export type CommanderClass =
  | "TANK"
  | "BRUISER"
  | "ASSASSIN"
  | "CONTROL"
  | "SPELLCASTER"
  | "SUPPORT"
  | "NECRO"
  | "LEADER"
  | "TRICKSTER"
  | "RANGER"
  | "MYTHIC";

export type CommanderPassive =
  | "NONE"
  | "IGNORE_ARMOR"
  | "CHAIN_DAMAGE"
  | "STEALTH"
  | "GRAVEYARD_POWER"
  | "BONUS_RESOURCE"
  | "DRAIN"
  | "HEALING_AURA"
  | "PING"
  | "SCRY"
  | "SUMMON_TOKEN"
  | "RANGED_BURST"
  | "DRAW"
  | "EXECUTE"
  | "TIME_MANIPULATION"
  | "TECH_SYNC"
  | "INFERNAL_GATE"
  | "DIVINE_GATE"
  | "CONFUSE"
  | "CURSE"
  | "FEAR"
  | "VISION";

export type CommanderSubtype =
  | "NONE"
  | "ROYAL"
  | "WARRIOR"
  | "TECH"
  | "SHADOW"
  | "PIRATE"
  | "DIVINE"
  | "OCCULT"
  | "WILD"
  | "MILITARY";

export type CommanderCombatStyle =
  | "NONE"
  | "MELEE"
  | "HEAVY"
  | "DEFENSIVE"
  | "EVASIVE"
  | "RANGED"
  | "LIFESTEAL"
  | "CURSED"
  | "ARCANE";

export interface CommanderTraitProfile {
  cardClass: CommanderClass;
  passive: CommanderPassive;
  subtype: CommanderSubtype;
  combatStyle: CommanderCombatStyle;
  tags: string[];
}

export const DEFAULT_COMMANDER_PROFILE: CommanderTraitProfile = {
  cardClass: "BRUISER",
  passive: "NONE",
  subtype: "NONE",
  combatStyle: "MELEE",
  tags: []
};

export const SKIN_TO_CLASS: Record<string, CommanderClass> = {
  Guardian: "TANK",
  Warrior: "BRUISER",
  Techno: "CONTROL",
  Mech: "CONTROL",
  "Fortune Teller": "SPELLCASTER",
  Astrological: "SPELLCASTER",
  "Dead King": "LEADER",
  "King Of Kings": "LEADER",
  "Long Live The King": "LEADER",
  "Not King Nor Queen": "LEADER",
  "Pure Evil": "NECRO",
  "Devils Advocate": "NECRO",
  Blessed: "SUPPORT",
  Holy: "SUPPORT",
  "The Healer": "SUPPORT",
  "One Shot One Kill": "ASSASSIN",
  "Fast Lane": "ASSASSIN",
  "Round Table": "LEADER",
  "Ancient Warrior": "BRUISER",
  Anunnaki: "MYTHIC",
  "Forsaken Throne": "MYTHIC",
  "Sovereign Of Shadows": "MYTHIC",
  "Good vs Evil": "MYTHIC",
  "Carved In Hell": "MYTHIC",
  "Chosen Ones": "MYTHIC",
  "Time Is All We Have": "CONTROL",
  "Visiting Earth": "SPELLCASTER",
  Interstellar: "SPELLCASTER",
  Galactic: "SPELLCASTER",
  "Peace Of Mind": "SUPPORT",
  "Dead Man's Hand": "TRICKSTER",
  "A Pirates Sins": "TRICKSTER",
  "Smooth Operator": "TRICKSTER",
  Hybrid: "BRUISER",
  "Heavy Is The Head": "LEADER",
  "Born Into Darkness": "NECRO",
  "Death Defines": "NECRO",
  "Living In Grief": "NECRO",
  Inferno: "SPELLCASTER",
  "Ice Age": "CONTROL",
  "Witching Hour": "SPELLCASTER",
  "The Cogs Turn": "CONTROL",
  Punishment: "CONTROL",
  "Dead Queen": "LEADER",
  Beauty: "SUPPORT",
  "Beauty Queen": "SUPPORT",
  Wisdom: "SUPPORT",
  Naked: "TRICKSTER",
  "Naked Minds": "CONTROL",
  Misunderstood: "TRICKSTER",
  Ruined: "NECRO",
  Enigma: "CONTROL",
  "Del Muerte": "NECRO",
  "Dead Dollars": "TRICKSTER",
  "Kill For Gold": "TRICKSTER",
  "3 Card Monty": "TRICKSTER",
  "Yes or No": "TRICKSTER",
  "Celebrate Life": "SUPPORT",
  "Dead Money": "TRICKSTER",
  Frankenstein: "MYTHIC",
  "Day Of The Dead": "NECRO"
};

export const EYE_TO_PASSIVE: Record<string, CommanderPassive> = {
  Piercing: "IGNORE_ARMOR",
  Lightning: "CHAIN_DAMAGE",
  "Unseen Death": "STEALTH",
  "I See Dead People": "GRAVEYARD_POWER",
  "Crypt Coin": "BONUS_RESOURCE",
  "Life Is Hell": "DRAIN",
  "Hell's Gateway": "INFERNAL_GATE",
  "Heaven's Gateway": "DIVINE_GATE",
  "Love Eyes": "HEALING_AURA",
  "Machine Gun Eye": "PING",
  "Looking Into The Future": "SCRY",
  "Hugin & Munin": "SUMMON_TOKEN",
  Moonshot: "RANGED_BURST",
  Explorer: "DRAW",
  "Times Up": "EXECUTE",
  "Time Warp": "TIME_MANIPULATION",
  "Time Reversed": "TIME_MANIPULATION",
  "Temporal Rift": "TIME_MANIPULATION",
  VR: "TECH_SYNC",
  Robotic: "TECH_SYNC",
  Jarvis: "TECH_SYNC",
  "The High Life": "CONFUSE",
  "Mad Scientist": "VISION",
  "Eye See All": "VISION",
  "Ancient History": "VISION",
  "Endless Void": "FEAR",
  Trapped: "CURSE",
  Imprisoned: "CURSE",
  "Devilish Sight": "CURSE",
  "The Creeper": "FEAR",
  "Self Reflection": "SCRY",
  "Around The World": "DRAW",
  "Life Through A Broken Lense": "VISION",
  "Leave Me Alone": "STEALTH",
  "Facing Death": "EXECUTE",
  "Lost Childhood": "CURSE",
  "Grieving Widow": "GRAVEYARD_POWER",
  "Faith's Guardian": "HEALING_AURA",
  "In Lucifer We Trust": "INFERNAL_GATE"
};

export const HEADWEAR_TO_SUBTYPE: Record<string, CommanderSubtype> = {
  "King Crown": "ROYAL",
  Emperor: "ROYAL",
  Royalty: "ROYAL",
  "Lords Crown": "ROYAL",
  "Heavy Is The Head": "ROYAL",

  Samurai: "WARRIOR",
  Bushido: "WARRIOR",
  "Dead Samurai": "WARRIOR",
  "Viking Warrior": "WARRIOR",
  Leonidas: "WARRIOR",
  "Roman Soldier": "WARRIOR",
  War: "WARRIOR",

  "Matrix Helmet": "TECH",
  "Bio Hazard": "TECH",
  Steampunk: "TECH",
  "The Brainiac": "TECH",
  Astral: "TECH",
  "Dead Astronaut": "TECH",

  "Hooded One": "SHADOW",
  Bane: "SHADOW",
  Hellrazor: "SHADOW",
  "Devil Horns": "SHADOW",
  "Hell Horns": "SHADOW",
  Pentagram: "SHADOW",

  "Pirates Life": "PIRATE",
  "Caribbean Pirate": "PIRATE",
  "Davy Jones": "PIRATE",
  "The Captain": "PIRATE",
  "Pirate Beanie": "PIRATE",

  "Pharaohs Fortune": "DIVINE",
  "Egyptian God": "DIVINE",
  "All Seeing Eye": "DIVINE",

  "Fortune Teller": "OCCULT",
  Jester: "OCCULT",
  "Clowning Around": "OCCULT",

  Arachne: "WILD",
  Wolfgang: "WILD",
  Wolfskin: "WILD",
  "Baby Dragon": "WILD",
  "Dead Dragon": "WILD",
  Octopus: "WILD",
  "Dragon Slayer": "WILD",
  "Dead Scorpion": "WILD",
  "Odins Raven": "WILD",

  "Police Hat": "MILITARY",
  "Old Police Hat": "MILITARY",
  Fireman: "MILITARY",
  "WW2 Ace": "MILITARY",
  Capone: "MILITARY",
  Biker: "MILITARY",
  "Gold Miner": "MILITARY"
};

export const MOUTH_TO_COMBAT_STYLE: Record<string, CommanderCombatStyle> = {
  Katana: "MELEE",
  Dagger: "MELEE",
  "Elven Dagger": "MELEE",
  "Broken Sword": "MELEE",
  "The Hobbit Sting Sword": "MELEE",
  Lightsaber: "MELEE",
  "Sword Of Heaven": "MELEE",

  Stormbreaker: "HEAVY",
  "Crypt Mjolnir": "HEAVY",
  "Loki Sceptor": "HEAVY",
  "Minoru Sceptor": "HEAVY",
  "Saurons Mace": "HEAVY",
  "Mace Skull": "HEAVY",
  Bullet: "RANGED",
  Grenade: "RANGED",

  "Warfare Mask": "DEFENSIVE",
  "Radiation Mask": "DEFENSIVE",
  "Dead Protectors Mask": "DEFENSIVE",
  "Racers Mask": "DEFENSIVE",

  "Smoke Bomb": "EVASIVE",
  Pipe: "EVASIVE",
  "Smoked Out": "EVASIVE",

  Fangs: "LIFESTEAL",
  "Alien Attack": "LIFESTEAL",

  "666 Grill": "CURSED",
  "Skull Eats Skull": "CURSED",
  "Stitched Up": "CURSED",
  "Tongue Out": "CURSED",

  Robotic: "ARCANE",
  "Rainbow Grill": "ARCANE",
  "Diamond Grill": "ARCANE",
  "Flash Grill": "ARCANE",
  "Crypt Grill": "ARCANE",
  "Wax Grill": "ARCANE",
  "Razor Grill": "ARCANE"
};

export function getCommanderClassFromSkin(skin?: string): CommanderClass {
  if (!skin) return DEFAULT_COMMANDER_PROFILE.cardClass;
  return SKIN_TO_CLASS[skin] ?? DEFAULT_COMMANDER_PROFILE.cardClass;
}

export function getCommanderPassiveFromEyes(eyes?: string): CommanderPassive {
  if (!eyes) return DEFAULT_COMMANDER_PROFILE.passive;
  return EYE_TO_PASSIVE[eyes] ?? DEFAULT_COMMANDER_PROFILE.passive;
}

export function getCommanderSubtypeFromHeadwear(headwear?: string): CommanderSubtype {
  if (!headwear) return DEFAULT_COMMANDER_PROFILE.subtype;
  return HEADWEAR_TO_SUBTYPE[headwear] ?? DEFAULT_COMMANDER_PROFILE.subtype;
}

export function getCommanderCombatStyleFromMouth(mouth?: string): CommanderCombatStyle {
  if (!mouth) return DEFAULT_COMMANDER_PROFILE.combatStyle;
  return MOUTH_TO_COMBAT_STYLE[mouth] ?? DEFAULT_COMMANDER_PROFILE.combatStyle;
}

export interface CommanderTraitInput {
  skin?: string;
  eyes?: string;
  headwear?: string;
  mouth?: string;
  isLegendary?: boolean;
  oneOfOne?: string | null;
}

export function buildCommanderTraitProfile(input: CommanderTraitInput): CommanderTraitProfile {
  const cardClass = getCommanderClassFromSkin(input.skin);
  const passive = getCommanderPassiveFromEyes(input.eyes);
  const subtype = getCommanderSubtypeFromHeadwear(input.headwear);
  const combatStyle = getCommanderCombatStyleFromMouth(input.mouth);

  const tags: string[] = [];

  if (input.skin) tags.push(`SKIN:${input.skin}`);
  if (input.eyes) tags.push(`EYES:${input.eyes}`);
  if (input.headwear) tags.push(`HEADWEAR:${input.headwear}`);
  if (input.mouth) tags.push(`MOUTH:${input.mouth}`);
  if (input.isLegendary) tags.push("LEGENDARY");
  if (input.oneOfOne) tags.push(`ONE_OF_ONE:${input.oneOfOne}`);

  if (input.isLegendary || input.oneOfOne) {
    return {
      cardClass: "MYTHIC",
      passive,
      subtype,
      combatStyle,
      tags
    };
  }

  return {
    cardClass,
    passive,
    subtype,
    combatStyle,
    tags
  };
}

export function estimateCommanderBaseStats(profile: CommanderTraitProfile): {
  attack: number;
  health: number;
  armor: number;
} {
  let attack = 3;
  let health = 24;
  let armor = 0;

  switch (profile.cardClass) {
    case "TANK":
      health += 10;
      armor += 2;
      break;
    case "BRUISER":
      attack += 2;
      health += 6;
      armor += 1;
      break;
    case "ASSASSIN":
      attack += 4;
      break;
    case "CONTROL":
      attack += 1;
      health += 4;
      armor += 1;
      break;
    case "SPELLCASTER":
      attack += 2;
      health += 2;
      break;
    case "SUPPORT":
      attack += 1;
      health += 5;
      armor += 1;
      break;
    case "NECRO":
      attack += 2;
      health += 3;
      break;
    case "LEADER":
      attack += 2;
      health += 6;
      armor += 1;
      break;
    case "TRICKSTER":
      attack += 3;
      health += 2;
      break;
    case "RANGER":
      attack += 3;
      health += 2;
      break;
    case "MYTHIC":
      attack += 4;
      health += 8;
      armor += 2;
      break;
  }

  switch (profile.combatStyle) {
    case "MELEE":
      attack += 1;
      break;
    case "HEAVY":
      attack += 2;
      health += 1;
      break;
    case "DEFENSIVE":
      armor += 2;
      health += 2;
      break;
    case "EVASIVE":
      health += 1;
      break;
    case "RANGED":
      attack += 1;
      break;
    case "LIFESTEAL":
      attack += 1;
      health += 1;
      break;
    case "CURSED":
      attack += 1;
      break;
    case "ARCANE":
      attack += 1;
      health += 1;
      break;
    case "NONE":
    default:
      break;
  }

  if (profile.subtype === "ROYAL") health += 2;
  if (profile.subtype === "TECH") armor += 1;
  if (profile.subtype === "WARRIOR") attack += 1;

  return { attack, health, armor };
}