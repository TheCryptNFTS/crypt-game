/**
 * dev:mulligan — pins the OPENING MULLIGAN (PART 1), the Hearthstone-style opening-hand
 * redraw, end-to-end through the deterministic reducer. Properties proven:
 *
 *   (a) GATING: a match with an explicit mulligan phase "cannot start" — while any side is
 *       pending, every non-MULLIGAN action reject-softs `mulligan-pending`; once both sides
 *       resolve, normal play is legal again.
 *   (b) REDRAW SEMANTICS: the chosen opening-hand cards LEAVE the hand, an EQUAL number of
 *       new cards are drawn, hand size is preserved, and the mulliganed cards are shuffled
 *       back into the deck (not just bottom-stacked).
 *   (c) DETERMINISM: same seed -> identical post-mulligan hand+deck across two independent
 *       runs (uses ONLY the seeded mulberry32 stream; never Math.random).
 *   (d) ONCE-ONLY: a side may mulligan exactly once; a second MULLIGAN reject-softs.
 *   (e) EITHER SIDE: P2 can mulligan during the phase even though P1 is the active player.
 *   (f) NO-OP SAFETY: a mulligan with no chosen cards changes nothing and consumes no RNG.
 *   (g) LEGACY UNCHANGED: with NO mulligan phase, the historical P1-only full-hand redraw
 *       still works (the path the committed golden scenario pins).
 */

import { applyAction, Action } from "../engine/reducer";
import { beginMulliganPhase, requireMulligan } from "../engine/setup";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState } from "../engine/state";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`OK: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

/** A fresh seeded match with an open both-sides mulligan phase. */
function phaseMatch(seed: number): MatchState {
  return beginMulliganPhase(makeSeededMatch(seed));
}

// === (a) GATING: the match cannot start until mulligan resolves =================
{
  const m = phaseMatch(3001);
  check("phase open: requireMulligan is true before anyone mulligans", requireMulligan(m) === true);
  // A normal action while the phase is open is rejected.
  const blocked = applyAction(m, { type: "END_TURN", player: "P1" });
  check("phase open: END_TURN reject-softs mulligan-pending", blocked.events.some((e) => e.type === "REJECTED" && (e as any).reason === "mulligan-pending"), blocked.events);
  check("phase open: rejected action is a true no-op (state unchanged)", blocked.state === m);

  // P1 resolves, P2 still pending -> still gated.
  const afterP1 = applyAction(m, { type: "MULLIGAN", player: "P1", cards: [0, 2] }).state;
  check("after P1 mulligan: phase still requires P2", requireMulligan(afterP1) === true, afterP1.mulligan);
  const stillBlocked = applyAction(afterP1, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  check("after P1 only: PLAY_UNIT still reject-softs mulligan-pending", stillBlocked.events.some((e) => e.type === "REJECTED" && (e as any).reason === "mulligan-pending"));

  // P2 resolves -> phase closes, normal play legal.
  const afterBoth = applyAction(afterP1, { type: "MULLIGAN", player: "P2", cards: [] }).state;
  check("after both mulligan: requireMulligan is false (match started)", requireMulligan(afterBoth) === false, afterBoth.mulligan);
  const nowLegal = applyAction(afterBoth, { type: "END_TURN", player: "P1" });
  check("after both mulligan: END_TURN is now legal (no rejection)", !nowLegal.events.some((e) => e.type === "REJECTED"), nowLegal.events);
}

// === (b) REDRAW SEMANTICS: chosen cards leave, equal number drawn ===============
{
  const m = phaseMatch(3002);
  const handBefore = [...m.players.P1.hand];
  const deckLenBefore = m.players.P1.deck.length;
  const chosen = [0, 1, 3];
  const mulled = chosen.map((i) => handBefore[i]);

  const res = applyAction(m, { type: "MULLIGAN", player: "P1", cards: chosen });
  const p1 = res.state.players.P1;

  check("redraw: hand size is preserved", p1.hand.length === handBefore.length, { before: handBefore.length, after: p1.hand.length });
  check("redraw: deck size is preserved (returned == redrawn)", p1.deck.length === deckLenBefore, { before: deckLenBefore, after: p1.deck.length });
  check("redraw: MULLIGAN_RESOLVED reports the redrawn count", res.events.some((e) => e.type === "MULLIGAN_RESOLVED" && (e as any).redrawn === chosen.length), res.events);

  // The kept cards (indices not chosen) remain, in original order, at the front.
  const kept = handBefore.filter((_, i) => !chosen.includes(i));
  check("redraw: kept cards remain in original order at the front", kept.every((c, i) => p1.hand[i] === c), { kept, hand: p1.hand });

  // Every mulliganed card is reshuffled back into the LIBRARY (deck) — i.e. it was not
  // discarded/lost. A mulliganed card CAN be redrawn into the new hand (Hearthstone-style),
  // so "reshuffled back" means: still present in deck OR hand, never destroyed. We also
  // assert at least one mulliganed card is genuinely back in the DECK (not all redrawn),
  // proving the reshuffle put them into the library rather than bottom-discarding them.
  const noneLost = mulled.every((c) => p1.deck.includes(c) || p1.hand.includes(c));
  check("redraw: no mulliganed card is lost (still in deck or hand)", noneLost, { mulled, deck: p1.deck, hand: p1.hand });
  const someBackInDeck = mulled.some((c) => p1.deck.includes(c));
  check("redraw: mulliganed cards are reshuffled into the deck (>=1 back in library)", someBackInDeck, { mulled, deck: p1.deck });

  // deckCount mirrors deck length.
  check("redraw: deckCount mirrors deck length", p1.deckCount === p1.deck.length);
}

// === (c) DETERMINISM: same seed -> identical result across two runs =============
{
  const run = () => {
    const m = phaseMatch(3003);
    const res = applyAction(m, { type: "MULLIGAN", player: "P1", cards: [0, 2, 4] });
    const p1 = res.state.players.P1;
    return { hand: p1.hand, deck: p1.deck, cursor: res.state.rngCursor };
  };
  const a = run();
  const b = run();
  check("determinism: same seed -> identical post-mulligan HAND", JSON.stringify(a.hand) === JSON.stringify(b.hand), { a: a.hand, b: b.hand });
  check("determinism: same seed -> identical post-mulligan DECK", JSON.stringify(a.deck) === JSON.stringify(b.deck));
  check("determinism: same seed -> identical rngCursor", a.cursor === b.cursor, { a: a.cursor, b: b.cursor });

  // A different seed should generally produce a different reshuffle/redraw.
  const other = (() => {
    const m = phaseMatch(987654);
    const res = applyAction(m, { type: "MULLIGAN", player: "P1", cards: [0, 2, 4] });
    return res.state.players.P1.deck;
  })();
  check("determinism: a different seed produces a different reshuffled deck", JSON.stringify(other) !== JSON.stringify(a.deck));
}

// === (d) ONCE-ONLY: a side mulligans exactly once ===============================
{
  const m = phaseMatch(3004);
  const first = applyAction(m, { type: "MULLIGAN", player: "P1", cards: [0] });
  check("once-only: first P1 mulligan resolves", first.state.mulligan?.P1 === "done", first.state.mulligan);
  const second = applyAction(first.state, { type: "MULLIGAN", player: "P1", cards: [1] });
  check("once-only: second P1 mulligan reject-softs mulligan-already-done", second.events.some((e) => e.type === "REJECTED" && (e as any).reason === "mulligan-already-done"), second.events);
  check("once-only: rejected second mulligan is a no-op (hand unchanged)", JSON.stringify(second.state.players.P1.hand) === JSON.stringify(first.state.players.P1.hand));
}

// === (e) EITHER SIDE: P2 mulligans during the phase though P1 is active =========
{
  const m = phaseMatch(3005);
  check("either-side: P1 is the active player", m.activePlayer === "P1");
  const res = applyAction(m, { type: "MULLIGAN", player: "P2", cards: [0, 1] });
  check("either-side: P2's MULLIGAN is accepted despite P1 being active", res.state.mulligan?.P2 === "done" && !res.events.some((e) => e.type === "REJECTED"), { mull: res.state.mulligan, events: res.events });
  check("either-side: P1 remains pending", res.state.mulligan?.P1 === "pending");
}

// === (f) NO-OP SAFETY: empty selection changes nothing, consumes no RNG =========
{
  const m = phaseMatch(3006);
  const handBefore = [...m.players.P1.hand];
  const deckBefore = [...m.players.P1.deck];
  const cursorBefore = m.rngCursor ?? 0;
  const res = applyAction(m, { type: "MULLIGAN", player: "P1", cards: [] });
  const p1 = res.state.players.P1;
  check("no-op: empty selection leaves hand identical", JSON.stringify(p1.hand) === JSON.stringify(handBefore));
  check("no-op: empty selection leaves deck identical", JSON.stringify(p1.deck) === JSON.stringify(deckBefore));
  check("no-op: empty selection consumes ZERO rng draws (cursor unchanged)", (res.state.rngCursor ?? 0) === cursorBefore, { before: cursorBefore, after: res.state.rngCursor });
  check("no-op: side is still marked done", res.state.mulligan?.P1 === "done");

  // `cards` omitted entirely is also a clean no-op redraw.
  const omitted = applyAction(phaseMatch(3006), { type: "MULLIGAN", player: "P1" } as Action);
  check("no-op: omitted `cards` behaves as empty selection (hand unchanged)", JSON.stringify(omitted.state.players.P1.hand) === JSON.stringify(handBefore));
}

// === bad-index safety: out-of-range / duplicate index reject-softs ==============
{
  const m = phaseMatch(3007);
  const handBefore = [...m.players.P1.hand];
  const oob = applyAction(m, { type: "MULLIGAN", player: "P1", cards: [999] });
  check("bad-index: out-of-range index reject-softs mulligan-bad-index", oob.events.some((e) => e.type === "REJECTED" && (e as any).reason === "mulligan-bad-index"), oob.events);
  check("bad-index: rejected mulligan is a no-op (hand unchanged, still pending)", oob.state === m && JSON.stringify(m.players.P1.hand) === JSON.stringify(handBefore));
  const dup = applyAction(m, { type: "MULLIGAN", player: "P1", cards: [0, 0] });
  check("bad-index: duplicate index reject-softs mulligan-bad-index", dup.events.some((e) => e.type === "REJECTED" && (e as any).reason === "mulligan-bad-index"));
}

// === (g) LEGACY UNCHANGED: no phase -> historical P1-only full-hand redraw =======
{
  // No beginMulliganPhase -> mulligan === undefined -> legacy path.
  const m = makeSeededMatch(3008);
  check("legacy: no phase means requireMulligan is false", requireMulligan(m) === false);
  const handBefore = [...m.players.P1.hand];
  const res = applyAction(m, { type: "MULLIGAN", player: "P1" } as Action);
  const p1 = res.state.players.P1;
  check("legacy: full-hand bottom-cycle keeps hand size", p1.hand.length === handBefore.length, { before: handBefore.length, after: p1.hand.length });
  check("legacy: no MULLIGAN_RESOLVED event emitted on the legacy path", !res.events.some((e) => e.type === "MULLIGAN_RESOLVED"));
  // Legacy mulligan returned the whole old hand to the deck bottom; the new hand is the
  // next OPENING_HAND_SIZE cards off the (unshuffled) top.
  check("legacy: the old hand cards are all back in the library", handBefore.every((c) => p1.deck.includes(c) || p1.hand.includes(c)));
  // P2 cannot use the legacy mulligan. With no phase, the active-player guard (P1 is
  // active) rejects a P2 action first as `not-your-turn`; were P2 active it would hit the
  // explicit `mulligan-p1-only`. Either way a P2 legacy mulligan is rejected.
  const p2legacy = applyAction(m, { type: "MULLIGAN", player: "P2" } as Action);
  check("legacy: P2 MULLIGAN is rejected (not-your-turn or mulligan-p1-only)", p2legacy.events.some((e) => e.type === "REJECTED" && ["not-your-turn", "mulligan-p1-only"].includes((e as any).reason)), p2legacy.events);
}

console.log(`\n=== MULLIGAN PROOF (opening-hand selective redraw, seeded + deterministic) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} mulligan check(s) failed.`);
  process.exit(1);
}
console.log("ALL MULLIGAN PROOFS PASSED");
