import { MatchState, PlayerId, UnitInPlay } from "./state";
import {
  isBattlecryHeroHitUnit,
  isDeathBlastUnit,
  isRushUnit,
  isTauntUnit,
  getUnitPassive
} from "./unitMetadata";

function getEnemyPlayerId(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

function findUnitByInstanceId(
  match: MatchState,
  playerId: PlayerId,
  instanceId: string
): UnitInPlay | null {
  const player = match.players[playerId];

  for (const unit of player.board.front) {
    if (unit.instanceId === instanceId) return unit;
  }

  for (const unit of player.board.back) {
    if (unit.instanceId === instanceId) return unit;
  }

  return null;
}

export function applyUnitSpawnAdjustments(unit: UnitInPlay): UnitInPlay {
  const nextKeywords = [...unit.keywords];

  if (isTauntUnit(unit.cardId) && !nextKeywords.includes("TAUNT")) {
    nextKeywords.push("TAUNT");
  }

  return {
    ...unit,
    keywords: nextKeywords,
    summoningSick: !isRushUnit(unit.cardId)
  };
}

export function applyBattlecryEffects(
  match: MatchState,
  playerId: PlayerId,
  playedUnit: UnitInPlay
): MatchState {
  let updatedMatch = match;

  if (isBattlecryHeroHitUnit(playedUnit.cardId)) {
    const enemyId = getEnemyPlayerId(playerId);
    const enemy = updatedMatch.players[enemyId];
    const nextHealth = Math.max(0, enemy.health - 2);

    updatedMatch = {
      ...updatedMatch,
      winner: nextHealth <= 0 ? playerId : updatedMatch.winner,
      players: {
        ...updatedMatch.players,
        [enemyId]: {
          ...enemy,
          health: nextHealth
        }
      }
    };
  }

  return updatedMatch;
}

export function applyDeathPassiveEffects(
  match: MatchState,
  deadOwnerId: PlayerId,
  deadUnit: UnitInPlay
): MatchState {
  let updatedMatch = match;

  if (isDeathBlastUnit(deadUnit.cardId)) {
    const enemyId = getEnemyPlayerId(deadOwnerId);
    const enemy = updatedMatch.players[enemyId];
    const nextHealth = Math.max(0, enemy.health - 2);

    updatedMatch = {
      ...updatedMatch,
      winner: nextHealth <= 0 ? deadOwnerId : updatedMatch.winner,
      players: {
        ...updatedMatch.players,
        [enemyId]: {
          ...enemy,
          health: nextHealth
        }
      }
    };
  }

  return updatedMatch;
}

export function describeUnitPassive(cardId: string): string {
  const passive = getUnitPassive(cardId);

  switch (passive) {
    case "RUSH":
      return "Can act immediately when played.";
    case "TAUNT":
      return "Must be attacked first.";
    case "GUARD":
      return "Defensive frontline unit.";
    case "DEATH_BLAST":
      return "Deals 2 damage to enemy hero on death.";
    case "BATTLECRY_HERO_HIT":
      return "Deals 2 damage to enemy hero on play.";
    case "LIFESTEAL":
      return "Heals hero for damage dealt.";
    case "EXECUTE_PRESSURE":
      return "Deals extra damage to weak units.";
    case "ARMOR_GAIN":
      return "Built for bruiser-style combat.";
    default:
      return "No special passive.";
  }
}

export function getUnitPassiveSummary(
  match: MatchState,
  playerId: PlayerId,
  instanceId: string
): string {
  const unit = findUnitByInstanceId(match, playerId, instanceId);

  if (!unit) {
    throw new Error(`Unit not found: ${instanceId}`);
  }

  return describeUnitPassive(unit.cardId);
}