import { createMatch, playUnitFromHand } from "../engine/setup";
import { playEquipmentFromHand } from "../engine/playEquipmentFromHand";
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
            summoningSick: u.summoningSick,
            keywords: u.keywords || [],
            attachedEquipment: u.attachedEquipment || []
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
            summoningSick: u.summoningSick,
            keywords: u.keywords || [],
            attachedEquipment: u.attachedEquipment || []
          })),
          discard: match.players.P2.discard
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

match.players.P1.hand = ["unit_stone_guard", "eq_axe"];
match.players.P2.hand = ["unit_bronze_scout"];

printMatch("START", match);

match = playUnitFromHand(match, "P1", 0, "front");
printMatch("AFTER P1 PLAYS UNIT", match);

const targetId = match.players.P1.board.front[0].instanceId;
match = playEquipmentFromHand(match, "P1", 0, targetId);
printMatch("AFTER P1 PLAYS EQUIPMENT", match);

console.log("\n=== STATUS ===");
console.log("Equipment play logic is working if stats and keywords changed.");
