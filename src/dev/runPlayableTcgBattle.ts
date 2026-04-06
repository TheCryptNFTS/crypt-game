import { getAllLoadedUnits } from "../data/loadAllUnits";
import { playUnitFromHand } from "../engine/setup";

const tcgUnits = getAllLoadedUnits().filter((card) => card.id.startsWith("tcg_unit_"));

if (tcgUnits.length < 2) {
  throw new Error("Not enough playable TCG units found.");
}

let match = {
  turn: 1,
  activePlayer: "P1",
  phase: "main",
  winner: null,
  players: {
    P1: {
      id: "P1",
      health: 30,
      energy: 10,
      maxEnergy: 10,
      commanderId: "cmd_stone_warden",
      deck: [],
      hand: [tcgUnits[0].id, tcgUnits[1].id],
      discard: [],
      board: {
        front: [],
        back: []
      },
      turnFlags: {
        firstUnitCostReduction: 0,
        firstUnitPlayed: false
      }
    },
    P2: {
      id: "P2",
      health: 30,
      energy: 10,
      maxEnergy: 10,
      commanderId: "cmd_bronze_raider",
      deck: [],
      hand: [tcgUnits[2]?.id || tcgUnits[0].id, tcgUnits[3]?.id || tcgUnits[1].id],
      discard: [],
      board: {
        front: [],
        back: []
      },
      turnFlags: {
        firstUnitCostReduction: 0,
        firstUnitPlayed: false
      }
    }
  }
};

function printMatch(label: string, currentMatch: any) {
  console.log(`\n=== ${label} ===`);
  console.log(
    JSON.stringify(
      {
        turn: currentMatch.turn,
        activePlayer: currentMatch.activePlayer,
        phase: currentMatch.phase,
        winner: currentMatch.winner,
        p1: {
          health: currentMatch.players.P1.health,
          energy: currentMatch.players.P1.energy,
          hand: currentMatch.players.P1.hand,
          front: currentMatch.players.P1.board.front.map((u: any) => ({
            instanceId: u.instanceId,
            cardId: u.cardId,
            attack: u.attack,
            health: u.health,
            armor: u.armor,
            exhausted: u.exhausted,
            summoningSick: u.summoningSick
          })),
          discard: currentMatch.players.P1.discard
        },
        p2: {
          health: currentMatch.players.P2.health,
          energy: currentMatch.players.P2.energy,
          hand: currentMatch.players.P2.hand,
          front: currentMatch.players.P2.board.front.map((u: any) => ({
            instanceId: u.instanceId,
            cardId: u.cardId,
            attack: u.attack,
            health: u.health,
            armor: u.armor,
            exhausted: u.exhausted,
            summoningSick: u.summoningSick
          })),
          discard: currentMatch.players.P2.discard
        }
      },
      null,
      2
    )
  );
}

printMatch("PLAYABLE TCG MATCH START", match);

match = playUnitFromHand(match as any, "P1", 0, "front");
printMatch("AFTER P1 PLAYS TCG UNIT", match);

match = {
  ...match,
  activePlayer: "P2"
};

match = playUnitFromHand(match as any, "P2", 0, "front");
printMatch("AFTER P2 PLAYS TCG UNIT", match);

console.log("\n=== STATUS ===");
console.log("Playable TCG units are now loading into live battle state.");
