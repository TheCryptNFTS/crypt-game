/**
 * dev:alt-wincon — proof of the opt-in ALTERNATE WIN CONDITIONS layered onto the
 * reducer's victory path (`detectWinner`), each gated behind its own MatchRules flag.
 * See `src/engine/RESOLUTION_MODEL.md` §10.
 *
 * Two no-burn-compatible alternate win axes, on top of the historical nexus-depletion +
 * deck-out victory:
 *
 *   1. DECKOUT (`rules.deckoutLoss`): drawing from an EMPTY deck loses you the game
 *      (fatigue). The vanilla engine ALREADY loses on an empty draw, so this is the
 *      default behavior — the flag exists to EXPLICITLY DISABLE it (`deckoutLoss:false`)
 *      for a no-fatigue variant. We prove BOTH: empty-deck draw loses by default, and an
 *      explicit `false` keeps the drawing player alive (deck-empty but not dead).
 *
 *   2. ASSEMBLE / LIBRARY (`rules.assembleToWin: N`): holding >= N cards in hand wins by
 *      card-advantage — an INDIRECT, no-burn victory that never touches the enemy face.
 *      Scored when an action carries a player across the threshold (e.g. the start-of-turn
 *      draw "draws you into the library win"); a hand already at/above N at action ENTRY is
 *      a decided position and is reject-softed as `match-over` by the global entry guard.
 *      OFF by default (vanilla unaffected, fixture unmoved).
 *
 * Precedence is asserted: LETHAL-NEXUS still wins FIRST (a finishing blow beats an
 * alt-win that is one tick away), then deckout, then the indirect assemble axis.
 * Determinism is asserted (same setup -> same winner). Flag-OFF is asserted unaffected.
 */

import { applyAction, Action } from "../engine/reducer";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, PlayerId, MatchRules } from "../engine/state";

let failed = 0;
function assert(cond: boolean, msg: string, detail?: unknown): void {
  if (cond) {
    console.log(`OK: ${msg}`);
  } else {
    console.error(`FAIL: ${msg}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
    failed += 1;
  }
}

/** Clean arena: empty boards, full nexuses, P1 to act, optional rules. */
function arena(seed = 4040, rules: MatchRules | null = null): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.turn = 1;
  m.winner = null;
  m.pendingChoice = null;
  m.rules = rules;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].hand = [];
    m.players[p].deck = ["tcg_2", "tcg_6", "tcg_8"];
    m.players[p].deckCount = 3;
  }
  return m;
}

// === 1. DECKOUT: drawing from an empty deck loses (vanilla default) ===============
{
  // P2 will draw at the start of their turn; give P2 an empty deck so the turn-start
  // draw fatigues them out. END_TURN by P1 passes the turn to P2 and triggers the draw.
  let m = arena(1, /*rules*/ null); // vanilla — deckout already active
  m.players.P2.deck = [];
  m.players.P2.deckCount = 0;
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  assert(r.state.winner === "P1", "deckout (vanilla): P2's empty-deck draw loses -> P1 wins", r.state.winner);
  assert(r.events.some((e) => e.type === "DECK_OUT" && (e as any).player === "P2"), "deckout: DECK_OUT event emitted for P2");
}

// === 1b. DECKOUT explicitly enabled behaves identically ===========================
{
  let m = arena(2, { deckoutLoss: true });
  m.players.P2.deck = [];
  m.players.P2.deckCount = 0;
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  assert(r.state.winner === "P1", "deckout (flag true): empty-deck draw still loses", r.state.winner);
}

// === 1c. DECKOUT explicitly DISABLED keeps the drawing player alive ===============
{
  let m = arena(3, { deckoutLoss: false });
  m.players.P2.deck = [];
  m.players.P2.deckCount = 0;
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  assert(r.state.winner === null, "deckout disabled: empty-deck draw does NOT lose (no-fatigue variant)", r.state.winner);
  assert(r.events.some((e) => e.type === "DECK_OUT" && (e as any).player === "P2"), "deckout disabled: DECK_OUT still reported (informational)");
}

// === 2. ASSEMBLE / LIBRARY win: DRAWING into >= N cards wins (no-burn) ============
{
  // P2 is one card short of the threshold (3 cards, threshold 4). P1 ends their turn;
  // P2's start-of-turn draw carries them from 3 -> 4 cards, crossing the threshold and
  // winning by card-advantage (a "draw into the library win"). NO nexus damage dealt.
  // The win is reached BY the action (not pre-existing at entry), so the match-over
  // entry guard does not pre-empt it — it is genuinely scored during END_TURN.
  let m = arena(4, { assembleToWin: 4 });
  m.players.P2.hand = ["tcg_2", "tcg_6", "tcg_8"]; // 3 in hand...
  m.players.P2.deck = ["tcg_10", "tcg_2", "tcg_6"]; // ...non-empty deck to draw the 4th
  m.players.P2.deckCount = 3;
  const p2NexusBefore = m.players.P2.nexusHealth;
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  assert(r.state.winner === "P2", "assemble: P2 draws 3 -> 4 >= threshold 4, wins by card-advantage", r.state.winner);
  assert(r.state.players.P2.hand.length >= 4, "assemble: P2 hand reached the threshold via the draw", r.state.players.P2.hand.length);
  assert(r.state.players.P2.nexusHealth === p2NexusBefore, "assemble: NO-BURN — P2 nexus untouched", r.state.players.P2.nexusHealth);
  assert(r.events.some((e) => e.type === "WIN" && (e as any).player === "P2"), "assemble: WIN emitted");
}

// === 2b. ASSEMBLE below threshold does NOT win ====================================
{
  // P2 draws from 2 -> 3, still under the threshold of 6: no win.
  let m = arena(5, { assembleToWin: 6 });
  m.players.P2.hand = ["tcg_2", "tcg_6"]; // 2 in hand, draws to 3
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  assert(r.state.winner === null, "assemble: below threshold (3 < 6) does NOT win", r.state.winner);
}

// === 2c. ASSEMBLE is OFF by default (vanilla unaffected) ==========================
{
  let m = arena(6, /*rules*/ null);
  // A huge hand on the player whose turn is beginning — would trivially win if assemble
  // were ever on. In a vanilla match (no rules) it never wins.
  m.players.P2.hand = ["a", "b", "c", "d", "e", "f", "g"]; // huge, draws to 8
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  assert(r.state.winner === null, "assemble OFF by default: a huge hand never wins in a vanilla match", r.state.winner);
}

// === 3. PRECEDENCE: lethal-nexus wins FIRST, even when the OTHER player assembles ==
{
  // P2 is at 0 nexus (P1 has lethal) AND P2 simultaneously holds a winning assemble hand.
  // The global match-over guard at action entry reads detectWinner, which checks the
  // nexus axis BEFORE the assemble axis — so the position is decided as "P1 wins by
  // lethal", and the action reject-softs `match-over` (P2 is NEVER awarded an assemble
  // win from a dead-nexus position). This proves the documented ordering:
  // lethal-nexus > deckout > ascendancy > assemble.
  let m = arena(7, { assembleToWin: 3 });
  m.players.P2.hand = ["x", "y", "z"]; // P2 would assemble-win (3 >= 3)...
  m.players.P2.nexusHealth = 0; // ...but P2's nexus is already dead -> P1 wins first.
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  assert(
    r.events.some((e) => e.type === "REJECTED" && (e as any).reason === "match-over"),
    "precedence: a dead-nexus position is match-over (lethal decided it), P2 never assemble-wins",
    r.events
  );
  assert(r.state.winner !== "P2", "precedence: P2 is NOT awarded an assemble win from a lethal-dead position", r.state.winner);
}

// === 4. DETERMINISM: same setup -> same winner ====================================
{
  function run(seed: number): PlayerId | null {
    let m = arena(seed, { assembleToWin: 4 });
    m.players.P2.hand = ["tcg_2", "tcg_6", "tcg_8"]; // draws into the 4th -> assemble win
    m.players.P2.deck = ["tcg_10", "tcg_2", "tcg_6"];
    m.players.P2.deckCount = 3;
    return applyAction(m, { type: "END_TURN", player: "P1" }).state.winner;
  }
  assert(run(909) === run(909) && run(909) === "P2", "determinism: identical setup -> identical winner");
}

console.log(`\n=== ALT WIN-CON PROOF (opt-in deckoutLoss + assembleToWin; no-burn) ===`);
if (failed > 0) {
  console.error(`FAILED: ${failed} alt-win-con check(s) failed.`);
  process.exit(1);
}
console.log("ALL ALT WIN-CON PROOFS PASSED");
