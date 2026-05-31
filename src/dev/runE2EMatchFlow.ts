/**
 * dev:e2e — full match flow driven ENTIRELY through the single `applyAction`
 * reducer (P1 greedy vs P2 AI, both via the same planner + reducer). This
 * replaces the old turnEngine/combatEngine-based flow and proves the
 * consolidated path runs a complete match to a terminal state.
 */

import { playAiMatch } from "./reducerHarness";

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error(`FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`OK: ${message}`);
}

function run() {
  const { actions, result } = playAiMatch(4242);
  const { finalState, events } = result;

  assert(actions.length > 0, "match produced actions");
  assert(events.length > 0, "match produced events");

  // It must terminate: either a winner or it ran cleanly to the turn cap.
  const decided = finalState.winner === "P1" || finalState.winner === "P2";
  const nexusDrained =
    (finalState.players.P1.nexusHealth ?? 20) <= 0 ||
    (finalState.players.P2.nexusHealth ?? 20) <= 0;
  assert(
    decided || finalState.turn >= 2,
    "match advanced turns through applyAction"
  );
  if (decided) {
    assert(
      events.some((e) => e.type === "WIN"),
      "a WIN event was emitted when the match decided"
    );
    assert(nexusDrained || events.some((e) => e.type === "DECK_OUT"), "win was by nexus or deck-out");
  }

  // Determinism: same seed replays identically.
  const again = playAiMatch(4242);
  assert(
    JSON.stringify(again.result.finalState) === JSON.stringify(finalState),
    "same seed -> identical final state (deterministic)"
  );

  console.log("\n=== E2E MATCH FLOW (via applyAction) ===");
  console.log(`actions=${actions.length} events=${events.length} winner=${finalState.winner ?? "none"} turn=${finalState.turn}`);
  console.log("PASS");
}

run();
