import { attackHero, attackUnit } from "./engine/combat";
import { createFixedTestMatch, endTurn, playUnitFromHand } from "./engine/setup";

let match = createFixedTestMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

// Go to P2 turn
match = endTurn(match);

// P2 plays scout from hand index 0
match = playUnitFromHand(match, "P2", 0, "front");

console.log("\n=== AFTER P2 PLAYS SCOUT ===");
console.log(JSON.stringify(match, null, 2));

// Go to P1 turn
match = endTurn(match);

// P1 now has 3 energy, so Shield Bearer is playable from hand index 0
match = playUnitFromHand(match, "P1", 0, "front");

console.log("\n=== AFTER P1 PLAYS SHIELD BEARER (TAUNT) ===");
console.log(JSON.stringify(match, null, 2));

// Back to P2 turn
match = endTurn(match);

const scoutId = match.players.P2.board.front[0].instanceId;
const tauntId = match.players.P1.board.front[0].instanceId;

try {
  match = attackHero(match, "P2", scoutId);
} catch (error) {
  console.log("\n=== HERO ATTACK BLOCKED BY TAUNT ===");
  console.log(error instanceof Error ? error.message : error);
}

match = attackUnit(match, "P2", scoutId, tauntId);

console.log("\n=== AFTER SCOUT ATTACKS TAUNT UNIT ===");
console.log(JSON.stringify(match, null, 2));