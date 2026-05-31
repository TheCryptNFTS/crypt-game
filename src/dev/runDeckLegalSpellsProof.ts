/**
 * dev:deck-legal-spells (#10) — spells are now DECK-LEGAL.
 *
 * `liveSpells` are engine-legal (merged into allPlayableCards, resolved by
 * PLAY_SPELL) but were historically kept out of the deck builder. buildCuratedDeck
 * now drafts a small, capped set of SAFE-tier spells into the flex slots above a
 * commander's unit/equipment/artifact minimums. This proof pins the contract:
 *
 *   - every curated commander's default deck contains >=1 spell,
 *   - ONLY "safe" spells are ever drafted (no removal/face-burn auto-included),
 *   - deck size is preserved and the unit/equip/artifact floor is never starved,
 *   - drafted decks still bootstrap into a real match,
 *   - the builder is deterministic (same deck on repeated calls).
 */

import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { buildCuratedDeck } from "../lib/buildCuratedDeck";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { allPlayableCards } from "../engine/cards";
import { liveSpells } from "../engine/spellCards";

const MAX_SPELLS_PER_DECK = 6;

const SAFE_SPELL_IDS = new Set(
  liveSpells.filter((s) => (s as { tier?: string }).tier === "safe").map((s) => s.id)
);
const RESTRICTED_SPELL_IDS = new Set(
  liveSpells.filter((s) => (s as { tier?: string }).tier !== "safe").map((s) => s.id)
);
const cardById = new Map(allPlayableCards.map((c) => [c.id, c] as const));

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`OK: ${msg}`);
  } else {
    console.error(`FAIL: ${msg}`);
    failed += 1;
  }
}

const commanderIds = Object.keys(COMMANDER_SPECS);

for (const cmd of commanderIds) {
  const spec = COMMANDER_SPECS[cmd as keyof typeof COMMANDER_SPECS];
  const rules = spec.deckRules;
  const deckSize = rules.deckSize;
  const minNonSpell =
    (rules.minUnits ?? 0) + (rules.minEquipment ?? 0) + (rules.minArtifacts ?? 0);

  const deck = buildCuratedDeck(cmd);
  const spells = deck.filter((id) => id.startsWith("spell_"));
  const nonSpell = deck.length - spells.length;

  assert(deck.length === deckSize, `${cmd}: deck size is ${deckSize}`);
  assert(spells.length >= 1, `${cmd}: deck contains at least one spell (got ${spells.length})`);
  assert(
    spells.length <= MAX_SPELLS_PER_DECK,
    `${cmd}: spell count ${spells.length} within cap ${MAX_SPELLS_PER_DECK}`
  );
  assert(
    nonSpell >= minNonSpell,
    `${cmd}: non-spell core ${nonSpell} >= min floor ${minNonSpell}`
  );

  for (const id of spells) {
    assert(SAFE_SPELL_IDS.has(id), `${cmd}: drafted spell ${id} is safe-tier`);
    assert(!RESTRICTED_SPELL_IDS.has(id), `${cmd}: never drafts restricted spell ${id}`);
    const card = cardById.get(id);
    assert(!!card && card.type === "spell", `${cmd}: ${id} resolves to a real spell card`);
  }

  // Determinism: the builder is pure — repeated calls yield identical decks.
  const again = buildCuratedDeck(cmd);
  assert(
    JSON.stringify(deck) === JSON.stringify(again),
    `${cmd}: buildCuratedDeck is deterministic`
  );
}

// A spell-bearing deck must still bootstrap into a live match.
{
  const p1 = commanderIds[0];
  const p2 = commanderIds[1];
  const match = createMatchFromDecks({
    p1: { commanderId: p1, deck: buildCuratedDeck(p1) },
    p2: { commanderId: p2, deck: buildCuratedDeck(p2) },
    shuffle: false,
    openingHandSize: 3,
  }) as any;
  assert(match.players.P1.hand.length === 3, "spell-bearing deck bootstraps (P1 opening hand)");
  assert(match.players.P2.hand.length === 3, "spell-bearing deck bootstraps (P2 opening hand)");
}

if (failed > 0) {
  console.error(`\nDECK-LEGAL SPELLS PROOF FAILED: ${failed} assertion(s).`);
  process.exit(1);
}
console.log("\nALL DECK-LEGAL SPELLS PROOFS PASSED");
