export type CommanderCardClass =
  | "TANK"
  | "ASSASSIN"
  | "SPELLCASTER"
  | "NECRO"
  | "CONTROL"
  | "MYTHIC";

export type CommanderPassive =
  | "HEALING_AURA"
  | "IGNORE_ARMOR"
  | "FEAR"
  | "INFERNAL_GATE"
  | "TECH_SYNC"
  | "GRAVEYARD_POWER"
  | "EXECUTE"
  | "TIME_MANIPULATION"
  | "SCRY"
  | "BONUS_RESOURCE";

export type CommanderSubtype =
  | "WARRIOR"
  | "PIRATE"
  | "OCCULT"
  | "SHADOW"
  | "TECH"
  | "ROYAL"
  | "DIVINE";

export type CommanderCombatStyle =
  | "DEFENSIVE"
  | "RANGED"
  | "EVASIVE"
  | "LIFESTEAL"
  | "ARCANE"
  | "CURSED"
  | "MELEE"
  | "HEAVY";

export type CommanderTraits = {
  skin: string;
  eyes: string;
  headwear: string;
  mouth: string;
};

export type CommanderDerivedProfile = {
  cardClass: CommanderCardClass;
  passive: CommanderPassive;
  subtype: CommanderSubtype;
  combatStyle: CommanderCombatStyle;
  tags: string[];
};

export type CommanderFlags = {
  isLegendary?: boolean;
  oneOfOne?: string | null;
};

type FocusedTraitCounts = {
  skins: Record<string, number>;
  eyes: Record<string, number>;
  headwears: Record<string, number>;
  mouths: Record<string, number>;
  legendary: number;
  oneOfOne: number;
};

const COMMANDER_TRAIT_COUNTS: FocusedTraitCounts = {
  skins: {
    Guardian: 53,
    "Fast Lane": 65,
    "Fortune Teller": 43,
    "Pure Evil": 49,
    Techno: 38,
    "Del Muerte": 42,
    "Dead King": 22,
    "Time Is All We Have": 75,
    Anunnaki: 77,
    "Good vs Evil": 73,
    "Carved In Hell": 61,
    "Smooth Operator": 71
  },
  eyes: {
    "Faith's Guardian": 10,
    Piercing: 127,
    "Endless Void": 15,
    "In Lucifer We Trust": 25,
    Jarvis: 4,
    "I See Dead People": 208,
    "Times Up": 123,
    "Time Warp": 13,
    "Looking Into The Future": 5,
    "Self Reflection": 30,
    "Hell's Gateway": 15,
    "Crypt Coin": 90
  },
  headwears: {
    "Roman Soldier": 30,
    "The Captain": 40,
    "Fortune Teller": 36,
    "Devil Horns": 73,
    "Matrix Helmet": 35,
    "Hooded One": 113,
    "King Crown": 64,
    "Heavy Is The Head": 7,
    "Egyptian God": 13,
    "Clowning Around": 33,
    "The Brainiac": 9
  },
  mouths: {
    "Warfare Mask": 149,
    Bullet: 103,
    "Smoke Bomb": 224,
    Fangs: 148,
    Robotic: 300,
    "Skull Eats Skull": 208,
    "Sword Of Heaven": 25,
    "Minoru Sceptor": 24,
    "Loki Sceptor": 38,
    "Tongue Out": 33,
    "666 Grill": 249,
    "Diamond Grill": 31
  },
  legendary: 111,
  oneOfOne: 1
};

function getCountOrFallback(
  group: Record<string, number>,
  trait: string,
  fallback = 999
): number {
  return group[trait] ?? fallback;
}

function normalizedRarityScore(count: number): number {
  if (count <= 1) return 1;
  if (count <= 5) return 0.97;
  if (count <= 10) return 0.92;
  if (count <= 20) return 0.86;
  if (count <= 40) return 0.74;
  if (count <= 80) return 0.6;
  if (count <= 160) return 0.42;
  return 0.22;
}

export function getCommanderTraitRarityScore(
  traits: CommanderTraits,
  flags?: CommanderFlags
): number {
  const skinScore = normalizedRarityScore(
    getCountOrFallback(COMMANDER_TRAIT_COUNTS.skins, traits.skin)
  );
  const eyesScore = normalizedRarityScore(
    getCountOrFallback(COMMANDER_TRAIT_COUNTS.eyes, traits.eyes)
  );
  const headwearScore = normalizedRarityScore(
    getCountOrFallback(COMMANDER_TRAIT_COUNTS.headwears, traits.headwear)
  );
  const mouthScore = normalizedRarityScore(
    getCountOrFallback(COMMANDER_TRAIT_COUNTS.mouths, traits.mouth)
  );

  let score = (skinScore + eyesScore + headwearScore + mouthScore) / 4;

  if (flags?.isLegendary) {
    score += normalizedRarityScore(COMMANDER_TRAIT_COUNTS.legendary) * 0.35;
  }

  if (flags?.oneOfOne) {
    score += normalizedRarityScore(COMMANDER_TRAIT_COUNTS.oneOfOne) * 0.75;
  }

  return Math.min(1.95, Number(score.toFixed(2)));
}

export function getCommanderPowerBand(score: number): string {
  if (score >= 1.55) return "GOD_TIER";
  if (score >= 1.25) return "MYTHIC";
  if (score >= 0.95) return "ELITE";
  if (score >= 0.65) return "STRONG";
  return "STANDARD";
}

function mapSkinToClass(
  skin: string,
  flags?: CommanderFlags
): CommanderCardClass {
  if (flags?.oneOfOne || flags?.isLegendary) return "MYTHIC";

  switch (skin) {
    case "Guardian":
      return "TANK";
    case "Fast Lane":
      return "ASSASSIN";
    case "Fortune Teller":
      return "SPELLCASTER";
    case "Pure Evil":
    case "Del Muerte":
      return "NECRO";
    case "Techno":
    case "Smooth Operator":
      return "CONTROL";
    default:
      return "CONTROL";
  }
}

function mapEyesToPassive(
  eyes: string,
  flags?: CommanderFlags
): CommanderPassive {
  if (flags?.oneOfOne) {
    if (flags.oneOfOne === "Lucifer") return "INFERNAL_GATE";
    if (flags.oneOfOne === "Satoshi") return "BONUS_RESOURCE";
    return "SCRY";
  }

  if (flags?.isLegendary) {
    if (eyes === "Times Up") return "EXECUTE";
    if (eyes === "Time Warp") return "TIME_MANIPULATION";
    return "SCRY";
  }

  switch (eyes) {
    case "Faith's Guardian":
      return "HEALING_AURA";
    case "Piercing":
      return "IGNORE_ARMOR";
    case "Endless Void":
      return "FEAR";
    case "In Lucifer We Trust":
      return "INFERNAL_GATE";
    case "Jarvis":
      return "TECH_SYNC";
    case "I See Dead People":
      return "GRAVEYARD_POWER";
    case "Looking Into The Future":
    case "Self Reflection":
      return "SCRY";
    case "Crypt Coin":
      return "BONUS_RESOURCE";
    default:
      return "SCRY";
  }
}

function mapHeadwearToSubtype(
  headwear: string,
  flags?: CommanderFlags
): CommanderSubtype {
  if (flags?.oneOfOne) {
    if (flags.oneOfOne === "Satoshi") return "TECH";
    if (flags.oneOfOne === "Lucifer") return "SHADOW";
    return "OCCULT";
  }

  if (flags?.isLegendary) {
    if (headwear === "Egyptian God") return "DIVINE";
    return "ROYAL";
  }

  switch (headwear) {
    case "Roman Soldier":
      return "WARRIOR";
    case "The Captain":
      return "PIRATE";
    case "Fortune Teller":
      return "OCCULT";
    case "Devil Horns":
    case "Hooded One":
      return "SHADOW";
    case "Matrix Helmet":
    case "The Brainiac":
      return "TECH";
    default:
      return "WARRIOR";
  }
}

function mapMouthToCombatStyle(
  mouth: string,
  flags?: CommanderFlags
): CommanderCombatStyle {
  if (flags?.oneOfOne === "Satoshi") return "ARCANE";
  if (flags?.oneOfOne === "Lucifer") return "CURSED";

  if (flags?.isLegendary) {
    if (mouth === "Sword Of Heaven") return "MELEE";
    return "HEAVY";
  }

  switch (mouth) {
    case "Warfare Mask":
      return "DEFENSIVE";
    case "Bullet":
      return "RANGED";
    case "Smoke Bomb":
      return "EVASIVE";
    case "Fangs":
      return "LIFESTEAL";
    case "Robotic":
      return "ARCANE";
    case "Skull Eats Skull":
      return "CURSED";
    default:
      return "MELEE";
  }
}

export function deriveCommanderProfile(
  traits: CommanderTraits,
  flags?: CommanderFlags
): CommanderDerivedProfile {
  const cardClass = mapSkinToClass(traits.skin, flags);
  const passive = mapEyesToPassive(traits.eyes, flags);
  const subtype = mapHeadwearToSubtype(traits.headwear, flags);
  const combatStyle = mapMouthToCombatStyle(traits.mouth, flags);

  const tags = [
    `SKIN:${traits.skin}`,
    `EYES:${traits.eyes}`,
    `HEADWEAR:${traits.headwear}`,
    `MOUTH:${traits.mouth}`
  ];

  if (flags?.isLegendary) tags.push("LEGENDARY");
  if (flags?.oneOfOne) tags.push(`ONE_OF_ONE:${flags.oneOfOne}`);

  return {
    cardClass,
    passive,
    subtype,
    combatStyle,
    tags
  };
}

export function deriveCommanderStats(
  profile: CommanderDerivedProfile,
  rarityScore: number,
  flags?: CommanderFlags
): { attack: number; health: number; armor: number } {
  let attack = 6;
  let health = 28;
  let armor = 0;

  switch (profile.cardClass) {
    case "TANK":
      attack = 4;
      health = 36;
      armor = 4;
      break;

    case "ASSASSIN":
      attack = 8;
      health = 24;
      armor = 0;
      break;

    case "SPELLCASTER":
      attack = 5;
      health = 27;
      armor = 0;
      break;

    case "NECRO":
      attack = 6;
      health = 28;
      armor = 0;
      break;

    case "CONTROL":
      attack = 5;
      health = 29;
      armor = 2;
      break;

    case "MYTHIC":
      attack = 8;
      health = 32;
      armor = 2;
      break;
  }

  if (profile.combatStyle === "DEFENSIVE") {
    health += 1;
    armor += 1;
  }

  if (profile.combatStyle === "RANGED") {
    attack += 1;
  }

  if (profile.combatStyle === "LIFESTEAL") {
    health += 1;
  }

  if (profile.combatStyle === "ARCANE") {
    attack += 1;
  }

  if (profile.combatStyle === "HEAVY") {
    health += 2;
  }

  if (profile.combatStyle === "CURSED") {
    attack += 1;
  }

  if (profile.passive === "BONUS_RESOURCE") {
    armor += 1;
  }

  if (profile.passive === "TIME_MANIPULATION") {
    attack += 1;
    health += 1;
  }

  if (flags?.isLegendary) {
    attack += 1;
    health += 1;
  }

  if (flags?.oneOfOne) {
    attack += 2;
    health += 2;
    armor += 1;
  }

  if (rarityScore >= 1.25) {
    attack += 1;
    health += 1;
  }

  return { attack, health, armor };
}