import { MatchState } from "./state";

export type GameEvent =
  | {
      type: "UNIT_ATTACKED";
      attackerId: string;
      defenderId: string;
    }
  | {
      type: "HERO_ATTACKED";
      attackerId: string;
      defenderPlayerId: "P1" | "P2";
      damage: number;
    }
  | {
      type: "UNIT_DIED";
      unitId: string;
      cardId: string;
      ownerId: "P1" | "P2";
    };

export function emitEvent(match: MatchState, event: GameEvent): MatchState {
  console.log(`\n=== EVENT: ${event.type} ===`);
  console.log(JSON.stringify(event, null, 2));
  return match;
}