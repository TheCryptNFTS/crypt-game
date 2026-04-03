import { attackHero } from "./engine/combat";
import { createMatch, endTurn, playUnitFromHand } from "./engine/setup";

let match = createMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

// P2 turn
match = endTurn(match);

// Play Bronze Scout from hand index 0 to front
match = playUnitFromHand(match, "P2", 0, "front");

console.log("\n=== AFTER P2 PLAYS SCOUT ===");
console.log(JSON.stringify(match, null, 2));

// End P2 turn, go back to P1
match = endTurn(match);

// End P1 turn, go back to P2 so scout loses summoning sickness
match = endTurn(match);

const scoutId = match.players.P2.board.front[0].instanceId;

match = attackHero(match, "P2", scoutId);

console.log("\n=== AFTER SCOUT ATTACKS P1 HERO ===");
console.log(JSON.stringify(match, null, 2));