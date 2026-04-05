import { MatchState, PlayerId } from "./state";

export type GameEvent =
  | {
      type: "UNIT_PLAYED";
      playerId: PlayerId;
      cardId: string;
      instanceId: string;
    }
  | {
      type: "TURN_START";
      playerId: PlayerId;
    }
  | {
      type: "TURN_END";
      playerId: PlayerId;
    }
  | {
      type: "UNIT_ATTACKED";
      attackerId: string;
      defenderId: string;
    }
  | {
      type: "HERO_ATTACKED";
      attackerId: string;
      defenderPlayerId: PlayerId;
      damage: number;
    }
  | {
      type: "UNIT_DIED";
      unitId: string;
      cardId: string;
      ownerId: PlayerId;
    };

export function emitEvent(match: MatchState, _event: GameEvent): MatchState {
  return match;
}