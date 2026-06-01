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
  SHIELD: {
    keyword: "SHIELD",
    meaning: "absorbs the first instance of combat damage, then breaks (one-shot absorb)",
    scoreHint: 2.0,
    validOn: ["unit"]
  },
  WINDFURY: {
    keyword: "WINDFURY",
    meaning: "may attack a second time each turn",
    scoreHint: 1.75,
    validOn: ["unit"]
  },
  FEAR: {
    keyword: "FEAR",
    meaning: "low-cost enemy attackers cannot strike this unit (RESTRICT_ATTACK)",
    scoreHint: 1.5,
    validOn: ["unit"]
  },
  OATH: {
    keyword: "OATH",
    meaning: "contributes to the faction OATH payoff layer (faction-scaled buff)",
    scoreHint: 1.25,
    validOn: ["unit"]
  },

  // --- Keywords whose mechanic is compiled from each card's ability TEXT --------
  // These carry no INTRINSIC stat grant; instead the ability compiler
  // (engine/abilityCompiler.ts) parses the card's rules text bearing the keyword
  // into real engine ops (e.g. RALLY -> BUFF_ALLIES on attack, JUDGMENT ->
  // PIERCE_ARMOR, DECAY/MIRE -> DEBUFF_ENEMY / end-of-turn decay, PATIENT ->
  // RESTRICT_ATTACK + grower/mitigation, SUMMON -> SUMMON_TOKEN, MARTYR/VOW ->
  // faction-scaled BUFF_SELF, BLESS -> BUFF_ALLIES, RECALL -> return to hand).
  // The scoreHints below reflect their realized power, not "inert".
  PATIENT: {
    keyword: "PATIENT",
    meaning: "compiles from text: cannot attack, grows / mitigates / regenerates over time",
    scoreHint: 1.5,
    validOn: ["unit"]
  },
  DECAY: {
    keyword: "DECAY",
    meaning: "compiles from text: attrition — debuffs on hit or decays at end of turn",
    scoreHint: 1.5,
    validOn: ["unit"]
  },
  SUMMON: {
    keyword: "SUMMON",
    meaning: "compiles from text: summons a token unit",
    scoreHint: 1.5,
    validOn: ["unit"]
  },
  JUDGMENT: {
    keyword: "JUDGMENT",
    meaning: "compiles from text: pierces enemy armor",
    scoreHint: 1.5,
    validOn: ["unit"]
  },
  RALLY: {
    keyword: "RALLY",
    meaning: "compiles from text: buffs allied units on attack",
    scoreHint: 1.5,
    validOn: ["unit"]
  },
  MARTYR: {
    keyword: "MARTYR",
    meaning: "compiles from text: faction-scaled self-buff on summon",
    scoreHint: 1.25,
    validOn: ["unit"]
  },
  BLESS: {
    keyword: "BLESS",
    meaning: "compiles from text: buffs allied units on summon",
    scoreHint: 1.5,
    validOn: ["unit"]
  },
  VOW: {
    keyword: "VOW",
    meaning: "compiles from text: faction-scaled self-buff on summon",
    scoreHint: 1.25,
    validOn: ["unit"]
  },
  MIRE: {
    keyword: "MIRE",
    meaning: "compiles from text: attrition / end-of-turn decay onto enemies",
    scoreHint: 1.5,
    validOn: ["unit"]
  },
  RECALL: {
    keyword: "RECALL",
    meaning: "compiles from text: returns a unit to its owner's hand",
    scoreHint: 1.5,
    validOn: ["unit"]
  },

  // --- Keywords with an INTRINSIC summon grant (engine/keywordEngine.ts) --------
  RELIC: {
    keyword: "RELIC",
    meaning: "enduring artifact-grade unit — gains +1 Armor when it enters play",
    scoreHint: 1.25,
    validOn: ["unit"]
  },
  RITUAL: {
    keyword: "RITUAL",
    meaning: "consecrated by a summoning rite — gains +1 max health when it enters play",
    scoreHint: 1.25,
    validOn: ["unit"]
  }
};

export const ALL_KEYWORDS = Object.keys(KEYWORD_RULES);
