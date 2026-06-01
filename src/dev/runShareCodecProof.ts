/**
 * dev:share — proof for the CREATOR export codecs.
 *
 *   (1) DECK codec: encodeDeck -> decodeDeck round-trips a deck EXACTLY (commander
 *       + ordered card-id list, duplicates preserved), and the wire string is
 *       copy-paste-safe (no chars needing URL escaping).
 *   (2) REPLAY codec: encodeReplay -> decodeReplay round-trips seed + action list,
 *       AND re-feeding the decoded (seed, actions) through the SAME reducer the
 *       live game uses re-derives the BYTE-IDENTICAL final state — proving
 *       seed+actions = full deterministic replay.
 *
 * Deterministic, node-only at runtime, NO reducer/golden mutation.
 */

import { encodeDeck, decodeDeck, type ShareableDeck } from "../share/deckCodec";
import { encodeReplay, decodeReplay } from "../share/replayCodec";
import { playAiMatch, replay as replayActions, makeSeededMatch } from "./reducerHarness";
import type { Action } from "../engine/reducer";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

// ---- (1) DECK CODEC ----------------------------------------------------------

const deck: ShareableDeck = {
  commanderId: "cmd_stone_warden",
  // Intentional duplicates + ordering to prove EXACT round-trip.
  cards: ["tcg_1", "tcg_1", "tcg_2", "tcg_3", "tcg_3", "tcg_42", "tcg_7"],
};

const deckCode = encodeDeck(deck);
const decodedDeck = decodeDeck(deckCode);

assert(
  JSON.stringify(decodedDeck) === JSON.stringify(deck),
  "deck encode->decode round-trips exactly (commander + ordered cards + duplicates)"
);
assert(
  deckCode === encodeURIComponent(deckCode),
  "deck share code is URL/copy-paste safe (no escaping needed)"
);
assert(
  decodeDeck(encodeDeck({ commanderId: "x", cards: [] })).cards.length === 0,
  "empty deck round-trips"
);

let threw = false;
try {
  decodeDeck("v9.garbage");
} catch {
  threw = true;
}
assert(threw, "decodeDeck rejects an unsupported version");

// ---- (2) REPLAY CODEC + RE-DERIVATION ----------------------------------------

const SEED = 54321;
const { actions, result } = playAiMatch(SEED);

const replayCode = encodeReplay({ seed: SEED, actions });
const decodedReplay = decodeReplay(replayCode);

assert(decodedReplay.seed === SEED, "replay encode->decode preserves seed");
assert(
  JSON.stringify(decodedReplay.actions) === JSON.stringify(actions),
  "replay encode->decode preserves the action list exactly"
);
assert(
  replayCode === encodeURIComponent(replayCode),
  "replay share code is URL/copy-paste safe (no escaping needed)"
);

// Re-derive: feed decoded (seed, actions) back through the reducer.
const rederived = replayActions(
  makeSeededMatch(decodedReplay.seed),
  decodedReplay.actions as Action[]
);

assert(
  JSON.stringify(rederived.finalState) === JSON.stringify(result.finalState),
  "decoded (seed, actions) re-derives the BYTE-IDENTICAL final state"
);
assert(
  rederived.finalState.winner === result.finalState.winner,
  "re-derived match resolves to the same winner"
);

console.log("\nALL SHARE CODEC PROOFS PASSED\n");
