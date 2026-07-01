/**
 * useSnapMatch — React binding for the Cut-1 Snap engine.
 *
 * Owns match state + the tap-to-select / tap-a-Crypt-to-place interaction, and
 * auto-plays P2 (AI) with a short reveal beat between placements. The whole
 * public surface is: which card is selected, place it in a Crypt, end the turn,
 * reset. No attack, no targets, no phases.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSnapMatch } from "./setup";
import { snapReducer, playableHand } from "./reducer";
import { planP2Turn } from "./ai";
import type { LaneIndex, SnapState } from "./types";

export type UseSnapMatchOptions = { seed?: number };

export function useSnapMatch(options: UseSnapMatchOptions = {}) {
  const [matchKey, setMatchKey] = useState(0);
  const [state, setState] = useState<SnapState>(() =>
    createSnapMatch({ seed: options.seed }),
  );
  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);

  // AI turn: when it becomes P2's phase, place its cards one at a time for a
  // readable reveal, then the last END_TURN resolves the round.
  //
  // StrictMode-safe by construction: the `setState` updater is PURE (a fixed
  // pre-planned action per tick — no closure mutation), and the step index lives
  // in a ref advanced OUTSIDE setState. The effect deps are the primitive
  // (active, turn) — which don't change while P2 is placing — so the single
  // interval steps the whole turn; only the final END_TURN flips deps and ends
  // it. No persistent guard (which would break mount→cleanup→remount).
  const stepRef = useRef(0);
  useEffect(() => {
    if (state.winner || state.active !== "P2") return;
    const actions = planP2Turn(state);
    stepRef.current = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    // A short readable hold before the first placement so the "Opponent's turn"
    // beat registers (End Turn → beat → card appears → score changes) even when
    // the AI has only one play. Snappy, not cinematic — then step at 520ms.
    const hold = setTimeout(() => {
      timer = setInterval(() => {
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
      }, 520);
    }, 220);
    return () => {
      clearTimeout(hold);
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.active, state.turn, state.winner, matchKey]);

  const placeInLane = useCallback(
    (lane: LaneIndex) => {
      if (!selectedHandId || state.active !== "P1" || state.winner) return;
      setState((prev) => {
        const next = snapReducer(prev, {
          type: "PLAY_CARD",
          seat: "P1",
          instanceId: selectedHandId,
          lane,
        });
        return next;
      });
      setSelectedHandId(null);
    },
    [selectedHandId, state.active, state.winner],
  );

  const endTurn = useCallback(() => {
    if (state.active !== "P1" || state.winner) return;
    setSelectedHandId(null);
    setState((prev) => snapReducer(prev, { type: "END_TURN", seat: "P1" }));
  }, [state.active, state.winner]);

  const reset = useCallback(() => {
    stepRef.current = 0;
    setSelectedHandId(null);
    setState(createSnapMatch({ seed: options.seed ? options.seed + matchKey + 1 : undefined }));
    setMatchKey((k) => k + 1);
  }, [options.seed, matchKey]);

  const playable = useMemo(() => playableHand(state, "P1"), [state]);
  const playableIds = useMemo(() => new Set(playable.map((c) => c.instanceId)), [playable]);

  return {
    state,
    matchKey,
    selectedHandId,
    setSelectedHandId,
    placeInLane,
    endTurn,
    reset,
    playableIds,
    energy: state.players.P1.energy,
    turn: state.turn,
    myTurn: state.active === "P1" && !state.winner,
  };
}
