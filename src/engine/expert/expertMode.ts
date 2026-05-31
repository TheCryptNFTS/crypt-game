export type ExpertModeConfig = {
  enabled: boolean;
  includeLore: boolean;
  includeAudit: boolean;
  includeModifierSources: boolean;
  includeCombatBreakdown: boolean;
  includeCaps: boolean;
};

export const EXPERT_MODE: ExpertModeConfig = {
  enabled: true,
  includeLore: true,
  includeAudit: true,
  includeModifierSources: true,
  includeCombatBreakdown: true,
  includeCaps: true
};
