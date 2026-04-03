import { createFixedTestMatch, goToCombatPhase, playUnitFromHand } from "./engine/setup";
import { attackUnit, attackHero } from "./engine/combat";

let match = createFixedTestMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

match = playUnitFromHand(match, "P1", 0, "front");
match = {
  ...match,
  activePlayer: "P2"
};
match = playUnitFromHand(match, "P2", 0, "front");

console.log("\n=== AFTER BOTH UNITS ARE PLAYED ===");
console.log(JSON.stringify(match, null, 2));

match = {
  ...match,
  activePlayer: "P1",
  players: {
    ...match.players,
    P1: {
      ...match.players.P1,
      board: {
        ...match.players.P1.board,
        front: match.players.P1.board.front.map((unit) => ({
          ...unit,
          summoningSick: false
        }))
      }
    },
    P2: {
      ...match.players.P2,
      board: {
        ...match.players.P2.board,
        front: match.players.P2.board.front.map((unit) => ({
          ...unit,
          summoningSick: false
        }))
      }
    }
  }
};

match = goToCombatPhase(match);

const p1UnitId = match.players.P1.board.front[0].instanceId;
const p2UnitId = match.players.P2.board.front[0].instanceId;

match = attackUnit(match, "P1", p1UnitId, p2UnitId);

console.log("\n=== AFTER P1 UNIT ATTACKS P2 UNIT ===");
console.log(JSON.stringify(match, null, 2));

let heroTest = createFixedTestMatch();

heroTest = playUnitFromHand(heroTest, "P1", 0, "front");
heroTest = {
  ...heroTest,
  players: {
    ...heroTest.players,
    P1: {
      ...heroTest.players.P1,
      board: {
        ...heroTest.players.P1.board,
        front: heroTest.players.P1.board.front.map((unit) => ({
          ...unit,
          summoningSick: false
        }))
      }
    },
    P2: {
      ...heroTest.players.P2,
      board: {
        front: [],
        back: []
      }
    }
  }
};

heroTest = goToCombatPhase(heroTest);
const heroAttackerId = heroTest.players.P1.board.front[0].instanceId;
heroTest = attackHero(heroTest, "P1", heroAttackerId);

console.log("\n=== AFTER P1 UNIT ATTACKS HERO ===");
console.log(JSON.stringify(heroTest, null, 2));