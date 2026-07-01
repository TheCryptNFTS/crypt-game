/**
 * LANE SCORING — the single source of truth for "who is winning".
 *
 * Both the reducer (to decide the match at turn 6) and the AI planner (to pick
 * where to place) call THESE functions. Sharing one scorer is what keeps the AI
 * from desyncing with the rules: the planner can only ever reason about the same
 * numbers the reducer will settle on.
 */

import type { SnapLane, SnapState, SnapWinner, Seat, LaneOutcome } from "./types";

/** Total committed power for one seat in one Crypt. */
export function lanePower(lane: SnapLane, seat: Seat): number {
  const cards = seat === "P1" ? lane.P1 : lane.P2;
  let total = 0;
  for (const c of cards) total += c.power;
  return total;
}

/** Who currently holds a single Crypt (higher power), or "DRAW" if tied. */
export function laneWinner(lane: SnapLane): SnapWinner {
  const p1 = lanePower(lane, "P1");
  const p2 = lanePower(lane, "P2");
  if (p1 > p2) return "P1";
  if (p2 > p1) return "P2";
  return "DRAW";
}

/** Per-lane breakdown across all Crypts. */
export function laneOutcomes(state: SnapState): LaneOutcome[] {
  return state.lanes.map((lane) => ({
    index: lane.index,
    p1Power: lanePower(lane, "P1"),
    p2Power: lanePower(lane, "P2"),
    winner: laneWinner(lane),
  }));
}

/**
 * Decide the match from the current board. Marvel-Snap rules:
 *   1. Win the most Crypts.
 *   2. On a tie in Crypts won, the higher TOTAL power across all Crypts wins.
 *   3. Still tied → DRAW.
 * Pure — does not mutate state.
 */
export function detectSnapWinner(state: SnapState): SnapWinner {
  const outcomes = laneOutcomes(state);
  let p1Lanes = 0;
  let p2Lanes = 0;
  let p1Total = 0;
  let p2Total = 0;
  for (const o of outcomes) {
    p1Total += o.p1Power;
    p2Total += o.p2Power;
    if (o.winner === "P1") p1Lanes += 1;
    else if (o.winner === "P2") p2Lanes += 1;
  }
  if (p1Lanes > p2Lanes) return "P1";
  if (p2Lanes > p1Lanes) return "P2";
  // Crypt count tied → total power decides.
  if (p1Total > p2Total) return "P1";
  if (p2Total > p1Total) return "P2";
  return "DRAW";
}
