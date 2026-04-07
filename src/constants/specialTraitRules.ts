export type SpecialTraitRule = {
  category: "God" | "One of One";
  value: string;
  effectType: string;
  summary: string;
};

export const SPECIAL_TRAIT_RULES: SpecialTraitRule[] = [
  {
    category: "God",
    value: "Anubis",
    effectType: "grave_judgment",
    summary: "Death and graveyard specialist with soul-weighing and resurrection-pressure themes."
  },
  {
    category: "God",
    value: "Anunnaki",
    effectType: "cosmic_origin",
    summary: "Ancient cosmic force with creator-tier scaling and reality-bending effects."
  },
  {
    category: "God",
    value: "Aphrodite",
    effectType: "charm_control",
    summary: "Charm, manipulation, allure, and enemy-redirection mechanics."
  },
  {
    category: "God",
    value: "Hades",
    effectType: "underworld_drain",
    summary: "Underworld ruler built around grave recursion, drain, and inevitability."
  },
  {
    category: "God",
    value: "Loki",
    effectType: "trickster_chaos",
    summary: "Trickster deity focused on swaps, deception, randomness, and control."
  },
  {
    category: "God",
    value: "Odin",
    effectType: "rune_wisdom",
    summary: "Rune, foresight, command, and tactical war-god mechanics."
  },
  {
    category: "God",
    value: "Poseidon",
    effectType: "tidal_control",
    summary: "Flood, displacement, sea pressure, and wave-based battlefield control."
  },
  {
    category: "God",
    value: "Thor",
    effectType: "thunder_burst",
    summary: "Storm, hammer impact, shock, and explosive frontline punishment."
  },
  {
    category: "God",
    value: "Vishnu",
    effectType: "preservation_cycle",
    summary: "Preservation, order, renewal, and stabilising divine recursion."
  },
  {
    category: "God",
    value: "Zeus",
    effectType: "sky_judgment",
    summary: "Authority, lightning punishment, and overextension control."
  },

  {
    category: "One of One",
    value: "Crypt Keeper",
    effectType: "grave_warden",
    summary: "Legendary keeper identity with tomb, sealing, and grave-control mechanics."
  },
  {
    category: "One of One",
    value: "Darius",
    effectType: "warlord_command",
    summary: "Aggressive warlord identity focused on command and frontline pressure."
  },
  {
    category: "One of One",
    value: "Diamond Damien",
    effectType: "diamond_resilience",
    summary: "Premium resilience and brilliance-based defensive pressure."
  },
  {
    category: "One of One",
    value: "Good vs Evil",
    effectType: "duality_switch",
    summary: "Dual-mode identity that shifts between opposing mechanical states."
  },
  {
    category: "One of One",
    value: "Grim Reaper",
    effectType: "death_execute",
    summary: "Execution-heavy death avatar with finisher pressure."
  },
  {
    category: "One of One",
    value: "Grim Reaper 2079",
    effectType: "cyber_execute",
    summary: "Futuristic execution profile blending death and cyber precision."
  },
  {
    category: "One of One",
    value: "Harley",
    effectType: "chaos_trickster",
    summary: "Wild tempo, volatility, and disruption-focused legendary identity."
  },
  {
    category: "One of One",
    value: "Hear, Speak, See No Evil",
    effectType: "silence_denial",
    summary: "Denial, silence, concealment, and distorted information mechanics."
  },
  {
    category: "One of One",
    value: "I Am Death",
    effectType: "death_incarnate",
    summary: "Ultimate death embodiment with overwhelming inevitability pressure."
  },
  {
    category: "One of One",
    value: "I am Death - Pink",
    effectType: "death_variant",
    summary: "Variant death avatar with stylised fatal-pressure mechanics."
  },
  {
    category: "One of One",
    value: "Jean",
    effectType: "psychic_control",
    summary: "Mind-based control, pressure, and psychic disruption."
  },
  {
    category: "One of One",
    value: "King Tomb",
    effectType: "royal_entomb",
    summary: "Royal tomb authority with burial and grave-dominance mechanics."
  },
  {
    category: "One of One",
    value: "Lucifer",
    effectType: "fallen_corruption",
    summary: "Fallen-angel corruption, temptation, and infernal leverage."
  },
  {
    category: "One of One",
    value: "Satoshi",
    effectType: "genesis_system",
    summary: "Origin-system control tied to creation, chain authority, and economic influence."
  },
  {
    category: "One of One",
    value: "Skeletor",
    effectType: "dark_arcane",
    summary: "Villainous arcane force with skull, spell, and domination energy."
  },
  {
    category: "One of One",
    value: "Skull Heart",
    effectType: "undead_core",
    summary: "Undead sustain and death-driven endurance mechanics."
  },
  {
    category: "One of One",
    value: "Skull Island",
    effectType: "territory_curse",
    summary: "Zone-control identity built around cursed territory and pressure."
  },
  {
    category: "One of One",
    value: "T2",
    effectType: "machine_precision",
    summary: "Machine inevitability, precision targeting, and cold future-force logic."
  },
  {
    category: "One of One",
    value: "The Deceiver",
    effectType: "perfect_deception",
    summary: "High-end deception, misdirection, and enemy-action distortion."
  },
  {
    category: "One of One",
    value: "Walter",
    effectType: "volatile_alchemy",
    summary: "Explosive setup, chemical volatility, and unstable payoff mechanics."
  },
  {
    category: "One of One",
    value: "Yesterday Is History",
    effectType: "time_reset",
    summary: "Time-warping identity built around resets, memory, and temporal pressure."
  }

  ,
  {
    category: "One of One",
    value: "Amenadiel",
    effectType: "angelic_authority",
    summary: "Divine authority and celestial command pressure."
  },
  {
    category: "One of One",
    value: "D'Vile",
    effectType: "dark_corruption",
    summary: "Dark villain identity focused on corruption and hostile pressure."
  },
  {
    category: "One of One",
    value: "Elias",
    effectType: "mystic_presence",
    summary: "Measured mystic influence with thoughtful control patterns."
  },
  {
    category: "One of One",
    value: "Golden Samurai God",
    effectType: "divine_samurai",
    summary: "Precision samurai offense fused with divine-grade impact."
  },
  {
    category: "One of One",
    value: "Hokusai",
    effectType: "artistic_wave_control",
    summary: "Flow, creation, and wave-like battlefield shaping."
  },
  {
    category: "One of One",
    value: "Hunter",
    effectType: "predator_mark",
    summary: "Tracking, prey-marking, and clean target execution."
  },
  {
    category: "One of One",
    value: "Kiss of Death",
    effectType: "fatal_touch",
    summary: "High-lethality finisher identity built around fatal contact."
  },
  {
    category: "One of One",
    value: "Mr LOL",
    effectType: "comic_chaos",
    summary: "Unpredictable mockery and chaos-pressure mechanics."
  },
  {
    category: "One of One",
    value: "The Dragon Master",
    effectType: "dragon_command",
    summary: "Dragon control, command aura, and mythic board leadership."
  },
  {
    category: "One of One",
    value: "The Kraken",
    effectType: "deep_crush_control",
    summary: "Sea-monster pressure with crushing battlefield control."
  }

];
