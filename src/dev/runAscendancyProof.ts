/**
 * dev:ascendancy (#4) — an INDIRECT, no-burn alternate win condition.
 *
 * The match historically had a single win axis: reduce the enemy nexus to 0 (or
 * deck them out). #4 adds a SECOND, purely indirect axis — the ASCENDANCY meter.
 * At each player's turn END, holding STRICTLY more live units than the opponent
 * (sustained board dominance) ticks that player's meter up by one; failing to
 * dominate resets it to 0. Reaching `rules.ascendancyToWin` is a CONTROL VICTORY
 * — a win earned entirely through the board, never by burning the enemy face.
 *
 * This proof pins the contract through the REAL reducer (applyAction / END_TURN):
 *   - the meter is OFF by default — a vanilla match never grows an ascendancy field,
 *   - sustained dominance reaches the threshold and wins WITHOUT any nexus damage,
 *   - losing dominance for a turn RESETS the meter (dominance must be sustained),
 *   - lethal (nexus depletion) still wins first, even at the brink of a control win,
 *   - the whole mechanism is deterministic (same setup -> same winner & meter).
 */

import { applyAction, Action } from "../engine/reducer";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, UnitInPlay, PlayerId, Lane } from "../engine/state";

let failed = 0;
function assert(cond: boolean, msg: string, detail?: unknown): void {
  if (cond) {
    console.log(`OK: ${msg}`);
  } else {
    console.error(`FAIL: ${msg}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
    failed += 1;
  }
}

function unit(instanceId: string, lane: Lane): UnitInPlay {
  return {
    cardId: "tcg_test",
    instanceId,
    lane,
    attack: 1,
    health: 3,
    maxHealth: 3,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: false,
    summoningSick: false,
  } as UnitInPlay;
}

/** A clean arena: empty boards, full nexuses, P1 to act. */
function arena(seed = 99, enableAscendancy = false): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.turn = 1;
  m.winner = null;
  if (enableAscendancy) {
    m.rules = { ascendancyToWin: 3 };
  }
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].hand = [];
  }
  return m;
}

function setBoard(m: MatchState, p: PlayerId, frontCount: number): void {
  m.players[p].board.front = Array.from({ length: frontCount }, (_, i) => unit(`${p}_${i}`, "front"));
  m.players[p].board.back = [];
}

function endTurn(m: MatchState, player: PlayerId): MatchState {
  const action: Action = { type: "END_TURN", player };
  return applyAction(m, action).state;
}

// --- OFF by default: a vanilla match never grows an ascendancy field ---------
{
  let m = arena(7, /*enableAscendancy*/ false);
  setBoard(m, "P1", 3); // P1 dominates the board
  setBoard(m, "P2", 0);
  m = endTurn(m, "P1");
  assert(m.ascendancy == null, "vanilla match: no ascendancy meter is created", m.ascendancy);
  assert(m.winner === null, "vanilla match: board dominance alone never wins");
}

// --- sustained dominance reaches the threshold and wins (no burn) ------------
{
  let m = arena(11, /*enableAscendancy*/ true);
  setBoard(m, "P1", 3); // P1 always dominant
  setBoard(m, "P2", 1);

  m = endTurn(m, "P1"); // P1 meter -> 1
  assert(m.ascendancy?.P1 === 1, "tick 1: P1 ascendancy is 1", m.ascendancy);
  assert(m.winner === null, "tick 1: not yet a control victory");

  m = endTurn(m, "P2"); // P2 not dominant -> stays 0
  assert(m.ascendancy?.P2 === 0, "P2 never dominant -> meter 0", m.ascendancy);

  m = endTurn(m, "P1"); // P1 meter -> 2
  assert(m.ascendancy?.P1 === 2, "tick 2: P1 ascendancy is 2", m.ascendancy);
  assert(m.winner === null, "tick 2: still no winner");

  m = endTurn(m, "P2");
  m = endTurn(m, "P1"); // P1 meter -> 3 == threshold
  assert(m.ascendancy?.P1 === 3, "tick 3: P1 ascendancy hits threshold", m.ascendancy);
  assert(m.winner === "P1", "P1 wins by CONTROL victory at the threshold");
  assert(m.players.P2.nexusHealth === 20, "control victory dealt ZERO nexus damage (no-burn)");
}

// --- losing dominance resets the meter (dominance must be sustained) ---------
{
  let m = arena(13, true);
  setBoard(m, "P1", 3);
  setBoard(m, "P2", 1);
  m = endTurn(m, "P1"); // P1 -> 1
  assert(m.ascendancy?.P1 === 1, "reset case: P1 ascendancy climbs to 1", m.ascendancy);

  // P2 floods the board so P1 is no longer dominant next turn.
  setBoard(m, "P2", 5);
  m = endTurn(m, "P2"); // P2 dominant -> P2 meter 1
  m = endTurn(m, "P1"); // P1 NOT dominant now -> reset to 0
  assert(m.ascendancy?.P1 === 0, "P1 loses dominance -> meter RESETS to 0", m.ascendancy);
  assert(m.winner === null, "reset case: no premature win");
}

// --- a depleted nexus outranks an imminent control win -----------------------
// detectWinner checks nexus death BEFORE ascendancy, and the reducer's global
// match-over guard treats a 0-nexus state as decided. So a player who is one tick
// from a control victory but whose own nexus is depleted can NOT ascend past it:
// the next END_TURN is rejected as match-over and the meter never reaches the
// threshold. (Lethal is the higher-priority axis.)
{
  let m = arena(17, true);
  setBoard(m, "P1", 3);
  setBoard(m, "P2", 0);
  m = endTurn(m, "P1"); // 1
  m = endTurn(m, "P2");
  m = endTurn(m, "P1"); // 2 (one tick from a control win)
  assert(m.ascendancy?.P1 === 2, "brink: P1 at 2 of 3", m.ascendancy);
  // P1's own nexus is now depleted. The next END_TURN must NOT let P1 ascend to 3.
  m.players.P1.nexusHealth = 0;
  const before = JSON.stringify(m);
  m = endTurn(m, "P2"); // rejected: match-over (P1 nexus dead)
  assert(m.ascendancy?.P1 === 2, "depleted nexus blocks the meter from advancing", m.ascendancy);
  assert(m.winner !== "P1", "P1 does NOT steal a control win past a dead nexus", m.winner);
  assert(JSON.stringify(m) === before, "the action reject-softs (state untouched)");
}

// --- determinism: identical setup -> identical winner and meter --------------
{
  function run(): { winner: PlayerId | null; p1: number } {
    let m = arena(21, true);
    setBoard(m, "P1", 4);
    setBoard(m, "P2", 1);
    for (let i = 0; i < 3; i += 1) {
      m = endTurn(m, "P1");
      if (m.winner) break;
      m = endTurn(m, "P2");
    }
    return { winner: m.winner, p1: m.ascendancy?.P1 ?? -1 };
  }
  const a = run();
  const b = run();
  assert(JSON.stringify(a) === JSON.stringify(b), "ascendancy resolution is deterministic", { a, b });
  assert(a.winner === "P1", "deterministic run resolves to the expected P1 control win", a);
}

if (failed > 0) {
  console.error(`\nASCENDANCY (alt-win) PROOF FAILED: ${failed} assertion(s).`);
  process.exit(1);
}
console.log("\nALL ASCENDANCY (alt-win) PROOFS PASSED");
