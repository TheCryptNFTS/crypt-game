import { attackHero, attackUnit } from "./engine/combat";
import {
  createFixedTestMatch,
  endTurn,
  goToCombatPhase,
  goToEndPhase,
  playUnitFromHand
} from "./engine/setup";

let match = createFixedTestMatch();

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

// Move to end and pass to P2 main phase
match = goToCombatPhase(match);
match = goToEndPhase(match);
match = endTurn(match);

// P2 main: play scout
match = playUnitFromHand(match, "P2", 0, "front");

console.log("\n=== AFTER P2 PLAYS SCOUT ===");
console.log(JSON.stringify(match, null, 2));

// End P2 turn properly
match = goToCombatPhase(match);
match = goToEndPhase(match);
match = endTurn(match);

// P1 main: play Shield Bearer
match = playUnitFromHand(match, "P1", 0, "front");

console.log("\n=== AFTER P1 PLAYS SHIELD BEARER (TAUNT) ===");
console.log(JSON.stringify(match, null, 2));

// End P1 turn properly
match = goToCombatPhase(match);
match = goToEndPhase(match);
match = endTurn(match);

// P2 combat
match = goToCombatPhase(match);

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