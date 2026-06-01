/**
 * POST-MATCH REWARDS HOOK — sibling to useMatchProgression. Wires match-end to
 * the rewards ledger (quests + Sigil + season track) OUTSIDE the deterministic
 * reducer.
 *
 * Like useMatchProgression, this observes a decided winner seat (computed by the
 * view layer, NOT inside the reducer) and, exactly once per decided match, feeds
 * a MatchResult summary into the pure rewards math and persists the updated
 * RewardsState to localStorage. It NEVER calls applyAction, never mutates match
 * state, and never touches the reducer or its golden fixtures.
 *
 * HARD RULE: in-game-only. Sigil + cosmetic flags only. No hex, no on-chain
 * assets, no wallet writes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RewardsState,
  MatchResult,
  applyMatchToRewards,
  purchaseCosmetic,
  loadRewards,
  saveRewards,
  resetRewards,
} from "./rewards";

type WinnerSeat = "P1" | "P2" | null;

export type UseMatchRewardsOptions = {
  /** Which seat is THIS player. Solo is always P1. */
  mySeat?: "P1" | "P2";
  /**
   * Units this player fielded this match, keyed by faction id (e.g.
   * { Stone: 5 }). Supplied by the view layer; drives "play N <faction>"
   * quests. Optional.
   */
  factionUnitsPlayed?: Record<string, number>;
  /** Clock injection for tests/determinism. Defaults to Date.now. */
  now?: () => number;
};

/**
 * @param winner The decided winner seat from the match hook (null while live).
 * @param matchKey A value that changes when a NEW match starts so the
 *   once-per-match guard re-arms. Optional.
 */
export function useMatchRewards(
  winner: WinnerSeat,
  matchKey: string | number = "default",
  options: UseMatchRewardsOptions = {}
) {
  const mySeat = options.mySeat ?? "P1";
  const now = options.now ?? (() => Date.now());

  const [rewards, setRewards] = useState<RewardsState>(() => loadRewards(now()));

  // Record at most once per matchKey; re-arms when matchKey changes.
  const recordedKeyRef = useRef<string | number | null>(null);

  useEffect(() => {
    recordedKeyRef.current = null;
  }, [matchKey]);

  useEffect(() => {
    if (!winner) return;
    if (recordedKeyRef.current === matchKey) return;
    recordedKeyRef.current = matchKey;

    const result: MatchResult = {
      won: winner === mySeat,
      factionUnitsPlayed: options.factionUnitsPlayed,
    };
    setRewards((prev) => {
      const next = applyMatchToRewards(prev, result, now());
      saveRewards(next);
      return next;
    });
    // factionUnitsPlayed/now are read at fire time; matchKey gates re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner, matchKey, mySeat]);

  /** Spend Sigil on a cosmetic; persists on success. Returns whether it stuck. */
  const buyCosmetic = useCallback((cosmeticId: string): boolean => {
    let didBuy = false;
    setRewards((prev) => {
      const res = purchaseCosmetic(prev, cosmeticId);
      if (!res.ok) return prev;
      didBuy = true;
      saveRewards(res.state);
      return res.state;
    });
    return didBuy;
  }, []);

  const reset = useCallback(() => {
    setRewards(resetRewards(now()));
    recordedKeyRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { rewards, buyCosmetic, reset };
}
