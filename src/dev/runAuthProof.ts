/**
 * runAuthProof — proves the HMAC-signed session token replaces the trust-the-
 * header stub with a VERIFIABLE identity, and that seat ownership is enforced.
 *
 * What it proves (all IN-PROCESS — no sockets):
 *   1. A validly-signed token for account A resolves to A and is accepted.
 *   2. A TAMPERED token (payload changed, signature not re-signed) is rejected.
 *   3. A FORGED token (signed with the wrong secret) is rejected.
 *   4. An EXPIRED token is rejected.
 *   5. A token for A cannot submit for B's seat (seat-spoof), even though the
 *      token itself is valid — identity != authorization for a seat.
 *   6. A missing/garbage bearer is rejected (401).
 *
 * Run: `tsx src/dev/runAuthProof.ts`
 */

import { GameServer, AuthError } from "../../server/server";
import {
  issueToken,
  verifyToken,
  DEV_SESSION_SECRET,
} from "../../server/auth";
import type { Action, Seat } from "../../server/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

/** Run a fn expected to throw an AuthError; assert its status. */
function expectAuthError(fn: () => unknown, status: number, label: string): void {
  try {
    fn();
    console.error(`FAILED: ${label} (expected AuthError ${status}, none thrown)`);
    process.exit(1);
  } catch (e) {
    if (e instanceof AuthError && e.status === status) {
      console.log(`OK: ${label} (AuthError ${status}: ${e.reason})`);
    } else {
      console.error(`FAILED: ${label} (got ${(e as Error).message})`);
      process.exit(1);
    }
  }
}

const ALICE = "acct_alice";
const BOB = "acct_bob";
const MALLORY = "acct_mallory"; // authenticated, but not in the match
const SEED = 246813;

const server = new GameServer();
const { matchId } = server.createMatch({
  seed: SEED,
  seats: { P1: ALICE, P2: BOB } as Record<Seat, string>,
});

// --- 1. A valid token for A resolves to A and is accepted --------------------
const aliceToken = issueToken(ALICE);
const v = verifyToken(aliceToken);
assert(v.ok && v.session.accountId === ALICE, "valid token verifies and resolves to its account");

const caller = server.resolveCaller(matchId, `Bearer ${aliceToken}`);
assert(caller.accountId === ALICE && caller.seat === "P1", "valid bearer resolves to account A and seat P1");

const ok = server.submitActionAuthed(matchId, `Bearer ${aliceToken}`, {
  type: "END_TURN",
  player: "P1",
} as Action);
assert(ok.accepted, "validly-signed token for A submits A's own action successfully");

// --- 2. A TAMPERED token is rejected -----------------------------------------
// Flip the payload to claim BOB without re-signing: signature no longer matches.
const [h, p, s] = aliceToken.split(".");
const tamperedPayload = Buffer.from(
  JSON.stringify({ sub: BOB, exp: Date.now() + 60_000 })
).toString("base64url");
const tampered = `${h}.${tamperedPayload}.${s}`;
const vt = verifyToken(tampered);
assert(!vt.ok && vt.reason === "bad-signature", "tampered token rejected (bad-signature)");
expectAuthError(() => server.resolveCaller(matchId, `Bearer ${tampered}`), 401, "tampered bearer => 401");

// --- 3. A FORGED token (wrong secret) is rejected ----------------------------
const forged = issueToken(ALICE, { secret: DEV_SESSION_SECRET + "-attacker" });
const vf = verifyToken(forged);
assert(!vf.ok && vf.reason === "bad-signature", "forged token (wrong secret) rejected (bad-signature)");
expectAuthError(() => server.resolveCaller(matchId, `Bearer ${forged}`), 401, "forged bearer => 401");

// --- 4. An EXPIRED token is rejected -----------------------------------------
const expired = issueToken(ALICE, { expiry: Date.now() - 1000 });
const ve = verifyToken(expired);
assert(!ve.ok && ve.reason === "expired", "expired token rejected (expired)");
expectAuthError(() => server.resolveCaller(matchId, `Bearer ${expired}`), 401, "expired bearer => 401");

// A token that is valid NOW but checked at a FUTURE clock is expired then.
const shortLived = issueToken(ALICE, { ttlMs: 1000 });
assert(verifyToken(shortLived).ok, "short-lived token valid at issue time");
assert(
  !verifyToken(shortLived, Date.now() + 2000).ok,
  "same token rejected once the (injected) clock passes its expiry"
);

// --- 5. A valid token for A cannot submit for B's seat -----------------------
// Alice presents a perfectly valid token, but tries to act as P2 (Bob's seat).
const spoof = server.submitActionAuthed(matchId, `Bearer ${aliceToken}`, {
  type: "END_TURN",
  player: "P2",
} as Action);
assert(
  !spoof.accepted && spoof.rejectReason === "seat-spoof",
  "valid token for A CANNOT submit for B's seat (seat-spoof); identity != seat authority"
);

// And an authenticated NON-participant (Mallory) is forbidden from acting at all.
const malloryToken = issueToken(MALLORY);
expectAuthError(
  () => server.submitActionAuthed(matchId, `Bearer ${malloryToken}`, {
    type: "END_TURN",
    player: "P1",
  } as Action),
  403,
  "authenticated non-participant forbidden from submitting (403)"
);

// --- 6. Missing / garbage bearer rejected ------------------------------------
expectAuthError(() => server.resolveCaller(matchId, undefined), 401, "missing bearer => 401");
expectAuthError(() => server.resolveCaller(matchId, "not-a-token"), 401, "garbage bearer => 401");

console.log("\nALL AUTH PROOFS PASSED\n");
