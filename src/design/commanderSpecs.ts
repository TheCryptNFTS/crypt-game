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
    name: "Tor of Stone's Grasp",
    faction: "STONE_KEEPERS",
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
    name: "Bulwark Shieldbreaker",
    faction: "IRON_DEFENDERS",
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
    name: "Heartwood of Verdant Oaths",
    faction: "BRONZE_GUARDIANS",
    // Teardown §3/§5: this string is rendered on the ONBOARDING pick card — it
    // MUST match the implemented passive (commanderPassives.ts cmd_bronze_raider,
    // a RUSH grant). The old text described the removed no-burn-violating "deal 1
    // damage" mechanic: a newcomer's first strategic choice was a lie.
    passive: "Raid — units you summon that cost 3 or less gain Rush (they can attack the turn they arrive).",
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
    name: "Cold-Mirror of Forgotten Truths",
    faction: "SILVER_SENTINELS",
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
    name: "Diadem of Dusk's Reign",
    faction: "GOLDEN_SOVEREIGNS",
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
