import { MatchState, PlayerId, UnitInPlay } from "./state";

function applyArmorToUnits(units: UnitInPlay[], amount: number): UnitInPlay[] {
  return units.map((unit) => ({
    ...unit,
    armor: unit.armor + amount
  }));
}

export function applyStartOfTurnCommanderEffects(
  match: MatchState,
  playerId: PlayerId
): MatchState {
  const player = match.players[playerId];

  if (player.commanderId === "cmd_bronze_raider") {
    return {
      ...match,
      players: {
        ...match.players,
        [playerId]: {
          ...player,
          turnFlags: {
            ...player.turnFlags,
            firstUnitCostReduction: 1,
            firstUnitPlayed: false
          }
        }
      }
    };
  }

  return match;
}

export function applyEndOfTurnCommanderEffects(
  match: MatchState,
  playerId: PlayerId
): MatchState {
  const player = match.players[playerId];

  if (player.commanderId === "cmd_stone_warden") {
    return {
      ...match,
      players: {
        ...match.players,
        [playerId]: {
          ...player,
          board: {
            front: applyArmorToUnits(player.board.front, 1),
            back: applyArmorToUnits(player.board.back, 1)
          }
        }
      }
    };
  }

  return match;
}