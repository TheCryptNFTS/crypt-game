/**
 * META-GAME RATING (Elo) — pure, deterministic, in-game-only.
 *
 * This module computes an Elo-style skill rating from a decided match. It is
 * SEPARATE from the deterministic match reducer and never touches game state,
 * RNG, or the golden fixtures. Ratings are an in-game-only scalar (a number):
 * they represent skill, NOT any on-chain asset. Nothing here mints, credits, or
 * sources real "hex" or any token. See src/meta/progression.ts for the same
 * hard rule applied to XP/levels/stars.
 *
 * All functions are pure: same inputs -> same outputs, no randomness, no I/O.
 */

/** Default Elo K-factor. Higher = ratings move faster per game. */
export const DEFAULT_K = 32;

/** The rating every new player starts at (and the soft-reset baseline). */
export const BASELINE_RATING = 1000;

/** Floor so a rating can never go negative / spiral below a sane minimum. */
export const MIN_RATING = 100;

export type MatchResultInput = {
  winnerId: string;
  loserId: string;
  /** Optional override for the K-factor; defaults to DEFAULT_K. */
  k?: number;
};

export type RatingDelta = {
  /** Points the winner gains (>= 0). */
  winnerDelta: number;
  /** Points the loser loses (<= 0). */
  loserDelta: number;
};

/**
 * Elo expected score for player A against player B. Returns a probability in
 * (0,1): the share of a "win" A is expected to take given the rating gap.
 * E_A = 1 / (1 + 10^((ratingB - ratingA) / 400)).
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Core Elo update for a decided game (no draws here — TCG matches resolve to a
 * winner). Returns the integer point movement for each side.
 *
 * Winner scored 1 vs expected E_w, loser scored 0 vs expected E_l. Because
 * E_w + E_l = 1, the raw (pre-rounding) deltas are exactly equal and opposite,
 * i.e. zero-sum. We round to whole points; the rounding is symmetric so the
 * reported winnerDelta and -loserDelta match within at most 1 point.
 */
export function computeRatingDelta(
  winnerRating: number,
  loserRating: number,
  k: number = DEFAULT_K
): RatingDelta {
  const expectedWinner = expectedScore(winnerRating, loserRating);
  const expectedLoser = expectedScore(loserRating, winnerRating);

  // Winner: actual 1, loser: actual 0.
  const rawWinner = k * (1 - expectedWinner);
  const rawLoser = k * (0 - expectedLoser);

  const winnerDelta = Math.round(rawWinner);
  // Mirror the winner's rounded delta so the exchange stays exactly zero-sum
  // after rounding (no points created or destroyed by rounding bias).
  const loserDelta = -winnerDelta;

  // Keep loserDelta referenced for clarity even though we mirror it.
  void rawLoser;

  return { winnerDelta, loserDelta };
}

export type RatingState = {
  /** playerId -> current rating. Missing players are treated as BASELINE. */
  ratings: Record<string, number>;
};

export function ratingOf(state: RatingState, id: string): number {
  return state.ratings[id] ?? BASELINE_RATING;
}

/**
 * Apply a decided match to a rating table, returning a NEW state (immutable).
 * Pure: deterministic, no side effects. Ratings are clamped at MIN_RATING.
 */
export function applyMatchResult(
  state: RatingState,
  result: MatchResultInput
): { state: RatingState; delta: RatingDelta } {
  const winnerRating = ratingOf(state, result.winnerId);
  const loserRating = ratingOf(state, result.loserId);
  const delta = computeRatingDelta(winnerRating, loserRating, result.k ?? DEFAULT_K);

  const nextRatings: Record<string, number> = { ...state.ratings };
  nextRatings[result.winnerId] = Math.max(MIN_RATING, winnerRating + delta.winnerDelta);
  nextRatings[result.loserId] = Math.max(MIN_RATING, loserRating + delta.loserDelta);

  return { state: { ratings: nextRatings }, delta };
}
