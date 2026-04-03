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

export type UnitSubtype = "STONE" | "BRONZE" | "SHADOW" | "TECH";

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
  faction: "stone" | "bronze";
  rarity: "common" | "rare";
  source: string;
};

type SpellSeed = {
  id: string;
  name: string;
  faction: "stone" | "bronze" | "neutral";
  rarity: "common" | "rare";
  source: string;
};

type EquipmentSeed = {
  id: string;
  name: string;
  faction: "stone" | "bronze";
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

function deriveUnitIdentity(source: string, faction: "stone" | "bronze") {
  const s = source.toLowerCase();

  if (s.includes("shield") || s.includes("buckler") || s.includes("gauntlets") || s.includes("bracers")) {
    return {
      cardClass: "TANK" as UnitClass,
      passive: s.includes("shield") ? ("TAUNT" as UnitPassive) : ("GUARD" as UnitPassive),
      subtype: faction === "stone" ? ("STONE" as UnitSubtype) : ("BRONZE" as UnitSubtype),
      combatStyle: "DEFENSIVE" as UnitCombatStyle,
      keywords: s.includes("shield") ? ["TAUNT"] : []
    };
  }

  if (s.includes("axe") || s.includes("katana") || s.includes("storm")) {
    return {
      cardClass: "BRUISER" as UnitClass,
      passive: "ARMOR_GAIN" as UnitPassive,
      subtype: faction === "stone" ? ("STONE" as UnitSubtype) : ("BRONZE" as UnitSubtype),
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

  if (s.includes("dragon") || s.includes("scorpion") || s.includes("raven") || s.includes("octopus")) {
    return {
      cardClass: "NECRO" as UnitClass,
      passive: "DEATH_BLAST" as UnitPassive,
      subtype: "BRONZE" as UnitSubtype,
      combatStyle: "SACRIFICE" as UnitCombatStyle,
      keywords: ["DEATH_BLAST_2"]
    };
  }

  return {
    cardClass: faction === "stone" ? ("TANK" as UnitClass) : ("RANGER" as UnitClass),
    passive: faction === "stone" ? ("GUARD" as UnitPassive) : ("RUSH" as UnitPassive),
    subtype: faction === "stone" ? ("STONE" as UnitSubtype) : ("BRONZE" as UnitSubtype),
    combatStyle: faction === "stone" ? ("DEFENSIVE" as UnitCombatStyle) : ("FAST" as UnitCombatStyle),
    keywords: faction === "bronze" ? ["RUSH"] : []
  };
}

function deriveUnitStats(
  faction: "stone" | "bronze",
  rarity: "common" | "rare",
  cardClass: UnitClass,
  passive: UnitPassive
) {
  let attack = faction === "stone" ? 3 : 3;
  let health = faction === "stone" ? 12 : 8;
  let speed = faction === "stone" ? 2 : 4;
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

function deriveUnitCost(cardClass: UnitClass, rarity: "common" | "rare") {
  if (cardClass === "RANGER") return 1;
  if (cardClass === "NECRO") return rarity === "rare" ? 2 : 2;
  if (cardClass === "CONTROL") return 2;
  if (cardClass === "TANK") return rarity === "rare" ? 3 : 2;
  if (cardClass === "ASSASSIN") return 3;
  if (cardClass === "BRUISER") return 4;
  return 3;
}

export function buildGeneratedUnit(seed: UnitSeed): GeneratedUnit {
  const rarityScore = scoreFromSource(seed.source);
  const finalRarity = seed.rarity ?? rarityBucket(rarityScore);

  const identity = deriveUnitIdentity(seed.source, seed.faction);
  const stats = deriveUnitStats(
    seed.faction,
    finalRarity,
    identity.cardClass,
    identity.passive
  );

  return {
    id: seed.id,
    name: seed.name,
    type: "unit",
    faction: seed.faction,
    rarity: finalRarity,
    cost: deriveUnitCost(identity.cardClass, finalRarity),
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
}

export function buildGeneratedSpell(seed: SpellSeed): GeneratedSpell {
  const rarityScore = scoreFromSource(seed.source);

  if (seed.source === "Grimoire") {
    return {
      id: seed.id,
      name: seed.name,
      type: "spell",
      faction: seed.faction,
      rarity: seed.rarity,
      cost: 2,
      effect: { type: "DRAW_CARDS", value: 2 },
      generated: { source: seed.source, rarityScore }
    };
  }

  if (seed.source === "Arcane Orb") {
    return {
      id: seed.id,
      name: seed.name,
      type: "spell",
      faction: seed.faction,
      rarity: seed.rarity,
      cost: 2,
      effect: { type: "DAMAGE_UNIT", value: 3 },
      generated: { source: seed.source, rarityScore }
    };
  }

  if (seed.source === "Bong Of Protection") {
    return {
      id: seed.id,
      name: seed.name,
      type: "spell",
      faction: seed.faction,
      rarity: seed.rarity,
      cost: 2,
      effect: { type: "HEAL_UNIT", value: 4 },
      generated: { source: seed.source, rarityScore }
    };
  }

  return {
    id: seed.id,
    name: seed.name,
    type: "spell",
    faction: seed.faction,
    rarity: seed.rarity,
    cost: 3,
    effect: { type: "BUFF_UNIT", attack: 2, health: 2 },
    generated: { source: seed.source, rarityScore }
  };
}

export function buildGeneratedEquipment(seed: EquipmentSeed): GeneratedEquipment {
  const rarityScore = scoreFromSource(seed.source);

  if (seed.source.includes("Shield") || seed.source === "Buckler") {
    return {
      id: seed.id,
      name: seed.name,
      type: "equipment",
      faction: seed.faction,
      rarity: seed.rarity,
      cost: 2,
      effect: { attack: 0, health: 2, speed: 0, armor: 2 },
      generated: { source: seed.source, rarityScore }
    };
  }

  if (seed.source.includes("Boots")) {
    return {
      id: seed.id,
      name: seed.name,
      type: "equipment",
      faction: seed.faction,
      rarity: seed.rarity,
      cost: 2,
      effect: { attack: 0, health: 0, speed: 2, armor: 0 },
      generated: { source: seed.source, rarityScore }
    };
  }

  return {
    id: seed.id,
    name: seed.name,
    type: "equipment",
    faction: seed.faction,
    rarity: seed.rarity,
    cost: 2,
    effect: { attack: 2, health: 0, speed: 0, armor: 0 },
    generated: { source: seed.source, rarityScore }
  };
}

export function buildStarterUnits(): GeneratedUnit[] {
  const seeds: UnitSeed[] = [
    { id: "unit_stone_guard", name: "Stone Guard", faction: "stone", rarity: "common", source: "Bracers" },
    { id: "unit_shield_bearer", name: "Shield Bearer", faction: "stone", rarity: "common", source: "Buckler" },
    { id: "unit_stone_brute", name: "Stone Brute", faction: "stone", rarity: "rare", source: "Crusader Shield" },
    { id: "unit_bronze_scout", name: "Bronze Scout", faction: "bronze", rarity: "common", source: "Boots" },
    { id: "unit_blade_striker", name: "Blade Striker", faction: "bronze", rarity: "common", source: "Revolver" },
    { id: "unit_berserker", name: "Berserker", faction: "bronze", rarity: "rare", source: "Axe" },
    { id: "unit_bomb_skull", name: "Bomb Skull", faction: "bronze", rarity: "rare", source: "Dead Dragon" },
    { id: "unit_shock_raider", name: "Shock Raider", faction: "bronze", rarity: "rare", source: "Storm Breaker" }
  ];

  return seeds.map(buildGeneratedUnit);
}

export function buildStarterSpells(): GeneratedSpell[] {
  const seeds: SpellSeed[] = [
    { id: "spell_firebolt", name: "Firebolt", faction: "neutral", rarity: "common", source: "Arcane Orb" },
    { id: "spell_insight", name: "Insight", faction: "neutral", rarity: "common", source: "Grimoire" },
    { id: "spell_mend", name: "Mend", faction: "stone", rarity: "common", source: "Bong Of Protection" },
    { id: "spell_battle_blessing", name: "Battle Blessing", faction: "stone", rarity: "rare", source: "Wings" },
    { id: "spell_execute", name: "Execute", faction: "bronze", rarity: "rare", source: "Dead Scorpion" }
  ];

  const spells = seeds.map(buildGeneratedSpell);

  return spells.map((spell) => {
    if (spell.id === "spell_execute") {
      return {
        ...spell,
        cost: 2,
        effect: { type: "DESTROY_DAMAGED_UNIT" as const }
      };
    }

    return spell;
  });
}

export function buildStarterEquipment(): GeneratedEquipment[] {
  const seeds: EquipmentSeed[] = [
    { id: "eq_riot_shield", name: "Riot Shield", faction: "stone", rarity: "rare", source: "Riot Shield" },
    { id: "eq_heavy_plate", name: "Heavy Plate", faction: "stone", rarity: "common", source: "Energy Shield" },
    { id: "eq_speed_boots", name: "Speed Boots", faction: "bronze", rarity: "common", source: "Stealth Boots" },
    { id: "eq_axe", name: "War Axe", faction: "bronze", rarity: "rare", source: "Axe" }
  ];

  return seeds.map(buildGeneratedEquipment);
}