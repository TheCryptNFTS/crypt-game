import { attackUnit } from "./engine/combat";
import { createFixedTestMatch, endTurn, playEquipmentFromHand, playUnitFromHand } from "./engine/setup";

let match = createFixedTestMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

// P2 turn
match = endTurn(match);

// P2 plays scout from hand index 0
match = playUnitFromHand(match, "P2", 0, "front");

console.log("\n=== AFTER P2 PLAYS SCOUT ===");
console.log(JSON.stringify(match, null, 2));

// P1 turn
match = endTurn(match);

// P1 plays stone guard from hand index 0
match = playUnitFromHand(match, "P1", 0, "front");

console.log("\n=== AFTER P1 PLAYS STONE GUARD ===");
console.log(JSON.stringify(match, null, 2));

// Back to P2 turn
match = endTurn(match);

// NOW P2 has 3 energy, so Axe can be equipped
const scoutId = match.players.P2.board.front[0].instanceId;

// After previous turns, Axe should still be in hand.
// Find it properly instead of guessing index.
const axeIndex = match.players.P2.hand.findIndex((cardId) => cardId === "eq_axe");

if (axeIndex === -1) {
  throw new Error("P2 does not have eq_axe in hand");
}

match = playEquipmentFromHand(match, "P2", axeIndex, scoutId);

console.log("\n=== AFTER P2 EQUIPS AXE TO SCOUT ===");
console.log(JSON.stringify(match, null, 2));

const defenderId = match.players.P1.board.front[0].instanceId;

match = attackUnit(match, "P2", scoutId, defenderId);

console.log("\n=== AFTER AXE SCOUT ATTACKS STONE GUARD ===");
console.log(JSON.stringify(match, null, 2));