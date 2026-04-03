import { performAction } from "./engine/actions";
import { createFixedTestMatch } from "./engine/setup";

let match = createFixedTestMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

// P1 plays Stone Guard first so Stone Warden has something to buff later
match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P1",
  handIndex: 1,
  lane: "front"
});

console.log("\n=== AFTER P1 PLAYS STONE GUARD ===");
console.log(JSON.stringify(match, null, 2));

// End P1 turn -> Stone Warden should give +1 armor to friendly units
match = performAction(match, { type: "GO_TO_COMBAT" });
match = performAction(match, { type: "GO_TO_END" });
match = performAction(match, { type: "END_TURN" });

console.log("\n=== AFTER P1 END TURN (STONE WARDEN BUFF) ===");
console.log(JSON.stringify(match, null, 2));

// Now Bronze Raider start-of-turn discount should be active for P2
console.log("\n=== P2 BEFORE PLAYING FIRST UNIT ===");
console.log(JSON.stringify(match, null, 2));

// P2 plays first unit; Bronze Scout normally costs 1, should cost 0
match = performAction(match, {
  type: "PLAY_UNIT",
  playerId: "P2",
  handIndex: 0,
  lane: "front"
});

console.log("\n=== AFTER P2 PLAYS FIRST UNIT WITH BRONZE DISCOUNT ===");
console.log(JSON.stringify(match, null, 2));