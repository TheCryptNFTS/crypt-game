import { getAllLoadedUnits } from "../data/loadAllUnits";
import { playUnitFromHand } from "../engine/setup";
import type { MatchState } from "../engine/state";

const nftUnits = getAllLoadedUnits().filter((card) => card.id.startsWith("nft_unit_"));

if (nftUnits.length < 4) {
  throw new Error("Not enough NFT units found.");
}

let match: MatchState = {
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
      hand: [nftUnits[0].id, nftUnits[1].id],
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
      hand: [nftUnits[2].id, nftUnits[3].id],
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

function printMatch(label: string, currentMatch: MatchState) {
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
          front: currentMatch.players.P1.board.front.map((u) => ({
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
          front: currentMatch.players.P2.board.front.map((u) => ({
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

printMatch("NFT MATCH START", match);

match = playUnitFromHand(match, "P1", 0, "front");
printMatch("AFTER P1 PLAYS NFT", match);

match = {
  ...match,
  activePlayer: "P2"
};

match = playUnitFromHand(match, "P2", 0, "front");
printMatch("AFTER P2 PLAYS NFT", match);

console.log("\n=== STATUS ===");
console.log("NFT units are loading correctly from getAllLoadedUnits().");
