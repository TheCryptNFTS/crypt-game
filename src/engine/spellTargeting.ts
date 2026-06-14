import { compileAbility } from "./abilityCompiler";

// A spell targets an ENEMY unit (damage / debuff / removal / bounce) or an ALLY
// unit (heal / buff). One source of truth for BOTH the AI planner (which picks a
// legal target) and the board's cast-target highlight (which shows the player
// where to aim), so the two can never drift.
const SPELL_ENEMY_OPS = ["DEAL_DAMAGE", "DEBUFF_ENEMY", "DESTROY_UNIT", "RETURN_TO_HAND"];
const SPELL_ALLY_OPS = ["HEAL", "BUFF_SELF"];

export type SpellTargeting = { needsTarget: boolean; wantsEnemy: boolean; wantsAlly: boolean };

/** Classify a spell card's targeting from its compiled ability ops. */
export function classifySpellTargeting(card: any): SpellTargeting {
  const specs = (compileAbility(card?.rawTraits?.Ability).specs ?? []) as any[];
  const wantsEnemy = specs.some((s) => SPELL_ENEMY_OPS.includes(s.op));
  const wantsAlly = specs.some((s) => SPELL_ALLY_OPS.includes(s.op));
  return { needsTarget: wantsEnemy || wantsAlly, wantsEnemy, wantsAlly };
}
