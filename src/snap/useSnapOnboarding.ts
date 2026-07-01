/**
 * useSnapOnboarding — React binding for the scripted first match.
 *
 * Same interaction shape as useSnapMatch (tap card → tap Crypt → end turn), but
 * the match is the fixed onboarding scenario and the opponent follows a scripted
 * weak line instead of the greedy AI. The board layer (SnapOnboardingBoard) adds
 * the coach: it restricts input to the one expected play each turn so a newcomer
 * cannot wander off the guaranteed-win rails.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildOnboardingMatch, planOpponentTurn } from "./onboarding";
import { snapReducer, playableHand } from "./reducer";
import type { LaneIndex, SnapState } from "./types";

export function useSnapOnboarding() {
  const [matchKey, setMatchKey] = useState(0);
  const [state, setState] = useState<SnapState>(() => buildOnboardingMatch());
  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);

  // Scripted opponent — identical StrictMode-safe pattern to useSnapMatch: a PURE
  // updater, a fixed pre-planned action per tick, step index in a ref advanced
  // OUTSIDE setState, primitive deps only. A touch slower (700ms) than free play
  // so a first-timer can read what the opponent did.
  const stepRef = useRef(0);
  useEffect(() => {
    if (state.winner || state.active !== "P2") return;
    const actions = planOpponentTurn(state);
    stepRef.current = 0;
    const timer = setInterval(() => {
      const idx = stepRef.current;
      if (idx >= actions.length) {
        clearInterval(timer);
        return;
      }
      stepRef.current = idx + 1;
      const action = actions[idx];
      setState((prev) =>
        prev.active === "P2" && !prev.winner ? snapReducer(prev, action) : prev,
      );
    }, 700);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.active, state.turn, state.winner, matchKey]);

  const placeInLane = useCallback(
    (lane: LaneIndex) => {
      if (!selectedHandId || state.active !== "P1" || state.winner) return;
      setState((prev) =>
        snapReducer(prev, { type: "PLAY_CARD", seat: "P1", instanceId: selectedHandId, lane }),
      );
      setSelectedHandId(null);
    },
    [selectedHandId, state.active, state.winner],
  );

  const endTurn = useCallback(() => {
    if (state.active !== "P1" || state.winner) return;
    setSelectedHandId(null);
    setState((prev) => snapReducer(prev, { type: "END_TURN", seat: "P1" }));
  }, [state.active, state.winner]);

  const restart = useCallback(() => {
    stepRef.current = 0;
    setSelectedHandId(null);
    setState(buildOnboardingMatch());
    setMatchKey((k) => k + 1);
  }, []);

  const playable = useMemo(() => playableHand(state, "P1"), [state]);
  const playableIds = useMemo(() => new Set(playable.map((c) => c.instanceId)), [playable]);

  return {
    state,
    matchKey,
    selectedHandId,
    setSelectedHandId,
    placeInLane,
    endTurn,
    restart,
    playableIds,
    energy: state.players.P1.energy,
    turn: state.turn,
    myTurn: state.active === "P1" && !state.winner,
  };
}
