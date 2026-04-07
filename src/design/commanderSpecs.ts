import type { FactionCode } from "./factionIdentity";

export type CommanderSpec = {
  id: string;
  name: string;
  faction: FactionCode;
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
    passive: "+1 durability pressure for guard-style boards",
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
    passive: "weapon/tempo pressure",
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
    passive: "rush openings and pressure",
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
    passive: "artifact/arcane value",
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
    passive: "elite scaling and top-end value",
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
