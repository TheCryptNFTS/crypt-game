/**
 * runServerPersistenceProof — proves authoritative matches SURVIVE A RESTART.
 *
 * The convergence proof shows live state == replay(seed, actionLog) within a
 * single process. This proof closes the durability gap: it persists the
 * append-only log to SQLite, throws away the in-memory registry, points a FRESH
 * server at the SAME DB, and asserts the reloaded match is byte-identical.
 *
 * What it proves (all IN-PROCESS, on a temp-file SQLite DB):
 *   1. A match is created and several interleaved two-seat actions are played
 *      through the server; each action is durably appended on accept.
 *   2. A SECOND, FRESH GameServer pointed at the SAME DB (a simulated restart)
 *      recovers the match and its hashed state is byte-IDENTICAL to pre-restart.
 *   3. A rejected (out-of-turn / seat-spoof) action did NOT get persisted — the
 *      durable action log length is unchanged.
 *   4. Determinism: reloading the SAME DB twice yields identical state.
 *   5. Post-restart play continues to persist and survives a further restart.
 *
 * Run: `tsx src/dev/runServerPersistenceProof.ts`
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GameServer } from "../../server/server";
import { PersistenceStore } from "../../server/persistence";
import { hashState } from "../../server/matchEngine";
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
const SEED = 909090;

// A temp-file DB so we can open it from multiple independent connections,
// exactly modelling a process restart. (`:memory:` cannot be shared across
// connections, so durability-across-restart requires a real file.)
const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), "crypt-persist-"));
const dbPath = path.join(dbDir, "crypt.db");

/** Drive N accepted interleaved turn-flips through a server, returning the
 *  number actually accepted (mirrors the convergence proof's interleaving). */
function playInterleavedTurns(
  server: GameServer,
  matchId: string,
  target: number
): number {
  let accepted = 0;
  let guard = 0;
  while (accepted < target && guard < 1000) {
    guard++;
    const a = server.submitAction(matchId, ALICE, {
      type: "END_TURN",
      player: "P1",
    } as Action);
    const b = server.submitAction(matchId, BOB, {
      type: "END_TURN",
      player: "P2",
    } as Action);
    if (a.accepted) accepted++;
    if (b.accepted) accepted++;
  }
  return accepted;
}

// --- 1. Create + play through a DURABLE server -------------------------------
const store1 = new PersistenceStore(dbPath);
const server1 = new GameServer(store1);
const { matchId } = server1.createMatch({
  seed: SEED,
  seats: { P1: ALICE, P2: BOB } as Record<Seat, string>,
});

const accepted1 = playInterleavedTurns(server1, matchId, 10);
assert(accepted1 === 10, `played 10 interleaved turn-flips (got ${accepted1})`);

const preRestartHash = hashState(server1.getState(matchId).state);
const preRestartSeq = server1.registry.get(matchId)!.seq;
assert(preRestartSeq === 10, `durable log has 10 entries pre-restart (got ${preRestartSeq})`);

// Close the first connection — the match is now ONLY on disk.
store1.close();

// --- 2. RESTART: fresh server + fresh store pointed at the SAME DB -----------
const store2 = new PersistenceStore(dbPath);
const server2 = new GameServer(store2); // bootstrap() runs in the constructor

const reloaded = server2.registry.get(matchId);
assert(!!reloaded, "fresh server recovered the match from disk after restart");
const postRestartHash = hashState(server2.getState(matchId).state);
assert(
  postRestartHash === preRestartHash,
  "reloaded state is BYTE-IDENTICAL to pre-restart state"
);
assert(
  server2.registry.get(matchId)!.seq === preRestartSeq,
  "reloaded durable log length matches pre-restart seq"
);

// The reconnect/reconcile path agrees too (it throws on any divergence).
const reconnect = server2.reconnect(matchId);
assert(
  hashState(reconnect.state) === preRestartHash,
  "reconnect snapshot (replay-verified) == pre-restart state after restart"
);

// --- 3. A REJECTED action must NOT have been persisted -----------------------
// Drive a seat-spoof and an out-of-turn action on the fresh server; neither may
// grow the durable log. Re-open the DB to confirm what's actually on disk.
const spoof = server2.submitAction(matchId, BOB, {
  type: "END_TURN",
  player: "P1",
} as Action);
assert(!spoof.accepted, "seat-spoof action rejected on reloaded match");

const active = server2.getState(matchId).state.activePlayer;
const idleSeat: Seat = active === "P1" ? "P2" : "P1";
const idleAccount = idleSeat === "P1" ? ALICE : BOB;
const idle = server2.submitAction(matchId, idleAccount, {
  type: "END_TURN",
  player: idleSeat,
} as Action);
assert(!idle.accepted, "out-of-turn action reject-softed on reloaded match");

// Inspect the DB directly: the action log on disk must STILL be exactly 10.
const probe = new PersistenceStore(dbPath);
const onDisk = probe.loadActions(matchId);
probe.close();
assert(
  onDisk.length === preRestartSeq,
  `rejected actions did NOT persist (on-disk log still ${preRestartSeq}, got ${onDisk.length})`
);

// --- 4. Determinism: a SECOND independent reload matches the first -----------
store2.close();
const store3 = new PersistenceStore(dbPath);
const server3 = new GameServer(store3);
const reloadHashAgain = hashState(server3.getState(matchId).state);
assert(
  reloadHashAgain === preRestartHash,
  "reloading the SAME DB twice yields identical state (deterministic recovery)"
);

// --- 5. Post-restart play persists and survives a FURTHER restart ------------
const accepted3 = playInterleavedTurns(server3, matchId, 4);
assert(accepted3 === 4, `played 4 more turn-flips after restart (got ${accepted3})`);
const afterMoreHash = hashState(server3.getState(matchId).state);
const afterMoreSeq = server3.registry.get(matchId)!.seq;
assert(afterMoreSeq === 14, `durable log grew to 14 after more play (got ${afterMoreSeq})`);
store3.close();

const store4 = new PersistenceStore(dbPath);
const server4 = new GameServer(store4);
assert(
  hashState(server4.getState(matchId).state) === afterMoreHash,
  "post-restart play also survives a further restart (byte-identical)"
);
assert(
  server4.registry.get(matchId)!.seq === 14,
  "durable log still 14 after the second restart"
);
store4.close();

// --- cleanup -----------------------------------------------------------------
fs.rmSync(dbDir, { recursive: true, force: true });

console.log("\nALL SERVER PERSISTENCE PROOFS PASSED\n");
