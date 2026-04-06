import { useMemo, useState } from "react";
import {
  createNewMatch,
  playUnit,
  playEquipment,
  playArtifact,
  endPlayerTurn,
  attackTarget,
  PlayerId,
} from "../lib/gameClient";

export function useGame() {
  const [match, setMatch] = useState(() => createNewMatch());

  const actions = useMemo(
    () => ({
      reset() {
        setMatch(createNewMatch());
      },

      playUnit(playerId: PlayerId, handIndex: number, lane: "front" = "front") {
        setMatch((prev: any) => playUnit(prev, playerId, handIndex, lane));
      },

      playEquipment(playerId: PlayerId, handIndex: number, targetInstanceId: string) {
        setMatch((prev: any) =>
          playEquipment(prev, playerId, handIndex, targetInstanceId)
        );
      },

      playArtifact(playerId: PlayerId, handIndex: number) {
        setMatch((prev: any) => playArtifact(prev, playerId, handIndex));
      },

      endTurn() {
        setMatch((prev: any) => endPlayerTurn(prev));
      },

      attack(attackerInstanceId: string, defenderInstanceId?: string) {
        setMatch((prev: any) =>
          attackTarget(prev, attackerInstanceId, defenderInstanceId)
        );
      },
    }),
    []
  );

  return {
    match,
    actions,
  };
}
