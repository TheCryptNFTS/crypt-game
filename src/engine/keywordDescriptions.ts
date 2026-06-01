// Single source of truth for player-facing keyword descriptions.
//
// Every entry is grounded in actual engine behavior. See:
//   - keywordEngine.ts      (RUSH, GUARD, FLYING, RANGED, QUICKSTEP, MYTHIC, COMMAND, CRUSH)
//   - combat.ts             (TAUNT, LIFESTEAL, EXECUTE_PRESSURE, CRUSH overflow)
//   - unitAbilities.ts      (DEATH_BLAST, BATTLECRY_HERO_HIT, TAUNT, ARMOR_GAIN summary)
//   - combatEngine.ts       (RUSH attack gate, CRUSH overflow)
//
// Keywords with NO mechanical hook in the engine are marked `decorative: true`
// (currently faction-flavor tags only — see design/factionIdentity.ts).

export type KeywordDescription = {
  label: string;
  description: string;
  /** True when the keyword has no engine behavior and is flavor/faction text only. */
  decorative?: boolean;
};

export const KEYWORD_DESCRIPTIONS: Record<string, KeywordDescription> = {
  RUSH: {
    label: "Rush",
    description: "Ignores summoning sickness — can attack the turn it is played."
  },
  GUARD: {
    label: "Guard",
    description: "Enemies must attack this unit before they can hit other units or your hero."
  },
  TAUNT: {
    label: "Taunt",
    description: "Must be attacked before the enemy can target other units or your hero."
  },
  FLYING: {
    label: "Flying",
    description: "Can attack any enemy unit, and can only be hit by Flying or Ranged attackers."
  },
  RANGED: {
    label: "Ranged",
    description: "Can attack Flying units that ground units cannot reach."
  },
  QUICKSTEP: {
    label: "Quickstep",
    description: "Gains +1 Speed when it enters play."
  },
  MYTHIC: {
    label: "Mythic",
    description: "Gains +1 Attack and +1 Health when it enters play."
  },
  COMMAND: {
    label: "Command",
    description: "Gains +1 Armor when it enters play."
  },
  CRUSH: {
    label: "Crush",
    description: "Excess damage beyond a blocker's Health carries over to the enemy hero."
  },
  SHIELD: {
    label: "Shield",
    description: "The first instance of combat damage this unit would take is fully absorbed, then the shield breaks."
  },
  WARD: {
    label: "Ward",
    description: "The first instance of combat damage this unit would take is fully absorbed, then the ward breaks."
  },
  DIVINE_SHIELD: {
    label: "Divine Shield",
    description: "The first instance of combat damage this unit would take is fully absorbed, then it breaks."
  },
  WINDFURY: {
    label: "Windfury",
    description: "Can attack twice each turn."
  },
  LIFESTEAL: {
    label: "Lifesteal",
    description: "Heals your hero for the amount of damage this unit deals."
  },
  EXECUTE_PRESSURE: {
    label: "Execute Pressure",
    description: "Deals +2 Attack against units with 5 or less Health."
  },
  DEATH_BLAST: {
    label: "Death Blast",
    description: "Deals 2 damage to the enemy hero when this unit dies."
  },
  BATTLECRY_HERO_HIT: {
    label: "Battlecry",
    description: "Deals 2 damage to the enemy hero when this unit is played."
  },
  DEATHKNELL: {
    label: "Deathknell",
    description: "When this unit dies, deals damage to the strongest enemy unit — which can chain into that unit's own death triggers."
  },
  DEPLOY: {
    label: "Deploy",
    description: "When this unit is played, deals damage to the strongest enemy unit."
  },
  ARMOR_GAIN: {
    label: "Armor Gain",
    description: "Built for bruiser-style combat with added durability."
  },
  // --- Decorative / faction-flavor only: no engine hook found ---
  TECH: {
    label: "Tech",
    description: "Faction flavor tag (Iron / Gods). No mechanical effect.",
    decorative: true
  },
  ARCANE: {
    label: "Arcane",
    description: "Faction flavor tag (Silver / Gods). No mechanical effect.",
    decorative: true
  },
  HUNT: {
    label: "Hunt",
    description: "Faction flavor tag (Bronze). No mechanical effect.",
    decorative: true
  }
};

/** Look up a keyword, falling back to a graceful entry for unknown tags. */
export function getKeywordDescription(keyword: string): KeywordDescription {
  const known = KEYWORD_DESCRIPTIONS[keyword];
  if (known) return known;
  return {
    label: keyword,
    description: "No description available for this keyword.",
    decorative: true
  };
}
