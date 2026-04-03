import { createMatch, createFixedTestMatch } from "./engine/setup";
import { getLoadedCommanderById } from "./data/loadCommanders";

const liveMatch = createMatch();
const fixedMatch = createFixedTestMatch();

console.log("=== LIVE MATCH ===");
console.log(JSON.stringify(liveMatch, null, 2));

console.log("\n=== FIXED MATCH ===");
console.log(JSON.stringify(fixedMatch, null, 2));

console.log("\n=== P1 LIVE COMMANDER ===");
console.log(JSON.stringify(getLoadedCommanderById(liveMatch.players.P1.commanderId), null, 2));

console.log("\n=== P2 LIVE COMMANDER ===");
console.log(JSON.stringify(getLoadedCommanderById(liveMatch.players.P2.commanderId), null, 2));