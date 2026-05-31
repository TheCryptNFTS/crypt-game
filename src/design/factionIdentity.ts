export type FactionCode =
  | "STONE_KEEPERS"
  | "IRON_DEFENDERS"
  | "BRONZE_GUARDIANS"
  | "SILVER_SENTINELS"
  | "GOLDEN_SOVEREIGNS"
  | "GODS";

export type FactionIdentity = {
  faction: FactionCode;
  fantasy: string;
  preferredKeywords: string[];
  bannedKeywords: string[];
  curveBias: {
    low: number;
    mid: number;
    high: number;
  };
  statBias: {
    attack: number;
    health: number;
    armor: number;
    speed: number;
  };
  preferredSubtypes: string[];
  notes: string;
};

export const FACTION_IDENTITIES: Record<FactionCode, FactionIdentity> = {
  STONE_KEEPERS: {
    faction: "STONE_KEEPERS",
    fantasy: "durable guardians and anchored midrange fighters",
    preferredKeywords: ["GUARD", "CRUSH"],
    bannedKeywords: ["TECH"],
    curveBias: { low: 0.9, mid: 1.2, high: 1.0 },
    statBias: { attack: 0.95, health: 1.2, armor: 1.25, speed: 0.85 },
    preferredSubtypes: ["armor", "hybrid"],
    notes: "stone should feel hard to remove, stable, honest, oppressive on board"
  },
  IRON_DEFENDERS: {
    faction: "IRON_DEFENDERS",
    fantasy: "weapon-heavy tempo attackers",
    preferredKeywords: ["RUSH", "CRUSH", "TECH"],
    bannedKeywords: ["ARCANE"],
    curveBias: { low: 1.1, mid: 1.15, high: 0.85 },
    statBias: { attack: 1.2, health: 0.95, armor: 1.0, speed: 1.0 },
    preferredSubtypes: ["weapon", "hybrid"],
    notes: "iron should feel armed, sharp, immediate, tempo-positive"
  },
  BRONZE_GUARDIANS: {
    faction: "BRONZE_GUARDIANS",
    fantasy: "aggressive skirmishers and fast pressure",
    preferredKeywords: ["RUSH", "QUICKSTEP", "HUNT"],
    bannedKeywords: ["GUARD"],
    curveBias: { low: 1.35, mid: 0.95, high: 0.7 },
    statBias: { attack: 1.15, health: 0.9, armor: 0.8, speed: 1.25 },
    preferredSubtypes: ["weapon", "hybrid", "creature"],
    notes: "bronze should open fast and punish slow starts"
  },
  SILVER_SENTINELS: {
    faction: "SILVER_SENTINELS",
    fantasy: "arcane tricksters with evasive tools and artifacts",
    preferredKeywords: ["ARCANE", "FLYING"],
    bannedKeywords: ["CRUSH"],
    curveBias: { low: 1.0, mid: 1.05, high: 1.0 },
    statBias: { attack: 0.95, health: 0.95, armor: 0.85, speed: 1.15 },
    preferredSubtypes: ["artifact", "metaverse", "hybrid"],
    notes: "silver should feel slippery, clever, technical, spell-adjacent"
  },
  GOLDEN_SOVEREIGNS: {
    faction: "GOLDEN_SOVEREIGNS",
    fantasy: "elite finishers, premium bodies, and command presence",
    preferredKeywords: ["COMMAND", "MYTHIC", "GUARD"],
    bannedKeywords: ["QUICKSTEP"],
    curveBias: { low: 0.75, mid: 1.05, high: 1.35 },
    statBias: { attack: 1.15, health: 1.05, armor: 1.1, speed: 0.9 },
    preferredSubtypes: ["hybrid", "artifact", "armor"],
    notes: "gold should feel premium, slower, powerful, top-end oriented"
  },
  GODS: {
    faction: "GODS",
    fantasy: "mythic splash cards with unfair presence but hard restrictions",
    preferredKeywords: ["MYTHIC", "FLYING", "COMMAND", "ARCANE"],
    bannedKeywords: [],
    curveBias: { low: 0.2, mid: 0.5, high: 2.0 },
    statBias: { attack: 1.35, health: 1.3, armor: 1.15, speed: 1.0 },
    preferredSubtypes: ["artifact", "creature", "hybrid"],
    notes: "god cards should be rare, loud, and capped hard"
  }
};
