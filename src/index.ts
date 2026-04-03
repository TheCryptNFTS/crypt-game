import { performAction } from "./engine/actions";
import { createFixedTestMatch } from "./engine/setup";

let match = createFixedTestMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

// P1 plays Stone Guard
match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P1",
  handIndex: 0,
  lane: "front"
});

const p1UnitId = match.players.P1.board.front[0].instanceId;

console.log("\n=== AFTER P1 PLAYS STONE GUARD ===");
console.log(JSON.stringify(match, null, 2));

// Find Battle Blessing dynamically
const blessingIndex = match.players.P1.hand.findIndex(
  (cardId) => cardId === "spell_battle_blessing"
);
if (blessingIndex === -1) {
  throw new Error("Battle Blessing not found in P1 hand");
}

match = performAction(match, {
  type: "PLAY_SPELL",
  playerId: "P1",
  handIndex: blessingIndex,
  targetInstanceId: p1UnitId
});

console.log("\n=== AFTER BATTLE BLESSING ===");
console.log(JSON.stringify(match, null, 2));

// Damage unit manually so Mend and Execute can be tested
match.players.P1.board.front[0].health = 7;

console.log("\n=== AFTER MANUAL DAMAGE TO P1 UNIT ===");
console.log(JSON.stringify(match, null, 2));

// Find Mend dynamically
const mendIndex = match.players.P1.hand.findIndex(
  (cardId) => cardId === "spell_mend"
);
if (mendIndex === -1) {
  throw new Error("Mend not found in P1 hand");
}

match = performAction(match, {
  type: "PLAY_SPELL",
  playerId: "P1",
  handIndex: mendIndex,
  targetInstanceId: p1UnitId
});

console.log("\n=== AFTER MEND ===");
console.log(JSON.stringify(match, null, 2));

// End P1 turn
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// P2 plays Bronze Scout
match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P2",
  handIndex: 0,
  lane: "front"
});

const p2UnitId = match.players.P2.board.front[0].instanceId;

console.log("\n=== AFTER P2 PLAYS BRONZE SCOUT ===");
console.log(JSON.stringify(match, null, 2));

// End P2 turn
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// Find Insight dynamically
const insightIndex = match.players.P1.hand.findIndex(
  (cardId) => cardId === "spell_insight"
);
if (insightIndex === -1) {
  throw new Error("Insight not found in P1 hand");
}

match = performAction(match, {
  type: "PLAY_SPELL",
  playerId: "P1",
  handIndex: insightIndex
});

console.log("\n=== AFTER INSIGHT ===");
console.log(JSON.stringify(match, null, 2));

// Find Firebolt dynamically
const fireboltIndex = match.players.P1.hand.findIndex(
  (cardId) => cardId === "spell_firebolt"
);
if (fireboltIndex === -1) {
  throw new Error("Firebolt not found in P1 hand");
}

match = performAction(match, {
  type: "PLAY_SPELL",
  playerId: "P1",
  handIndex: fireboltIndex,
  targetInstanceId: p2UnitId
});

console.log("\n=== AFTER FIREBOLT ===");
console.log(JSON.stringify(match, null, 2));

// Damage P1 unit manually so Execute can kill it
match.players.P1.board.front[0].health = 5;

console.log("\n=== AFTER MANUAL DAMAGE FOR EXECUTE TEST ===");
console.log(JSON.stringify(match, null, 2));

// End P1 turn
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

// Find Execute dynamically
const executeIndex = match.players.P2.hand.findIndex(
  (cardId) => cardId === "spell_execute"
);
if (executeIndex === -1) {
  throw new Error("Execute not found in P2 hand");
}

match = performAction(match, {
  type: "PLAY_SPELL",
  playerId: "P2",
  handIndex: executeIndex,
  targetInstanceId: p1UnitId
});

console.log("\n=== AFTER EXECUTE ===");
console.log(JSON.stringify(match, null, 2));