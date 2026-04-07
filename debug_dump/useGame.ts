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

const COMBAT_LOG_CAP = 50;

function capLog(lines: string[]): string[] {
  if (lines.length <= COMBAT_LOG_CAP) return lines;
  return lines.slice(-COMBAT_LOG_CAP);
}

export function useGame() {
  const [match, setMatch] = useState(() => createNewMatch());
  const [combatLog, setCombatLog] = useState<string[]>([]);

  const appendLog = (line: string) => {
    setCombatLog((prev) => capLog([...prev, line]));
  };

  const actions = useMemo(
    () => ({
      reset() {
        setMatch(createNewMatch());
        setCombatLog([]);
      },

      playUnit(playerId: PlayerId, handIndex: number, lane: "front" = "front") {
        setMatch((prev: any) => {
          try {
            const next = playUnit(prev, playerId, handIndex, lane);
            queueMicrotask(() =>
              appendLog(`${playerId} played a unit from hand index ${handIndex}.`)
            );
            return next;
          } catch {
            return prev;
          }
        });
      },

      playEquipment(playerId: PlayerId, handIndex: number, targetInstanceId: string) {
        setMatch((prev: any) => {
          try {
            const next = playEquipment(prev, playerId, handIndex, targetInstanceId);
            queueMicrotask(() =>
              appendLog(
                `${playerId} played equipment from hand index ${handIndex} onto ${targetInstanceId}.`
              )
            );
            return next;
          } catch {
            return prev;
          }
        });
      },

      playArtifact(playerId: PlayerId, handIndex: number) {
        setMatch((prev: any) => {
          try {
            const next = playArtifact(prev, playerId, handIndex);
            queueMicrotask(() =>
              appendLog(`${playerId} played an artifact from hand index ${handIndex}.`)
            );
            return next;
          } catch {
            return prev;
          }
        });
      },

      endTurn() {
        setMatch((prev: any) => {
          try {
            const next = endPlayerTurn(prev);
            queueMicrotask(() => appendLog(`Turn ended. Active: ${next.activePlayer}.`));
            return next;
          } catch {
            return prev;
          }
        });
      },

      attack(attackerInstanceId: string, defenderInstanceId?: string) {
        setMatch((prev: any) => {
          try {
            const next = attackTarget(prev, attackerInstanceId, defenderInstanceId);
            const target = defenderInstanceId ?? "opposing player";
            queueMicrotask(() =>
              appendLog(`Attack: ${attackerInstanceId} → ${target}.`)
            );
            return next;
          } catch {
            return prev;
          }
        });
      },
    }),
    []
  );

  return {
    match,
    combatLog,
    actions,
  };
}
