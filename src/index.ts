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

// End P1 turn
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// P2 plays Bomb Skull
match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P2",
  handIndex: 0,
  lane: "front"
});

console.log("\n=== AFTER P2 PLAYS BOMB SKULL ===");
console.log(JSON.stringify(match, null, 2));

// Make Stone Guard kill Bomb Skull
match.players.P1.board.front[0].attack = 10;

// End P2 turn
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// P1 combat
match = performAction(match, { type: "GO_TO_COMBAT" });

const guardId = match.players.P1.board.front[0].instanceId;
const bombId = match.players.P2.board.front[0].instanceId;

match = performAction(match, {
  type: "ATTACK_UNIT",
  playerId: "P1",
  attackerInstanceId: guardId,
  defenderInstanceId: bombId
});

console.log("\n=== AFTER BOMB SKULL DIES ===");
console.log(JSON.stringify(match, null, 2));