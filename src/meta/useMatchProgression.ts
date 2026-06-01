/**
 * POST-MATCH PROGRESSION HOOK — wires match-end to the meta layer OUTSIDE the
 * deterministic reducer.
 *
 * This hook observes the local match's `winner` (computed by the view layer,
 * NOT inside the reducer) and, exactly once per decided match, feeds the result
 * into the rating + progression math and persists the updated PlayerProfile to
 * localStorage. It NEVER calls applyAction, never mutates match state, and never
 * touches the reducer or its golden fixtures.
 *
 * HARD RULE: in-game-only. No hex, no on-chain assets, no wallet writes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PlayerProfile,
  applyMatchToProfile,
  loadProfile,
  saveProfile,
  resetProfile,
} from "./progression";
import { BASELINE_RATING } from "./rating";

type WinnerSeat = "P1" | "P2" | null;

export type UseMatchProgressionOptions = {
  /** Local profile id; defaults to "local". */
  playerId?: string;
  /**
   * The MMR to treat the AI/opponent as for the Elo exchange. Solo play has no
   * real opponent rating, so we use the baseline by default. PvP can pass the
   * real opponent rating here.
   */
  opponentRating?: number;
  /** Which seat is THIS player. Solo is always P1. */
  mySeat?: "P1" | "P2";
};

/**
 * @param winner The decided winner seat from the match hook (null while live).
 * @param matchKey A value that changes when a NEW match starts (e.g. a reset
 *   counter or match id) so the same-winner guard re-arms per match. Optional.
 */
export function useMatchProgression(
  winner: WinnerSeat,
  matchKey: string | number = "default",
  options: UseMatchProgressionOptions = {}
) {
  const playerId = options.playerId ?? "local";
  const opponentRating = options.opponentRating ?? BASELINE_RATING;
  const mySeat = options.mySeat ?? "P1";

  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile(playerId));

  // Guard: record at most once per (matchKey). Re-arms when matchKey changes.
  const recordedKeyRef = useRef<string | number | null>(null);

  useEffect(() => {
    // New match started — allow recording again.
    recordedKeyRef.current = null;
  }, [matchKey]);

  useEffect(() => {
    if (!winner) return;
    if (recordedKeyRef.current === matchKey) return;
    recordedKeyRef.current = matchKey;

    const won = winner === mySeat;
    setProfile((prev) => {
      const next = applyMatchToProfile(prev, { won, opponentRating });
      saveProfile(next);
      return next;
    });
  }, [winner, matchKey, mySeat, opponentRating]);

  const reset = useCallback(() => {
    setProfile(resetProfile(playerId));
    recordedKeyRef.current = null;
  }, [playerId]);

  return { profile, reset };
}
