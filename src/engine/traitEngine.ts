export type CommanderClass =
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

export type CombatStyle =
  | "DEFENSIVE"
  | "RANGED"
  | "EVASIVE"
  | "LIFESTEAL"
  | "ARCANE"
  | "CURSED"
  | "MELEE"
  | "HEAVY"
  | "FAST";

export type PowerBand = "STANDARD" | "STRONG" | "MYTHIC";

export type LoadedCommander = {
  id: string;
  name: string;
  skin: string;
  eyes: string;
  headwear: string;
  mouth: string;
  isLegendary: boolean;
  oneOfOne: string | null;
  profile: {
    cardClass: CommanderClass;
    passive: CommanderPassive;
    subtype: CommanderSubtype;
    combatStyle: CombatStyle;
    tags: string[];
  };
  attack: number;
  health: number;
  armor: number;
  abilityText: string;
  tags: string[];
  rarityScore: number;
  powerBand: PowerBand;
};

type CommanderTraitInput = {
  id: string;
  name: string;
  traits: {
    skin: string;
    eyes: string;
    headwear: string;
    mouth: string;
  };
  isLegendary?: boolean;
  oneOfOne?: string;
};

const SKIN_COUNTS: Record<string, number> = {
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
};

const EYE_COUNTS: Record<string, number> = {
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
};

const HEADWEAR_COUNTS: Record<string, number> = {
  "Roman Soldier": 30,
  "The Captain": 40,
  "Fortune Teller": 36,
  "Devil Horns": 73,
  "Matrix Helmet": 35,
  "Hooded One": 113,
  "King Crown": 64,
  "Heavy Is The Head": 47,
  "Egyptian God": 13,
  "Clowning Around": 33,
  "The Brainiac": 9
};

const MOUTH_COUNTS: Record<string, number> = {
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
};

function inverseRarity(count: number): number {
  if (count <= 0) return 0.5;
  return 1 / Math.sqrt(count);
}

function getTraitRarityScore(
  skin: string,
  eyes: string,
  headwear: string,
  mouth: string,
  isLegendary: boolean,
  oneOfOne: string | null
): number {
  const skinScore = inverseRarity(SKIN_COUNTS[skin] ?? 120);
  const eyesScore = inverseRarity(EYE_COUNTS[eyes] ?? 120);
  const headwearScore = inverseRarity(HEADWEAR_COUNTS[headwear] ?? 120);
  const mouthScore = inverseRarity(MOUTH_COUNTS[mouth] ?? 120);

  let score = (skinScore + eyesScore + headwearScore + mouthScore) * 5.25;

  if (isLegendary) score += 0.18;
  if (oneOfOne) score += 0.65;

  return Number(score.toFixed(2));
}

function getPowerBand(score: number): PowerBand {
  if (score >= 1.15) return "MYTHIC";
  if (score >= 0.65) return "STRONG";
  return "STANDARD";
}

function getClassFromTraits(
  skin: string,
  eyes: string,
  headwear: string,
  mouth: string,
  isLegendary: boolean,
  oneOfOne: string | null
): CommanderClass {
  if (oneOfOne || isLegendary) return "MYTHIC";
  if (skin === "Guardian" || mouth === "Warfare Mask") return "TANK";
  if (skin === "Fast Lane" || eyes === "Piercing" || mouth === "Bullet") return "ASSASSIN";
  if (skin === "Fortune Teller" || eyes === "Endless Void") return "SPELLCASTER";
  if (skin === "Pure Evil" || eyes === "In Lucifer We Trust" || mouth === "Fangs") return "NECRO";
  if (skin === "Techno" || eyes === "Jarvis" || mouth === "Robotic") return "CONTROL";
  return "CONTROL";
}

function getPassiveFromTraits(
  skin: string,
  eyes: string,
  headwear: string,
  mouth: string,
  isLegendary: boolean,
  oneOfOne: string | null
): CommanderPassive {
  if (skin === "Guardian") return "HEALING_AURA";
  if (skin === "Fast Lane" || mouth === "Bullet") return "IGNORE_ARMOR";
  if (skin === "Fortune Teller" || eyes === "Endless Void") return "FEAR";
  if (skin === "Pure Evil" || mouth === "Fangs" || oneOfOne === "Lucifer") return "INFERNAL_GATE";
  if (skin === "Techno" || mouth === "Robotic") return "TECH_SYNC";
  if (skin === "Del Muerte" || eyes === "I See Dead People") return "GRAVEYARD_POWER";
  if (mouth === "Sword Of Heaven") return "EXECUTE";
  if (eyes === "Time Warp" || skin === "Time Is All We Have") return "TIME_MANIPULATION";
  if (eyes === "Looking Into The Future") return "SCRY";
  if (oneOfOne === "Satoshi") return "BONUS_RESOURCE";
  if (isLegendary) return "SCRY";
  return "HEALING_AURA";
}

function getSubtypeFromTraits(
  skin: string,
  headwear: string,
  eyes: string,
  mouth: string
): CommanderSubtype {
  if (skin === "Guardian" || headwear === "Roman Soldier") return "WARRIOR";
  if (skin === "Fast Lane" || headwear === "The Captain") return "PIRATE";
  if (skin === "Fortune Teller" || headwear === "Fortune Teller") return "OCCULT";
  if (skin === "Pure Evil" || headwear === "Devil Horns" || mouth === "Fangs") return "SHADOW";
  if (skin === "Techno" || eyes === "Jarvis" || headwear === "Matrix Helmet") return "TECH";
  if (headwear === "King Crown" || headwear === "Heavy Is The Head") return "ROYAL";
  if (skin === "Anunnaki" || headwear === "Egyptian God") return "DIVINE";
  return "WARRIOR";
}

function getCombatStyle(
  cardClass: CommanderClass,
  passive: CommanderPassive,
  subtype: CommanderSubtype
): CombatStyle {
  if (cardClass === "TANK") return "DEFENSIVE";
  if (cardClass === "ASSASSIN") return "RANGED";
  if (cardClass === "SPELLCASTER") return "EVASIVE";
  if (cardClass === "CONTROL" && subtype === "TECH") return "ARCANE";
  if (cardClass === "NECRO" && passive === "INFERNAL_GATE") return "LIFESTEAL";
  if (cardClass === "NECRO") return "CURSED";
  if (cardClass === "MYTHIC" && passive === "EXECUTE") return "MELEE";
  if (cardClass === "MYTHIC") return "HEAVY";
  return "FAST";
}

function buildBaseStats(
  cardClass: CommanderClass,
  passive: CommanderPassive,
  powerBand: PowerBand
) {
  let attack = 5;
  let health = 28;
  let armor = 0;

  if (cardClass === "TANK") {
    attack = 4;
    health = 35;
    armor = 4;
  } else if (cardClass === "ASSASSIN") {
    attack = 8;
    health = 24;
    armor = 0;
  } else if (cardClass === "SPELLCASTER") {
    attack = 5;
    health = 27;
    armor = 0;
  } else if (cardClass === "NECRO") {
    attack = 6;
    health = 28;
    armor = 0;
  } else if (cardClass === "CONTROL") {
    attack = 6;
    health = 29;
    armor = 2;
  } else if (cardClass === "MYTHIC") {
    attack = 9;
    health = 33;
    armor = 2;
  }

  if (passive === "HEALING_AURA") health += 2;
  if (passive === "IGNORE_ARMOR") attack += 1;
  if (passive === "BONUS_RESOURCE") armor += 1;
  if (passive === "INFERNAL_GATE") health += 1;
  if (passive === "TIME_MANIPULATION") health += 3;

  if (powerBand === "STRONG") {
    health += 0;
    armor += 1;
  }

  if (powerBand === "MYTHIC") {
    attack += 2;
    health += 2;
    armor += 1;
  }

  return { attack, health, armor };
}

export function buildCommanderFromTraits(input: CommanderTraitInput): LoadedCommander {
  const skin = input.traits.skin;
  const eyes = input.traits.eyes;
  const headwear = input.traits.headwear;
  const mouth = input.traits.mouth;
  const isLegendary = !!input.isLegendary;
  const oneOfOne = input.oneOfOne ?? null;

  const rarityScore = getTraitRarityScore(
    skin,
    eyes,
    headwear,
    mouth,
    isLegendary,
    oneOfOne
  );

  const powerBand = getPowerBand(rarityScore);
  const cardClass = getClassFromTraits(skin, eyes, headwear, mouth, isLegendary, oneOfOne);
  const passive = getPassiveFromTraits(skin, eyes, headwear, mouth, isLegendary, oneOfOne);
  const subtype = getSubtypeFromTraits(skin, headwear, eyes, mouth);
  const combatStyle = getCombatStyle(cardClass, passive, subtype);
  const stats = buildBaseStats(cardClass, passive, powerBand);

  const tags = [
    `SKIN:${skin}`,
    `EYES:${eyes}`,
    `HEADWEAR:${headwear}`,
    `MOUTH:${mouth}`,
    ...(isLegendary ? ["LEGENDARY"] : []),
    ...(oneOfOne ? [`ONE_OF_ONE:${oneOfOne}`] : [])
  ];

  return {
    id: input.id,
    name: input.name,
    skin,
    eyes,
    headwear,
    mouth,
    isLegendary,
    oneOfOne,
    profile: {
      cardClass,
      passive,
      subtype,
      combatStyle,
      tags
    },
    attack: stats.attack,
    health: stats.health,
    armor: stats.armor,
    abilityText: `Class: ${cardClass} | Passive: ${passive} | Subtype: ${subtype} | Combat: ${combatStyle}`,
    tags,
    rarityScore,
    powerBand
  };
}