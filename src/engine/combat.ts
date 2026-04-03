import { MatchState, PlayerId } from "./state";

function getOpponentId(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

export function attackHero(
  match: MatchState,
  playerId: PlayerId,
  attackerInstanceId: string
): MatchState {
  const player = match.players[playerId];
  const opponentId = getOpponentId(playerId);
  const opponent = match.players[opponentId];

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