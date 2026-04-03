import { attackHero, attackUnit } from "./combat";
import {
  createMatch,
  endTurn,
  goToCombatPhase,
  goToEndPhase,
  playEquipmentFromHand,
  playSpellFromHand,
  playUnitFromHand
} from "./setup";
import { MatchState, PlayerId, Lane } from "./state";

export type GameAction =
  | {
      type: "CREATE_MATCH";
    }
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
      type: "PLAY_SPELL";
      playerId: PlayerId;
      handIndex: number;
      targetInstanceId?: string;
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

export function performAction(match: MatchState | null, action: GameAction): MatchState {
  switch (action.type) {
    case "CREATE_MATCH":
      return createMatch();

    case "PLAY_UNIT":
      if (!match) throw new Error("No match exists");
      return playUnitFromHand(match, action.playerId, action.handIndex, action.lane);

    case "PLAY_EQUIPMENT":
      if (!match) throw new Error("No match exists");
      return playEquipmentFromHand(
        match,
        action.playerId,
        action.handIndex,
        action.targetInstanceId
      );

    case "PLAY_SPELL":
      if (!match) throw new Error("No match exists");
      return playSpellFromHand(
        match,
        action.playerId,
        action.handIndex,
        action.targetInstanceId
      );

    case "ATTACK_HERO":
      if (!match) throw new Error("No match exists");
      return attackHero(match, action.playerId, action.attackerInstanceId);

    case "ATTACK_UNIT":
      if (!match) throw new Error("No match exists");
      return attackUnit(
        match,
        action.playerId,
        action.attackerInstanceId,
        action.defenderInstanceId
      );

    case "GO_TO_COMBAT":
      if (!match) throw new Error("No match exists");
      return goToCombatPhase(match);

    case "GO_TO_END":
      if (!match) throw new Error("No match exists");
      return goToEndPhase(match);

    case "END_TURN":
      if (!match) throw new Error("No match exists");
      return endTurn(match);

    default:
      throw new Error("Unknown action type");
  }
}