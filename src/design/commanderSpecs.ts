import type { FactionCode } from "./factionIdentity";

export type CommanderSpec = {
  id: string;
  name: string;
  faction: FactionCode | null;
  passive: string;
  deckRules: {
    exactFaction: boolean;
    maxGodCards: number;
    deckSize: number;
    minUnits: number;
    minEquipment: number;
    minArtifacts: number;
  };
};

export const COMMANDER_SPECS: Record<string, CommanderSpec> = {
  cmd_stone_warden: {
    id: "cmd_stone_warden",
    name: "Stone Warden",
    faction: null,
    passive: "Bulwark — units you summon with Guard enter play with +0/+2.",
    deckRules: {
      exactFaction: false,
      maxGodCards: 1,
      deckSize: 30,
      minUnits: 18,
      minEquipment: 4,
      minArtifacts: 2
    }
  },
  cmd_iron_warlord: {
    id: "cmd_iron_warlord",
    name: "Iron Warlord",
    faction: null,
    passive: "Warmonger — whenever you equip a unit, it gains +1 Attack.",
    deckRules: {
      exactFaction: false,
      maxGodCards: 1,
      deckSize: 30,
      minUnits: 18,
      minEquipment: 5,
      minArtifacts: 2
    }
  },
  cmd_bronze_raider: {
    id: "cmd_bronze_raider",
    name: "Bronze Raider",
    faction: null,
    passive: "Raid — whenever you summon a unit, deal 1 damage to the enemy nexus.",
    deckRules: {
      exactFaction: false,
      maxGodCards: 1,
      deckSize: 30,
      minUnits: 20,
      minEquipment: 4,
      minArtifacts: 1
    }
  },
  cmd_silver_oracle: {
    id: "cmd_silver_oracle",
    name: "Silver Oracle",
    faction: null,
    passive: "Foresight — at the start of your turn, Scry 2 (reorder your top 2 cards by cost).",
    deckRules: {
      exactFaction: false,
      maxGodCards: 1,
      deckSize: 30,
      minUnits: 17,
      minEquipment: 4,
      minArtifacts: 3
    }
  },
  cmd_golden_emperor: {
    id: "cmd_golden_emperor",
    name: "Golden Emperor",
    faction: null,
    passive: "Opulence — units you summon that cost 5 or more enter play with +1/+1.",
    deckRules: {
      exactFaction: false,
      maxGodCards: 1,
      deckSize: 30,
      minUnits: 18,
      minEquipment: 4,
      minArtifacts: 2
    }
  }
};
