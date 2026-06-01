/**
 * dev:format — pins the CORE FORMAT (PART 2): a curated rotating legality filter layered on
 * top of the existing deck validation, with "Open" (the full 4129-card pool) as the unchanged
 * DEFAULT. Properties proven:
 *
 *   (a) CORE SET SANITY: the curated Core set is non-empty, sits inside the 150–300 design
 *       band, is balanced across factions/rarities, and every member is a real catalog card.
 *   (b) ALL-CORE DECK: a 30-card deck built entirely from Core cards PASSES Core (and Open).
 *   (c) NON-CORE REJECTION: swapping in one card that is NOT in Core makes the SAME deck FAIL
 *       Core (with a clear per-card error) while still PASSING Open.
 *   (d) OPEN == TODAY: validating with format "Open" is byte-identical to validating with no
 *       format at all (the historical behavior), so existing callers are unaffected.
 *   (e) DETERMINISM: the Core set is identical across two independent module evaluations
 *       (pure rule over the catalog; no RNG, no Date).
 */

import { validateDeck } from "../engine/deckRules";
import { CORE_SET, CORE_CARD_IDS, coreCountsByFaction, coreCountsByRarity, isCardLegalInFormat } from "../engine/formats";
import { allPlayableCards, getPlayableCardById } from "../engine/cards";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`OK: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

const DECK_SIZE = 30;
const COMMANDER = "cmd_stone_warden"; // any id; validateDeck does not bind cards to it.

/** Build a legal-size deck from a list of ids, repeating to fill but never exceeding maxCopies
 *  (=2). Throws if the source pool is too small to fill the deck under the copy cap. */
function buildDeck(sourceIds: readonly string[], size: number): string[] {
  const deck: string[] = [];
  const counts = new Map<string, number>();
  let i = 0;
  while (deck.length < size) {
    if (i >= sourceIds.length) i = 0; // wrap to add a second copy of earlier cards
    const id = sourceIds[i];
    i += 1;
    const c = counts.get(id) ?? 0;
    if (c >= 2) continue;
    counts.set(id, c + 1);
    deck.push(id);
    if (i >= sourceIds.length * 2) break; // safety
  }
  if (deck.length < size) throw new Error("source pool too small to build a legal deck");
  return deck;
}

// === (a) CORE SET SANITY ========================================================
{
  check("core: set is non-empty", CORE_SET.size > 0, CORE_SET.size);
  check("core: size within the 150–300 design band", CORE_SET.size >= 150 && CORE_SET.size <= 300, CORE_SET.size);
  check("core: every Core id resolves to a real catalog card", CORE_CARD_IDS.every((id) => getPlayableCardById(id) != null));
  check("core: no soft-banned (disabled) card is in Core", CORE_CARD_IDS.every((id) => getPlayableCardById(id)?.disabled !== true));
  check("core: no spell is in Core (deck-eligible types only)", CORE_CARD_IDS.every((id) => getPlayableCardById(id)?.type !== "spell"));

  const byF = coreCountsByFaction();
  const byR = coreCountsByRarity();
  console.log("  Core by faction:", JSON.stringify(byF));
  console.log("  Core by rarity :", JSON.stringify(byR));
  // Balance: at least 5 of the 6 factions represented, and every rarity present.
  check("core: balanced across factions (>=5 factions represented)", Object.keys(byF).length >= 5, byF);
  check("core: every rarity represented", ["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"].every((r) => (byR[r] ?? 0) > 0), byR);
  // Favors interesting (keyworded) cards over vanilla stat sticks.
  const vanilla = CORE_CARD_IDS.filter((id) => (getPlayableCardById(id)?.keywords?.length ?? 0) === 0).length;
  check("core: favors non-vanilla cards (interesting > vanilla)", CORE_SET.size - vanilla > vanilla, { interesting: CORE_SET.size - vanilla, vanilla });
}

// === (b) ALL-CORE DECK passes Core AND Open ====================================
const coreDeck = buildDeck(CORE_CARD_IDS, DECK_SIZE);
{
  const inCore = validateDeck(coreDeck, COMMANDER, { deckSize: DECK_SIZE, maxCopies: 2, format: "Core" });
  check("all-core deck: PASSES Core", inCore.valid, inCore.errors);
  const inOpen = validateDeck(coreDeck, COMMANDER, { deckSize: DECK_SIZE, maxCopies: 2, format: "Open" });
  check("all-core deck: PASSES Open", inOpen.valid, inOpen.errors);
}

// === (c) NON-CORE card: fails Core, passes Open ================================
{
  // Find a real catalog card that is NOT in Core (deck-eligible type, not disabled).
  const nonCore = allPlayableCards.find(
    (c) => (c.type === "unit" || c.type === "equipment" || c.type === "artifact") && c.disabled !== true && !CORE_SET.has(c.id)
  );
  check("non-core: a non-Core catalog card exists to test with", nonCore != null, nonCore?.id);
  if (nonCore) {
    check("non-core: isCardLegalInFormat agrees it's illegal in Core", isCardLegalInFormat(nonCore.id, "Core") === false);
    check("non-core: isCardLegalInFormat agrees it's legal in Open", isCardLegalInFormat(nonCore.id, "Open") === true);

    // Swap one slot of the all-Core deck for the non-Core card (keep size = 30).
    const mixed = [...coreDeck];
    mixed[0] = nonCore.id;

    const inCore = validateDeck(mixed, COMMANDER, { deckSize: DECK_SIZE, maxCopies: 2, format: "Core" });
    check("mixed deck: FAILS Core", !inCore.valid, inCore.errors);
    check("mixed deck: Core error names the offending card + format", inCore.errors.some((e) => e.includes(nonCore.id) && e.includes("Core")), inCore.errors);

    const inOpen = validateDeck(mixed, COMMANDER, { deckSize: DECK_SIZE, maxCopies: 2, format: "Open" });
    check("mixed deck: PASSES Open (non-Core card is fine in Open)", inOpen.valid, inOpen.errors);
  }
}

// === (d) OPEN == TODAY: explicit Open identical to no-format ====================
{
  // Use a deck drawn from the FULL pool (today's behavior) so this exercises the real
  // historical path, not a Core-restricted one.
  const fullPoolIds = allPlayableCards
    .filter((c) => c.type === "unit" || c.type === "equipment" || c.type === "artifact")
    .map((c) => c.id);
  const openDeck = buildDeck(fullPoolIds, DECK_SIZE);

  const noFormat = validateDeck(openDeck, COMMANDER, { deckSize: DECK_SIZE, maxCopies: 2 });
  const explicitOpen = validateDeck(openDeck, COMMANDER, { deckSize: DECK_SIZE, maxCopies: 2, format: "Open" });
  check("open==today: no-format result equals explicit Open result", JSON.stringify(noFormat) === JSON.stringify(explicitOpen), { noFormat, explicitOpen });
  check("open==today: today's full-pool deck is valid (unchanged behavior)", noFormat.valid, noFormat.errors);

  // And a malformed deck (wrong size) reports the SAME errors under both, proving the format
  // layer is purely additive in Open.
  const shortDeck = openDeck.slice(0, 10);
  const a = validateDeck(shortDeck, COMMANDER, { deckSize: DECK_SIZE, maxCopies: 2 });
  const b = validateDeck(shortDeck, COMMANDER, { deckSize: DECK_SIZE, maxCopies: 2, format: "Open" });
  check("open==today: malformed-deck errors identical with/without explicit Open", JSON.stringify(a) === JSON.stringify(b));
}

// === (e) DETERMINISM: the Core set is a stable pure rule ========================
{
  // Re-derive the same selection rule inline and confirm it matches CORE_SET exactly.
  // (Same inputs + same sorted-by-id scan => identical set.)
  const FACTIONS = ["STONE_KEEPERS", "IRON_DEFENDERS", "BRONZE_GUARDIANS", "SILVER_SENTINELS", "GOLDEN_SOVEREIGNS", "GODS"];
  const RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"];
  const IQ: Record<string, number> = { COMMON: 10, RARE: 10, EPIC: 8, LEGENDARY: 6, MYTHIC: 4 };
  const VQ: Record<string, number> = { COMMON: 3, RARE: 2, EPIC: 1, LEGENDARY: 1, MYTHIC: 0 };
  const pool = allPlayableCards.filter((c) => (c.type === "unit" || c.type === "equipment" || c.type === "artifact") && c.disabled !== true);
  const expect = new Set<string>();
  for (const f of FACTIONS) for (const r of RARITIES) {
    const bucket = pool.filter((c) => c.faction === f && c.rarity === r).sort((a, b) => a.id.localeCompare(b.id));
    for (const c of bucket.filter((c) => (c.keywords?.length ?? 0) > 0).slice(0, IQ[r])) expect.add(c.id);
    for (const c of bucket.filter((c) => (c.keywords?.length ?? 0) === 0).slice(0, VQ[r])) expect.add(c.id);
  }
  const same = expect.size === CORE_SET.size && [...expect].every((id) => CORE_SET.has(id));
  check("determinism: Core set matches an independent re-derivation of the rule", same, { rule: expect.size, core: CORE_SET.size });
}

console.log(`\n=== CORE FORMAT PROOF (curated rotating legality; Open = default, unchanged) ===`);
console.log(`Core size: ${CORE_SET.size}`);
if (failures > 0) {
  console.error(`FAILED: ${failures} format check(s) failed.`);
  process.exit(1);
}
console.log("ALL FORMAT PROOFS PASSED");
