import { performAction } from "./engine/actions";
import { createFixedTestMatch } from "./engine/setup";

let match = createFixedTestMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

// P1 plays Stone Guard
match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P1",
  handIndex: 1,
  lane: "front"
});

console.log("\n=== AFTER P1 PLAYS STONE GUARD (UNIT_PLAYED EVENT FIRED) ===");
console.log(JSON.stringify(match, null, 2));

// End P1 turn
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// P2 plays Bronze Scout
match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P2",
  handIndex: 0,
  lane: "front"
});

// Make scout lethal
match.players.P2.board.front[0].attack = 20;

console.log("\n=== AFTER P2 PLAYS SUPER SCOUT (UNIT_PLAYED EVENT FIRED) ===");
console.log(JSON.stringify(match, null, 2));

// End P2 turn
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// P1 immediately passes
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// P2 kills Stone Guard
match = performAction(match, { type: "GO_TO_COMBAT" });

const scoutId = match.players.P2.board.front[0].instanceId;
const guardId = match.players.P1.board.front[0].instanceId;

match = performAction(match, {
  type: "ATTACK_UNIT",
  playerId: "P2",
  attackerInstanceId: scoutId,
  defenderInstanceId: guardId
});

console.log("\n=== AFTER STONE GUARD DIES (UNIT_DIED EVENT FIRED) ===");
console.log(JSON.stringify(match, null, 2));