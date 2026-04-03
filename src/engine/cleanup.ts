import { emitEvent } from "./events";
import { MatchState, PlayerId } from "./state";

function cleanupPlayerDeadUnits(match: MatchState, playerId: PlayerId): MatchState {
  const player = match.players[playerId];

  const deadFront = player.board.front.filter((unit) => unit.health <= 0);
  const deadBack = player.board.back.filter((unit) => unit.health <= 0);

  const survivingFront = player.board.front.filter((unit) => unit.health > 0);
  const survivingBack = player.board.back.filter((unit) => unit.health > 0);

  const deadUnits = [...deadFront, ...deadBack];
  const deadCardIds = deadUnits.map((unit) => unit.cardId);

  let updatedMatch: MatchState = {
    ...match,
    players: {
      ...match.players,
      [playerId]: {
        ...player,
        discard: [...player.discard, ...deadCardIds],
        board: {
          front: survivingFront,
          back: survivingBack
        }
      }
    }
  };

  for (const deadUnit of deadUnits) {
    updatedMatch = emitEvent(updatedMatch, {
      type: "UNIT_DIED",
      playerId,
      cardId: deadUnit.cardId,
      instanceId: deadUnit.instanceId
    });
  }

  return updatedMatch;
}

export function cleanupDeadUnits(match: MatchState): MatchState {
  let updated = cleanupPlayerDeadUnits(match, "P1");
  updated = cleanupPlayerDeadUnits(updated, "P2");
  return updated;
}