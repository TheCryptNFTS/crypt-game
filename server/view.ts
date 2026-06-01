/**
 * Fog-of-war view projection.
 *
 * The authoritative `MatchState` is COMPLETE server-side — both hands, both deck
 * orders, all hidden zones. That completeness is required for determinism and
 * replay. But a client must never RECEIVE hidden information it could read out
 * of the wire (an opponent's hand contents, either deck's order). So before any
 * state leaves the server we project it down to a per-seat REDACTED `MatchView`:
 *
 *   - your own side: full hand contents, board, artifacts, energy, counts.
 *   - the opponent's side: board + artifacts (public), but hand reduced to a
 *     COUNT (no card ids), and deck reduced to a COUNT (no order, no contents).
 *   - your OWN deck: count only too — you may know how many cards remain, but the
 *     ORDER is hidden (the next-draw is server-authoritative; revealing order
 *     would leak your future draws to a cheating client).
 *
 * CRITICAL INVARIANT: this is a pure VIEW transform over a CLONE. It reads the
 * authoritative state and returns a new object; it NEVER mutates the state the
 * reducer folds over and persists. Determinism is untouched — redaction happens
 * strictly on the way out, after the reducer has computed the full truth.
 *
 * The shape mirrors `src/game-ui/useRemoteCryptMatch.ts`'s `MatchView`
 * (self/opponent ViewSide + turn/activePlayer/winner/mySeat/matchId), so the
 * client's `viewToMatch` adapter consumes it directly. The opponent's `hand`
 * field is intentionally OMITTED — only `handCount` is sent — so there is
 * literally nothing for a tampering client to inspect.
 */

import type { MatchState, Seat } from "./types";
import type { PlayerState } from "../src/engine/state";

/** One side of the redacted view (mirrors the client's `ViewSide`). */
export interface ViewSide {
  nexusHealth: number;
  energy: number;
  maxEnergy: number;
  /** Present ONLY for your own side (full card ids). Omitted for the opponent. */
  hand?: string[];
  /** Always present: number of cards in hand (the only hand info about the foe). */
  handCount: number;
  /** Always present: number of cards left in deck. ORDER is never revealed. */
  deckCount: number;
  board: {
    front: PlayerState["board"]["front"];
    back: PlayerState["board"]["back"];
  };
  artifacts: PlayerState["artifacts"];
}

/** The per-seat redacted projection sent to a client (mirrors `MatchView`). */
export interface MatchView {
  matchId: string;
  turn: number;
  activePlayer: Seat;
  winner: Seat | null;
  mySeat: Seat;
  self: ViewSide;
  opponent: ViewSide;
}

/** Effective deck size: prefer the live array length, fall back to deckCount. */
function deckSize(p: PlayerState): number {
  return Array.isArray(p.deck) ? p.deck.length : p.deckCount ?? 0;
}

/** Project YOUR own side: hand contents visible, deck order hidden (count only). */
function selfSide(p: PlayerState): ViewSide {
  return {
    nexusHealth: p.nexusHealth,
    energy: p.energy,
    maxEnergy: p.maxEnergy,
    // Defensive copies so the caller can never reach back into authoritative state.
    hand: [...p.hand],
    handCount: p.hand.length,
    deckCount: deckSize(p),
    board: {
      front: structuredClone(p.board.front),
      back: structuredClone(p.board.back),
    },
    artifacts: structuredClone(p.artifacts),
  };
}

/** Project the OPPONENT's side: public board/artifacts, hand + deck as counts
 *  only. The `hand` field is OMITTED entirely — no card ids ever cross. */
function opponentSide(p: PlayerState): ViewSide {
  return {
    nexusHealth: p.nexusHealth,
    energy: p.energy,
    maxEnergy: p.maxEnergy,
    // NO `hand` field — count only.
    handCount: p.hand.length,
    deckCount: deckSize(p),
    board: {
      front: structuredClone(p.board.front),
      back: structuredClone(p.board.back),
    },
    artifacts: structuredClone(p.artifacts),
  };
}

/**
 * Build the redacted view for `seat` from the COMPLETE authoritative state.
 * Pure: reads `state`, returns a fresh `MatchView`; never mutates `state`.
 */
export function projectViewForSeat(
  matchId: string,
  state: MatchState,
  seat: Seat,
  /**
   * Optional server-side outcome override (a forfeit from concede/timeout). The
   * engine has no concede action, so a forfeit winner lives outside `state`; the
   * caller passes it here so the client sees a decided match. When set it wins
   * over the engine's own `state.winner` (a forfeit ends the match immediately).
   */
  winnerOverride?: Seat | null
): MatchView {
  const oppSeat: Seat = seat === "P1" ? "P2" : "P1";
  return {
    matchId,
    turn: state.turn,
    activePlayer: state.activePlayer,
    winner: winnerOverride ?? state.winner ?? null,
    mySeat: seat,
    self: selfSide(state.players[seat]),
    opponent: opponentSide(state.players[oppSeat]),
  };
}

/**
 * Build a NEUTRAL SPECTATOR view from the COMPLETE authoritative state.
 *
 * A spectator owns NO seat and is entitled to NO private information about
 * EITHER player. So we project BOTH sides through the SAME `opponentSide()`
 * redactor the player transport already uses for the foe — the projection that
 * OMITS the `hand` field entirely (count only) and reveals no deck ORDER. The
 * spectator view is therefore the INTERSECTION of what is public to each seat:
 * board + artifacts + nexus/energy + hand/deck COUNTS, and nothing hidden.
 *
 * There is no privileged vantage: `self` is fixed to P1 and `opponent` to P2
 * purely so the existing client `viewToMatch` adapter (which keys off
 * `mySeat`) can render the board; NEITHER side carries a `hand` array, so the
 * seat labels grant the spectator no extra information. This reuses the SAME
 * fog redactor as the player path rather than hand-rolling a second one — the
 * one place hidden zones are stripped stays the one place.
 *
 * Pure: reads `state`, returns a fresh `MatchView`; never mutates `state`.
 */
export function projectSpectatorView(
  matchId: string,
  state: MatchState,
  winnerOverride?: Seat | null
): MatchView {
  return {
    matchId,
    turn: state.turn,
    activePlayer: state.activePlayer,
    winner: winnerOverride ?? state.winner ?? null,
    // Fixed neutral labelling: a spectator is "P1-vantage" only so the client
    // adapter can render, but BOTH sides are redacted to public-only — neither
    // is the spectator's own hand, so no seat privilege is granted.
    mySeat: "P1",
    self: opponentSide(state.players.P1),
    opponent: opponentSide(state.players.P2),
  };
}
