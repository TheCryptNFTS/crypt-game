export type CommanderTraits = {
    Backgrounds?: string;
    Eyes?: string;
    Headwears?: string;
    Mouth?: string;
    Skins?: string;
    Legendary?: string;
    "One of One"?: string;
  };
  
  export type CommanderProfile = {
    cardClass: string;
    passive: string;
    subtype: string;
    combatStyle: string;
    tags: string[];
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
    profile: CommanderProfile;
    attack: number;
    health: number;
    armor: number;
    abilityText: string;
    tags: string[];
    rarityScore: number;
    powerBand: "STANDARD" | "STRONG" | "MYTHIC";
  };
  
  type CommanderInput = {
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
  
  function scoreInverse(count: number): number {
    if (count <= 1) return 2.5;
    if (count <= 5) return 2.0;
    if (count <= 10) return 1.5;
    if (count <= 25) return 1.0;
    if (count <= 50) return 0.6;
    if (count <= 100) return 0.35;
    return 0.15;
  }
  
  const TRAIT_COUNTS = {
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
    mouth: {
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
    }
  } as const;
  
  function getClassFromTraits(skin: string, eyes: string, headwear: string, mouth: string): string {
    if (skin === "Guardian" || headwear === "Roman Soldier") return "TANK";
    if (skin === "Fast Lane" || eyes === "Piercing") return "ASSASSIN";
    if (skin === "Fortune Teller" || eyes === "Endless Void") return "SPELLCASTER";
    if (skin === "Pure Evil" || mouth === "Fangs") return "NECRO";
    if (skin === "Techno" || eyes === "Jarvis") return "CONTROL";
    if (skin === "Del Muerte" || mouth === "Skull Eats Skull") return "NECRO";
    return "MYTHIC";
  }
  
  function getPassiveFromTraits(skin: string, eyes: string, headwear: string, mouth: string): string {
    if (skin === "Guardian") return "HEALING_AURA";
    if (skin === "Fast Lane") return "IGNORE_ARMOR";
    if (skin === "Fortune Teller") return "FEAR";
    if (skin === "Pure Evil") return "INFERNAL_GATE";
    if (skin === "Techno") return "TECH_SYNC";
    if (skin === "Del Muerte") return "GRAVEYARD_POWER";
    if (skin === "Dead King") return "EXECUTE";
    if (skin === "Time Is All We Have") return "TIME_MANIPULATION";
    if (skin === "Anunnaki") return "SCRY";
    if (skin === "Smooth Operator") return "BONUS_RESOURCE";
    if (skin === "Carved In Hell") return "INFERNAL_GATE";
    if (skin === "Good vs Evil") return "SCRY";
    return "NONE";
  }
  
  function getSubtypeFromTraits(headwear: string, skin: string): string {
    if (headwear === "The Captain") return "PIRATE";
    if (headwear === "Roman Soldier") return "WARRIOR";
    if (headwear === "Fortune Teller") return "OCCULT";
    if (headwear === "Devil Horns") return "SHADOW";
    if (headwear === "Matrix Helmet" || headwear === "The Brainiac") return "TECH";
    if (headwear === "King Crown" || headwear === "Heavy Is The Head") return "ROYAL";
    if (headwear === "Egyptian God") return "DIVINE";
    if (headwear === "Hooded One") return "SHADOW";
    if (headwear === "Clowning Around") return "OCCULT";
    if (skin === "Smooth Operator") return "TECH";
    return "WARRIOR";
  }
  
  function getCombatStyleFromTraits(skin: string, eyes: string, mouth: string): string {
    if (skin === "Guardian") return "DEFENSIVE";
    if (skin === "Fast Lane") return "RANGED";
    if (skin === "Fortune Teller") return "EVASIVE";
    if (skin === "Pure Evil") return "LIFESTEAL";
    if (skin === "Techno") return "ARCANE";
    if (skin === "Del Muerte") return "CURSED";
    if (skin === "Dead King") return "MELEE";
    if (skin === "Time Is All We Have") return "HEAVY";
    if (skin === "Anunnaki") return "HEAVY";
    if (mouth === "Diamond Grill") return "ARCANE";
    if (mouth === "666 Grill") return "CURSED";
    return "MELEE";
  }
  
  function buildRarityScore(
    skin: string,
    eyes: string,
    headwear: string,
    mouth: string,
    isLegendary: boolean,
    oneOfOne: string | null
  ): number {
    const skinScore = scoreInverse(TRAIT_COUNTS.skins[skin as keyof typeof TRAIT_COUNTS.skins] ?? 300);
    const eyesScore = scoreInverse(TRAIT_COUNTS.eyes[eyes as keyof typeof TRAIT_COUNTS.eyes] ?? 300);
    const headwearScore = scoreInverse(
      TRAIT_COUNTS.headwears[headwear as keyof typeof TRAIT_COUNTS.headwears] ?? 300
    );
    const mouthScore = scoreInverse(TRAIT_COUNTS.mouth[mouth as keyof typeof TRAIT_COUNTS.mouth] ?? 300);
  
    let score = skinScore + eyesScore + headwearScore + mouthScore;
  
    if (isLegendary) score += 1.25;
    if (oneOfOne) score += 2.5;
  
    return Number(score.toFixed(2));
  }
  
  function getPowerBand(rarityScore: number): "STANDARD" | "STRONG" | "MYTHIC" {
    if (rarityScore >= 5) return "MYTHIC";
    if (rarityScore >= 3) return "STRONG";
    return "STANDARD";
  }
  
  export function buildCommanderFromTraits(input: CommanderInput): LoadedCommander {
    const skin = input.traits.skin;
    const eyes = input.traits.eyes;
    const headwear = input.traits.headwear;
    const mouth = input.traits.mouth;
    const isLegendary = Boolean(input.isLegendary);
    const oneOfOne = input.oneOfOne ?? null;
  
    const cardClass = getClassFromTraits(skin, eyes, headwear, mouth);
    const passive = getPassiveFromTraits(skin, eyes, headwear, mouth);
    const subtype = getSubtypeFromTraits(headwear, skin);
    const combatStyle = getCombatStyleFromTraits(skin, eyes, mouth);
    const rarityScore = buildRarityScore(skin, eyes, headwear, mouth, isLegendary, oneOfOne);
    const powerBand = getPowerBand(rarityScore);
  
    let attack = 4;
    let health = 28;
    let armor = 0;
  
    if (cardClass === "TANK") {
      attack += 1;
      health += 7;
      armor += 3;
    }
    if (cardClass === "ASSASSIN") {
      attack += 4;
      health -= 3;
    }
    if (cardClass === "SPELLCASTER") {
      attack += 1;
      health -= 1;
    }
    if (cardClass === "NECRO") {
      attack += 2;
      health += 1;
    }
    if (cardClass === "CONTROL") {
      attack += 1;
      health += 1;
      armor += 1;
    }
    if (cardClass === "MYTHIC") {
      attack += 3;
      health += 4;
      armor += 2;
    }
  
    if (powerBand === "STRONG") {
      attack += 1;
      health += 2;
      armor += 1;
    }
  
    if (powerBand === "MYTHIC") {
      attack += 2;
      health += 4;
      armor += 1;
    }
  
    const tags = [
      `SKIN:${skin}`,
      `EYES:${eyes}`,
      `HEADWEAR:${headwear}`,
      `MOUTH:${mouth}`
    ];
  
    if (isLegendary) tags.push("LEGENDARY");
    if (oneOfOne) tags.push(`ONE_OF_ONE:${oneOfOne}`);
  
    const profile: CommanderProfile = {
      cardClass,
      passive,
      subtype,
      combatStyle,
      tags
    };
  
    return {
      id: input.id,
      name: input.name,
      skin,
      eyes,
      headwear,
      mouth,
      isLegendary,
      oneOfOne,
      profile,
      attack,
      health,
      armor,
      abilityText: `Class: ${cardClass} | Passive: ${passive} | Subtype: ${subtype} | Combat: ${combatStyle}`,
      tags,
      rarityScore,
      powerBand
    };
  }