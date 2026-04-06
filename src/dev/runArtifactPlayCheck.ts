import { createMatch, playUnitFromHand } from "../engine/setup";
import { playArtifactFromHand } from "../engine/playArtifactFromHand";
import { getAllLoadedArtifacts } from "../data/loadAllArtifacts";
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

const sampleArtifact =
  getAllLoadedArtifacts().find((a: any) => String(a.id).startsWith("tcg_art_")) || null;

if (!sampleArtifact) {
  throw new Error("No playable TCG artifact found.");
}

let match = createMatch();

(match as any).players.P1.hand = ["unit_stone_guard", sampleArtifact.id];
(match as any).players.P2.hand = ["unit_bronze_scout"];

printMatch("ARTIFACT TEST START", match);

match = playUnitFromHand(match, "P1", 0, "front");
printMatch("AFTER P1 PLAYS UNIT", match);

match = playArtifactFromHand(match, "P1", 0);
printMatch("AFTER P1 PLAYS ARTIFACT", match);

console.log("\n=== STATUS ===");
console.log("Artifact play logic is working if artifact left hand and entered artifact zone.");
