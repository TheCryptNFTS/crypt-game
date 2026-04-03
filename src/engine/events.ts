import { MatchState, PlayerId, UnitInPlay } from "./state";
import { applyBattlecryEffects, applyDeathPassiveEffects } from "./unitAbilities";

export type GameEvent =
  | {
      type: "TURN_START";
      playerId: PlayerId;
    }
  | {
      type: "TURN_END";
      playerId: PlayerId;
    }
  | {
      type: "UNIT_PLAYED";
      playerId: PlayerId;
      cardId: string;
      instanceId: string;
    }
  | {
      type: "UNIT_DIED";
      playerId: PlayerId;
      cardId: string;
      instanceId: string;
    };

function applyArmorToAllFriendly(match: MatchState, playerId: PlayerId, amount: number): MatchState {
  const player = match.players[playerId];

  return {
    ...match,
    players: {
      ...match.players,
      [playerId]: {
        ...player,
        board: {
          front: player.board.front.map((unit) => ({
            ...unit,
            armor: unit.armor + amount
          })),
          back: player.board.back.map((unit) => ({
            ...unit,
            armor: unit.armor + amount
          }))
        }
      }
    }
  };
}

function applyBronzeStartTurnDiscount(match: MatchState, playerId: PlayerId): MatchState {
  const player = match.players[playerId];

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

function findUnitInBoard(
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

function makeDeadUnitSnapshot(event: Extract<GameEvent, { type: "UNIT_DIED" }>): UnitInPlay {
  return {
    instanceId: event.instanceId,
    cardId: event.cardId,
    lane: "front",
    attack: 0,
    health: 0,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: true,
    summoningSick: false
  };
}

export function emitEvent(match: MatchState, event: GameEvent): MatchState {
  const player = match.players[event.playerId];

  switch (event.type) {
    case "TURN_START": {
      if (player.commanderId === "cmd_bronze_raider") {
        return applyBronzeStartTurnDiscount(match, event.playerId);
      }

      return match;
    }

    case "TURN_END": {
      if (player.commanderId === "cmd_stone_warden") {
        return applyArmorToAllFriendly(match, event.playerId, 1);
      }

      return match;
    }

    case "UNIT_PLAYED": {
      const playedUnit = findUnitInBoard(match, event.playerId, event.instanceId);

      if (!playedUnit) {
        return match;
      }

      return applyBattlecryEffects(match, event.playerId, playedUnit);
    }

    case "UNIT_DIED": {
      const deadUnit = makeDeadUnitSnapshot(event);
      return applyDeathPassiveEffects(match, event.playerId, deadUnit);
    }

    default:
      return match;
  }
}