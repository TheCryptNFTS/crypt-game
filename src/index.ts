import { performAction } from "./engine/actions";
import { createFixedTestMatch } from "./engine/setup";

let match = createFixedTestMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

// P2 needs a target unit, so P1 plays Stone Guard first
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

// P2 plays Bronze Scout so Firebolt has a target later if needed
match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P2",
  handIndex: 0,
  lane: "front"
});

// End P2 turn
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

console.log("\n=== BEFORE FIREBOLT ===");
console.log(JSON.stringify(match, null, 2));

const targetId = match.players.P2.board.front[0].instanceId;

match = performAction(match, {
  type: "PLAY_SPELL",
  playerId: "P1",
  handIndex: 0,
  targetInstanceId: targetId
});

console.log("\n=== AFTER FIREBOLT ===");
console.log(JSON.stringify(match, null, 2));