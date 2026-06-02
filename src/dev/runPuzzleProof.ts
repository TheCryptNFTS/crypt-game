/**
 * dev:puzzle — proof that the PUZZLE / SOLO MODE scenarios (A9) are sound and
 * deterministic, driven entirely by the SHIPPED reducer.
 *
 * For EVERY puzzle in the table we assert:
 *   1. SOLVABLE — the intended solution line, replayed through `applyAction`,
 *      awards the hero seat the win.
 *   2. NON-TRIVIAL — the deliberately-wrong line does NOT win this turn (proving
 *      the puzzle encodes a real decision, not a board that wins no matter what).
 *   3. DETERMINISTIC — running the solution twice yields the identical winner.
 *
 * No engine edits, no new ops, no tokens — a puzzle is just a fixed state + an
 * Action[] through the existing reducer.
 */

import { PUZZLES, runPuzzleLine, solvePuzzle } from "../engine/puzzles";

let failed = 0;
function assert(cond: boolean, msg: string, detail?: unknown): void {
  if (cond) {
    console.log(`OK: ${msg}`);
  } else {
    console.error(`FAIL: ${msg}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
    failed += 1;
  }
}

console.log(`=== PUZZLE / SOLO MODE PROOF (${PUZZLES.length} scenarios) ===`);

// Sanity: the table must hold the full authored set (3 original + 8 new = 11) and
// every id must be unique, so a copy/paste collision can never silently shadow a
// scenario.
assert(PUZZLES.length >= 11, `puzzle table holds at least 11 scenarios`, { count: PUZZLES.length });
const ids = PUZZLES.map((p) => p.id);
assert(new Set(ids).size === ids.length, `all puzzle ids are unique`, { ids });

for (const puzzle of PUZZLES) {
  // 1. The intended solution WINS for the hero.
  const solved = solvePuzzle(puzzle);
  assert(
    solved.solved && solved.winner === puzzle.heroSeat,
    `[${puzzle.id}] intended solution wins for ${puzzle.heroSeat}`,
    { winner: solved.winner },
  );

  // 2. The wrong line does NOT win this turn.
  const wrong = runPuzzleLine(puzzle, puzzle.wrongLine);
  assert(
    !(wrong.solved && wrong.winner === puzzle.heroSeat),
    `[${puzzle.id}] wrong line does NOT win this turn`,
    { winner: wrong.winner },
  );

  // 3. Determinism — the SAME solution yields a byte-identical settled state across
  //    two fully independent runs (winner AND final board), proving the scenario is a
  //    pure function of (seed, board, actions) with no hidden RNG / wall-clock leak.
  const a = solvePuzzle(puzzle);
  const b = solvePuzzle(puzzle);
  assert(a.winner === b.winner, `[${puzzle.id}] solution winner is deterministic`, {
    a: a.winner,
    b: b.winner,
  });
  assert(
    JSON.stringify(a.finalState) === JSON.stringify(b.finalState),
    `[${puzzle.id}] settled state is deterministic across two runs`,
  );
}

console.log(`\n=== PUZZLE PROOF SUMMARY ===`);
if (failed > 0) {
  console.error(`FAILED: ${failed} puzzle check(s) failed.`);
  process.exit(1);
}
console.log("ALL PUZZLE PROOFS PASSED");
