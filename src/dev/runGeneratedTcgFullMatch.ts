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
  return hand.findIndex((id) => id.startsWith("tcg_unit_") || id.startsWith("unit_") || id.startsWith("nft_unit_"));
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
          health: (match as any).players.P1.health,
          energy: (match as any).players.P1.energy,
          hand: (match as any).players.P1.hand,
          front: (match as any).players.P1.board.front.map((u: any) => ({
            instanceId: u.instanceId,
            cardId: u.cardId,
            attack: u.attack,
            health: u.health,
            armor: u.armor,
            exhausted: u.exhausted,
            summoningSick: u.summoningSick,
            keywords: u.keywords || []
          })),
          artifacts: (match as any).players.P1.artifacts || [],
          deckCount: ((match as any).players.P1.deck || []).length
        },
        p2: {
          health: (match as any).players.P2.health,
          energy: (match as any).players.P2.energy,
          hand: (match as any).players.P2.hand,
          front: (match as any).players.P2.board.front.map((u: any) => ({
            instanceId: u.instanceId,
            cardId: u.cardId,
            attack: u.attack,
            health: u.health,
            armor: u.armor,
            exhausted: u.exhausted,
            summoningSick: u.summoningSick,
            keywords: u.keywords || []
          })),
          artifacts: (match as any).players.P2.artifacts || [],
          deckCount: ((match as any).players.P2.deck || []).length
        }
      },
      null,
      2
    )
  );
}

const p1Deck = buildGeneratedTcgDeck("cmd_stone_warden");
const p2Deck = buildGeneratedTcgDeck("cmd_bronze_raider");

const p1Draw = drawCards(p1Deck, 5);
const p2Draw = drawCards(p2Deck, 5);

let match = createMatch();

(match as any).players.P1.commanderId = "cmd_stone_warden";
(match as any).players.P2.commanderId = "cmd_bronze_raider";

(match as any).players.P1.deck = p1Draw.deck;
(match as any).players.P2.deck = p2Draw.deck;

(match as any).players.P1.hand = p1Draw.hand;
(match as any).players.P2.hand = p2Draw.hand;

printMatch("GENERATED TCG MATCH START", match);

const p1UnitIndex = findFirstPlayableUnitIndex((match as any).players.P1.hand);
if (p1UnitIndex >= 0) {
  match = playUnitFromHand(match, "P1", p1UnitIndex, "front");
  printMatch("AFTER P1 PLAYS UNIT", match);
}

const p1ArtifactIndex = findFirstPlayableArtifactIndex((match as any).players.P1.hand);
if (p1ArtifactIndex >= 0) {
  match = playArtifactFromHand(match, "P1", p1ArtifactIndex);
  printMatch("AFTER P1 PLAYS ARTIFACT", match);
}

(match as any).activePlayer = "P2";

const p2UnitIndex = findFirstPlayableUnitIndex((match as any).players.P2.hand);
if (p2UnitIndex >= 0) {
  match = playUnitFromHand(match, "P2", p2UnitIndex, "front");
  printMatch("AFTER P2 PLAYS UNIT", match);
}

console.log("\n=== STATUS ===");
console.log("Generated TCG decks are now feeding a live match.");
