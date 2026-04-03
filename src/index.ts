import { attackHero, attackUnit } from "./engine/combat";
import { goToCombatPhase, playUnitFromHand } from "./engine/setup";
import { createFixedTestMatch } from "./engine/setup";

let match = createFixedTestMatch();

console.log("=== TEST 1: UNIT VS UNIT ===");
console.log(JSON.stringify(match, null, 2));

match = playUnitFromHand(match, "P1", 0, "front");
match = {
  ...match,
  activePlayer: "P2"
};
match = playUnitFromHand(match, "P2", 0, "front");

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

console.log("\n=== AFTER UNIT VS UNIT COMBAT ===");
console.log(JSON.stringify(match, null, 2));

let heroTest = createFixedTestMatch();

console.log("\n=== TEST 2: HERO ATTACK ===");
console.log(JSON.stringify(heroTest, null, 2));

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

console.log("\n=== AFTER HERO ATTACK ===");
console.log(JSON.stringify(heroTest, null, 2));

let lifestealTest = createFixedTestMatch();

lifestealTest = {
  ...lifestealTest,
  activePlayer: "P2",
  players: {
    ...lifestealTest.players,
    P2: {
      ...lifestealTest.players.P2,
      health: 20,
      hand: ["unit_berserker"]
    }
  }
};

console.log("\n=== TEST 3: LIFESTEAL ===");
console.log(JSON.stringify(lifestealTest, null, 2));

lifestealTest = playUnitFromHand(lifestealTest, "P2", 0, "front");

lifestealTest = {
  ...lifestealTest,
  players: {
    ...lifestealTest.players,
    P1: {
      ...lifestealTest.players.P1,
      board: {
        front: [],
        back: []
      }
    },
    P2: {
      ...lifestealTest.players.P2,
      board: {
        ...lifestealTest.players.P2.board,
        front: lifestealTest.players.P2.board.front.map((unit) => ({
          ...unit,
          summoningSick: false
        }))
      }
    }
  }
};

lifestealTest = goToCombatPhase(lifestealTest);

const berserkerId = lifestealTest.players.P2.board.front[0].instanceId;
lifestealTest = attackHero(lifestealTest, "P2", berserkerId);

console.log("\n=== AFTER LIFESTEAL HERO ATTACK ===");
console.log(JSON.stringify(lifestealTest, null, 2));

let executePressureTest = createFixedTestMatch();

executePressureTest = {
  ...executePressureTest,
  players: {
    ...executePressureTest.players,
    P1: {
      ...executePressureTest.players.P1,
      hand: ["unit_blade_striker"],
      board: {
        front: [],
        back: []
      }
    },
    P2: {
      ...executePressureTest.players.P2,
      hand: ["unit_bronze_scout"],
      board: {
        front: [],
        back: []
      }
    }
  }
};

console.log("\n=== TEST 4: EXECUTE PRESSURE ===");
console.log(JSON.stringify(executePressureTest, null, 2));

executePressureTest = {
  ...executePressureTest,
  activePlayer: "P1"
};
executePressureTest = playUnitFromHand(executePressureTest, "P1", 0, "front");

executePressureTest = {
  ...executePressureTest,
  activePlayer: "P2"
};
executePressureTest = playUnitFromHand(executePressureTest, "P2", 0, "front");

executePressureTest = {
  ...executePressureTest,
  activePlayer: "P1",
  players: {
    ...executePressureTest.players,
    P1: {
      ...executePressureTest.players.P1,
      board: {
        ...executePressureTest.players.P1.board,
        front: executePressureTest.players.P1.board.front.map((unit) => ({
          ...unit,
          summoningSick: false
        }))
      }
    },
    P2: {
      ...executePressureTest.players.P2,
      board: {
        ...executePressureTest.players.P2.board,
        front: executePressureTest.players.P2.board.front.map((unit) => ({
          ...unit,
          summoningSick: false,
          health: 5
        }))
      }
    }
  }
};

executePressureTest = goToCombatPhase(executePressureTest);

const strikerId = executePressureTest.players.P1.board.front[0].instanceId;
const scoutId = executePressureTest.players.P2.board.front[0].instanceId;

executePressureTest = attackUnit(executePressureTest, "P1", strikerId, scoutId);

console.log("\n=== AFTER EXECUTE PRESSURE COMBAT ===");
console.log(JSON.stringify(executePressureTest, null, 2));