import { MatchState, PlayerId, UnitInPlay } from "./state";

function getOpponentId(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

function applyDamage(unit: UnitInPlay, rawDamage: number): UnitInPlay {
  const absorbed = Math.min(unit.armor, rawDamage);
  const remainingDamage = rawDamage - absorbed;

  return {
    ...unit,
    armor: unit.armor - absorbed,
    health: unit.health - remainingDamage
  };
}

function defenderHasFrontTaunt(match: MatchState, defenderId: PlayerId): boolean {
  return match.players[defenderId].board.front.some((unit) =>
    unit.keywords.includes("TAUNT")
  );
}

function defenderFrontTauntIds(match: MatchState, defenderId: PlayerId): string[] {
  return match.players[defenderId].board.front
    .filter((unit) => unit.keywords.includes("TAUNT"))
    .map((unit) => unit.instanceId);
}

export function attackHero(
  match: MatchState,
  playerId: PlayerId,
  attackerInstanceId: string
): MatchState {
  const player = match.players[playerId];
  const opponentId = getOpponentId(playerId);
  const opponent = match.players[opponentId];

  if (defenderHasFrontTaunt(match, opponentId)) {
    throw new Error("Cannot attack hero while enemy TAUNT unit is in front lane");
  }

  const frontUnitIndex = player.board.front.findIndex(
    (unit) => unit.instanceId === attackerInstanceId
  );

  if (frontUnitIndex === -1) {
    throw new Error("Attacker not found in front lane");
  }

  const attacker = player.board.front[frontUnitIndex];

  if (attacker.exhausted) {
    throw new Error("Unit is exhausted");
  }

  if (attacker.summoningSick) {
    throw new Error("Unit has summoning sickness");
  }

  const updatedAttacker = {
    ...attacker,
    exhausted: true
  };

  const newFront = [...player.board.front];
  newFront[frontUnitIndex] = updatedAttacker;

  const newOpponentHealth = Math.max(0, opponent.health - attacker.attack);
  const winner = newOpponentHealth <= 0 ? playerId : null;

  return {
    ...match,
    winner,
    players: {
      ...match.players,
      [playerId]: {
        ...player,
        board: {
          ...player.board,
          front: newFront
        }
      },
      [opponentId]: {
        ...opponent,
        health: newOpponentHealth
      }
    }
  };
}

export function attackUnit(
  match: MatchState,
  playerId: PlayerId,
  attackerInstanceId: string,
  defenderInstanceId: string
): MatchState {
  const opponentId = getOpponentId(playerId);

  const player = match.players[playerId];
  const opponent = match.players[opponentId];

  const attackerIndex = player.board.front.findIndex(
    (unit) => unit.instanceId === attackerInstanceId
  );

  if (attackerIndex === -1) {
    throw new Error("Attacker not found in front lane");
  }

  const defenderIndex = opponent.board.front.findIndex(
    (unit) => unit.instanceId === defenderInstanceId
  );

  if (defenderIndex === -1) {
    throw new Error("Defender not found in enemy front lane");
  }

  const tauntIds = defenderFrontTauntIds(match, opponentId);
  if (tauntIds.length > 0 && !tauntIds.includes(defenderInstanceId)) {
    throw new Error("Must attack enemy TAUNT unit first");
  }

  const attacker = player.board.front[attackerIndex];
  const defender = opponent.board.front[defenderIndex];

  if (attacker.exhausted) {
    throw new Error("Unit is exhausted");
  }

  if (attacker.summoningSick) {
    throw new Error("Unit has summoning sickness");
  }

  const damagedDefender = applyDamage(defender, attacker.attack);
  const damagedAttacker = applyDamage(
    { ...attacker, exhausted: true },
    defender.attack
  );

  let newPlayerFront = [...player.board.front];
  let newOpponentFront = [...opponent.board.front];

  if (damagedAttacker.health <= 0) {
    newPlayerFront = newPlayerFront.filter((unit) => unit.instanceId !== attackerInstanceId);
  } else {
    newPlayerFront[attackerIndex] = damagedAttacker;
  }

  if (damagedDefender.health <= 0) {
    newOpponentFront = newOpponentFront.filter((unit) => unit.instanceId !== defenderInstanceId);
  } else {
    newOpponentFront[defenderIndex] = damagedDefender;
  }

  return {
    ...match,
    players: {
      ...match.players,
      [playerId]: {
        ...player,
        board: {
          ...player.board,
          front: newPlayerFront
        }
      },
      [opponentId]: {
        ...opponent,
        board: {
          ...opponent.board,
          front: newOpponentFront
        }
      }
    }
  };
}