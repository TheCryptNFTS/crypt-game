import { MatchState, PlayerId } from "./state";

type AnyUnit = any;

function getPlayer(match: MatchState, playerId: PlayerId): any {
  return (match as any).players[playerId];
}

function getEnemyPlayerId(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

function getAllUnitsForPlayer(match: MatchState, playerId: PlayerId): AnyUnit[] {
  const player = getPlayer(match, playerId);
  return [...(player.board.front || []), ...(player.board.back || [])];
}

export function mergeKeywords(existing: string[] = [], incoming: string[] = []): string[] {
  return Array.from(new Set([...(existing || []), ...(incoming || [])]));
}

export function unitHasKeyword(unit: AnyUnit, keyword: string): boolean {
  return Array.isArray(unit?.keywords) && unit.keywords.includes(keyword);
}

export function unitCanAttack(unit: AnyUnit): boolean {
  if (!unit) return false;
  if (unit.exhausted) return false;
  if (unit.summoningSick && !unitHasKeyword(unit, "RUSH")) return false;
  return true;
}

export function getUnitByInstanceId(
  match: MatchState,
  playerId: PlayerId,
  instanceId: string
): AnyUnit | null {
  const units = getAllUnitsForPlayer(match, playerId);
  return units.find((u) => u.instanceId === instanceId) || null;
}

export function getAttackableEnemyUnits(
  match: MatchState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string
): AnyUnit[] {
  const defenderPlayerId = getEnemyPlayerId(attackerPlayerId);
  const attacker = getUnitByInstanceId(match, attackerPlayerId, attackerInstanceId);

  if (!attacker) {
    throw new Error(`Attacker not found: ${attackerInstanceId}`);
  }

  const defenderUnits = getAllUnitsForPlayer(match, defenderPlayerId);
  const guardUnits = defenderUnits.filter((u) => unitHasKeyword(u, "GUARD"));

  let candidates = guardUnits.length > 0 ? guardUnits : defenderUnits;

  if (unitHasKeyword(attacker, "FLYING")) {
    return candidates;
  }

  const filtered = candidates.filter((target) => {
    if (unitHasKeyword(target, "FLYING")) {
      return unitHasKeyword(attacker, "RANGED") || unitHasKeyword(attacker, "FLYING");
    }
    return true;
  });

  return filtered;
}

export function canAttackEnemyPlayer(
  match: MatchState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string
): boolean {
  const attacker = getUnitByInstanceId(match, attackerPlayerId, attackerInstanceId);

  if (!attacker) return false;
  if (!unitCanAttack(attacker)) return false;

  const defenderPlayerId = getEnemyPlayerId(attackerPlayerId);
  const defenderUnits = getAllUnitsForPlayer(match, defenderPlayerId);
  const guardUnits = defenderUnits.filter((u) => unitHasKeyword(u, "GUARD"));

  return guardUnits.length === 0;
}

export function applyKeywordHooksOnSummon(unit: AnyUnit): AnyUnit {
  const nextUnit = { ...unit };

  nextUnit.keywords = Array.isArray(nextUnit.keywords) ? [...nextUnit.keywords] : [];

  if (unitHasKeyword(nextUnit, "QUICKSTEP")) {
    nextUnit.speed = (nextUnit.speed || 0) + 1;
  }

  if (unitHasKeyword(nextUnit, "MYTHIC")) {
    nextUnit.attack = (nextUnit.attack || 0) + 1;
    nextUnit.health = (nextUnit.health || 0) + 1;
  }

  if (unitHasKeyword(nextUnit, "COMMAND")) {
    nextUnit.armor = (nextUnit.armor || 0) + 1;
  }

  return nextUnit;
}

export function applyCrushOverflow(
  attacker: AnyUnit,
  blocker: AnyUnit,
  defendingPlayerHealth: number
): { blockerHealth: number; defendingPlayerHealth: number } {
  const blockerHealth = (blocker.health || 0) - (attacker.attack || 0);

  if (!unitHasKeyword(attacker, "CRUSH")) {
    return {
      blockerHealth,
      defendingPlayerHealth
    };
  }

  const overflow = Math.max(0, (attacker.attack || 0) - (blocker.health || 0));

  return {
    blockerHealth,
    defendingPlayerHealth: defendingPlayerHealth - overflow
  };
}
