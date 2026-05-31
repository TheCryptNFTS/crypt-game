import { makeRng, shuffle } from "../engine/rng";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { buildPlayerDeck } from "../nft/buildOwnedDeck";
import { allCommanders } from "../engine/commanders";
import { playAiMatch } from "../dev/reducerHarness";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

// 1. Same seed => identical PRNG stream.
const a = makeRng(12345);
const b = makeRng(12345);
const seqA = [a(), a(), a(), a(), a()];
const seqB = [b(), b(), b(), b(), b()];
assert(JSON.stringify(seqA) === JSON.stringify(seqB), "same seed yields identical rng sequence");

// 2. Different seed => different stream.
const c = makeRng(99999);
const seqC = [c(), c(), c(), c(), c()];
assert(JSON.stringify(seqA) !== JSON.stringify(seqC), "different seed yields different rng sequence");

// 3. Seeded shuffle is reproducible.
const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const s1 = shuffle(items, makeRng(42));
const s2 = shuffle(items, makeRng(42));
assert(JSON.stringify(s1) === JSON.stringify(s2), "same seed yields identical shuffle");

// 4. Full match from same seed => identical opening hands/decks + seed/idCounter.
const cmd = allCommanders[0];
const deck = buildPlayerDeck().deck;
const SEED = 7777;
const m1: any = createMatchFromDecks({
  p1: { commanderId: cmd.id, deck },
  p2: { commanderId: cmd.id, deck },
  seed: SEED,
});
const m2: any = createMatchFromDecks({
  p1: { commanderId: cmd.id, deck },
  p2: { commanderId: cmd.id, deck },
  seed: SEED,
});
assert(m1.seed === SEED && m2.seed === SEED, "seed stored on match state");
assert(m1.idCounter === 0 && m2.idCounter === 0, "idCounter initialized to 0");
assert(
  JSON.stringify(m1.players.P1.deck) === JSON.stringify(m2.players.P1.deck) &&
    JSON.stringify(m1.players.P1.hand) === JSON.stringify(m2.players.P1.hand) &&
    JSON.stringify(m1.players.P2.deck) === JSON.stringify(m2.players.P2.deck),
  "same seed yields identical match deck/hand order"
);

// 5. (seed, actions) -> byte-identical final state run twice through applyAction.
const r1 = playAiMatch(54321);
const r2 = playAiMatch(54321);
assert(
  JSON.stringify(r1.result.finalState) === JSON.stringify(r2.result.finalState),
  "same (seed, actions) yields byte-identical final state twice"
);
assert(
  JSON.stringify(r1.result.events) === JSON.stringify(r2.result.events),
  "same (seed, actions) yields byte-identical event stream twice"
);

// 6. idCounter advances monotonically and draw order matches across the two runs.
assert(
  r1.result.finalState.idCounter === r2.result.finalState.idCounter,
  "idCounter matches across identical reducer runs"
);
assert(
  JSON.stringify(r1.result.finalState.players.P1.deck) ===
    JSON.stringify(r2.result.finalState.players.P1.deck) &&
    JSON.stringify(r1.result.finalState.players.P2.deck) ===
      JSON.stringify(r2.result.finalState.players.P2.deck),
  "draw order (remaining decks) matches across identical reducer runs"
);

console.log("\nALL DETERMINISM PROOFS PASSED\n");
