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

console.log("\n=== AFTER P1 PLAYS STONE GUARD ===");
console.log(JSON.stringify(match, null, 2));

// End P1 turn
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// P2 plays Shock Raider
match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P2",
  handIndex: 0,
  lane: "front"
});

console.log("\n=== AFTER P2 PLAYS SHOCK RAIDER ===");
console.log(JSON.stringify(match, null, 2));