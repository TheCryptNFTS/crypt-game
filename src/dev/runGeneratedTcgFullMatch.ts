import { createMatch, playUnitFromHand } from "../engine/setup";
import { playArtifactFromHand } from "../engine/playArtifactFromHand";
import { buildGeneratedTcgDeck } from "../lib/buildGeneratedTcgDeck";
import { MatchState } from "../engine/state";

function drawCards(deck: string[], count: number) {
  const nextDeck = [...deck];
  const hand: string[] = [];

  for (let i = 0; i < count; i++) {
    const card = nextDeck.shift();
    if (card) hand.push(card);
  }

  return { deck: nextDeck, hand };
}

function findFirstPlayableUnitIndex(hand: string[]): number {
  return hand.findIndex(
    (id) =>
      id.startsWith("tcg_unit_") ||
      id.startsWith("unit_") ||
      id.startsWith("nft_unit_")
  );
}

function findFirstPlayableArtifactIndex(hand: string[]): number {
  return hand.findIndex((id) => id.startsWith("tcg_art_"));
}

function printMatch(label: string, match: MatchState) {
  console.log(`\n=== ${label} ===`);
  console.log(
    JSON.stringify(
      {
        turn: match.turn,
        activePlayer: match.activePlayer,
        phase: match.phase,
        winner: match.winner,
        p1: {
          health: match.players.P1.health,
          energy: match.players.P1.energy,
          hand: match.players.P1.hand,
          front: match.players.P1.board.front.map((u: any) => ({
            instanceId: u.instanceId,
            cardId: u.cardId,
            attack: u.attack,
            health: u.health,
            armor: u.armor,
            exhausted: u.exhausted,
            summoningSick: u.summoningSick
          })),
          artifacts: (match as any).players.P1.artifacts || [],
          deckCount: match.players.P1.deck.length
        },
        p2: {
          health: match.players.P2.health,
          energy: match.players.P2.energy,
          hand: match.players.P2.hand,
          front: match.players.P2.board.front.map((u: any) => ({
            instanceId: u.instanceId,
            cardId: u.cardId,
            attack: u.attack,
            health: u.health,
            armor: u.armor,
            exhausted: u.exhausted,
            summoningSick: u.summoningSick
          })),
          artifacts: (match as any).players.P2.artifacts || [],
          deckCount: match.players.P2.deck.length
        }
      },
      null,
      2
    )
  );
}

let match = createMatch();

const p1Deck = buildGeneratedTcgDeck("cmd_stone_warden");
const p2Deck = buildGeneratedTcgDeck("cmd_bronze_raider");

const p1Draw = drawCards(p1Deck, 5);
const p2Draw = drawCards(p2Deck, 5);

match.players.P1.deck = p1Draw.deck;
match.players.P1.hand = p1Draw.hand;

match.players.P2.deck = p2Draw.deck;
match.players.P2.hand = p2Draw.hand;

// force enough energy for test simulation
match.players.P1.energy = 10;
match.players.P1.maxEnergy = 10;
match.players.P2.energy = 10;
match.players.P2.maxEnergy = 10;

printMatch("GENERATED TCG MATCH START", match);

const p1UnitIndex = findFirstPlayableUnitIndex(match.players.P1.hand);
if (p1UnitIndex >= 0) {
  match = playUnitFromHand(match, "P1", p1UnitIndex, "front");
  printMatch("AFTER P1 PLAYS UNIT", match);
}

match = {
  ...match,
  activePlayer: "P2"
};

const p2UnitIndex = findFirstPlayableUnitIndex(match.players.P2.hand);
if (p2UnitIndex >= 0) {
  match = playUnitFromHand(match, "P2", p2UnitIndex, "front");
  printMatch("AFTER P2 PLAYS UNIT", match);
}

match = {
  ...match,
  activePlayer: "P1"
};

const p1ArtifactIndex = findFirstPlayableArtifactIndex(match.players.P1.hand);
if (p1ArtifactIndex >= 0) {
  match = playArtifactFromHand(match as any, "P1", p1ArtifactIndex);
  printMatch("AFTER P1 PLAYS ARTIFACT", match as any);
}

console.log("\n=== STATUS ===");
console.log("Generated TCG full match flow is working if units and artifacts enter live state.");
