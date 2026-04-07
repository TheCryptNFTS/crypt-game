export type CommanderOneOfOneRule = {
  value: string;
  effectType: string;
  summary: string;
  bonus?: {
    attack?: number;
    health?: number;
    armor?: number;
    crit?: number;
    speed?: number;
    utility?: number;
  };
};

export const COMMANDER_ONE_OF_ONE_RULES: CommanderOneOfOneRule[] = [
  {
    value: "Diamond Damien",
    effectType: "diamond_resilience",
    summary: "High-value resilience, polish, and premium survivability pressure.",
    bonus: { armor: 2, health: 1, utility: 1 }
  },
  {
    value: "Grim Reaper",
    effectType: "death_execute",
    summary: "Execution-heavy death avatar with strong finisher pressure.",
    bonus: { attack: 2, crit: 1, utility: 1 }
  },
  {
    value: "Harley",
    effectType: "chaos_trickster",
    summary: "Wild tempo, mind games, and disruptive chaos pressure.",
    bonus: { speed: 1, utility: 2 }
  },
  {
    value: "Hear,-Speak,-See-No-Evil",
    effectType: "silence_denial",
    summary: "Silence, concealment, information denial, and distorted control.",
    bonus: { utility: 3 }
  },
  {
    value: "I am Death",
    effectType: "death_incarnate",
    summary: "Overwhelming inevitability and fatal-pressure identity.",
    bonus: { attack: 2, health: 1, utility: 2 }
  },
  {
    value: "I am Death - Pink",
    effectType: "death_variant",
    summary: "Variant death-pressure profile with stylised lethal identity.",
    bonus: { attack: 2, utility: 2 }
  },
  {
    value: "King Of Kings",
    effectType: "supreme_authority",
    summary: "Top-tier authority, command aura, and dominance scaling.",
    bonus: { health: 2, armor: 1, utility: 2 }
  },
  {
    value: "King Tomb",
    effectType: "royal_entomb",
    summary: "Royal tomb authority with burial and grave-control pressure.",
    bonus: { health: 2, utility: 2 }
  },
  {
    value: "Lucifer",
    effectType: "fallen_corruption",
    summary: "Corruption, temptation, infernal leverage, and dark pressure.",
    bonus: { attack: 2, utility: 2 }
  },
  {
    value: "Satoshi",
    effectType: "genesis_system",
    summary: "Origin-system control tied to creation, chain authority, and value leverage.",
    bonus: { utility: 3, crit: 1 }
  },
  {
    value: "Skeletor",
    effectType: "dark_arcane",
    summary: "Villainous arcane force with dark spell pressure and domination energy.",
    bonus: { attack: 1, utility: 3 }
  },
  {
    value: "Skull Heart",
    effectType: "undead_core",
    summary: "Undead sustain and death-driven endurance mechanics.",
    bonus: { health: 2, utility: 2 }
  },
  {
    value: "Skull Island",
    effectType: "territory_curse",
    summary: "Zone-control identity built around cursed territory and pressure.",
    bonus: { health: 1, utility: 3 }
  },
  {
    value: "T2",
    effectType: "machine_precision",
    summary: "Machine inevitability, targeting precision, and cold future-force logic.",
    bonus: { crit: 1, utility: 3 }
  },
  {
    value: "The Deceiver",
    effectType: "perfect_deception",
    summary: "High-end deception, misdirection, and enemy-action distortion.",
    bonus: { utility: 4 }
  },
  {
    value: "Walter",
    effectType: "volatile_alchemy",
    summary: "Explosive setup, chemical volatility, and unstable payoff mechanics.",
    bonus: { attack: 1, utility: 2 }
  },
  {
    value: "Yesterday is history",
    effectType: "time_reset",
    summary: "Time-warping identity built around resets, memory, and temporal pressure.",
    bonus: { utility: 3, speed: 1 }
  }
];
