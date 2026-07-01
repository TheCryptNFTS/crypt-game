/**
 * SNAP REDUCER — Cut 1. Pure, deterministic, reject-soft.
 *
 * Only two actions exist: place a card in a Crypt, and end your turn. There is
 * no attack, no rows, no targeting, no stack, no phases. Illegal actions return
 * the SAME state object (reject-soft) so the UI can dispatch freely and the
 * planner can probe without corrupting state.
 *
 * Turn model (sequential for Cut 1 — vanilla cards make sequential and
 * simultaneous reveal mechanically identical since power just sums):
 *   P1 places (energy = turn) → END_TURN → P2 places → END_TURN → round resolves
 *   (turn++, both refill energy to the new turn number and draw 1). At the end
 *   of turn 6 the board is scored: higher power wins each Crypt, 2 of 3 wins.
 */

import { detectSnapWinner, laneOutcomes } from "./scoreLane";
import {
  LANE_CAPACITY,
  MAX_TURNS,
  type Seat,
  type SnapAction,
  type SnapCard,
  type SnapPlayerState,
  type SnapState,
} from "./types";

/** Draw the top card of a player's deck into hand (mutates the given player). */
function drawOne(player: SnapPlayerState): void {
  const card = player.deck.shift();
  if (card) player.hand.push(card);
}

/** Settle the match: score every Crypt and set the winner. Mutates `s`. */
function settle(s: SnapState): void {
  s.outcomes = laneOutcomes(s);
  s.winner = detectSnapWinner(s);
  const p1Lanes = s.outcomes.filter((o) => o.winner === "P1").length;
  const p2Lanes = s.outcomes.filter((o) => o.winner === "P2").length;
  const verdict =
    s.winner === "DRAW"
      ? "Stalemate — the Crypts hold even."
      : `${s.winner} takes the vault (${p1Lanes}–${p2Lanes} Crypts).`;
  s.log.push(verdict);
}

export function snapReducer(state: SnapState, action: SnapAction): SnapState {
  // A decided match is frozen.
  if (state.winner) return state;
  // You can only act on your own turn.
  if (action.seat !== state.active) return state;

  const s: SnapState = structuredClone(state);
  const player = s.players[action.seat];

  switch (action.type) {
    case "PLAY_CARD": {
      const idx = player.hand.findIndex((c) => c.instanceId === action.instanceId);
      if (idx < 0) return state; // not in hand
      const card = player.hand[idx];
      if (player.energy < card.cost) return state; // can't afford
      const lane = s.lanes[action.lane];
      if (!lane) return state; // bad lane
      const side = action.seat === "P1" ? lane.P1 : lane.P2;
      if (side.length >= LANE_CAPACITY) return state; // Crypt full for this seat

      // Commit: hand → Crypt, spend energy.
      player.hand.splice(idx, 1);
      side.push(card);
      player.energy -= card.cost;
      s.log.push(`${action.seat} plays ${card.name} (${card.power}⚔) to Crypt ${action.lane + 1}.`);
      return s;
    }

    case "END_TURN": {
      if (s.active === "P1") {
        // Hand the round to P2.
        s.active = "P2";
        return s;
      }
      // P2 just ended → the round resolves.
      if (s.turn >= MAX_TURNS) {
        settle(s);
        return s;
      }
      s.turn += 1;
      for (const seat of ["P1", "P2"] as Seat[]) {
        const p = s.players[seat];
        p.energy = s.turn; // energy = the turn number
        drawOne(p);
      }
      s.active = "P1";
      s.log.push(`— Turn ${s.turn} — ${s.turn} energy.`);
      return s;
    }

    default:
      return state;
  }
}

/** Cards a seat can legally place right now (in hand + affordable). Pure helper. */
export function playableHand(state: SnapState, seat: Seat): SnapCard[] {
  if (state.winner || state.active !== seat) return [];
  const p = state.players[seat];
  return p.hand.filter((c) => c.cost <= p.energy);
}
