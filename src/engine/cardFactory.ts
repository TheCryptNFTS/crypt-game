export type UnitClass =
  | "TANK"
  | "RANGER"
  | "ASSASSIN"
  | "BRUISER"
  | "NECRO"
  | "CONTROL";

export type UnitPassive =
  | "GUARD"
  | "TAUNT"
  | "RUSH"
  | "EXECUTE_PRESSURE"
  | "LIFESTEAL"
  | "DEATH_BLAST"
  | "BATTLECRY_HERO_HIT"
  | "ARMOR_GAIN";

export type UnitSubtype = "STONE" | "BRONZE" | "OCCULT" | "DIVINE" | "WILD" | "TECH";

export type UnitCombatStyle =
  | "DEFENSIVE"
  | "FAST"
  | "MELEE"
  | "HEAVY"
  | "SACRIFICE";

export type GeneratedUnit = {
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
  generated: {
    source: string;
    cardClass: UnitClass;
    passive: UnitPassive;
    subtype: UnitSubtype;
    combatStyle: UnitCombatStyle;
    rarityScore: number;
  };
};

export type GeneratedSpell = {
  id: string;
  name: string;
  type: "spell";
  faction: string;
  rarity: string;
  cost: number;
  effect:
    | { type: "DAMAGE_UNIT"; value: number }
    | { type: "DRAW_CARDS"; value: number }
    | { type: "BUFF_UNIT"; attack: number; health: number }
    | { type: "HEAL_UNIT"; value: number }
    | { type: "DESTROY_DAMAGED_UNIT" };
  generated: {
    source: string;
    rarityScore: number;
  };
};

export type GeneratedEquipment = {
  id: string;
  name: string;
  type: "equipment";
  faction: string;
  rarity: string;
  cost: number;
  effect: {
    attack: number;
    health: number;
    speed: number;
    armor: number;
  };
  generated: {
    source: string;
    rarityScore: number;
  };
};

type UnitSeed = {
  id: string;
  name: string;
  faction: "STONE_KEEPERS" | "BRONZE_GUARDIANS" | "IRON_DEFENDERS" | "SILVER_SENTINELS" | "GOLDEN_SOVEREIGNS";
  rarity: "common" | "rare";
  source: string;
};

type SpellSeed = {
  id: string;
  name: string;
  faction: "STONE_KEEPERS" | "BRONZE_GUARDIANS" | "IRON_DEFENDERS" | "SILVER_SENTINELS" | "GOLDEN_SOVEREIGNS" | "GODS";
  rarity: "common" | "rare";
  source: string;
};

type EquipmentSeed = {
  id: string;
  name: string;
  faction: "STONE_KEEPERS" | "BRONZE_GUARDIANS" | "IRON_DEFENDERS" | "SILVER_SENTINELS" | "GOLDEN_SOVEREIGNS";
  rarity: "common" | "rare";
  source: string;
};

const DIGITAL_TRAIT_COUNTS: Record<string, number> = {
  Gauntlets: 124,
  Boots: 144,
  Bracers: 155,
  "Crusader Shield": 62,
  Buckler: 152,
  "Stealth Boots": 132,
  "Energy Shield": 28,
  Riot: 53,
  "Riot Shield": 53,
  Axe: 222,
  Revolver: 209,
  "Pipe Dream": 203,
  "Smoke Bomb": 23,
  Katana: 30,
  "Storm Breaker": 36,
  "Lokis Sceptre": 40,
  "Minoru Sceptre": 23,
  "Baby Dragon": 94,
  "Dead Dragon": 115,
  "Dragon Slayer": 101,
  "Odins Raven": 70,
  "Dead Scorpion": 99,
  Octopus: 90,
  "Bong Of Protection": 56,
  Wings: 52,
  Grimoire: 175,
  "Arcane Orb": 173
};

function rarityBucket(score: number): "common" | "rare" {
  return score >= 0.17 ? "rare" : "common";
}

function inverseRarity(count: number): number {
  if (count <= 0) return 0.12;
  return Number((1 / Math.sqrt(count)).toFixed(3));
}

function scoreFromSource(source: string): number {
  return inverseRarity(DIGITAL_TRAIT_COUNTS[source] ?? 140);
}

function deriveUnitIdentity(source: string, faction: "STONE_KEEPERS" | "BRONZE_GUARDIANS" | "IRON_DEFENDERS" | "SILVER_SENTINELS" | "GOLDEN_SOVEREIGNS") {
  const s = source.toLowerCase();

  if (
    s.includes("shield") ||
    s.includes("buckler") ||
    s.includes("gauntlets") ||
    s.includes("bracers")
  ) {
    return {
      cardClass: "TANK" as UnitClass,
      passive: s.includes("shield") ? ("TAUNT" as UnitPassive) : ("GUARD" as UnitPassive),
      subtype: faction === "STONE_KEEPERS" ? ("STONE" as UnitSubtype) : ("BRONZE" as UnitSubtype),
      combatStyle: "DEFENSIVE" as UnitCombatStyle,
      keywords: s.includes("shield") ? ["TAUNT"] : []
    };
  }

  if (s.includes("axe") || s.includes("katana") || s.includes("storm")) {
    return {
      cardClass: "BRUISER" as UnitClass,
      passive: "ARMOR_GAIN" as UnitPassive,
      subtype: faction === "STONE_KEEPERS" ? ("STONE" as UnitSubtype) : ("BRONZE" as UnitSubtype),
      combatStyle: "HEAVY" as UnitCombatStyle,
      keywords: []
    };
  }

  if (s.includes("revolver") || s.includes("pipe")) {
    return {
      cardClass: "ASSASSIN" as UnitClass,
      passive: "EXECUTE_PRESSURE" as UnitPassive,
      subtype: "BRONZE" as UnitSubtype,
      combatStyle: "MELEE" as UnitCombatStyle,
      keywords: []
    };
  }

  if (
    s.includes("dragon") ||
    s.includes("scorpion") ||
    s.includes("raven") ||
    s.includes("octopus")
  ) {
    return {
      cardClass: "NECRO" as UnitClass,
      passive: "DEATH_BLAST" as UnitPassive,
      subtype: "WILD" as UnitSubtype,
      combatStyle: "SACRIFICE" as UnitCombatStyle,
      keywords: ["DEATH_BLAST_2"]
    };
  }

  return {
    cardClass: faction === "STONE_KEEPERS" ? ("TANK" as UnitClass) : ("RANGER" as UnitClass),
    passive: faction === "STONE_KEEPERS" ? ("GUARD" as UnitPassive) : ("RUSH" as UnitPassive),
    subtype: faction === "STONE_KEEPERS" ? ("STONE" as UnitSubtype) : ("BRONZE" as UnitSubtype),
    combatStyle: faction === "STONE_KEEPERS" ? ("DEFENSIVE" as UnitCombatStyle) : ("FAST" as UnitCombatStyle),
    keywords: faction === "BRONZE_GUARDIANS" ? ["RUSH"] : []
  };
}

function deriveUnitStats(
  faction: "STONE_KEEPERS" | "BRONZE_GUARDIANS" | "IRON_DEFENDERS" | "SILVER_SENTINELS" | "GOLDEN_SOVEREIGNS",
  rarity: "common" | "rare",
  cardClass: UnitClass,
  passive: UnitPassive
) {
  let attack = 3;
  let health = faction === "STONE_KEEPERS" ? 12 : 8;
  let speed = faction === "STONE_KEEPERS" ? 2 : 4;
  let armor = 0;

  if (cardClass === "TANK") {
    attack = 2;
    health = rarity === "rare" ? 18 : 15;
    speed = 1;
    armor = rarity === "rare" ? 2 : 1;
  }

  if (cardClass === "RANGER") {
    attack = 4;
    health = 7;
    speed = rarity === "rare" ? 6 : 5;
  }

  if (cardClass === "ASSASSIN") {
    attack = rarity === "rare" ? 6 : 5;
    health = rarity === "rare" ? 8 : 7;
    speed = 4;
  }

  if (cardClass === "BRUISER") {
    attack = rarity === "rare" ? 6 : 5;
    health = rarity === "rare" ? 12 : 10;
    speed = 2;
    armor = rarity === "rare" ? 1 : 0;
  }

  if (cardClass === "NECRO") {
    attack = rarity === "rare" ? 5 : 4;
    health = rarity === "rare" ? 7 : 6;
    speed = 3;
  }

  if (cardClass === "CONTROL") {
    attack = 3;
    health = rarity === "rare" ? 9 : 8;
    speed = 4;
    armor = rarity === "rare" ? 1 : 0;
  }

  if (passive === "RUSH") speed += 1;
  if (passive === "TAUNT") armor += 1;

  return { attack, health, speed, armor };
}

function deriveEquipmentEffect(
  name: string,
  faction: "STONE_KEEPERS" | "BRONZE_GUARDIANS" | "IRON_DEFENDERS" | "SILVER_SENTINELS" | "GOLDEN_SOVEREIGNS",
  rarity: "common" | "rare"
) {
  const s = name.toLowerCase();

  if (s.includes("shield") || s.includes("plate")) {
    return {
      attack: 0,
      health: rarity === "rare" ? 2 : 2,
      speed: 0,
      armor: rarity === "rare" ? 2 : 2
    };
  }

  if (s.includes("boots")) {
    return {
      attack: 0,
      health: 0,
      speed: 2,
      armor: 0
    };
  }

  if (s.includes("axe")) {
    return {
      attack: 2,
      health: 0,
      speed: 0,
      armor: 0
    };
  }

  return {
    attack: faction === "BRONZE_GUARDIANS" ? 1 : 0,
    health: faction === "STONE_KEEPERS" ? 1 : 0,
    speed: 0,
    armor: 0
  };
}

const UNIT_SEEDS: UnitSeed[] = [
  {
    id: "unit_stone_guard",
    name: "Stone Guard",
    faction: "STONE_KEEPERS",
    rarity: "common",
    source: "Bracers"
  },
  {
    id: "unit_shield_bearer",
    name: "Shield Bearer",
    faction: "STONE_KEEPERS",
    rarity: "common",
    source: "Buckler"
  },
  {
    id: "unit_stone_brute",
    name: "Stone Brute",
    faction: "STONE_KEEPERS",
    rarity: "rare",
    source: "Crusader Shield"
  },
  {
    id: "unit_bronze_scout",
    name: "Bronze Scout",
    faction: "BRONZE_GUARDIANS",
    rarity: "common",
    source: "Boots"
  },
  {
    id: "unit_blade_striker",
    name: "Blade Striker",
    faction: "BRONZE_GUARDIANS",
    rarity: "common",
    source: "Revolver"
  },
  {
    id: "unit_berserker",
    name: "Berserker",
    faction: "BRONZE_GUARDIANS",
    rarity: "rare",
    source: "Axe"
  },
  {
    id: "unit_bomb_skull",
    name: "Bomb Skull",
    faction: "BRONZE_GUARDIANS",
    rarity: "rare",
    source: "Dead Dragon"
  },
  {
    id: "unit_shock_raider",
    name: "Shock Raider",
    faction: "BRONZE_GUARDIANS",
    rarity: "rare",
    source: "Storm Breaker"
  }
];

const SPELL_SEEDS: SpellSeed[] = [
  {
    id: "spell_firebolt",
    name: "Firebolt",
    faction: "GODS",
    rarity: "common",
    source: "Arcane Orb"
  },
  {
    id: "spell_insight",
    name: "Insight",
    faction: "GODS",
    rarity: "common",
    source: "Grimoire"
  },
  {
    id: "spell_mend",
    name: "Mend",
    faction: "STONE_KEEPERS",
    rarity: "common",
    source: "Bong Of Protection"
  },
  {
    id: "spell_battle_blessing",
    name: "Battle Blessing",
    faction: "STONE_KEEPERS",
    rarity: "rare",
    source: "Wings"
  },
  {
    id: "spell_execute",
    name: "Execute",
    faction: "BRONZE_GUARDIANS",
    rarity: "rare",
    source: "Dead Scorpion"
  }
];

const EQUIPMENT_SEEDS: EquipmentSeed[] = [
  {
    id: "eq_riot_shield",
    name: "Riot Shield",
    faction: "STONE_KEEPERS",
    rarity: "rare",
    source: "Riot Shield"
  },
  {
    id: "eq_heavy_plate",
    name: "Heavy Plate",
    faction: "STONE_KEEPERS",
    rarity: "common",
    source: "Energy Shield"
  },
  {
    id: "eq_speed_boots",
    name: "Speed Boots",
    faction: "BRONZE_GUARDIANS",
    rarity: "common",
    source: "Stealth Boots"
  },
  {
    id: "eq_axe",
    name: "War Axe",
    faction: "BRONZE_GUARDIANS",
    rarity: "rare",
    source: "Axe"
  }
];

export function buildStarterUnits(): GeneratedUnit[] {
  return UNIT_SEEDS.map((seed) => {
    const rarityScore = scoreFromSource(seed.source);
    const rarity = seed.rarity ?? rarityBucket(rarityScore);
    const identity = deriveUnitIdentity(seed.source, seed.faction);
    const stats = deriveUnitStats(seed.faction, rarity, identity.cardClass, identity.passive);

    const cost =
      identity.cardClass === "RANGER"
        ? 1
        : identity.cardClass === "ASSASSIN"
          ? 3
          : identity.cardClass === "NECRO"
            ? 2
            : identity.cardClass === "BRUISER"
              ? 4
              : rarity === "rare"
                ? 3
                : 2;

    return {
      id: seed.id,
      name: seed.name,
      type: "unit",
      faction: seed.faction,
      rarity,
      cost,
      stats,
      keywords: identity.keywords,
      generated: {
        source: seed.source,
        cardClass: identity.cardClass,
        passive: identity.passive,
        subtype: identity.subtype,
        combatStyle: identity.combatStyle,
        rarityScore
      }
    };
  });
}

export function buildStarterSpells(): GeneratedSpell[] {
  return SPELL_SEEDS.map((seed) => {
    const rarityScore = scoreFromSource(seed.source);
    const rarity = seed.rarity ?? rarityBucket(rarityScore);

    let effect: GeneratedSpell["effect"];

    switch (seed.id) {
      case "spell_firebolt":
        effect = { type: "DAMAGE_UNIT", value: 3 };
        break;
      case "spell_insight":
        effect = { type: "DRAW_CARDS", value: 2 };
        break;
      case "spell_mend":
        effect = { type: "HEAL_UNIT", value: 4 };
        break;
      case "spell_battle_blessing":
        effect = { type: "BUFF_UNIT", attack: 2, health: 2 };
        break;
      case "spell_execute":
        effect = { type: "DESTROY_DAMAGED_UNIT" };
        break;
      default:
        effect = { type: "DAMAGE_UNIT", value: 2 };
        break;
    }

    const cost =
      seed.id === "spell_battle_blessing"
        ? 3
        : seed.id === "spell_execute"
          ? 2
          : 2;

    return {
      id: seed.id,
      name: seed.name,
      type: "spell",
      faction: seed.faction,
      rarity,
      cost,
      effect,
      generated: {
        source: seed.source,
        rarityScore
      }
    };
  });
}

export function buildStarterEquipment(): GeneratedEquipment[] {
  return EQUIPMENT_SEEDS.map((seed) => {
    const rarityScore = scoreFromSource(seed.source);
    const rarity = seed.rarity ?? rarityBucket(rarityScore);
    const effect = deriveEquipmentEffect(seed.name, seed.faction, rarity);

    return {
      id: seed.id,
      name: seed.name,
      type: "equipment",
      faction: seed.faction,
      rarity,
      cost: 2,
      effect,
      generated: {
        source: seed.source,
        rarityScore
      }
    };
  });
}