import { MatchState, PlayerId } from "./state";

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

function applyArmorToAllFriendly(
  match: MatchState,
  playerId: PlayerId,
  amount: number
): MatchState {
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

function applyBronzeStartTurnDiscount(
  match: MatchState,
  playerId: PlayerId
): MatchState {
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

function dealDamageToEnemyHero(
  match: MatchState,
  sourcePlayerId: PlayerId,
  damage: number
): MatchState {
  const enemyId: PlayerId = sourcePlayerId === "P1" ? "P2" : "P1";
  const enemy = match.players[enemyId];
  const nextHealth = Math.max(0, enemy.health - damage);

  return {
    ...match,
    winner: nextHealth <= 0 ? sourcePlayerId : match.winner,
    players: {
      ...match.players,
      [enemyId]: {
        ...enemy,
        health: nextHealth
      }
    }
  };
}

export function emitEvent(match: MatchState, event: GameEvent): MatchState {
  const player = match.players[event.playerId];

  switch (event.type) {
    case "TURN_START":
      if (player.commanderId === "cmd_bronze_raider") {
        return applyBronzeStartTurnDiscount(match, event.playerId);
      }
      return match;

    case "TURN_END":
      if (player.commanderId === "cmd_stone_warden") {
        return applyArmorToAllFriendly(match, event.playerId, 1);
      }
      return match;

    case "UNIT_PLAYED":
      if (event.cardId === "unit_shock_raider") {
        return dealDamageToEnemyHero(match, event.playerId, 2);
      }
      return match;

    case "UNIT_DIED":
      if (event.cardId === "unit_bomb_skull") {
        return dealDamageToEnemyHero(match, event.playerId, 2);
      }
      return match;

    default:
      return match;
  }
}