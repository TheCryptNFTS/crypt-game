import { createMatch, playUnitFromHand } from "../engine/setup";
import { playArtifactFromHand } from "../engine/playArtifactFromHand";
import { MatchState } from "../engine/state";

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
          discard: (match as any).players.P1.discard
        },
        p2: {
          health: (match as any).players.P2.health,
          energy: (match as any).players.P2.energy,
          hand: (match as any).players.P2.hand,
          front: (match as any).players.P2.board.front,
          artifacts: (match as any).players.P2.artifacts || [],
          discard: (match as any).players.P2.discard
        }
      },
      null,
      2
    )
  );
}

let match = createMatch();

// force enough energy for the test
match.players.P1.energy = 10;
match.players.P1.maxEnergy = 10;
match.players.P2.energy = 10;
match.players.P2.maxEnergy = 10;

match.players.P1.hand = ["unit_stone_guard", "tcg_art_3399"];
match.players.P2.hand = ["unit_bronze_scout"];

printMatch("ARTIFACT TEST START", match);

match = playUnitFromHand(match, "P1", 0, "front");
printMatch("AFTER P1 PLAYS UNIT", match);

match = playArtifactFromHand(match as any, "P1", 0);
printMatch("AFTER P1 PLAYS ARTIFACT", match as any);

console.log("\n=== STATUS ===");
console.log("Artifact play logic is working if artifact moved from hand into artifact zone.");
