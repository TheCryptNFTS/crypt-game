/**
 * runServerConvergenceProof — proves the authoritative server scaffold upholds
 * the engine's determinism contract end to end.
 *
 * What it proves (all IN-PROCESS — no sockets, zero network flakiness):
 *   1. Two simulated clients submit interleaved actions THROUGH the server
 *      wrapper (GameServer). Each only ever submits actions for its own seat;
 *      the server re-derives state and accepts only legal ones.
 *   2. Both observers (each reads the server's authoritative state) converge to
 *      byte-IDENTICAL state.
 *   3. A FRESH replay from the durable record `{seed, actionLog}` equals the
 *      live state byte-for-byte (reconnection / anti-cheat foundation).
 *   4. A spoofed action (client submitting for the WRONG seat) is rejected and
 *      the append-only log is left UNTOUCHED.
 *   5. An out-of-turn action reject-softs and never enters the log.
 *
 * Run: `tsx src/dev/runServerConvergenceProof.ts`
 */

import { GameServer } from "../../server/server";
import { replayMatch, hashState } from "../../server/matchEngine";
import type { Action, Seat } from "../../server/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

// --- Two accounts, one match -------------------------------------------------
const ALICE = "acct_alice";
const BOB = "acct_bob";
const SEED = 424242;

const server = new GameServer();
const { matchId } = server.createMatch({
  seed: SEED,
  seats: { P1: ALICE, P2: BOB } as Record<Seat, string>,
});

/**
 * A "client": knows its account + seat, and submits actions through the server.
 * It NEVER holds authoritative state — after each submit it re-reads the
 * server's derived state, exactly like a real networked client would.
 */
class SimClient {
  constructor(
    private readonly account: string,
    private readonly seat: Seat
  ) {}

  endTurn(): boolean {
    const action: Action = { type: "END_TURN", player: this.seat };
    const res = server.submitAction(matchId, this.account, action);
    return res.accepted;
  }

  /** What this client currently observes (server-derived authoritative state). */
  observe() {
    return server.getState(matchId);
  }
}

const alice = new SimClient(ALICE, "P1");
const bob = new SimClient(BOB, "P2");

// --- 1. Interleaved play -----------------------------------------------------
// Both clients greedily TRY to end their turn every tick. The server accepts
// only the active seat's action, so turns flip cleanly and the two clients'
// submissions naturally interleave. We drive 12 accepted turn-flips.
let acceptedFlips = 0;
let guard = 0;
while (acceptedFlips < 12 && guard < 1000) {
  guard++;
  // Order of *attempts* is interleaved/alternating; correctness must not depend
  // on it (only the active seat's attempt is accepted).
  const aOk = alice.endTurn();
  const bOk = bob.endTurn();
  if (aOk) acceptedFlips++;
  if (bOk) acceptedFlips++;
}
assert(acceptedFlips === 12, `server accepted exactly 12 interleaved turn-flips (got ${acceptedFlips})`);

// --- 2. Both observers converge to byte-identical state ----------------------
const aliceView = alice.observe();
const bobView = bob.observe();
assert(
  hashState(aliceView.state) === hashState(bobView.state),
  "both clients observe byte-identical authoritative state"
);
assert(aliceView.seq === bobView.seq, "both clients observe the same committed seq");

// --- 3. Fresh replay from {seed, actionLog} equals live state ----------------
const { seed, actionLog } = server.registry.get(matchId)!.record;
const replayed = replayMatch({ seed, actionLog });
assert(
  hashState(replayed) === hashState(aliceView.state),
  "fresh replay(seed, actionLog) == live authoritative state (byte-identical)"
);
// And the registry's own reconcile path agrees (it throws on divergence).
const reconnect = server.reconnect(matchId);
assert(
  hashState(reconnect.state) === hashState(aliceView.state),
  "reconnect snapshot (replay-verified) == live state"
);

// --- 4. Seat-spoof is rejected and the log is untouched ----------------------
const seqBeforeSpoof = server.registry.get(matchId)!.seq;
// Bob (P2) tries to submit an action claiming to be P1.
const spoof = server.submitAction(matchId, BOB, { type: "END_TURN", player: "P1" });
assert(!spoof.accepted && spoof.rejectReason === "seat-spoof", "seat-spoof action rejected");
assert(
  server.registry.get(matchId)!.seq === seqBeforeSpoof,
  "append-only log UNTOUCHED after rejected spoof"
);

// --- 5. Out-of-turn action reject-softs and never enters the log -------------
// Determine the inactive seat from live state, then have that seat try to act.
const active = server.getState(matchId).state.activePlayer;
const idleSeat: Seat = active === "P1" ? "P2" : "P1";
const idleAccount = idleSeat === "P1" ? ALICE : BOB;
const seqBeforeIdle = server.registry.get(matchId)!.seq;
const idle = server.submitAction(matchId, idleAccount, { type: "END_TURN", player: idleSeat });
assert(!idle.accepted && idle.rejectReason === "not-your-turn", "out-of-turn action reject-softed");
assert(
  server.registry.get(matchId)!.seq === seqBeforeIdle,
  "append-only log UNTOUCHED after out-of-turn reject"
);

// --- 6. Re-replay still matches after the rejected attempts ------------------
const finalReplay = replayMatch(server.registry.get(matchId)!.record);
assert(
  hashState(finalReplay) === hashState(server.getState(matchId).state),
  "replay still byte-identical after rejected (non-logged) attempts"
);

console.log("\nALL SERVER CONVERGENCE PROOFS PASSED\n");
