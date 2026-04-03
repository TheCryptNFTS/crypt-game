import { createFixedTestMatch, playSpellFromHand, playUnitFromHand } from "./engine/setup";

let match = createFixedTestMatch();

match = {
  ...match,
  activePlayer: "P2",
  players: {
    ...match.players,
    P2: {
      ...match.players.P2,
      hand: ["unit_bomb_skull", "spell_execute"]
    }
  }
};

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

match = playUnitFromHand(match, "P2", 0, "front");

console.log("\n=== AFTER P2 PLAYS BOMB SKULL ===");
console.log(JSON.stringify(match, null, 2));

const bombSkullId = match.players.P2.board.front[0].instanceId;

match = {
  ...match,
  players: {
    ...match.players,
    P2: {
      ...match.players.P2,
      board: {
        ...match.players.P2.board,
        front: match.players.P2.board.front.map((unit) =>
          unit.instanceId === bombSkullId
            ? { ...unit, health: 0 }
            : unit
        )
      }
    }
  }
};

console.log("\n=== AFTER MANUAL LETHAL DAMAGE TO BOMB SKULL ===");
console.log(JSON.stringify(match, null, 2));

match = playSpellFromHand(match, "P2", 0, bombSkullId);

console.log("\n=== AFTER CLEANUP TRIGGER ===");
console.log(JSON.stringify(match, null, 2));