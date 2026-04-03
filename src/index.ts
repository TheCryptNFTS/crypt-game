import { performAction } from "./engine/actions";
import { createFixedTestMatch } from "./engine/setup";

let match = createFixedTestMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

// P1 -> pass to P2
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// P2 plays scout
match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P2",
  handIndex: 0,
  lane: "front"
});

// Buff scout manually for a lethal test
match.players.P2.board.front[0].attack = 20;

console.log("\n=== AFTER P2 PLAYS SUPER SCOUT ===");
console.log(JSON.stringify(match, null, 2));

// P2 pass to P1
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// P1 plays shield bearer
match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P1",
  handIndex: 0,
  lane: "front"
});

console.log("\n=== AFTER P1 PLAYS SHIELD BEARER ===");
console.log(JSON.stringify(match, null, 2));

// P1 pass to P2
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// P2 combat
match = performAction(match, { type: "GO_TO_COMBAT" });

const scoutId = match.players.P2.board.front[0].instanceId;
const defenderId = match.players.P1.board.front[0].instanceId;

match = performAction(match, {
  type: "ATTACK_UNIT",
  playerId: "P2",
  attackerInstanceId: scoutId,
  defenderInstanceId: defenderId
});

console.log("\n=== AFTER SUPER SCOUT KILLS SHIELD BEARER ===");
console.log(JSON.stringify(match, null, 2));