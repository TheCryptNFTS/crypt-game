/**
 * SNAP AI — Cut 1 greedy lane planner.
 *
 * The planner reasons with the EXACT SAME `lanePower`/scorer the reducer settles
 * with, so the AI can never "want" something the rules won't deliver (the #1
 * desync risk called out in the audit). It plays P2's whole turn: repeatedly
 * place the affordable card whose placement most improves P2's Crypt position,
 * until it can't afford anything, then ends the turn.
 */

import { lanePower } from "./scoreLane";
import { snapReducer, playableHand } from "./reducer";
import {
  LANE_CAPACITY,
  type LaneIndex,
  type SnapAction,
  type SnapCard,
  type SnapState,
} from "./types";

/** +1 win / 0 tie / -1 loss for a hypothetical P2 power total in one lane. */
function sign(p2: number, p1: number): number {
  if (p2 > p1) return 1;
  if (p2 < p1) return -1;
  return 0;
}

/**
 * Value of placing `card` in lane `laneIdx` for P2. Flipping a Crypt from
 * lost/tied to won is worth far more than raw power; ties broken by committing
 * power to already-contested Crypts and by the card's own power.
 */
function placementScore(state: SnapState, laneIdx: LaneIndex, card: SnapCard): number {
  const lane = state.lanes[laneIdx];
  const p1 = lanePower(lane, "P1");
  const p2 = lanePower(lane, "P2");
  const before = sign(p2, p1);
  const after = sign(p2 + card.power, p1);
  const flipGain = after - before; // 0, 1, or 2
  // Prefer flipping a Crypt we don't already own; then developing power where
  // the margin is thin; then just banking power.
  return flipGain * 100 + card.power - Math.max(0, p2 - p1) * 0.5;
}

/**
 * Plan P2's entire turn as an ordered action list ending in END_TURN. Pure:
 * runs its own throwaway copy of the reducer to track energy/hand/capacity, and
 * never mutates the passed state.
 */
export function planP2Turn(state: SnapState): SnapAction[] {
  const actions: SnapAction[] = [];
  let working = state;
  let guard = 0;

  while (guard++ < 32) {
    const affordable = playableHand(working, "P2");
    if (affordable.length === 0) break;

    let best: { action: SnapAction; score: number } | null = null;
    for (const card of affordable) {
      for (let l = 0; l < working.lanes.length; l++) {
        const lane = working.lanes[l];
        if (lane.P2.length >= LANE_CAPACITY) continue;
        const score = placementScore(working, l as LaneIndex, card);
        if (!best || score > best.score) {
          best = {
            action: { type: "PLAY_CARD", seat: "P2", instanceId: card.instanceId, lane: l as LaneIndex },
            score,
          };
        }
      }
    }
    if (!best) break;

    const next = snapReducer(working, best.action);
    if (next === working) break; // reject-soft: nothing changed, stop looping
    working = next;
    actions.push(best.action);
  }

  actions.push({ type: "END_TURN", seat: "P2" });
  return actions;
}
