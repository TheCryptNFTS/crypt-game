import { createMatch, playUnitFromHand } from "../engine/setup";
import { playArtifactFromHand } from "../engine/playArtifactFromHand";
import { buildCuratedLegalDeckV3 } from "../lib/buildCuratedLegalDeckV3";
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

function findUnitIndex(hand: string[]) {
  return hand.findIndex((id) => id.startsWith("tcg_unit_") || id.startsWith("unit_") || id.startsWith("nft_unit_"));
}

function findArtifactIndex(hand: string[]) {
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
          front: (match as any).players.P1.board.front,
          artifacts: (match as any).players.P1.artifacts || [],
          deckCount: (match as any).players.P1.deck.length
        },
        p2: {
          health: (match as any).players.P2.health,
          energy: (match as any).players.P2.energy,
          hand: (match as any).players.P2.hand,
          front: (match as any).players.P2.board.front,
          artifacts: (match as any).players.P2.artifacts || [],
          deckCount: (match as any).players.P2.deck.length
        }
      },
      null,
      2
    )
  );
}

let match = createMatch();

const p1Deck = buildCuratedLegalDeckV3("cmd_stone_warden");
const p2Deck = buildCuratedLegalDeckV3("cmd_bronze_raider");

const p1Draw = drawCards(p1Deck, 5);
const p2Draw = drawCards(p2Deck, 5);

(match as any).players.P1.deck = p1Draw.deck;
(match as any).players.P1.hand = p1Draw.hand;
(match as any).players.P2.deck = p2Draw.deck;
(match as any).players.P2.hand = p2Draw.hand;

(match as any).players.P1.energy = 10;
(match as any).players.P1.maxEnergy = 10;
(match as any).players.P2.energy = 10;
(match as any).players.P2.maxEnergy = 10;

printMatch("CURATED V3 MATCH START", match as any);

const p1Unit = findUnitIndex((match as any).players.P1.hand);
if (p1Unit >= 0) {
  match = playUnitFromHand(match, "P1", p1Unit, "front");
  printMatch("AFTER P1 UNIT", match as any);
}

(match as any).activePlayer = "P2";

const p2Unit = findUnitIndex((match as any).players.P2.hand);
if (p2Unit >= 0) {
  match = playUnitFromHand(match, "P2", p2Unit, "front");
  printMatch("AFTER P2 UNIT", match as any);
}

(match as any).activePlayer = "P1";

const p1Artifact = findArtifactIndex((match as any).players.P1.hand);
if (p1Artifact >= 0) {
  match = playArtifactFromHand(match as any, "P1", p1Artifact);
  printMatch("AFTER P1 ARTIFACT", match as any);
}

console.log("\n=== STATUS ===");
console.log("Curated V3 full match smoke test completed.");
