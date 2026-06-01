/**
 * dev:telemetry — aggregate buffered telemetry into per-faction win-rates.
 *
 * Standalone + deterministic: it drives a handful of seeded AI-vs-AI matches
 * through the SAME `playAiMatch` harness the determinism proofs use, derives a
 * telemetry record per match (winner, turns, cards played, MMR delta) WITHOUT
 * touching the reducer, records them to an in-memory sink, then prints the
 * per-faction aggregate. No reducer/golden mutation; node-only at runtime.
 */

import { playAiMatch } from "./reducerHarness";
import { InMemorySink } from "../telemetry/sinks";
import { recordMatch, aggregateByFaction } from "../telemetry/logger";
import { applyMatchResult, type RatingState } from "../meta/rating";
import type { MatchState } from "../engine/state";
import type { Action } from "../engine/reducer";

/** Count PLAY_* actions a seat issued (a stand-in for "cards played"). */
function cardsPlayedBy(actions: Action[], seat: "P1" | "P2"): number {
  return actions.filter(
    (a) =>
      a.player === seat &&
      (a.type === "PLAY_UNIT" ||
        a.type === "PLAY_ARTIFACT" ||
        a.type === "PLAY_SPELL" ||
        a.type === "EQUIP")
  ).length;
}

/** Deterministic faction label per seat (the harness uses fixed commanders, so
 *  we bucket by seat-as-faction to exercise the aggregation; real play passes the
 *  piloted faction). */
const SEAT_FACTION: Record<"P1" | "P2", string> = {
  P1: "STONE_KEEPERS",
  P2: "IRON_DEFENDERS",
};

const SEEDS = [101, 202, 303, 404, 505, 606, 707, 808];

const sink = new InMemorySink();
let ratings: RatingState = { ratings: {} };

for (const seed of SEEDS) {
  const { actions, result } = playAiMatch(seed);
  const state = result.finalState as MatchState;
  const winner = state.winner ?? "P1";

  // MMR exchange from the meta layer (pure, off-reducer). Winner = decided seat.
  const loser = winner === "P1" ? "P2" : "P1";
  const applied = applyMatchResult(ratings, {
    winnerId: SEAT_FACTION[winner],
    loserId: SEAT_FACTION[loser],
  });
  ratings = applied.state;

  // Record from EACH seat's perspective so both factions accrue games.
  for (const seat of ["P1", "P2"] as const) {
    const won = winner === seat;
    recordMatch(
      {
        matchId: `${seed}:${seat}`,
        winner,
        mySeat: seat,
        myFaction: SEAT_FACTION[seat],
        opponentFaction: SEAT_FACTION[seat === "P1" ? "P2" : "P1"],
        turns: state.turn,
        cardsPlayed: cardsPlayedBy(actions, seat),
        mmrDelta: won ? applied.delta.winnerDelta : applied.delta.loserDelta,
        timestamp: seed, // deterministic stamp
      },
      sink
    );
  }
}

const stats = aggregateByFaction(sink.readAll());

console.log("\n=== TELEMETRY REPORT (per-faction win-rates) ===\n");
console.log(
  ["faction", "games", "wins", "losses", "winRate", "avgTurns"].join("\t")
);
for (const s of stats) {
  console.log(
    [s.faction, s.games, s.wins, s.losses, s.winRate, s.avgTurns].join("\t")
  );
}
console.log(`\nTotal records buffered: ${sink.readAll().length}`);
console.log("\nTELEMETRY REPORT COMPLETE\n");
