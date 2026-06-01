/**
 * TELEMETRY TYPES — the shape of a recorded match result + the pluggable sink
 * contract. Pure data + interfaces only; NO engine / reducer imports, so this
 * module is browser-safe and never touches game state, RNG, or the golden.
 *
 * A "TelemetryEvent" is a flat, serialisable record of ONE decided match,
 * observed from the meta layer (winner + faction matchup + counts + MMR delta).
 * It is in-game-only analytics: it never carries hex, wallet, or on-chain data.
 */

export type Seat = "P1" | "P2";

/** A single decided-match record. All fields plain JSON, so any sink can persist
 *  it verbatim and the dev report can aggregate it without the engine. */
export interface MatchTelemetry {
  /** Stable per-match id (e.g. the match seed stringified, or a uuid). */
  matchId: string;
  /** Epoch ms the record was created (Date.now at log time). */
  timestamp: number;
  /** Winning seat (matches resolve to a winner — no draws). */
  winner: Seat;
  /** This player's seat, so the report can compute win-rate from your view. */
  mySeat: Seat;
  /** Faction the player piloted (free-form string; the report buckets by it). */
  myFaction: string;
  /** Faction the opponent piloted. */
  opponentFaction: string;
  /** Total turns the match lasted. */
  turns: number;
  /** Cards played by this player over the match. */
  cardsPlayed: number;
  /** MMR / rating delta this player earned (+win, -loss). */
  mmrDelta: number;
}

/**
 * PLUGGABLE SINK — where recorded telemetry goes. The default sink persists to
 * localStorage (or an in-memory fallback off-browser); a no-op remote sink stub
 * stands in for a future network exporter. Implementations MUST be synchronous-
 * safe and never throw into the caller (the hook fires on match-end render).
 */
export interface TelemetrySink {
  /** Append one record. */
  record(event: MatchTelemetry): void;
  /** Read everything buffered so far (most-recent order is sink-defined). */
  readAll(): MatchTelemetry[];
  /** Drop all buffered records. */
  clear(): void;
}
