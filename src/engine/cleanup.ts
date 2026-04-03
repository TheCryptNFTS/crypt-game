import { emitEvent } from "./events";
import { MatchState, PlayerId } from "./state";

export function cleanupDeadUnits(match: MatchState): MatchState {
  let updatedMatch = match;

  for (const playerId of ["P1", "P2"] as PlayerId[]) {
    const player = updatedMatch.players[playerId];

    const deadFront = player.board.front.filter((unit) => unit.health <= 0);
    const deadBack = player.board.back.filter((unit) => unit.health <= 0);

    const aliveFront = player.board.front.filter((unit) => unit.health > 0);
    const aliveBack = player.board.back.filter((unit) => unit.health > 0);

    updatedMatch = {
      ...updatedMatch,
      players: {
        ...updatedMatch.players,
        [playerId]: {
          ...player,
          discard: [
            ...player.discard,
            ...deadFront.map((unit) => unit.cardId),
            ...deadBack.map((unit) => unit.cardId)
          ],
          board: {
            front: aliveFront,
            back: aliveBack
          }
        }
      }
    };

    for (const deadUnit of [...deadFront, ...deadBack]) {
      updatedMatch = emitEvent(updatedMatch, {
        type: "UNIT_DIED",
        unitId: deadUnit.instanceId,
        cardId: deadUnit.cardId,
        ownerId: playerId
      });
    }
  }

  return updatedMatch;
}