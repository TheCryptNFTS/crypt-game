import { attackHero, attackUnit } from "./combat";
import {
  endTurn,
  goToCombatPhase,
  goToEndPhase,
  playEquipmentFromHand,
  playUnitFromHand
} from "./setup";
import { Lane, MatchState, PlayerId } from "./state";

export type GameAction =
  | {
      type: "PLAY_UNIT";
      playerId: PlayerId;
      handIndex: number;
      lane: Lane;
    }
  | {
      type: "PLAY_EQUIPMENT";
      playerId: PlayerId;
      handIndex: number;
      targetInstanceId: string;
    }
  | {
      type: "ATTACK_HERO";
      playerId: PlayerId;
      attackerInstanceId: string;
    }
  | {
      type: "ATTACK_UNIT";
      playerId: PlayerId;
      attackerInstanceId: string;
      defenderInstanceId: string;
    }
  | {
      type: "GO_TO_COMBAT";
    }
  | {
      type: "GO_TO_END";
    }
  | {
      type: "END_TURN";
    };

export function performAction(match: MatchState, action: GameAction): MatchState {
  switch (action.type) {
    case "PLAY_UNIT":
      return playUnitFromHand(match, action.playerId, action.handIndex, action.lane);

    case "PLAY_EQUIPMENT":
      return playEquipmentFromHand(
        match,
        action.playerId,
        action.handIndex,
        action.targetInstanceId
      );

    case "ATTACK_HERO":
      return attackHero(match, action.playerId, action.attackerInstanceId);

    case "ATTACK_UNIT":
      return attackUnit(
        match,
        action.playerId,
        action.attackerInstanceId,
        action.defenderInstanceId
      );

    case "GO_TO_COMBAT":
      return goToCombatPhase(match);

    case "GO_TO_END":
      return goToEndPhase(match);

    case "END_TURN":
      return endTurn(match);

    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unhandled action: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}