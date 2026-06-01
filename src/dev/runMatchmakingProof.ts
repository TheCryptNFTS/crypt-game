/**
 * runMatchmakingProof — proves the FIFO matchmaking queue + concede/timeout
 * lifecycle on the authoritative server, all IN-PROCESS (no sockets).
 *
 * What it proves:
 *   1. Enqueuing ONE player leaves them queued (position 1), no match yet.
 *   2. Enqueuing a SECOND player pairs the two: longest-waiting => P1, next =>
 *      P2, into a fresh AuthoritativeMatch with both decks bootstrapped.
 *   3. Each player can CLAIM their pairing exactly once (matchId + seat + an
 *      initial redacted view); the claim is one-shot (null afterwards).
 *   4. Re-enqueue is idempotent (no duplicate queue tickets / second match).
 *   5. DEQUEUE removes a waiting player so they are never paired.
 *   6. CONCEDE forfeits the conceding seat; the opponent is the winner; the
 *      decided match rejects all further actions; the action log is UNTOUCHED
 *      (replay(seed,log) is unaffected — concede is an out-of-band overlay).
 *   7. TIMEOUT reaping auto-concedes a seat unreachable past the timeout, and
 *      the OPPONENT (the seat seen more recently) wins.
 *
 * Run: `tsx src/dev/runMatchmakingProof.ts`
 */

import { GameServer } from "../../server/server";
import { replayMatch, hashState } from "../../server/matchEngine";
import { issueToken } from "../../server/auth";
import { allPlayableCards } from "../engine/cards";
import { allCommanders } from "../engine/commanders";
import type { Action } from "../../server/types";
import type { DeckBootstrapInput } from "../types/matchBootstrap";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

// --- Build a legal-enough deck bootstrap for two players ---------------------
const commander = allCommanders[0];
const someCards = (allPlayableCards as { id: string }[]).slice(0, 30).map((c) => c.id);
function deckFor(): DeckBootstrapInput {
  return { commanderId: commander.id, deck: [...someCards] };
}

const ALICE = "acct_alice";
const BOB = "acct_bob";
const CAROL = "acct_carol";
const aliceTok = `Bearer ${issueToken(ALICE)}`;
const bobTok = `Bearer ${issueToken(BOB)}`;
const carolTok = `Bearer ${issueToken(CAROL)}`;

const server = new GameServer();

// --- 1. One player queued, no match -----------------------------------------
const q1 = server.enqueue(aliceTok, deckFor());
assert(q1.state === "queued" && q1.position === 1, "first enqueue => queued at position 1");

// --- 4 (pre-check). Re-enqueue is idempotent: still position 1, no pairing ----
const q1again = server.enqueue(aliceTok, deckFor());
assert(q1again.state === "queued" && q1again.position === 1, "re-enqueue is idempotent (still position 1)");

// --- 2. Second player pairs the two -----------------------------------------
const q2 = server.enqueue(bobTok, deckFor());
assert(q2.state === "matched" && !!q2.matchId, "second enqueue pairs the two players (matched)");
// Bob enqueued second, so by FIFO the longest-waiting (Alice) is P1.
assert(q2.seat === "P2", "second-enqueued player gets seat P2");

// Alice now sees herself matched too (her pairing is pending claim).
const aliceStatus = server.queueStatus(aliceTok);
assert(
  aliceStatus.state === "matched" && aliceStatus.seat === "P1" && aliceStatus.matchId === q2.matchId,
  "first-enqueued player is matched as P1 into the SAME match",
);

// --- 3. Claim is one-shot ----------------------------------------------------
const aliceClaim = server.claimMatch(aliceTok);
const bobClaim = server.claimMatch(bobTok);
assert(
  !!aliceClaim && aliceClaim.seat === "P1" && aliceClaim.view.mySeat === "P1",
  "Alice claims P1 + initial redacted view",
);
assert(!!bobClaim && bobClaim.seat === "P2", "Bob claims P2");
assert(server.claimMatch(aliceTok) === null, "claim is one-shot (null on second claim)");
const matchId = aliceClaim!.matchId;

// --- 5. Dequeue removes a waiting player -------------------------------------
server.enqueue(carolTok, deckFor());
assert(server.queueStatus(carolTok).state === "queued", "Carol queued (odd one out)");
assert(server.dequeue(carolTok).cancelled, "dequeue removes Carol");
assert(server.queueStatus(carolTok).state === "idle", "Carol idle after dequeue");

// --- 6. Concede: opponent wins, log untouched, match terminal ----------------
const seqBefore = server.registry.get(matchId)!.seq;
const recordBefore = hashState(replayMatch(server.registry.get(matchId)!.record));
const conceded = server.concede(matchId, aliceTok); // Alice (P1) concedes
assert(conceded.winner === "P2", "P1 concede => P2 wins");
assert(conceded.view.winner === "P2", "conceding player's view shows opponent as winner");

// The append-only engine log is UNTOUCHED by a concede (it is an overlay).
assert(server.registry.get(matchId)!.seq === seqBefore, "concede leaves the action log UNTOUCHED");
assert(
  hashState(replayMatch(server.registry.get(matchId)!.record)) === recordBefore,
  "replay(seed,log) is unchanged by the concede overlay",
);

// A decided match rejects all further actions.
const afterConcede = server.submitAction(matchId, ALICE, { type: "END_TURN", player: "P1" } as Action);
assert(
  !afterConcede.accepted && afterConcede.rejectReason === "match-decided",
  "decided (conceded) match rejects further actions (match-decided)",
);

// --- 7. Timeout reaping auto-concedes the unreachable seat -------------------
// Fresh pair for the timeout test.
const dave = `Bearer ${issueToken("acct_dave")}`;
const erin = `Bearer ${issueToken("acct_erin")}`;
server.enqueue(dave, deckFor());
const pair2 = server.enqueue(erin, deckFor());
const m2 = pair2.matchId!;
// Both claim; Erin (P2) then goes silent while Dave (P1) keeps reading. We force
// a measurable activity GAP so the reaper has an unambiguous stalest seat.
server.claimMatch(dave);
server.claimMatch(erin);
const m2match = server.registry.get(m2)!;
const busyWaitMs = (ms: number) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    /* spin so the next touch lands in a strictly later millisecond */
  }
};
busyWaitMs(8);
server.getViewAuthed(m2, dave); // Dave (P1) is "seen" strictly AFTER Erin (P2)
const p1Seen = m2match.lastSeenAt("P1");
const p2Seen = m2match.lastSeenAt("P2");
const gap = p1Seen - p2Seen;
assert(gap > 0, "Dave (P1) was seen strictly after Erin (P2) — measurable gap");
// Pick `now` and a timeout where ONLY P2 is stale: p1Silent <= timeout < p2Silent.
const now = p1Seen + 1; // p1Silent = 1, p2Silent = gap + 1
const timeout = gap; // 1 <= gap (since gap >= 1) and gap < gap+1 = p2Silent
const reaped = server.reap(timeout, now);
assert(reaped.includes(m2), "reaper times out the match with an unreachable seat");
assert(server.registry.get(m2)!.winner === "P1", "timeout forfeits the stale seat (P2); P1 wins");

console.log("\nALL MATCHMAKING PROOFS PASSED\n");
