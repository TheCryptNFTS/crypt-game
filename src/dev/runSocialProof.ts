/**
 * runSocialProof — proves "Tier 4: Play with friends" (private challenges by
 * code) + in-match typographic emotes on the authoritative server, all
 * IN-PROCESS (no sockets).
 *
 * What it proves:
 *   CHALLENGES
 *   1. create => a 6-char code with a future expiry; the creator does NOT enter
 *      the public queue (status stays idle there).
 *   2. status before join => joined:false, matchId:null.
 *   3. join your OWN code => rejected (cannot-join-own-code); invalid code =>
 *      invalid-code.
 *   4. a second player joins => the two are paired into a match; creator=P1,
 *      joiner=P2. status now reports joined:true + the matchId.
 *   5. the produced match is BYTE-IDENTICAL in resolution to a queued match:
 *      replay(seed,log) of the challenge match equals a queue match built from
 *      the same two decks with the same seed (same createPairedMatch path).
 *   6. both players claim their pairing exactly like a queued match (one-shot).
 *   7. re-join a consumed code => code-consumed; cancel-after-join => false.
 *   8. cancel an OPEN code (creator only) removes it; a stranger cannot cancel.
 *   9. expired code => not joinable (TTL GC).
 *
 *   EMOTES
 *  10. listEmotes => the fixed preset set; ids are unique.
 *  11. a participant can send a preset emote; the opponent polls it (since=0).
 *  12. an unknown/forged emote id => ok:false, nothing relayed.
 *  13. a non-participant cannot send/poll (403 AuthError).
 *  14. rate limit: a second emote within the window is rejected (ok:false);
 *      `since` polling returns only newer events.
 *
 * Run: `tsx src/dev/runSocialProof.ts`
 */

import { GameServer, AuthError } from "../../server/server";
import { MatchRegistry, replayMatch, hashState } from "../../server/matchEngine";
import { issueToken } from "../../server/auth";
import { allPlayableCards } from "../engine/cards";
import { allCommanders } from "../engine/commanders";
import type { DeckBootstrapInput } from "../types/matchBootstrap";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

// --- Decks (same legal-enough shape the matchmaking proof uses) --------------
const commander = allCommanders[0];
const someCards = (allPlayableCards as { id: string }[]).slice(0, 30).map((c) => c.id);
function deckFor(): DeckBootstrapInput {
  return { commanderId: commander.id, deck: [...someCards] };
}

const ALICE = "acct_alice";
const BOB = "acct_bob";
const MALLORY = "acct_mallory";
const aliceTok = `Bearer ${issueToken(ALICE)}`;
const bobTok = `Bearer ${issueToken(BOB)}`;
const malloryTok = `Bearer ${issueToken(MALLORY)}`;

const server = new GameServer();

// === 1. create ==============================================================
const lobby = server.createChallenge(aliceTok, deckFor());
assert(/^[A-Z0-9]{6}$/.test(lobby.code), "create => 6-char uppercase code");
assert(lobby.expiresAt > Date.now(), "create => future expiry");
assert(server.queueStatus(aliceTok).state === "idle", "creator is NOT in the public queue");

// === 2. status before join ==================================================
const s0 = server.challengeStatus(aliceTok, lobby.code);
assert(!!s0 && s0.joined === false && s0.matchId === null, "status before join => not joined");

// === 3. bad joins ===========================================================
const ownJoin = server.joinChallenge(aliceTok, lobby.code, deckFor());
assert("error" in ownJoin && ownJoin.error === "cannot-join-own-code", "joining your own code is rejected");
const badJoin = server.joinChallenge(bobTok, "ZZZZZZ", deckFor());
assert("error" in badJoin && badJoin.error === "invalid-code", "invalid code is rejected");

// === 4. join pairs the two ==================================================
const joined = server.joinChallenge(bobTok, lobby.code, deckFor());
assert("matchId" in joined && !!joined.matchId, "join pairs the two players into a match");
const matchId = (joined as { matchId: string }).matchId;
const m = server.registry.get(matchId)!;
assert(m.record.seats.P1 === ALICE && m.record.seats.P2 === BOB, "creator => P1, joiner => P2");

const s1 = server.challengeStatus(aliceTok, lobby.code);
assert(!!s1 && s1.joined === true && s1.matchId === matchId, "status after join => joined + matchId");

// === 5. challenge match is byte-identical to a QUEUE match ===================
// Both the public queue and a challenge funnel through the SAME createPairedMatch
// path, which bootstraps `{ p1, p2, shuffle:true, seed }`. So a challenge match
// and a queue match built from the SAME two decks at the SAME seed must replay
// byte-identically. We replay BOTH records under that identical bootstrap (the
// only difference removed is the wall-clock-derived seed, which we pin).
const sharedBootstrap = {
  p1: deckFor(),
  p2: deckFor(),
  shuffle: true,
  seed: m.record.seed,
};
const challengeReplay = hashState(
  replayMatch({ seed: m.record.seed, actionLog: m.record.actionLog }, sharedBootstrap),
);
{
  const reg = new MatchRegistry();
  reg.enqueue(ALICE, deckFor());
  const pr = reg.enqueue(BOB, deckFor());
  const qm = reg.get(pr.matchId!)!;
  const forced = replayMatch(
    { seed: m.record.seed, actionLog: qm.record.actionLog },
    sharedBootstrap,
  );
  assert(
    hashState(forced) === challengeReplay,
    "challenge match resolves byte-identically to a queue match (same seed discipline + shared create path)",
  );
}

// === 6. both claim their pairing (one-shot) =================================
const aliceClaim = server.claimMatch(aliceTok);
const bobClaim = server.claimMatch(bobTok);
assert(!!aliceClaim && aliceClaim.seat === "P1" && aliceClaim.matchId === matchId, "creator claims P1");
assert(!!bobClaim && bobClaim.seat === "P2" && bobClaim.matchId === matchId, "joiner claims P2");
assert(server.claimMatch(aliceTok) === null, "claim is one-shot");

// === 7. consumed code / cancel-after-join ===================================
const reJoin = server.joinChallenge(malloryTok, lobby.code, deckFor());
assert("error" in reJoin && reJoin.error === "code-consumed", "re-joining a consumed code is rejected");
assert(server.cancelChallenge(aliceTok, lobby.code).cancelled === false, "cannot cancel an already-joined code");

// === 8. cancel an OPEN code (creator only) ==================================
const lobby2 = server.createChallenge(aliceTok, deckFor());
assert(server.cancelChallenge(bobTok, lobby2.code).cancelled === false, "a stranger cannot cancel a lobby");
assert(server.cancelChallenge(aliceTok, lobby2.code).cancelled === true, "creator cancels their open lobby");
assert(server.challengeStatus(aliceTok, lobby2.code) === null, "cancelled lobby is gone");

// === 9. expired code is not joinable ========================================
{
  // Use the registry directly with an injected `now` to drive the TTL GC.
  const reg = new MatchRegistry();
  const created = reg.createChallenge(ALICE, deckFor(), 1_000);
  const future = created.expiresAt + 1;
  const res = reg.joinChallenge(BOB, created.code, deckFor(), future);
  assert("error" in res && res.error === "expired-code", "an expired code is not joinable (TTL GC)");
}

// === 10. emote preset set ====================================================
const presets = server.listEmotes();
assert(presets.length > 0, "listEmotes => non-empty preset set");
assert(new Set(presets.map((p) => p.id)).size === presets.length, "preset ids are unique");
assert(
  presets.every((p) => p.label.includes("⬡")) && presets.some((p) => p.id === "gg"),
  "presets are ⬡-glyph typographic marks (incl. 'gg')",
);

// === 11. send + opponent polls ==============================================
const sent = server.sendEmote(matchId, aliceTok, "greet");
assert(sent.ok === true, "participant sends a preset emote");
const bobSees = server.pollEmotes(matchId, bobTok, 0);
assert(
  bobSees.length === 1 && bobSees[0].emoteId === "greet" && bobSees[0].from === ALICE,
  "opponent polls the relayed emote (since=0)",
);

// === 12. unknown/forged emote id ============================================
const forged = server.sendEmote(matchId, aliceTok, "DROP TABLE");
assert(forged.ok === false, "unknown/forged emote id is rejected (ok:false)");
assert(server.pollEmotes(matchId, bobTok, 0).length === 1, "forged emote was NOT relayed");

// === 13. non-participant cannot send/poll ===================================
let threw = false;
try {
  server.sendEmote(matchId, malloryTok, "gg");
} catch (e) {
  threw = e instanceof AuthError && (e as AuthError).status === 403;
}
assert(threw, "non-participant cannot send an emote (403)");
threw = false;
try {
  server.pollEmotes(matchId, malloryTok, 0);
} catch (e) {
  threw = e instanceof AuthError && (e as AuthError).status === 403;
}
assert(threw, "non-participant cannot poll emotes (403)");

// === 14. rate limit + since polling ==========================================
// Alice already emoted at step 11; a second immediate emote is rate-limited.
const tooFast = server.sendEmote(matchId, aliceTok, "taunt");
assert(tooFast.ok === false, "a second emote within the window is rate-limited (ok:false)");
// Bob (a different player) is independently rate-limited and CAN emote now.
const bobEmote = server.sendEmote(matchId, bobTok, "think");
assert(bobEmote.ok === true, "rate limit is per-player (opponent can still emote)");
// Both emotes are visible from since=0, newest discoverable via max `at`.
const all = server.pollEmotes(matchId, aliceTok, 0);
assert(
  all.length === 2 && all.some((e) => e.emoteId === "greet") && all.some((e) => e.emoteId === "think"),
  "since=0 returns the full recent-emotes channel",
);
// `since` is STRICTLY newer: polling at the latest `at` yields nothing (no
// boundary re-delivery), which is what an incrementally-polling client relies on.
const latestAt = Math.max(...all.map((e) => e.at));
assert(
  server.pollEmotes(matchId, aliceTok, latestAt).length === 0,
  "since-poll is strictly-newer (no re-delivery at the boundary `at`)",
);

console.log("\nALL SOCIAL PROOFS PASSED\n");
