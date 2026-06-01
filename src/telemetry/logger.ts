/**
 * TELEMETRY LOGGER + AGGREGATION — pure helpers over a `TelemetrySink`.
 *
 * `recordMatch` writes one decided-match record to a sink. `aggregateByFaction`
 * folds a list of records into per-faction win/loss/win-rate buckets (computed
 * from the player's own seat). Both are pure (the sink is the only side-effect
 * surface) and engine-free, so the dev report and the React hook share them.
 */

import { MatchTelemetry, TelemetrySink, Seat } from "./types";
import { defaultSink } from "./sinks";

/** The minimal facts a match-end caller knows; the logger stamps id/timestamp. */
export interface RecordMatchInput {
  matchId: string;
  winner: Seat;
  mySeat: Seat;
  myFaction: string;
  opponentFaction: string;
  turns: number;
  cardsPlayed: number;
  mmrDelta: number;
  /** Override the timestamp (tests pass a fixed value for determinism). */
  timestamp?: number;
}

/** Record one decided match into `sink` (defaults to the shared default sink). */
export function recordMatch(
  input: RecordMatchInput,
  sink: TelemetrySink = defaultSink
): MatchTelemetry {
  const event: MatchTelemetry = {
    matchId: input.matchId,
    timestamp: input.timestamp ?? Date.now(),
    winner: input.winner,
    mySeat: input.mySeat,
    myFaction: input.myFaction,
    opponentFaction: input.opponentFaction,
    turns: input.turns,
    cardsPlayed: input.cardsPlayed,
    mmrDelta: input.mmrDelta,
  };
  sink.record(event);
  return event;
}

export interface FactionStats {
  faction: string;
  games: number;
  wins: number;
  losses: number;
  /** wins / games, 0 when no games. Rounded to 4 dp for stable reporting. */
  winRate: number;
  /** Mean turns across this faction's games (0 when none). */
  avgTurns: number;
}

/**
 * Fold records into per-faction stats, keyed by the PLAYER's faction (`myFaction`).
 * A win is `winner === mySeat`. Pure: deterministic over the input order.
 */
export function aggregateByFaction(events: MatchTelemetry[]): FactionStats[] {
  const byFaction = new Map<string, { games: number; wins: number; turns: number }>();

  for (const e of events) {
    const bucket = byFaction.get(e.myFaction) ?? { games: 0, wins: 0, turns: 0 };
    bucket.games += 1;
    bucket.turns += e.turns;
    if (e.winner === e.mySeat) bucket.wins += 1;
    byFaction.set(e.myFaction, bucket);
  }

  return [...byFaction.entries()]
    .map(([faction, b]) => ({
      faction,
      games: b.games,
      wins: b.wins,
      losses: b.games - b.wins,
      winRate: b.games > 0 ? Math.round((b.wins / b.games) * 1e4) / 1e4 : 0,
      avgTurns: b.games > 0 ? Math.round((b.turns / b.games) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.games - a.games || a.faction.localeCompare(b.faction));
}
