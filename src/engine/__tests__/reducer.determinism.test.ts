import { describe, it, expect } from "vitest";
import { makeRng, shuffle } from "../rng";
import { createMatchFromDecks } from "../createMatchFromDecks";
import { buildPlayerDeck } from "../../nft/buildOwnedDeck";
import { allCommanders } from "../commanders";
import { playAiMatch } from "../../dev/reducerHarness";

/**
 * Determinism: the engine is a pure reducer over a seeded match. The same
 * seed (and therefore the same scripted action stream) must produce a
 * byte-identical final state and event stream every time. These mirror the
 * `dev:determinism` proof but assert through vitest so CI gates on them.
 */
describe("engine determinism", () => {
  it("same seed yields an identical rng sequence", () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("different seeds yield different rng sequences", () => {
    const a = makeRng(12345);
    const c = makeRng(99999);
    const seqA = [a(), a(), a(), a(), a()];
    const seqC = [c(), c(), c(), c(), c()];
    expect(seqA).not.toEqual(seqC);
  });

  it("seeded shuffle is reproducible", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const s1 = shuffle(items, makeRng(42));
    const s2 = shuffle(items, makeRng(42));
    expect(s1).toEqual(s2);
  });

  it("same seed yields an identical match deck/hand order", () => {
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
    expect(m1.seed).toBe(SEED);
    expect(m1.idCounter).toBe(0);
    expect(m1.players.P1.deck).toEqual(m2.players.P1.deck);
    expect(m1.players.P1.hand).toEqual(m2.players.P1.hand);
    expect(m1.players.P2.deck).toEqual(m2.players.P2.deck);
  });

  it("same (seed, actions) yields a byte-identical final state and event stream", () => {
    const r1 = playAiMatch(54321);
    const r2 = playAiMatch(54321);
    // Byte-identical via JSON serialization — the determinism contract.
    expect(JSON.stringify(r1.result.finalState)).toBe(
      JSON.stringify(r2.result.finalState)
    );
    expect(JSON.stringify(r1.result.events)).toBe(
      JSON.stringify(r2.result.events)
    );
    expect(r1.result.finalState.idCounter).toBe(r2.result.finalState.idCounter);
  });
});
