import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { buildCuratedDeck } from "../lib/buildCuratedDeck";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const commanderIds = Object.keys(COMMANDER_SPECS);
  assert(commanderIds.length >= 2, "Need at least 2 commanders for bootstrap check");

  const p1Commander = commanderIds[0];
  const p2Commander = commanderIds[1];

  const p1Deck = buildCuratedDeck(p1Commander);
  const p2Deck = buildCuratedDeck(p2Commander);

  const match = createMatchFromDecks({
    p1: { commanderId: p1Commander, deck: p1Deck },
    p2: { commanderId: p2Commander, deck: p2Deck },
    shuffle: false,
    openingHandSize: 3,
  }) as any;

  assert(match.players.P1.commander?.id === p1Commander, "P1 commander missing from runtime state");
  assert(match.players.P2.commander?.id === p2Commander, "P2 commander missing from runtime state");

  assert(match.players.P1.commanderZone?.cardId === p1Commander, "P1 commanderZone missing");
  assert(match.players.P2.commanderZone?.cardId === p2Commander, "P2 commanderZone missing");

  assert(!match.players.P1.hand.includes(p1Commander), "P1 commander leaked into hand");
  assert(!match.players.P2.hand.includes(p2Commander), "P2 commander leaked into hand");

  assert(!match.players.P1.deck.includes(p1Commander), "P1 commander leaked into deck");
  assert(!match.players.P2.deck.includes(p2Commander), "P2 commander leaked into deck");

  assert(match.players.P1.hand.length === 3, "P1 opening hand size incorrect");
  assert(match.players.P2.hand.length === 3, "P2 opening hand size incorrect");

  assert(
    match.players.P1.deckCount === p1Deck.length - 3,
    `P1 deckCount incorrect: expected ${p1Deck.length - 3}, got ${match.players.P1.deckCount}`
  );
  assert(
    match.players.P2.deckCount === p2Deck.length - 3,
    `P2 deckCount incorrect: expected ${p2Deck.length - 3}, got ${match.players.P2.deckCount}`
  );

  console.log("\n=== LEGALITY + BOOTSTRAP CHECK ===");
  console.log("PASS");
}

run();
