import { attackHero, attackUnit } from "./engine/combat";
import { getCommanderPassiveSummary } from "./engine/commanderAbilities";
import { endTurn, goToCombatPhase, goToEndPhase, playUnitFromHand } from "./engine/setup";
import { createFixedTestMatch } from "./engine/setup";

function print(title: string, data: unknown) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(data, null, 2));
}

function runTauntTest() {
  let match = createFixedTestMatch();

  match = {
    ...match,
    activePlayer: "P1",
    players: {
      ...match.players,
      P1: {
        ...match.players.P1,
        hand: ["unit_shield_bearer"],
        energy: 7,
        maxEnergy: 7
      },
      P2: {
        ...match.players.P2,
        hand: ["unit_bronze_scout"],
        energy: 7,
        maxEnergy: 7
      }
    }
  };

  print("TEST 1 START: TAUNT SETUP", match);

  match = playUnitFromHand(match, "P1", 0, "front");

  match = {
    ...match,
    activePlayer: "P2"
  };

  match = playUnitFromHand(match, "P2", 0, "front");
  match = goToCombatPhase(match);

  print("TEST 1 BEFORE HERO ATTACK WITH ENEMY TAUNT", match);

  try {
    const attackerId = match.players.P2.board.front[0].instanceId;
    match = attackHero(match, "P2", attackerId);
    print("TEST 1 FAILED - HERO ATTACK SHOULD HAVE BEEN BLOCKED", match);
  } catch (error) {
    console.log("\n=== TEST 1 RESULT ===");
    console.log("TAUNT correctly blocked hero attack");
    console.log(String(error));
  }
}

function runRushTest() {
  let match = createFixedTestMatch();

  match = {
    ...match,
    activePlayer: "P2",
    players: {
      ...match.players,
      P2: {
        ...match.players.P2,
        hand: ["unit_bronze_scout"],
        energy: 7,
        maxEnergy: 7
      }
    }
  };

  print("TEST 2 START: RUSH SETUP", match);

  match = playUnitFromHand(match, "P2", 0, "front");
  match = goToCombatPhase(match);

  const attackerId = match.players.P2.board.front[0].instanceId;
  match = attackHero(match, "P2", attackerId);

  print("TEST 2 AFTER RUSH HERO ATTACK", match);
}

function runNonRushTest() {
  let match = createFixedTestMatch();

  match = {
    ...match,
    activePlayer: "P1",
    players: {
      ...match.players,
      P1: {
        ...match.players.P1,
        hand: ["unit_stone_guard"],
        energy: 7,
        maxEnergy: 7
      }
    }
  };

  print("TEST 3 START: NON-RUSH SETUP", match);

  match = playUnitFromHand(match, "P1", 0, "front");
  match = goToCombatPhase(match);

  print("TEST 3 BEFORE NON-RUSH HERO ATTACK", match);

  try {
    const attackerId = match.players.P1.board.front[0].instanceId;
    match = attackHero(match, "P1", attackerId);
    print("TEST 3 FAILED - NON-RUSH SHOULD NOT ATTACK SAME TURN", match);
  } catch (error) {
    console.log("\n=== TEST 3 RESULT ===");
    console.log("Non-RUSH unit correctly blocked by summoning sickness");
    console.log(String(error));
  }
}

function runTurnFlowTest() {
  let match = createFixedTestMatch();

  match = {
    ...match,
    activePlayer: "P1",
    players: {
      ...match.players,
      P1: {
        ...match.players.P1,
        hand: ["unit_stone_guard"],
        energy: 7,
        maxEnergy: 7
      },
      P2: {
        ...match.players.P2,
        hand: ["unit_bronze_scout"],
        energy: 7,
        maxEnergy: 7
      }
    }
  };

  print("TEST 4 START: TURN FLOW SETUP", match);

  match = playUnitFromHand(match, "P1", 0, "front");

  match = {
    ...match,
    activePlayer: "P2"
  };

  match = playUnitFromHand(match, "P2", 0, "front");

  match = {
    ...match,
    players: {
      ...match.players,
      P2: {
        ...match.players.P2,
        board: {
          ...match.players.P2.board,
          front: match.players.P2.board.front.map((unit) => ({
            ...unit,
            exhausted: true,
            summoningSick: true
          }))
        }
      }
    }
  };

  print("TEST 4 BEFORE END TURN", match);

  match = {
    ...match,
    activePlayer: "P1",
    phase: "main"
  };

  match = goToCombatPhase(match);
  match = goToEndPhase(match);
  match = endTurn(match);

  print("TEST 4 AFTER END TURN / NEXT TURN START", match);
}

function runCommanderSummaryTest() {
  console.log("\n=== TEST 5 COMMANDER PASSIVE SUMMARIES ===");
  console.log({
    stone_warden: getCommanderPassiveSummary("cmd_stone_warden"),
    bronze_raider: getCommanderPassiveSummary("cmd_bronze_raider"),
    hell_judge: getCommanderPassiveSummary("cmd_hell_judge")
  });
}

function runUnitVsUnitTest() {
  let match = createFixedTestMatch();

  match = {
    ...match,
    activePlayer: "P1",
    players: {
      ...match.players,
      P1: {
        ...match.players.P1,
        hand: ["unit_stone_guard"],
        energy: 7,
        maxEnergy: 7
      },
      P2: {
        ...match.players.P2,
        hand: ["unit_bronze_scout"],
        energy: 7,
        maxEnergy: 7
      }
    }
  };

  print("TEST 6 START: UNIT VS UNIT", match);

  match = playUnitFromHand(match, "P1", 0, "front");

  match = {
    ...match,
    activePlayer: "P2"
  };

  match = playUnitFromHand(match, "P2", 0, "front");

  match = {
    ...match,
    activePlayer: "P1"
  };

  match = {
    ...match,
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
      }
    }
  };

  match = goToCombatPhase(match);

  const attackerId = match.players.P1.board.front[0].instanceId;
  const defenderId = match.players.P2.board.front[0].instanceId;

  match = attackUnit(match, "P1", attackerId, defenderId);

  print("TEST 6 AFTER UNIT VS UNIT", match);
}

runTauntTest();
runRushTest();
runNonRushTest();
runTurnFlowTest();
runCommanderSummaryTest();
runUnitVsUnitTest();