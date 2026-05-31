/**
 * runFogOfWarProof — proves the server's per-seat REDACTION hides hidden
 * information from clients WITHOUT weakening the authoritative state behind it.
 *
 * What it proves (all IN-PROCESS — no sockets):
 *   1. P1's view shows P1's OWN hand contents (real card ids).
 *   2. P1's view HIDES P2's hand contents entirely (no `hand` field; count only).
 *   3. P1's view reveals NEITHER deck's ORDER (deck is count-only on both sides).
 *   4. The view is symmetric: P2's view shows P2's hand, hides P1's.
 *   5. Redaction is a pure VIEW transform: the authoritative state behind it is
 *      still COMPLETE (both full hands, both full decks) and a FRESH replay from
 *      {seed, actionLog} reproduces that full state byte-for-byte.
 *   6. Projecting a view does NOT mutate the authoritative state or the action
 *      log (determinism + persistence untouched), proven by hashing before/after.
 *
 * Run: `tsx src/dev/runFogOfWarProof.ts`
 */

import { GameServer } from "../../server/server";
import { replayMatch, hashState } from "../../server/matchEngine";
import { issueToken } from "../../server/auth";
import type { Action, Seat } from "../../server/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

const ALICE = "acct_alice";
const BOB = "acct_bob";
const SEED = 135790;

const server = new GameServer();
const { matchId } = server.createMatch({
  seed: SEED,
  seats: { P1: ALICE, P2: BOB } as Record<Seat, string>,
});

const m = server.registry.get(matchId)!;

// --- Snapshot the COMPLETE authoritative state up front ----------------------
const fullState = server.getState(matchId).state;
const p1HandTruth = [...fullState.players.P1.hand];
const p2HandTruth = [...fullState.players.P2.hand];
const p1DeckTruth = [...fullState.players.P1.deck];
const p2DeckTruth = [...fullState.players.P2.deck];

assert(p1HandTruth.length > 0, `authoritative P1 hand is non-empty (${p1HandTruth.length} cards)`);
assert(p2HandTruth.length > 0, `authoritative P2 hand is non-empty (${p2HandTruth.length} cards)`);
assert(p1DeckTruth.length > 0, `authoritative P1 deck is non-empty (${p1DeckTruth.length} cards)`);

// Hash the authoritative state BEFORE any projection, to prove projection is pure.
const hashBeforeProjection = hashState(server.getState(matchId).state);

// --- 1+2+3. P1's redacted view ----------------------------------------------
const p1View = m.getViewForSeat("P1");

assert(
  Array.isArray(p1View.self.hand) &&
    p1View.self.hand!.length === p1HandTruth.length &&
    p1View.self.hand!.every((id, i) => id === p1HandTruth[i]),
  "P1 view shows P1's OWN hand contents (real card ids, in order)"
);
assert(
  p1View.opponent.hand === undefined,
  "P1 view OMITS P2's hand field entirely (no opponent card ids on the wire)"
);
assert(
  p1View.opponent.handCount === p2HandTruth.length,
  `P1 view reveals only P2's hand COUNT (${p1View.opponent.handCount})`
);
// Deck order is hidden for BOTH sides: the view carries no deck array at all.
assert(
  (p1View.self as { deck?: unknown }).deck === undefined &&
    (p1View.opponent as { deck?: unknown }).deck === undefined,
  "P1 view carries NO deck array for either side (deck ORDER never revealed)"
);
assert(
  p1View.self.deckCount === p1DeckTruth.length &&
    p1View.opponent.deckCount === p2DeckTruth.length,
  "P1 view reveals only deck COUNTS, not order"
);

// Serialize the whole P1 view and assert no P2 hand card id leaks anywhere in it.
const p1ViewJson = JSON.stringify(p1View);
const leakedP2Cards = p2HandTruth.filter((id) => {
  // Only count ids that aren't ALSO in P1's (legitimately visible) hand.
  if (p1HandTruth.includes(id)) return false;
  return p1ViewJson.includes(JSON.stringify(id).slice(1, -1));
});
assert(
  leakedP2Cards.length === 0,
  `no P2-exclusive hand card id appears anywhere in P1's serialized view (leaks: ${leakedP2Cards.length})`
);

// --- 4. Symmetric for P2 -----------------------------------------------------
const p2View = m.getViewForSeat("P2");
assert(
  Array.isArray(p2View.self.hand) &&
    p2View.self.hand!.length === p2HandTruth.length &&
    p2View.self.hand!.every((id, i) => id === p2HandTruth[i]),
  "P2 view shows P2's OWN hand contents"
);
assert(p2View.opponent.hand === undefined, "P2 view OMITS P1's hand field");

// --- 5. Authoritative state behind the view is still COMPLETE ----------------
const fullAfter = server.getState(matchId).state;
assert(
  fullAfter.players.P1.hand.length === p1HandTruth.length &&
    fullAfter.players.P2.hand.length === p2HandTruth.length &&
    fullAfter.players.P1.deck.length === p1DeckTruth.length &&
    fullAfter.players.P2.deck.length === p2DeckTruth.length,
  "authoritative state still holds BOTH full hands + BOTH full decks after projection"
);
const replayed = replayMatch(server.registry.get(matchId)!.record);
assert(
  hashState(replayed) === hashState(fullAfter),
  "fresh replay(seed, actionLog) reproduces the COMPLETE authoritative state byte-for-byte"
);

// --- 6. Projection is pure: state + log unchanged ----------------------------
const hashAfterProjection = hashState(server.getState(matchId).state);
assert(
  hashBeforeProjection === hashAfterProjection,
  "projecting views did NOT mutate the authoritative state (byte-identical before/after)"
);
assert(
  server.registry.get(matchId)!.seq === 0,
  "projecting views did NOT touch the append-only action log (seq still 0)"
);

// --- 7. After a real action through the AUTHED boundary, redaction still holds.
// Exercise the full fog-of-war response path: a valid P1 bearer submits and gets
// back { version, view, events } — the view is P1's redacted projection.
const bearerP1 = `Bearer ${issueToken(ALICE)}`;
const versionBefore = m.version;
const out = server.submitActionAuthed(matchId, bearerP1, {
  type: "END_TURN",
  player: "P1",
} as Action);
assert(out.accepted, "authed P1 END_TURN accepted through the fog-of-war boundary");
assert(out.version === versionBefore + 1, `version incremented per accepted action (${out.version})`);
assert(out.view !== null && out.view.mySeat === "P1", "response view is the caller's (P1) seat view");
assert(out.view!.opponent.hand === undefined, "response view STILL hides P2's hand after the action");

// Incremental: a client at the old version gets exactly this step's events.
const inc = server.getViewAuthed(matchId, bearerP1, versionBefore);
assert(inc.version === out.version, "incremental read reports the new version");
assert(!inc.stale, "incremental read is not stale when since < version");
const incCurrent = server.getViewAuthed(matchId, bearerP1, out.version);
assert(incCurrent.stale, "incremental read is stale when since == version (client already current)");

console.log("\nALL FOG-OF-WAR PROOFS PASSED\n");
