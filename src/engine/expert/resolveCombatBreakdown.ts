import { resolveOutgoingDamage, resolveMitigatedDamage } from "../resolveCombatBonuses";

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function resolveCombatBreakdown(attacker: any, defender: any) {
  const attackerAttack = num(attacker?.attack);
  const attackerCrit = num(attacker?.crit);
  const attackerUtility = num(attacker?.utility);
  const defenderArmor = num(defender?.armor);

  const outgoing = resolveOutgoingDamage(attacker);
  const mitigated = resolveMitigatedDamage(attacker, defender);

  const baselineWithoutCritOrUtility = Math.max(0, attackerAttack - defenderArmor);
  const baselineWithCritNoUtility = Math.max(0, outgoing - defenderArmor);

  return {
    attackerAttack,
    attackerCrit,
    attackerUtility,
    defenderArmor,
    outgoing,
    mitigated,
    baselineWithoutCritOrUtility,
    baselineWithCritNoUtility,
    utilityDelta: mitigated - baselineWithCritNoUtility,
    totalDeltaVsPlainAttack: mitigated - baselineWithoutCritOrUtility,
  };
}
