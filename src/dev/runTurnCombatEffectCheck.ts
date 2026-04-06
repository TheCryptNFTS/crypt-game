import { createMatch, playUnitFromHand } from "../engine/setup";
import { startTurn, endTurn } from "../engine/turnEngine";
import { attackUnit, attackPlayer } from "../engine/combatEngine";
import { playArtifactCard } from "../engine/effectSystem";
import { MatchState } from "../engine/state";

function printMatch(label: string, match: MatchState) {
  console.log(`\n=== ${label} ===`);
  console.log(
    JSON.stringify(
      {
        turn: (match as any).turn,
        activePlayer: (match as any).activePlayer,
        phase: (match as any).phase,
        winner: (match as any).winner,
        p1: {
          health: (match as any).players.P1.health,
          energy: (match as any).players.P1.energy,
          maxEnergy: (match as any).players.P1.maxEnergy,
          hand: (match as any).players.P1.hand,
          front: (match as any).players.P1.board.front,
          artifacts: (match as any).players.P1.artifacts || [],
          deckCount: (match as any).players.P1.deck.length,
          discard: (match as any).players.P1.discard
        },
        p2: {
          health: (match as any).players.P2.health,
          energy: (match as any).players.P2.energy,
          maxEnergy: (match as any).players.P2.maxEnergy,
          hand: (match as any).players.P2.hand,
          front: (match as any).players.P2.board.front,
          artifacts: (match as any).players.P2.artifacts || [],
          deckCount: (match as any).players.P2.deck.length,
          discard: (match as any).players.P2.discard
        }
      },
      null,
      2
    )
  );
}

let match = createMatch() as MatchState;

(match as any).players.P1.energy = 10;
(match as any).players.P1.maxEnergy = 10;
(match as any).players.P2.energy = 10;
(match as any).players.P2.maxEnergy = 10;

(match as any).players.P1.hand = ["unit_stone_guard", "tcg_art_3399"];
(match as any).players.P2.hand = ["unit_bronze_scout"];

printMatch("INITIAL", match);

match = playUnitFromHand(match, "P1", 0, "front");
printMatch("P1 PLAYS UNIT", match);

match = playArtifactCard(match, "P1", 0);
printMatch("P1 PLAYS ARTIFACT", match);

match = {
  ...(match as any),
  activePlayer: "P2"
} as MatchState;

match = playUnitFromHand(match, "P2", 0, "front");
printMatch("P2 PLAYS UNIT", match);

match = {
  ...(match as any),
  activePlayer: "P1"
} as MatchState;

match = endTurn(match);
printMatch("AFTER P1 ENDS TURN -> P2 START", match);

match = endTurn(match);
printMatch("AFTER P2 ENDS TURN -> P1 START", match);

const p1Attacker = (match as any).players.P1.board.front[0]?.instanceId;
const p2Defender = (match as any).players.P2.board.front[0]?.instanceId;

if (p1Attacker && p2Defender) {
  match = attackUnit(match, "P1", p1Attacker, p2Defender);
  printMatch("P1 ATTACKS P2 UNIT", match);
}

const p1StillAlive = (match as any).players.P1.board.front[0]?.instanceId;
if (p1StillAlive) {
  try {
    match = attackPlayer(match, "P1", p1StillAlive);
    printMatch("P1 ATTACKS FACE", match);
  } catch (error) {
    console.log("\n=== FACE ATTACK BLOCKED / NOT READY ===");
    console.log(String(error));
  }
}

console.log("\n=== STATUS ===");
console.log("Turn engine, combat engine, and effect system are working if turn flow, attack flow, and cleanup all updated.");
