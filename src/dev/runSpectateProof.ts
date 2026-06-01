/**
 * runSpectateProof — proves the read-only SPECTATE surface is (a) a correct LIVE
 * list of PUBLIC matches, (b) a NEUTRAL fog-of-war projection that leaks NEITHER
 * player's hidden information, (c) PRIVATE (friend-challenge) matches are NOT
 * spectatable, and (d) spectating is strictly READ-ONLY — it never advances the
 * match, never injects an action, never touches the durable action log. All
 * IN-PROCESS (no sockets).
 *
 * What it proves:
 *   1. A public-queue pairing appears in `GET /spectate/live` with truncated
 *      labels (no full account/wallet id leaks into the list).
 *   2. The neutral spectator view HIDES BOTH players' hands (no `hand` field on
 *      either side; counts only) and reveals NEITHER deck's order — and NO real
 *      hand card id from EITHER player appears anywhere in the serialized view.
 *   3. A PRIVATE friend-challenge match is NOT listed and NOT watchable
 *      (spectatorView => null; HTTP would 404), respecting the friend-duel intent.
 *   4. Spectating is READ-ONLY: polling the spectator view does NOT advance the
 *      version, does NOT mutate the authoritative state, and does NOT touch the
 *      append-only action log (replay(seed,log) is byte-identical before/after).
 *   5. A DECIDED match drops off the live list (only in-progress matches show).
 *
 * Run: `tsx src/dev/runSpectateProof.ts`
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

// --- Legal-enough deck bootstrap for the queue/challenge paths ----------------
const commander = allCommanders[0];
const someCards = (allPlayableCards as { id: string }[]).slice(0, 30).map((c) => c.id);
function deckFor(): DeckBootstrapInput {
  return { commanderId: commander.id, deck: [...someCards] };
}

// Long ids so the truncation is observable (mimics a wallet address).
const ALICE = "0xAlice00000000000000000000000000000000aaaa";
const BOB = "0xBob000000000000000000000000000000000bbbb";
const CAROL = "0xCarol000000000000000000000000000000cccc";
const DAVE = "0xDave0000000000000000000000000000000ddddd";
const aliceTok = `Bearer ${issueToken(ALICE)}`;
const bobTok = `Bearer ${issueToken(BOB)}`;
const carolTok = `Bearer ${issueToken(CAROL)}`;
const daveTok = `Bearer ${issueToken(DAVE)}`;

const server = new GameServer();

// --- Pair two PUBLIC-queue players (Alice => P1, Bob => P2) -------------------
server.enqueue(aliceTok, deckFor());
const paired = server.enqueue(bobTok, deckFor());
assert(paired.state === "matched" && !!paired.matchId, "public queue pairs two players into a live match");
const publicMatchId = paired.matchId!;

// --- 1. The public match is LISTED with truncated labels ---------------------
const live = server.liveSpectatable();
const row = live.find((r) => r.matchId === publicMatchId);
assert(!!row, "public-queue match appears in the live spectate list");
assert(
  row!.p1Label.length < ALICE.length && row!.p2Label.length < BOB.length,
  "live list labels are TRUNCATED (not full account ids)",
);
assert(
  !row!.p1Label.includes(ALICE.slice(6, -4)) && !row!.p2Label.includes(BOB.slice(6, -4)),
  "live list never carries the full account id (no middle of the wallet leaks)",
);
assert(typeof row!.turn === "number" && typeof row!.startedAt === "number", "live row carries turn + startedAt");

// --- Snapshot the COMPLETE authoritative truth for leak-checking --------------
const full = server.getState(publicMatchId).state;
const p1HandTruth = [...full.players.P1.hand];
const p2HandTruth = [...full.players.P2.hand];
assert(p1HandTruth.length > 0 && p2HandTruth.length > 0, "both authoritative hands are non-empty");

// --- 2. The neutral spectator view hides BOTH hands + both deck orders --------
const spec = server.spectatorView(publicMatchId, 0);
assert(spec !== null, "spectatorView returns a view for a public match");
const sv = spec!.view as {
  self: { hand?: unknown; handCount: number; deckCount: number; board: unknown; artifacts: unknown };
  opponent: { hand?: unknown; handCount: number; deckCount: number };
};
assert(sv.self.hand === undefined, "spectator view OMITS the P1 (self) hand field entirely");
assert(sv.opponent.hand === undefined, "spectator view OMITS the P2 (opponent) hand field entirely");
assert(
  sv.self.handCount === p1HandTruth.length && sv.opponent.handCount === p2HandTruth.length,
  "spectator view reveals only hand COUNTS for both players",
);
assert(
  (sv.self as { deck?: unknown }).deck === undefined &&
    (sv.opponent as { deck?: unknown }).deck === undefined,
  "spectator view carries NO deck array for either side (deck ORDER never revealed)",
);

// Serialize the WHOLE spectator view and assert NO real hand card id (from
// either player) appears anywhere in it.
const svJson = JSON.stringify(spec!.view);
const allHandTruth = [...new Set([...p1HandTruth, ...p2HandTruth])];
const leaked = allHandTruth.filter((id) => svJson.includes(JSON.stringify(id).slice(1, -1)));
assert(
  leaked.length === 0,
  `no real hand card id (either player) appears anywhere in the serialized spectator view (leaks: ${leaked.length})`,
);

// --- 3. A PRIVATE friend-challenge match is NOT spectatable -------------------
const lobby = server.createChallenge(carolTok, deckFor());
const joined = server.joinChallenge(daveTok, lobby.code, deckFor());
assert("matchId" in joined, "friend challenge pairs Carol + Dave into a match");
const privateMatchId = (joined as { matchId: string }).matchId;
assert(
  !server.liveSpectatable().some((r) => r.matchId === privateMatchId),
  "private friend-challenge match is NOT in the live spectate list",
);
assert(
  server.spectatorView(privateMatchId, 0) === null,
  "private friend-challenge match is NOT watchable (spectatorView => null => HTTP 404)",
);
// An unknown match id is likewise not watchable.
assert(server.spectatorView("does_not_exist", 0) === null, "unknown match id => null (not watchable)");

// --- 4. Spectating is READ-ONLY: it never advances the match ------------------
const m = server.registry.get(publicMatchId)!;
const versionBefore = m.version;
const seqBefore = m.seq;
const hashBefore = hashState(server.getState(publicMatchId).state);
const replayBefore = hashState(replayMatch(m.record));
// Poll the spectator view many times from various `since` values.
for (let i = 0; i < 25; i++) {
  server.spectatorView(publicMatchId, i % 3);
  server.liveSpectatable();
}
assert(m.version === versionBefore, "spectating did NOT advance the match version");
assert(m.seq === seqBefore, "spectating did NOT touch the append-only action log (seq unchanged)");
assert(
  hashState(server.getState(publicMatchId).state) === hashBefore,
  "spectating did NOT mutate the authoritative state (byte-identical before/after)",
);
assert(
  hashState(replayMatch(m.record)) === replayBefore,
  "replay(seed,log) is unchanged by spectating (determinism intact)",
);

// `since`-poll semantics: stale when caller is current, fresh after an action.
const incStale = m.getSpectatorIncremental(m.version);
assert(incStale.stale, "spectator incremental is stale when since == version");

// Drive ONE real action through the authed boundary (a player acts), then a
// spectator at the old version sees exactly the new version + this step's events.
const out = server.submitActionAuthed(publicMatchId, aliceTok, {
  type: "END_TURN",
  player: "P1",
} as Action);
assert(out.accepted, "a player's END_TURN advances the match (sanity)");
const incAfter = m.getSpectatorIncremental(versionBefore);
assert(incAfter.version === out.version && !incAfter.stale, "spectator sees the new version after a real action");
assert(incAfter.events.length > 0, "spectator incremental carries the post-`since` events for its combat log");
// Even after a real action, the spectator view STILL hides both hands.
const sv2 = server.spectatorView(publicMatchId, 0)!.view as {
  self: { hand?: unknown };
  opponent: { hand?: unknown };
};
assert(
  sv2.self.hand === undefined && sv2.opponent.hand === undefined,
  "spectator view STILL hides both hands after a real action",
);

// --- 5. A DECIDED match drops off the live list ------------------------------
server.concede(publicMatchId, aliceTok); // Alice concedes -> match decided
assert(
  !server.liveSpectatable().some((r) => r.matchId === publicMatchId),
  "a decided (conceded) match is no longer in the live spectate list",
);

console.log("\nALL SPECTATE PROOFS PASSED\n");
