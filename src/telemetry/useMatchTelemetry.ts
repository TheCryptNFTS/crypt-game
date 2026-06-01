/**
 * MATCH-END TELEMETRY HOOK — records a decided match to a `TelemetrySink`
 * EXACTLY ONCE per match, alongside the existing progression hook and OUTSIDE
 * the deterministic reducer. It observes the view-layer `winner` (never calls
 * applyAction, never mutates match state, never touches the golden fixtures).
 *
 * Mirrors `useMatchProgression`'s once-per-matchKey guard so the same match is
 * never double-logged across re-renders. In-game-only analytics: no hex, no
 * wallet, no on-chain writes.
 */

import { useEffect, useRef } from "react";
import { TelemetrySink, Seat } from "./types";
import { defaultSink } from "./sinks";
import { recordMatch } from "./logger";

type WinnerSeat = Seat | null;

export interface UseMatchTelemetryInput {
  /** Decided winner from the match hook (null while live). */
  winner: WinnerSeat;
  /** Changes when a NEW match starts so the once-guard re-arms (e.g. seed). */
  matchKey: string | number;
  /** Facts to stamp onto the record when the match decides. */
  mySeat: Seat;
  myFaction: string;
  opponentFaction: string;
  turns: number;
  cardsPlayed: number;
  /** MMR delta from the progression hook (pass the just-applied exchange). */
  mmrDelta: number;
}

export function useMatchTelemetry(
  input: UseMatchTelemetryInput,
  sink: TelemetrySink = defaultSink
): void {
  const recordedKeyRef = useRef<string | number | null>(null);

  // New match — re-arm.
  useEffect(() => {
    recordedKeyRef.current = null;
  }, [input.matchKey]);

  useEffect(() => {
    if (!input.winner) return;
    if (recordedKeyRef.current === input.matchKey) return;
    recordedKeyRef.current = input.matchKey;

    recordMatch(
      {
        matchId: String(input.matchKey),
        winner: input.winner,
        mySeat: input.mySeat,
        myFaction: input.myFaction,
        opponentFaction: input.opponentFaction,
        turns: input.turns,
        cardsPlayed: input.cardsPlayed,
        mmrDelta: input.mmrDelta,
      },
      sink
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.winner, input.matchKey]);
}
