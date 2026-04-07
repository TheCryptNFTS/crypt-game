function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function getAttackerCombatBonuses(attacker: any) {
  return {
    critBonus: num(attacker?.crit),
    utilityBonus: num(attacker?.utility),
  };
}

export function resolveOutgoingDamage(attacker: any) {
  const baseAttack = num(attacker?.attack);
  const { critBonus } = getAttackerCombatBonuses(attacker);
  return baseAttack + critBonus;
}

export function resolveMitigatedDamage(attacker: any, defender: any) {
  const outgoing = resolveOutgoingDamage(attacker);
  const { utilityBonus } = getAttackerCombatBonuses(attacker);
  const defenderArmor = Math.max(0, num(defender?.armor) - utilityBonus);
  return Math.max(0, outgoing - defenderArmor);
}
