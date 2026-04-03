import { performAction } from "./engine/actions";
import { createFixedTestMatch } from "./engine/setup";

let match = createFixedTestMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P1",
  handIndex: 1,
  lane: "front"
});

console.log("\n=== AFTER P1 PLAYS STONE GUARD ===");
console.log(JSON.stringify(match, null, 2));

match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

console.log("\n=== AFTER P1 END TURN (EVENT-BASED STONE BUFF) ===");
console.log(JSON.stringify(match, null, 2));

match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P2",
  handIndex: 0,
  lane: "front"
});

console.log("\n=== AFTER P2 PLAYS FIRST UNIT (EVENT-BASED BRONZE DISCOUNT) ===");
console.log(JSON.stringify(match, null, 2));