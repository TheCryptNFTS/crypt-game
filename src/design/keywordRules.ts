export type KeywordRule = {
  keyword: string;
  meaning: string;
  scoreHint: number;
  validOn: Array<"unit" | "equipment" | "artifact">;
};

export const KEYWORD_RULES: Record<string, KeywordRule> = {
  GUARD: {
    keyword: "GUARD",
    meaning: "must be attacked before face if attack rules permit",
    scoreHint: 2.0,
    validOn: ["unit"]
  },
  RUSH: {
    keyword: "RUSH",
    meaning: "can attack units immediately",
    scoreHint: 1.5,
    validOn: ["unit", "equipment"]
  },
  CRUSH: {
    keyword: "CRUSH",
    meaning: "premium combat pressure, heavy striker identity",
    scoreHint: 1.5,
    validOn: ["unit"]
  },
  QUICKSTEP: {
    keyword: "QUICKSTEP",
    meaning: "high tempo / speed identity",
    scoreHint: 1.25,
    validOn: ["unit"]
  },
  FLYING: {
    keyword: "FLYING",
    meaning: "evasive / aerial identity",
    scoreHint: 1.75,
    validOn: ["unit"]
  },
  TECH: {
    keyword: "TECH",
    meaning: "machine / precision / mechanical synergy",
    scoreHint: 1.25,
    validOn: ["unit", "equipment"]
  },
  ARCANE: {
    keyword: "ARCANE",
    meaning: "artifact / mystical / spell-adjacent synergy",
    scoreHint: 1.5,
    validOn: ["unit", "artifact"]
  },
  VENOM: {
    keyword: "VENOM",
    meaning: "attrition / poison pressure",
    scoreHint: 1.5,
    validOn: ["unit"]
  },
  HUNT: {
    keyword: "HUNT",
    meaning: "aggressive target-seeking pressure",
    scoreHint: 1.25,
    validOn: ["unit"]
  },
  COMMAND: {
    keyword: "COMMAND",
    meaning: "elite aura / leadership identity",
    scoreHint: 2.0,
    validOn: ["unit"]
  },
  MYTHIC: {
    keyword: "MYTHIC",
    meaning: "high-ceiling legendary identity",
    scoreHint: 2.5,
    validOn: ["unit", "artifact"]
  },

  // --- Canonical re-reveal engine tokens (WIRED to existing mechanics) ---
  // GUARD/RUSH/FLYING/CRUSH/MYTHIC above already cover Taunt/Guard, Rush/Charge,
  // Flying, Trample/Cleave/Pierce. The two below map cleanly onto existing
  // engine mechanics (see keywordEngine.ts / unitAbilities.ts / effects.ts).
  LIFESTEAL: {
    keyword: "LIFESTEAL",
    meaning: "heals controller for damage dealt (Lifesteal/Lifedrain)",
    scoreHint: 1.75,
    validOn: ["unit"]
  },
  STEALTH: {
    keyword: "STEALTH",
    meaning: "cannot be targeted until it acts (Stealth/Veil)",
    scoreHint: 1.5,
    validOn: ["unit"]
  },
  ARMORED: {
    keyword: "ARMORED",
    meaning: "gains +1 Armor when it enters play (mapped to armor stat)",
    scoreHint: 1.25,
    validOn: ["unit"]
  },

  // --- Canonical keywords WIRED into the live reducer (keywordEngine.ts) ---
  WARD: {
    keyword: "WARD",
    meaning: "absorbs the first instance of combat damage, then breaks",
    scoreHint: 2.0,
    validOn: ["unit"]
  },
  DIVINE_SHIELD: {
    keyword: "DIVINE_SHIELD",
    meaning: "absorbs the first instance of combat damage, then breaks",
    scoreHint: 2.0,
    validOn: ["unit"]
  },
  DEATHRATTLE: {
    keyword: "DEATHRATTLE",
    meaning: "on death, deals a fixed burst to the enemy nexus",
    scoreHint: 1.75,
    validOn: ["unit"]
  },
  REGROW: {
    keyword: "REGROW",
    meaning: "regenerates to full health at the start of its controller's turn",
    scoreHint: 1.5,
    validOn: ["unit"]
  },
  EXECUTE: {
    keyword: "EXECUTE",
    meaning: "finishes a defender left at or below half health after the hit",
    scoreHint: 1.75,
    validOn: ["unit"]
  },
  SCRY: {
    keyword: "SCRY",
    meaning: "on summon, smooths the top of the deck (cheapest cards first)",
    scoreHint: 1.25,
    validOn: ["unit"]
  },

  // --- Inert display keywords (REGISTERED so lookups/validation don't throw) ---
  // These are recognized canonical keywords with NO engine mechanic yet. They
  // are intentionally no-ops; the engine must simply not crash or warn on them.
  // TODO: not yet implemented — wire mechanics in a later wave if desired:
  //   PATIENT, SHIELD, OATH, DECAY, SUMMON, FEAR, JUDGMENT, RELIC, RALLY,
  //   MARTYR, BLESS, VOW, RITUAL, MIRE, WINDFURY, RECALL.
  PATIENT: inertRule("PATIENT"),
  SHIELD: inertRule("SHIELD"),
  OATH: inertRule("OATH"),
  DECAY: inertRule("DECAY"),
  SUMMON: inertRule("SUMMON"),
  FEAR: inertRule("FEAR"),
  JUDGMENT: inertRule("JUDGMENT"),
  RELIC: inertRule("RELIC"),
  RALLY: inertRule("RALLY"),
  MARTYR: inertRule("MARTYR"),
  BLESS: inertRule("BLESS"),
  VOW: inertRule("VOW"),
  RITUAL: inertRule("RITUAL"),
  MIRE: inertRule("MIRE"),
  WINDFURY: inertRule("WINDFURY"),
  RECALL: inertRule("RECALL")
};

/** Minimal no-op rule for canonical keywords that have no engine mechanic yet. */
function inertRule(keyword: string): KeywordRule {
  return {
    keyword,
    meaning: "recognized display keyword — no engine mechanic yet (inert)",
    scoreHint: 1.0,
    validOn: ["unit", "equipment", "artifact"]
  };
}

export const ALL_KEYWORDS = Object.keys(KEYWORD_RULES);
