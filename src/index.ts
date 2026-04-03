import { createFixedTestMatch, playUnitFromHand } from "./engine/setup";
import { emitEvent } from "./engine/events";

let match = createFixedTestMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

match = playUnitFromHand(match, "P1", 0, "front");

console.log("\n=== AFTER P1 PLAYS STONE GUARD ===");
console.log(JSON.stringify(match, null, 2));

match = {
  ...match,
  activePlayer: "P2"
};

match = playUnitFromHand(match, "P2", 0, "front");

console.log("\n=== AFTER P2 PLAYS BRONZE SCOUT ===");
console.log(JSON.stringify(match, null, 2));

const bombTest = {
  ...createFixedTestMatch(),
  activePlayer: "P2" as const,
  players: {
    ...createFixedTestMatch().players,
    P2: {
      ...createFixedTestMatch().players.P2,
      hand: ["unit_bomb_skull"]
    }
  }
};

let deathMatch = playUnitFromHand(bombTest, "P2", 0, "front");
const bomb = deathMatch.players.P2.board.front[0];

console.log("\n=== AFTER P2 PLAYS BOMB SKULL ===");
console.log(JSON.stringify(deathMatch, null, 2));

deathMatch = emitEvent(deathMatch, {
  type: "UNIT_DIED",
  playerId: "P2",
  cardId: bomb.cardId,
  instanceId: bomb.instanceId
});

console.log("\n=== AFTER UNIT_DIED EVENT FOR BOMB SKULL ===");
console.log(JSON.stringify(deathMatch, null, 2));