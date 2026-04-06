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
  }
};

export const ALL_KEYWORDS = Object.keys(KEYWORD_RULES);
