import { createMatch, playUnitFromHand } from "./engine/setup";

let match = createMatch();

console.log("=== BEFORE PLAY ===");
console.log(JSON.stringify(match, null, 2));

match = playUnitFromHand(match, "P2", 1, "front");

console.log("\n=== AFTER PLAY ===");
console.log(JSON.stringify(match, null, 2));