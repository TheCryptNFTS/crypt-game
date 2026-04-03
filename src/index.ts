import { attackHero } from "./engine/combat";
import { getCommanderPassiveSummary } from "./engine/commanderAbilities";
import {
  createFixedTestMatch,
  endTurn,
  goToCombatPhase,
  goToEndPhase,
  playUnitFromHand
} from "./engine/setup";

function print(title: string, data: unknown) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(data, null, 2));
}

/**
 * TEST 1
 * TAUNT should block hero attacks
 */
let tauntTest = createFixedTestMatch();

tauntTest = {
  ...tauntTest,
  activePlayer: "P2",
  players: {
    ...tauntTest.players,
    P2: {
      ...tauntTest.players.P2,
      hand: ["unit_bronze_scout"]
    },
    P1: {
      ...tauntTest.players.P1,
      hand: ["unit_shield_bearer"]
    }
  }
};

print("TEST 1 START: TAUNT SETUP", tauntTest);

tauntTest = {
  ...tauntTest,
  activePlayer: "P1"
};
tauntTest = playUnitFromHand(tauntTest, "P1", 0, "front");

tauntTest = {
  ...tauntTest,
  activePlayer: "P2"
};
tauntTest = playUnitFromHand(tauntTest, "P2", 0, "front");

tauntTest = {
  ...tauntTest,
  players: {
    ...tauntTest.players,
    P2: {
      ...tauntTest.players.P2,
      board: {
        ...tauntTest.players.P2.board,
        front: tauntTest.players.P2.board.front.map((unit) => ({
          ...unit,
          summoningSick: false
        }))
      }
    }
  }
};

tauntTest = goToCombatPhase(tauntTest);

print("TEST 1 BEFORE HERO ATTACK WITH ENEMY TAUNT", tauntTest);

try {
  const scoutId = tauntTest.players.P2.board.front.find(
    (unit) => unit.cardId === "unit_bronze_scout"
  )?.instanceId;

  if (!scoutId) {
    throw new Error("Bronze Scout not found");
  }

  tauntTest = attackHero(tauntTest, "P2", scoutId);
  print("TEST 1 FAILED - HERO ATTACK SHOULD HAVE BEEN BLOCKED", tauntTest);
} catch (error) {
  console.log("\n=== TEST 1 RESULT ===");
  console.log("TAUNT correctly blocked hero attack");
  console.log(String(error));
}

/**
 * TEST 2
 * RUSH unit can attack hero on same turn if no TAUNT exists
 */
let rushTest = createFixedTestMatch();

rushTest = {
  ...rushTest,
  activePlayer: "P2",
  players: {
    ...rushTest.players,
    P2: {
      ...rushTest.players.P2,
      hand: ["unit_bronze_scout"]
    },
    P1: {
      ...rushTest.players.P1,
      board: {
        front: [],
        back: []
      }
    }
  }
};

print("TEST 2 START: RUSH SETUP", rushTest);

rushTest = playUnitFromHand(rushTest, "P2", 0, "front");
rushTest = goToCombatPhase(rushTest);

const rushScoutId = rushTest.players.P2.board.front[0].instanceId;
rushTest = attackHero(rushTest, "P2", rushScoutId);

print("TEST 2 AFTER RUSH HERO ATTACK", rushTest);

/**
 * TEST 3
 * Non-RUSH unit should NOT attack on same turn
 */
let nonRushTest = createFixedTestMatch();

nonRushTest = {
  ...nonRushTest,
  activePlayer: "P1",
  players: {
    ...nonRushTest.players,
    P1: {
      ...nonRushTest.players.P1,
      hand: ["unit_stone_guard"]
    },
    P2: {
      ...nonRushTest.players.P2,
      board: {
        front: [],
        back: []
      }
    }
  }
};

print("TEST 3 START: NON-RUSH SETUP", nonRushTest);

nonRushTest = playUnitFromHand(nonRushTest, "P1", 0, "front");
nonRushTest = goToCombatPhase(nonRushTest);

print("TEST 3 BEFORE NON-RUSH HERO ATTACK", nonRushTest);

try {
  const stoneGuardId = nonRushTest.players.P1.board.front[0].instanceId;
  nonRushTest = attackHero(nonRushTest, "P1", stoneGuardId);
  print("TEST 3 FAILED - NON-RUSH SHOULD NOT ATTACK SAME TURN", nonRushTest);
} catch (error) {
  console.log("\n=== TEST 3 RESULT ===");
  console.log("Non-RUSH unit correctly blocked by summoning sickness");
  console.log(String(error));
}

/**
 * TEST 4
 * End turn should refresh next player's units and add energy
 */
let turnFlowTest = createFixedTestMatch();

turnFlowTest = {
  ...turnFlowTest,
  activePlayer: "P1",
  players: {
    ...turnFlowTest.players,
    P1: {
      ...turnFlowTest.players.P1,
      hand: ["unit_stone_guard"]
    },
    P2: {
      ...turnFlowTest.players.P2,
      hand: ["unit_bronze_scout"]
    }
  }
};

print("TEST 4 START: TURN FLOW SETUP", turnFlowTest);

turnFlowTest = playUnitFromHand(turnFlowTest, "P1", 0, "front");
turnFlowTest = {
  ...turnFlowTest,
  activePlayer: "P2"
};
turnFlowTest = playUnitFromHand(turnFlowTest, "P2", 0, "front");

turnFlowTest = {
  ...turnFlowTest,
  players: {
    ...turnFlowTest.players,
    P2: {
      ...turnFlowTest.players.P2,
      board: {
        ...turnFlowTest.players.P2.board,
        front: turnFlowTest.players.P2.board.front.map((unit) => ({
          ...unit,
          exhausted: true,
          summoningSick: true
        }))
      }
    }
  }
};

print("TEST 4 BEFORE END TURN", turnFlowTest);

turnFlowTest = {
  ...turnFlowTest,
  activePlayer: "P1"
};
turnFlowTest = goToCombatPhase(turnFlowTest);
turnFlowTest = goToEndPhase(turnFlowTest);
turnFlowTest = endTurn(turnFlowTest);

print("TEST 4 AFTER END TURN / NEXT TURN START", turnFlowTest);

/**
 * TEST 5
 * Commander passive summaries
 */
const stoneSummary = getCommanderPassiveSummary("cmd_stone_warden");
const bronzeSummary = getCommanderPassiveSummary("cmd_bronze_raider");
const hellSummary = getCommanderPassiveSummary("cmd_hell_judge");

console.log("\n=== TEST 5 COMMANDER PASSIVE SUMMARIES ===");
console.log({
  stone_warden: stoneSummary,
  bronze_raider: bronzeSummary,
  hell_judge: hellSummary
});