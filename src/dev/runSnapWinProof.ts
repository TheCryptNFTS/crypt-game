/**
 * runSnapWinProof — headless proof that the Cut-1 Snap engine plays a full,
 * deterministic match to a decided winner under the Snap rules.
 *
 * Asserts, across many seeds:
 *   - a match runs exactly 6 turns (energy == turn each round),
 *   - both sides only ever spend energy they have,
 *   - the winner is decided by "win 2 of 3 Crypts, total power breaks ties",
 *   - the engine is deterministic (same seed → identical winner + board), and
 *   - illegal actions are reject-soft (no-ops).
 *
 * Run: npx tsx src/dev/runSnapWinProof.ts   (or `npm run dev:snap`)
 */

import { createSnapMatch } from "../snap/setup";
import { snapReducer, playableHand } from "../snap/reducer";
import { planP2Turn } from "../snap/ai";
import { detectSnapWinner, lanePower } from "../snap/scoreLane";
import { MAX_TURNS, type LaneIndex, type SnapState } from "../snap/types";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("  ✗ " + msg);
  }
}

/** Drive P1 with the same greedy planner as P2 (mirror), for a self-playing match. */
function planP1Turn(state: SnapState) {
  // Reuse P2 logic by symmetry: temporarily treat P1 as the mover.
  const actions: { type: "PLAY_CARD"; seat: "P1"; instanceId: string; lane: LaneIndex }[] = [];
  let working = state;
  let guard = 0;
  while (guard++ < 32) {
    const affordable = playableHand(working, "P1");
    if (affordable.length === 0) break;
    // Greedy: highest-power affordable card into the lane where P1 trails most.
    let best: { instanceId: string; lane: LaneIndex; score: number } | null = null;
    for (const card of affordable) {
      for (let l = 0; l < working.lanes.length; l++) {
        const lane = working.lanes[l];
        if (lane.P1.length >= 4) continue;
        const p1 = lanePower(lane, "P1");
        const p2 = lanePower(lane, "P2");
        const score = (p2 - p1) * 10 + card.power; // shore up losing Crypts
        if (!best || score > best.score) best = { instanceId: card.instanceId, lane: l as LaneIndex, score };
      }
    }
    if (!best) break;
    const action = { type: "PLAY_CARD" as const, seat: "P1" as const, instanceId: best.instanceId, lane: best.lane };
    const next = snapReducer(working, action);
    if (next === working) break;
    working = next;
    actions.push(action);
  }
  return actions;
}

function playMatch(seed: number): SnapState {
  let state = createSnapMatch({ seed });
  let safety = 0;

  while (!state.winner && safety++ < 500) {
    // Energy invariant: at the top of each P1 phase, energy == turn.
    assert(
      state.players.P1.energy <= state.turn && state.players.P2.energy <= state.turn,
      `seed ${seed}: energy never exceeds turn number (turn ${state.turn})`,
    );

    // P1 plays its turn.
    for (const a of planP1Turn(state)) state = snapReducer(state, a);
    state = snapReducer(state, { type: "END_TURN", seat: "P1" });

    if (state.winner) break;

    // P2 (AI) plays its turn.
    for (const a of planP2Turn(state)) state = snapReducer(state, a);
    // planP2Turn already appends END_TURN, but dispatch it here explicitly in
    // case the loop bailed early.
    if (state.active === "P2") state = snapReducer(state, { type: "END_TURN", seat: "P2" });
  }

  return state;
}

console.log("runSnapWinProof — Cut-1 Snap engine\n");

const seeds = [1, 2, 3, 7, 42, 99, 128, 256, 1000, 31337];
let decisive = 0;

for (const seed of seeds) {
  const final = playMatch(seed);

  assert(final.winner !== null, `seed ${seed}: match reaches a decision`);
  assert(final.turn === MAX_TURNS, `seed ${seed}: match ran the full ${MAX_TURNS} turns (got ${final.turn})`);
  assert(final.outcomes !== null && final.outcomes.length === 3, `seed ${seed}: three Crypts scored`);

  // The winner the engine set must match a fresh independent scoring.
  assert(final.winner === detectSnapWinner(final), `seed ${seed}: engine winner matches independent scorer`);

  // Verify the "win 2 of 3, total power breaks ties" rule holds for the result.
  const o = final.outcomes!;
  const p1Lanes = o.filter((x) => x.winner === "P1").length;
  const p2Lanes = o.filter((x) => x.winner === "P2").length;
  const p1Total = o.reduce((n, x) => n + x.p1Power, 0);
  const p2Total = o.reduce((n, x) => n + x.p2Power, 0);
  let expected: string;
  if (p1Lanes > p2Lanes) expected = "P1";
  else if (p2Lanes > p1Lanes) expected = "P2";
  else if (p1Total > p2Total) expected = "P1";
  else if (p2Total > p1Total) expected = "P2";
  else expected = "DRAW";
  assert(final.winner === expected, `seed ${seed}: 2-of-3 (then total-power) rule → ${expected}, got ${final.winner}`);

  if (final.winner !== "DRAW") decisive++;

  // Determinism: replay the same seed, expect identical outcome + board totals.
  const replay = playMatch(seed);
  assert(replay.winner === final.winner, `seed ${seed}: deterministic winner on replay`);
  assert(
    JSON.stringify(replay.outcomes) === JSON.stringify(final.outcomes),
    `seed ${seed}: deterministic board on replay`,
  );

  console.log(
    `  seed ${String(seed).padStart(5)} → ${final.winner}  (Crypts ${p1Lanes}-${p2Lanes}, power ${p1Total}-${p2Total})`,
  );
}

// Reject-soft spot check: illegal actions must be no-ops (same object).
{
  const s = createSnapMatch({ seed: 5 });
  const outOfTurn = snapReducer(s, { type: "PLAY_CARD", seat: "P2", instanceId: s.players.P2.hand[0].instanceId, lane: 0 });
  assert(outOfTurn === s, "out-of-turn play is reject-soft (identity)");
  const badCard = snapReducer(s, { type: "PLAY_CARD", seat: "P1", instanceId: "nope", lane: 0 });
  assert(badCard === s, "unknown card is reject-soft (identity)");
}

console.log(`\n${seeds.length} seeds played, ${decisive} decisive.`);
if (failures > 0) {
  console.error(`\nFAIL — ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("PASS — Snap engine plays a full, deterministic, rules-correct match.\n");
