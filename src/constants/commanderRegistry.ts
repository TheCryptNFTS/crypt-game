export type CommanderPowerProfile = {
  id: string;
  displayName: string;
  nftKey?: string;
  passiveSummary: string;
  startOfGameBonus: {
    energyBonus: number;
    armorBonus: number;
    healthBonus: number;
    note: string;
  };
  tags?: string[];
};

export const COMMANDER_REGISTRY: Record<string, CommanderPowerProfile> = {
  cmd_stone_warden: {
    id: "cmd_stone_warden",
    displayName: "Stonekeepers",
    passiveSummary: "Tank-oriented commander identity. Built for sustain, board stickiness, and durable setup.",
    startOfGameBonus: {
      energyBonus: 0,
      armorBonus: 1,
      healthBonus: 2,
      note: "Extra sustain and frontline durability"
    },
    tags: ["tank", "sustain", "frontline"]
  },
  cmd_bronze_raider: {
    id: "cmd_bronze_raider",
    displayName: "Bronze Guardians",
    passiveSummary: "Aggressive commander identity. Built for pressure, tempo, and cleaner trades.",
    startOfGameBonus: {
      energyBonus: 0,
      armorBonus: 0,
      healthBonus: 0,
      note: "Aggressive commander. No free durability."
    },
    tags: ["aggro", "tempo", "pressure"]
  }
};
