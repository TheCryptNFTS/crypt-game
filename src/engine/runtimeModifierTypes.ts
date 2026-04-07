export type RuntimeModifierAudit = {
  reasons: string[];
  exactTraitMatches: string[];
  categoryMatches: string[];
  nameMatch: boolean;
  factionMatch: boolean;
};

export type RuntimeModifierBonus = {
  attack: number;
  health: number;
  armor: number;
  speed: number;
  crit: number;
  utility: number;
};

export type RuntimeModifierBundle = {
  stats: RuntimeModifierBonus;
  commanderTags: string[];
  passives: string[];
  audit: RuntimeModifierAudit;
};
