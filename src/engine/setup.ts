import decks from "../data/decks.json";
import units from "../data/units.json";
import { MatchState, PlayerId, PlayerState, Lane, UnitInPlay } from "./state";

function shuffle<T>(array: T[]): T[] {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function drawCards(deck: string[], count: number) {
  const newDeck = [...deck];
  const drawn: string[] = [];

  for (let i = 0; i < count; i++) {
    const card = newDeck.shift();
    if (card) drawn.push(card);
  }

  return { newDeck, drawn };
}

function createPlayer(playerId: PlayerId, deckKey: "deck_stone_test" | "deck_bronze_test"): PlayerState {
  const deckDef = decks[deckKey];
  const shuffledDeck = shuffle(deckDef.cardIds);
  const { newDeck, drawn } = drawCards(shuffledDeck, 3);

  return {
    id: playerId,
    health: 30,
    energy: 1,
    maxEnergy: 1,
    commanderId: deckDef.commanderId,
    deck: newDeck,
    hand: drawn,
    discard: [],
    board: {
      front: [],
      back: []
    }
  };
}

export function createMatch(): MatchState {
  return {
    turn: 1,
    activePlayer: "P1",
    winner: null,
    players: {
      P1: createPlayer("P1", "deck_stone_test"),
      P2: createPlayer("P2", "deck_bronze_test")
    }
  };
}

function makeInstanceId() {
  return `unit_${Math.random().toString(36).slice(2, 10)}`;
}

export function playUnitFromHand(
  match: MatchState,
  playerId: PlayerId,
  handIndex: number,
  lane: Lane
): MatchState {
  const player = match.players[playerId];
  const cardId = player.hand[handIndex];

  if (!cardId) {
    throw new Error("No card in that hand slot");
  }

  const unitCard = units.find((u) => u.id === cardId);

  if (!unitCard) {
    throw new Error("Selected card is not a unit");
  }

  if (player.energy < unitCard.cost) {
    throw new Error("Not enough energy");
  }

  if (player.board[lane].length >= 3) {
    throw new Error(`Lane ${lane} is full`);
  }

  const instance: UnitInPlay = {
    instanceId: makeInstanceId(),
    cardId: unitCard.id,
    lane,
    attack: unitCard.stats.attack,
    health: unitCard.stats.health,
    speed: unitCard.stats.speed,
    armor: unitCard.stats.armor,
    keywords: unitCard.keywords,
    exhausted: false,
    summoningSick: !unitCard.keywords.includes("RUSH")
  };

  const newHand = [...player.hand];
  newHand.splice(handIndex, 1);

  return {
    ...match,
    players: {
      ...match.players,
      [playerId]: {
        ...player,
        energy: player.energy - unitCard.cost,
        hand: newHand,
        board: {
          ...player.board,
          [lane]: [...player.board[lane], instance]
        }
      }
    }
  };
}

export function endTurn(match: MatchState): MatchState {
  const nextPlayerId: PlayerId = match.activePlayer === "P1" ? "P2" : "P1";
  const nextPlayer = match.players[nextPlayerId];

  const newMaxEnergy = Math.min(nextPlayer.maxEnergy + 1, 7);
  const drawnCard = nextPlayer.deck[0];
  const newDeck = drawnCard ? nextPlayer.deck.slice(1) : nextPlayer.deck;
  const newHand = drawnCard ? [...nextPlayer.hand, drawnCard] : nextPlayer.hand;

  const refreshedFront = nextPlayer.board.front.map((unit) => ({
    ...unit,
    exhausted: false,
    summoningSick: false
  }));

  const refreshedBack = nextPlayer.board.back.map((unit) => ({
    ...unit,
    exhausted: false,
    summoningSick: false
  }));

  return {
    ...match,
    turn: match.turn + 1,
    activePlayer: nextPlayerId,
    players: {
      ...match.players,
      [nextPlayerId]: {
        ...nextPlayer,
        maxEnergy: newMaxEnergy,
        energy: newMaxEnergy,
        deck: newDeck,
        hand: newHand,
        board: {
          front: refreshedFront,
          back: refreshedBack
        }
      }
    }
  };
}