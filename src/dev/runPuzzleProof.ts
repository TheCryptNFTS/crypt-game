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

  // 3. Determinism — same solution, same winner across two independent runs.
  const a = solvePuzzle(puzzle).winner;
  const b = solvePuzzle(puzzle).winner;
  assert(a === b, `[${puzzle.id}] solution is deterministic (winner stable)`, { a, b });
}

console.log(`\n=== PUZZLE PROOF SUMMARY ===`);
if (failed > 0) {
  console.error(`FAILED: ${failed} puzzle check(s) failed.`);
  process.exit(1);
}
console.log("ALL PUZZLE PROOFS PASSED");
