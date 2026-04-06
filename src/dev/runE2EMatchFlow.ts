import { COMMANDER_SPECS } from "../design/commanderSpecs";
import { buildCuratedDeck } from "../lib/buildCuratedDeck";
import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { getPlayableCardById } from "../engine/cards";
import { playUnitFromHand } from "../engine/setup";
import { endTurn } from "../engine/turnEngine";
import { attackUnit } from "../engine/combatEngine";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function findFirstUnitHandIndex(match: any, playerId: "P1" | "P2") {
  const hand = match.players[playerId].hand || [];
  for (let i = 0; i < hand.length; i += 1) {
    const card = getPlayableCardById(hand[i]);
    if (card?.type === "unit") return i;
  }
  return -1;
}

function run() {
  const commanderIds = Object.keys(COMMANDER_SPECS);
  assert(commanderIds.length >= 2, "Need at least 2 commanders");

  const p1Commander = commanderIds[0];
  const p2Commander = commanderIds[1];

  const p1Deck = buildCuratedDeck(p1Commander);
  const p2Deck = buildCuratedDeck(p2Commander);

  let match = createMatchFromDecks({
    p1: { commanderId: p1Commander, deck: p1Deck },
    p2: { commanderId: p2Commander, deck: p2Deck },
    shuffle: false,
    openingHandSize: 8,
  }) as any;

  assert(match.players.P1.commander?.id === p1Commander, "P1 commander missing");
  assert(match.players.P2.commander?.id === p2Commander, "P2 commander missing");
  assert(match.players.P1.commanderZone?.cardId === p1Commander, "P1 commander zone missing");
  assert(match.players.P2.commanderZone?.cardId === p2Commander, "P2 commander zone missing");
  assert(!match.players.P1.hand.includes(p1Commander), "P1 commander leaked into hand");
  assert(!match.players.P2.hand.includes(p2Commander), "P2 commander leaked into hand");

  match.players.P1.energy = 10;
  match.players.P1.maxEnergy = 10;
  match.players.P2.energy = 10;
  match.players.P2.maxEnergy = 10;

  const p1UnitIndex = findFirstUnitHandIndex(match, "P1");
  assert(p1UnitIndex >= 0, "No P1 unit in opening hand");
  match = playUnitFromHand(match, "P1", p1UnitIndex, "front");
  assert(match.players.P1.board.front.length === 1, "P1 failed to play a unit");

  match = endTurn(match);
  assert(match.activePlayer === "P2", "Turn did not pass to P2");

  const p2UnitIndex = findFirstUnitHandIndex(match, "P2");
  assert(p2UnitIndex >= 0, "No P2 unit in opening hand");
  match = playUnitFromHand(match, "P2", p2UnitIndex, "front");
  assert(match.players.P2.board.front.length === 1, "P2 failed to play a unit");

  match = endTurn(match);
  assert(match.activePlayer === "P1", "Turn did not pass back to P1");

  const attacker = match.players.P1.board.front[0];
  const defender = match.players.P2.board.front[0];
  const attackerStartHealth = attacker.health;
  const defenderStartHealth = defender.health;

  match = attackUnit(match, "P1", attacker.instanceId, defender.instanceId);

  const attackerAfter = match.players.P1.board.front[0];
  const defenderAfter = match.players.P2.board.front[0];

  assert(attackerAfter, "Attacker missing after combat");
  assert(defenderAfter, "Defender missing after combat");
  assert(attackerAfter.exhausted === true, "Attacker should be exhausted after combat");
  assert(
    attackerAfter.health !== attackerStartHealth || defenderAfter.health !== defenderStartHealth,
    "Combat did not change unit health"
  );

  console.log("\n=== E2E MATCH FLOW ===");
  console.log("PASS");
}

run();
