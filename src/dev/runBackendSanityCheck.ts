import { allCards, allPlayableCards, allCommanderCards, getCommanderCardById, getPlayableCardById } from "../engine/cards";
import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { normalizeFaction } from "../types/faction";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function testPlayablePoolExcludesCommanders() {
  const commanderIds = new Set(allCommanderCards.map((c) => c.id));
  const leaked = allPlayableCards.filter((c) => commanderIds.has(c.id));
  assert(leaked.length === 0, `Commander cards leaked into playable pool: ${leaked.map((c) => c.id).join(", ")}`);
}

function testAllCardsAliasIsPlayableOnly() {
  assert(allCards.length === allPlayableCards.length, "allCards should alias playable cards only");
}

function testCommanderRegistryResolvesSpecs() {
  const specIds = Object.keys(COMMANDER_SPECS);
  assert(specIds.length > 0, "No commander specs found");

  for (const commanderId of specIds) {
    const spec = COMMANDER_SPECS[commanderId];
    assert(spec, `Missing commander spec for ${commanderId}`);
    normalizeFaction(String(spec.faction));
  }
}

function testCommanderCardsResolve() {
  for (const card of allCommanderCards) {
    const found = getCommanderCardById(card.id);
    assert(found?.id === card.id, `Commander lookup failed for ${card.id}`);
  }
}

function testPlayableCardsResolve() {
  for (const card of allPlayableCards.slice(0, 50)) {
    const found = getPlayableCardById(card.id);
    assert(found?.id === card.id, `Playable card lookup failed for ${card.id}`);
  }
}

function testPlayableTypesPresent() {
  const types = new Set(allPlayableCards.map((c) => c.type));
  assert(types.has("unit"), "Playable pool missing units");
  assert(types.has("equipment"), "Playable pool missing equipment");
  assert(types.has("artifact"), "Playable pool missing artifacts");
}

function run() {
  testPlayablePoolExcludesCommanders();
  testAllCardsAliasIsPlayableOnly();
  testCommanderRegistryResolvesSpecs();
  testCommanderCardsResolve();
  testPlayableCardsResolve();
  testPlayableTypesPresent();

  console.log("\n=== BACKEND SANITY CHECK ===");
  console.log("PASS");
}

run();
