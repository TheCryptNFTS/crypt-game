import { cleanupDeadUnits } from "./cleanup";
import { emitEvent } from "./events";
import { MatchState, PlayerId, UnitInPlay } from "./state";
import { getUnitPassive } from "./unitMetadata";

function getEnemyPlayerId(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

function findUnitLocation(
  match: MatchState,
  playerId: PlayerId,
  instanceId: string
): { lane: "front" | "back"; index: number } {
  const player = match.players[playerId];

  const frontIndex = player.board.front.findIndex((unit) => unit.instanceId === instanceId);
  if (frontIndex !== -1) {
    return { lane: "front", index: frontIndex };
  }

  const backIndex = player.board.back.findIndex((unit) => unit.instanceId === instanceId);
  if (backIndex !== -1) {
    return { lane: "back", index: backIndex };
  }

  throw new Error(`Unit not found: ${instanceId}`);
}

function getUnitByInstanceId(
  match: MatchState,
  playerId: PlayerId,
  instanceId: string
): UnitInPlay {
  const location = findUnitLocation(match, playerId, instanceId);
  return match.players[playerId].board[location.lane][location.index];
}

function updateUnitInBoard(
  match: MatchState,
  playerId: PlayerId,
  updatedUnit: UnitInPlay
): MatchState {
  const location = findUnitLocation(match, playerId, updatedUnit.instanceId);
  const player = match.players[playerId];
  const updatedLane = [...player.board[location.lane]];
  updatedLane[location.index] = updatedUnit;

  return {
    ...match,
    players: {
      ...match.players,
      [playerId]: {
        ...player,
        board: {
          ...player.board,
          [location.lane]: updatedLane
        }
      }
    }
  };
}

function markAttackerSpent(
  match: MatchState,
  playerId: PlayerId,
  attackerId: string
): MatchState {
  const attacker = getUnitByInstanceId(match, playerId, attackerId);

  return updateUnitInBoard(match, playerId, {
    ...attacker,
    exhausted: true
  });
}

function healHero(match: MatchState, playerId: PlayerId, amount: number): MatchState {
  if (amount <= 0) return match;

  const player = match.players[playerId];

  return {
    ...match,
    players: {
      ...match.players,
      [playerId]: {
        ...player,
        health: player.health + amount
      }
    }
  };
}

function damageHero(match: MatchState, playerId: PlayerId, amount: number): MatchState {
  if (amount <= 0) return match;

  const player = match.players[playerId];
  const nextHealth = player.health - amount;

  return {
    ...match,
    winner: nextHealth <= 0 ? getEnemyPlayerId(playerId) : match.winner,
    players: {
      ...match.players,
      [playerId]: {
        ...player,
        health: nextHealth
      }
    }
  };
}

function hasTauntUnit(match: MatchState, playerId: PlayerId): boolean {
  const player = match.players[playerId];
  const allUnits = [...player.board.front, ...player.board.back];

  return allUnits.some(
    (unit) => unit.keywords.includes("TAUNT") || getUnitPassive(unit.cardId) === "TAUNT"
  );
}

function isTauntUnit(unit: UnitInPlay): boolean {
  return unit.keywords.includes("TAUNT") || getUnitPassive(unit.cardId) === "TAUNT";
}

function applyDamageToUnit(unit: UnitInPlay, damage: number): UnitInPlay {
  if (damage <= 0) return unit;

  let remainingDamage = damage;
  let nextArmor = unit.armor;

  if (nextArmor > 0) {
    const blocked = Math.min(nextArmor, remainingDamage);
    nextArmor -= blocked;
    remainingDamage -= blocked;
  }

  return {
    ...unit,
    armor: nextArmor,
    health: unit.health - remainingDamage
  };
}

function getModifiedAttackAgainstUnit(attacker: UnitInPlay, defender: UnitInPlay): number {
  const passive = getUnitPassive(attacker.cardId);
  let attack = attacker.attack;

  if (passive === "EXECUTE_PRESSURE" && defender.health <= 5) {
    attack += 2;
  }

  return attack;
}

function applyLifestealIfNeeded(
  match: MatchState,
  attackerPlayerId: PlayerId,
  attacker: UnitInPlay,
  damageDealt: number
): MatchState {
  if (getUnitPassive(attacker.cardId) !== "LIFESTEAL") {
    return match;
  }

  return healHero(match, attackerPlayerId, damageDealt);
}

export function attackUnit(
  match: MatchState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
  defenderInstanceId: string
): MatchState {
  if (match.activePlayer !== attackerPlayerId) {
    throw new Error("Not this player's turn");
  }

  if (match.phase !== "combat") {
    throw new Error("Can only attack during combat phase");
  }

  const defenderPlayerId = getEnemyPlayerId(attackerPlayerId);

  let attacker = getUnitByInstanceId(match, attackerPlayerId, attackerInstanceId);
  let defender = getUnitByInstanceId(match, defenderPlayerId, defenderInstanceId);

  if (attacker.exhausted) {
    throw new Error("Attacker is exhausted");
  }

  if (attacker.summoningSick) {
    throw new Error("Attacker has summoning sickness");
  }

  if (hasTauntUnit(match, defenderPlayerId) && !isTauntUnit(defender)) {
    throw new Error("Must attack a TAUNT unit first");
  }

  let updatedMatch = emitEvent(match, {
    type: "UNIT_ATTACKED",
    attackerId: attackerInstanceId,
    defenderId: defenderInstanceId
  });

  const attackerDamage = getModifiedAttackAgainstUnit(attacker, defender);
  const defenderDamage = getModifiedAttackAgainstUnit(defender, attacker);

  attacker = applyDamageToUnit(attacker, defenderDamage);
  defender = applyDamageToUnit(defender, attackerDamage);

  updatedMatch = updateUnitInBoard(updatedMatch, attackerPlayerId, attacker);
  updatedMatch = updateUnitInBoard(updatedMatch, defenderPlayerId, defender);
  updatedMatch = markAttackerSpent(updatedMatch, attackerPlayerId, attackerInstanceId);

  updatedMatch = applyLifestealIfNeeded(
    updatedMatch,
    attackerPlayerId,
    getUnitByInstanceId(updatedMatch, attackerPlayerId, attackerInstanceId),
    attackerDamage
  );

  updatedMatch = cleanupDeadUnits(updatedMatch);

  return updatedMatch;
}

export function attackHero(
  match: MatchState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string
): MatchState {
  if (match.activePlayer !== attackerPlayerId) {
    throw new Error("Not this player's turn");
  }

  if (match.phase !== "combat") {
    throw new Error("Can only attack during combat phase");
  }

  const defenderPlayerId = getEnemyPlayerId(attackerPlayerId);
  const attacker = getUnitByInstanceId(match, attackerPlayerId, attackerInstanceId);

  if (attacker.exhausted) {
    throw new Error("Attacker is exhausted");
  }

  if (attacker.summoningSick) {
    throw new Error("Attacker has summoning sickness");
  }

  if (hasTauntUnit(match, defenderPlayerId)) {
    throw new Error("Cannot attack hero while enemy TAUNT unit exists");
  }

  let heroDamage = attacker.attack;

  if (getUnitPassive(attacker.cardId) === "EXECUTE_PRESSURE") {
    heroDamage += 1;
  }

  let updatedMatch = emitEvent(match, {
    type: "HERO_ATTACKED",
    attackerId: attackerInstanceId,
    defenderPlayerId,
    damage: heroDamage
  });

  updatedMatch = damageHero(updatedMatch, defenderPlayerId, heroDamage);
  updatedMatch = markAttackerSpent(updatedMatch, attackerPlayerId, attackerInstanceId);
  updatedMatch = applyLifestealIfNeeded(updatedMatch, attackerPlayerId, attacker, heroDamage);

  return updatedMatch;
}