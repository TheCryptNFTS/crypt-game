export const FACTION_MECHANICS = {
  STONE: {
    identity: "durability_control",
    rules: [
      "GUARD units gain priority in curated selection",
      "artifact effects may add survivability",
      "equipment bias toward armor and health"
    ]
  },
  IRON: {
    identity: "equipment_tempo",
    rules: [
      "equipment density matters most",
      "weapon-style bonuses bias attack and speed",
      "tempo units preferred over pure tanks"
    ]
  },
  BRONZE: {
    identity: "rush_pressure",
    rules: [
      "RUSH density matters most",
      "low-cost aggression prioritized",
      "curve must open early"
    ]
  },
  SILVER: {
    identity: "artifact_arcane_value",
    rules: [
      "artifact count matters most",
      "ARCANE support gets priority",
      "midgame value over raw aggression"
    ]
  },
  GOLD: {
    identity: "elite_midrange",
    rules: [
      "higher-quality units preferred",
      "fewer weak fillers",
      "stronger 4-5 cost bodies prioritized"
    ]
  }
} as const;
