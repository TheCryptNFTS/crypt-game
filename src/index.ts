import { performAction } from "./engine/actions";
import { createFixedTestMatch } from "./engine/setup";

let match = createFixedTestMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

match = performAction(match, {
  type: "PLAY_SPELL",
  playerId: "P1",
  handIndex: 0
});

console.log("\n=== AFTER INSIGHT ===");
console.log(JSON.stringify(match, null, 2));