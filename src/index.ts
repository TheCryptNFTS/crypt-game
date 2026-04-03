import { performAction } from "./engine/actions";
import { createFixedTestMatch } from "./engine/setup";

let match = createFixedTestMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

// P1 -> combat -> end -> pass turn
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// P2 main: play scout
match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P2",
  handIndex: 0,
  lane: "front"
});

console.log("\n=== AFTER P2 PLAYS SCOUT ===");
console.log(JSON.stringify(match, null, 2));

// P2 -> combat -> end -> pass turn
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// P1 main: play shield bearer
match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P1",
  handIndex: 0,
  lane: "front"
});

console.log("\n=== AFTER P1 PLAYS SHIELD BEARER ===");
console.log(JSON.stringify(match, null, 2));

// P1 -> combat -> end -> pass turn
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// P2 combat
match = performAction(match, { type: "GO_TO_COMBAT" });

const scoutId = match.players.P2.board.front[0].instanceId;
const tauntId = match.players.P1.board.front[0].instanceId;

// Hero attack should fail
try {
  match = performAction(match, {
    type: "ATTACK_HERO",
    playerId: "P2",
    attackerInstanceId: scoutId
  });
} catch (error) {
  console.log("\n=== HERO ATTACK BLOCKED ===");
  console.log(error instanceof Error ? error.message : error);
}

// Unit attack should work
match = performAction(match, {
  type: "ATTACK_UNIT",
  playerId: "P2",
  attackerInstanceId: scoutId,
  defenderInstanceId: tauntId
});

console.log("\n=== AFTER SCOUT ATTACKS TAUNT UNIT ===");
console.log(JSON.stringify(match, null, 2));