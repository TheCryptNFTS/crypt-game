import { emitEvent } from "./events";
import { MatchState, PlayerId, UnitInPlay } from "./state";

function getAllDeadUnits(units: UnitInPlay[]): UnitInPlay[] {
  return units.filter((unit) => unit.health <= 0);
}

function getAllLivingUnits(units: UnitInPlay[]): UnitInPlay[] {
  return units.filter((unit) => unit.health > 0);
}

function processPlayerDeadUnits(match: MatchState, playerId: PlayerId): MatchState {
  const player = match.players[playerId];

  const deadFront = getAllDeadUnits(player.board.front);
  const deadBack = getAllDeadUnits(player.board.back);
  const allDeadUnits = [...deadFront, ...deadBack];

  if (allDeadUnits.length === 0) {
    return match;
  }

  let updatedMatch = match;

  for (const deadUnit of allDeadUnits) {
    updatedMatch = emitEvent(updatedMatch, {
      type: "UNIT_DIED",
      playerId,
      cardId: deadUnit.cardId,
      instanceId: deadUnit.instanceId
    });
  }

  const latestPlayer = updatedMatch.players[playerId];
  const stillLivingFront = getAllLivingUnits(latestPlayer.board.front);
  const stillLivingBack = getAllLivingUnits(latestPlayer.board.back);

  updatedMatch = {
    ...updatedMatch,
    players: {
      ...updatedMatch.players,
      [playerId]: {
        ...latestPlayer,
        discard: [...latestPlayer.discard, ...allDeadUnits.map((unit) => unit.cardId)],
        board: {
          front: stillLivingFront,
          back: stillLivingBack
        }
      }
    }
  };

  return updatedMatch;
}

export function cleanupDeadUnits(match: MatchState): MatchState {
  let updatedMatch = match;

  updatedMatch = processPlayerDeadUnits(updatedMatch, "P1");
  updatedMatch = processPlayerDeadUnits(updatedMatch, "P2");

  return updatedMatch;
}