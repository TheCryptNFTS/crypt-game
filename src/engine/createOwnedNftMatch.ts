import { getLoadedCommanderById } from "../data/loadCommanders";
import { buildNftDeck } from "../nft/buildNftDeck";
import { assertNoDisabledCards } from "./cards";
import { MatchState, PlayerId, PlayerState, STARTING_NEXUS_HEALTH } from "./state";

function drawOpeningHand(deck: string[], count: number): { deck: string[]; hand: string[] } {
  const nextDeck = [...deck];
  const hand: string[] = [];

  for (let i = 0; i < count; i++) {
    const card = nextDeck.shift();
    if (card) {
      hand.push(card);
    }
  }

  return { deck: nextDeck, hand };
}

function createOwnedNftPlayer(
  playerId: PlayerId,
  commanderId: string,
  tokenIds: Array<string | number>
): PlayerState {
  getLoadedCommanderById(commanderId);

  const fullDeck = buildNftDeck(tokenIds, 30);
  // BUG 3 FIX: enforce the soft-ban on this deck-construction path too (only
  // createMatchFromDecks checked before). A disabled card must not enter a match.
  assertNoDisabledCards(fullDeck, `${playerId} owned-nft deck`);
  const { deck, hand } = drawOpeningHand(fullDeck, 3);

  return {
    id: playerId,
    health: 30,
    nexusHealth: STARTING_NEXUS_HEALTH,
    energy: 10,
    maxEnergy: 10,
    commanderId,
    deck,
    hand,
    discard: [],
    graveyard: [],
    deckCount: deck.length,
    artifacts: [],
    board: {
      front: [],
      back: []
    },
    turnFlags: {
      firstUnitCostReduction: 0,
      firstUnitPlayed: false
    }
  };
}

export function createOwnedNftMatch(
  p1TokenIds: Array<string | number>,
  p2TokenIds: Array<string | number>
): MatchState {
  return {
    turn: 1,
    activePlayer: "P1",
    winner: null,
    seed: 0,
    idCounter: 0,
    rngCursor: 0,
    players: {
      P1: createOwnedNftPlayer("P1", "cmd_stone_warden", p1TokenIds),
      P2: createOwnedNftPlayer("P2", "cmd_bronze_raider", p2TokenIds)
    }
  };
}
