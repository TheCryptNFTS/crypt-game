import { RuntimeModifierAudit, RuntimeModifierBonus, RuntimeModifierBundle } from "./runtimeModifierTypes";

type Bonus = {
  attack?: number;
  health?: number;
  armor?: number;
  crit?: number;
  speed?: number;
  utility?: number;
};

type ModifierRecord = {
  bonus?: Bonus;
  reasons?: string[];
  extraTags?: string[];
  extraPassives?: string[];
  exactTraitMatches?: string[];
  categoryMatches?: string[];
  nameMatch?: boolean;
  factionMatch?: boolean;
};

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.filter((v) => typeof v === "string" && v.trim()).map(String))];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const MODIFIER_CAPS = {
  attack: 6,
  health: 10,
  armor: 6,
  speed: 4,
  crit: 3,
  utility: 12,
};

function normalizeBundle(modifier: ModifierRecord): RuntimeModifierBundle {
  const stats: RuntimeModifierBonus = {
    attack: num(modifier.bonus?.attack),
    health: num(modifier.bonus?.health),
    armor: num(modifier.bonus?.armor),
    speed: num(modifier.bonus?.speed),
    crit: num(modifier.bonus?.crit),
    utility: num(modifier.bonus?.utility),
  };

  const audit: RuntimeModifierAudit = {
    reasons: modifier.reasons ?? [],
    exactTraitMatches: modifier.exactTraitMatches ?? [],
    categoryMatches: modifier.categoryMatches ?? [],
    nameMatch: !!modifier.nameMatch,
    factionMatch: !!modifier.factionMatch,
  };

  return {
    stats,
    commanderTags: modifier.extraTags ?? [],
    passives: modifier.extraPassives ?? [],
    audit,
  };
}

export function getStoredCardModifier(match: any, playerId: string, cardId: string): ModifierRecord | null {
  const player = match?.players?.[playerId];
  if (!player?.cardModifiers || !cardId) return null;
  return player.cardModifiers[cardId] ?? null;
}

function applyCommonStats(target: any, modifier: ModifierRecord | null) {
  if (!target || !modifier?.bonus) return target;

  const baseAttack = num(target.attack);
  const baseHealth = num(target.health, 1);
  const baseArmor = num(target.armor);
  const baseSpeed = num(target.speed);
  const baseCrit = num(target.crit);
  const baseUtility = num(target.utility);

  target.attack = clamp(baseAttack + num(modifier.bonus.attack), 0, baseAttack + MODIFIER_CAPS.attack);
  target.health = clamp(baseHealth + num(modifier.bonus.health), 1, baseHealth + MODIFIER_CAPS.health);
  target.armor = clamp(baseArmor + num(modifier.bonus.armor), 0, baseArmor + MODIFIER_CAPS.armor);
  target.speed = clamp(baseSpeed + num(modifier.bonus.speed), 0, baseSpeed + MODIFIER_CAPS.speed);

  target.crit = clamp(baseCrit + num(modifier.bonus.crit), 0, MODIFIER_CAPS.crit);
  target.utility = clamp(baseUtility + num(modifier.bonus.utility), 0, MODIFIER_CAPS.utility);

  target.commanderTags = uniqueStrings([
    ...(Array.isArray(target.commanderTags) ? target.commanderTags : []),
    ...(Array.isArray(modifier.extraTags) ? modifier.extraTags : []),
  ]);

  target.passives = uniqueStrings([
    ...(Array.isArray(target.passives) ? target.passives : []),
    ...(Array.isArray(modifier.extraPassives) ? modifier.extraPassives : []),
  ]);

  target.modifiers = target.modifiers ?? {};
  return target;
}

export function applyModifierToUnitLike(unit: any, modifier: ModifierRecord | null) {
  if (!unit || !modifier?.bonus) return unit;
  applyCommonStats(unit, modifier);
  unit.modifiers.commander = normalizeBundle(modifier);
  return unit;
}

export function applyModifierToArtifactLike(artifact: any, modifier: ModifierRecord | null) {
  if (!artifact || !modifier?.bonus) return artifact;
  applyCommonStats(artifact, modifier);
  artifact.modifiers.commander = normalizeBundle(modifier);
  return artifact;
}

export function applyModifierToEquippedTarget(target: any, modifier: ModifierRecord | null) {
  if (!target || !modifier?.bonus) return target;
  applyCommonStats(target, modifier);
  target.modifiers = target.modifiers ?? {};
  target.modifiers.equipment = [
    ...((target.modifiers.equipment ?? []) as RuntimeModifierBundle[]),
    normalizeBundle(modifier),
  ];
  return target;
}
