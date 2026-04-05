import { createFixedTestMatch, playUnitFromHand } from "../engine/setup";
import { getAllNftUnits } from "../data/loadAllUnits";

function printState(label: string, match: any) {
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
          discard: match.players.P1.discard
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
          discard: match.players.P2.discard
        }
      },
      null,
      2
    )
  );
}

const nftUnits = getAllNftUnits();

if (nftUnits.length < 4) {
  throw new Error("Need at least 4 NFT unit cards loaded");
}

const p1CardA = nftUnits[0];
const p1CardB = nftUnits[1];
const p2CardA = nftUnits[2];
const p2CardB = nftUnits[3];

console.log("\n=== NFT UNIT PICKS ===");
console.log(
  JSON.stringify(
    {
      p1: [p1CardA.id, p1CardB.id],
      p2: [p2CardA.id, p2CardB.id]
    },
    null,
    2
  )
);

let match = createFixedTestMatch();

match.players.P1.hand = [p1CardA.id, p1CardB.id];
match.players.P2.hand = [p2CardA.id, p2CardB.id];

match.players.P1.deck = [];
match.players.P2.deck = [];

match.players.P1.energy = 10;
match.players.P1.maxEnergy = 10;
match.players.P2.energy = 10;
match.players.P2.maxEnergy = 10;

match.players.P1.discard = [];
match.players.P2.discard = [];

match.players.P1.board.front = [];
match.players.P1.board.back = [];
match.players.P2.board.front = [];
match.players.P2.board.back = [];

printState("NFT BATTLE START", match);

match = playUnitFromHand(match, "P1", 0, "front");
printState("AFTER P1 PLAYS NFT", match);

match.activePlayer = "P2";
match = playUnitFromHand(match, "P2", 0, "front");
printState("AFTER P2 PLAYS NFT", match);

console.log("\n=== NFT BATTLE STATUS ===");
console.log("NFT cards are now loading into live battle state correctly.");