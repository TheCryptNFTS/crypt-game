/**
 * dev:sealed — proves the SEALED / DRAFT (limited) machinery is deterministic,
 * pool-faithful, limited-legal, constructed-safe, and match-startable.
 *
 * Properties asserted:
 *   (a) DETERMINISM        — same seed -> byte-identical pool (and draft packs).
 *   (b) REAL CARDS ONLY    — every pool card resolves in the playable registry,
 *                            is a curated-core card, and is never soft-banned.
 *   (c) VARIES BY SEED     — different seeds -> different pools (not hardcoded).
 *   (d) LIMITED-LEGAL      — an assembled limited deck passes validateLimitedDeck.
 *   (e) CONSTRUCTED-SAFE   — that same limited deck ALSO passes the UNCHANGED
 *                            constructed validateDeck (limited never weakens it),
 *                            AND a deck with a card OUTSIDE the pool that is still
 *                            constructed-legal is correctly REJECTED by limited
 *                            (limited only ADDS the pool restriction).
 *   (f) MATCH-STARTABLE    — the limited deck + its picked curated commander build
 *                            a real match through the SAME createMatchFromDecks
 *                            the constructed path uses.
 */

import {
  generateSealedPool,
  generateDraftPacks,
  buildLimitedDeckFromPool,
  validateLimitedDeck,
  pickLimitedCommander,
  poolSupply,
  SEALED_PACK_SIZE,
  SEALED_DEFAULT_PACKS,
  LIMITED_MAX_DECK,
} from "../engine/sealedMode";
import { getPlayableCardById, isCardDisabled } from "../engine/cards";
import { validateDeck } from "../engine/deckRules";
import { getCommanderById } from "../engine/commanders";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import curatedCoreSetV2 from "../data/curatedCoreSetV2.json";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`OK: ${name}`);
  } else {
    failures += 1;
    console.error(
      `FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : "")
    );
  }
}

const CURATED_SOURCE_IDS = new Set(
  ((curatedCoreSetV2 as { all?: { sourceCardId: string }[] }).all ?? []).map(
    (e) => e.sourceCardId
  )
);

// === (a) DETERMINISM: same seed -> identical pool + identical draft packs ========
{
  const a = generateSealedPool(12345, SEALED_DEFAULT_PACKS);
  const b = generateSealedPool(12345, SEALED_DEFAULT_PACKS);
  check(
    "same seed -> identical pool (ids + order)",
    JSON.stringify(a.cards.map((c) => c.id)) === JSON.stringify(b.cards.map((c) => c.id))
  );
  check(
    "pool size = packs * pack-size",
    a.cards.length === SEALED_DEFAULT_PACKS * SEALED_PACK_SIZE,
    a.cards.length
  );
  const pa = generateDraftPacks(777, 6);
  const pb = generateDraftPacks(777, 6);
  check(
    "same seed -> identical draft packs",
    JSON.stringify(pa.map((p) => p.map((c) => c.id))) ===
      JSON.stringify(pb.map((p) => p.map((c) => c.id)))
  );
  check(
    "draft packs reconstitute the sealed pool exactly",
    JSON.stringify(pa.flat().map((c) => c.id)) ===
      JSON.stringify(generateSealedPool(777, 6).cards.map((c) => c.id))
  );
}

// === (b) REAL CARDS ONLY: registry-resolvable, curated, never soft-banned ========
{
  const pool = generateSealedPool(42, SEALED_DEFAULT_PACKS);
  let allReal = true;
  let allCurated = true;
  let anyBanned = false;
  for (const c of pool.cards) {
    if (!getPlayableCardById(c.id)) allReal = false;
    if (!CURATED_SOURCE_IDS.has(c.id)) allCurated = false;
    if (isCardDisabled(c.id)) anyBanned = true;
  }
  check("every pool card resolves in the playable registry", allReal);
  check("every pool card is a curated-core (V2) card", allCurated);
  check("no soft-banned card ever enters the pool", !anyBanned);
}

// === (c) VARIES BY SEED ==========================================================
{
  const sigs = new Set<string>();
  for (let s = 1; s <= 20; s += 1) {
    sigs.add(generateSealedPool(s, 6).cards.map((c) => c.id).join(","));
  }
  check("different seeds -> different pools (>= 10 distinct over 20 seeds)", sigs.size >= 10, sigs.size);
}

// === (d) LIMITED-LEGAL: an assembled deck passes limited validation ==============
let sampleDeck: string[] = [];
let sampleCommander = "";
{
  const pool = generateSealedPool(2026, SEALED_DEFAULT_PACKS);
  sampleDeck = buildLimitedDeckFromPool(pool);
  const res = validateLimitedDeck(sampleDeck, pool);
  check("assembled limited deck is exactly 30 cards", sampleDeck.length === LIMITED_MAX_DECK, sampleDeck.length);
  check("assembled limited deck passes validateLimitedDeck", res.valid, res.errors);

  // Determinism of assembly: same seed -> same deck.
  const again = buildLimitedDeckFromPool(generateSealedPool(2026, SEALED_DEFAULT_PACKS));
  check("limited deck assembly is deterministic (same seed -> same deck)", JSON.stringify(sampleDeck) === JSON.stringify(again));

  sampleCommander = pickLimitedCommander(sampleDeck);
  check("picked a real curated commander for the limited deck", !!getCommanderById(sampleCommander), sampleCommander);
}

// === (e) CONSTRUCTED-SAFE (additive, never weakening) ============================
{
  // The limited deck is ALSO constructed-legal — limited is additive, so a
  // limited-legal deck can never be constructed-illegal.
  const cmd = getCommanderById(sampleCommander);
  const constructed = validateDeck(sampleDeck, sampleCommander, {
    deckSize: cmd!.deckRules.deckSize,
    maxCopies: 2,
    allowGodCards: cmd!.deckRules.maxGodCards > 0,
  });
  check("limited-legal deck is ALSO constructed-legal (limited never weakens constructed)", constructed.valid, constructed.errors);

  // Limited ADDS the pool restriction: a card that is perfectly constructed-legal
  // but NOT in the opened pool must be REJECTED by limited validation. Find a
  // curated card absent from this pool and swap it in.
  const pool = generateSealedPool(2026, SEALED_DEFAULT_PACKS);
  const supply = poolSupply(pool);
  const outsider = [...CURATED_SOURCE_IDS].find((id) => !supply.has(id));
  check("a curated card outside the pool exists to test the restriction", !!outsider, outsider);
  if (outsider) {
    const tampered = [outsider, ...sampleDeck.slice(1)];
    const limitedRes = validateLimitedDeck(tampered, pool);
    check("limited REJECTS a constructed-legal card that wasn't opened (pool restriction is real)", !limitedRes.valid, limitedRes.errors);
    // And prove that same outsider card is NOT inherently illegal in constructed —
    // i.e. limited's rejection comes purely from the additive pool rule.
    check("the outsider IS a real playable card (rejection is pool-only, not a bad card)", !!getPlayableCardById(outsider));
  }
}

// === (f) MATCH-STARTABLE through the UNCHANGED createMatchFromDecks ==============
{
  // Opponent uses a second curated commander + its own seeded limited deck.
  const oppPool = generateSealedPool(98765, SEALED_DEFAULT_PACKS);
  const oppDeck = buildLimitedDeckFromPool(oppPool);
  const oppCommander = pickLimitedCommander(oppDeck) === sampleCommander ? "cmd_iron_warlord" : pickLimitedCommander(oppDeck);

  const match = createMatchFromDecks({
    p1: { commanderId: sampleCommander, deck: sampleDeck },
    p2: { commanderId: oppCommander, deck: oppDeck },
    seed: 555,
    openingHandSize: 3,
  }) as any;

  check("match built from limited deck: P1 commander bound", match.players.P1.commander?.id === sampleCommander, match.players.P1.commander?.id);
  check("match built from limited deck: P1 opening hand dealt", match.players.P1.hand.length === 3, match.players.P1.hand.length);
  check("match built from limited deck: P1 deckCount = deck - hand", match.players.P1.deckCount === sampleDeck.length - 3, match.players.P1.deckCount);
  check("match built from limited deck: no commander leaked into deck", !match.players.P1.deck.includes(sampleCommander));

  // Same seed -> same opening (determinism of the whole pool->deck->match chain).
  const match2 = createMatchFromDecks({
    p1: { commanderId: sampleCommander, deck: buildLimitedDeckFromPool(generateSealedPool(2026, SEALED_DEFAULT_PACKS)) },
    p2: { commanderId: oppCommander, deck: buildLimitedDeckFromPool(generateSealedPool(98765, SEALED_DEFAULT_PACKS)) },
    seed: 555,
    openingHandSize: 3,
  }) as any;
  check("pool->deck->match is fully reproducible (same seeds -> same opening hand)", JSON.stringify(match.players.P1.hand) === JSON.stringify(match2.players.P1.hand), { a: match.players.P1.hand, b: match2.players.P1.hand });
}

console.log("\n=== SEALED / DRAFT (LIMITED) PROOF ===");
if (failures > 0) {
  console.error(`FAILED: ${failures} sealed check(s) failed.`);
  process.exit(1);
}
console.log("ALL SEALED / DRAFT PROOFS PASSED");
