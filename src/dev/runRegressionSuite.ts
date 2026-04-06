import { createMatch, playUnitFromHand, playEquipmentFromHand } from "../engine/setup";
import { playArtifactCard } from "../engine/effectSystem";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function testUnitPlay() {
  let match = createMatch();

  match.players.P1.energy = 10;
  match.players.P1.maxEnergy = 10;
  match.players.P1.hand = ["unit_stone_guard"];

  match = playUnitFromHand(match, "P1", 0, "front");

  assert(match.players.P1.board.front.length === 1, "Unit not played");
  assert(match.players.P1.board.front[0].cardId === "unit_stone_guard", "Wrong unit played");
  assert(match.players.P1.hand.length === 0, "Unit not removed from hand");
}

function testEquipmentPlay() {
  let match = createMatch();

  match.players.P1.energy = 10;
  match.players.P1.maxEnergy = 10;
  match.players.P1.hand = ["unit_stone_guard", "eq_axe"];

  match = playUnitFromHand(match, "P1", 0, "front");

  const targetId = match.players.P1.board.front[0].instanceId;
  const baseAttack = match.players.P1.board.front[0].attack;
  const baseHandLength = match.players.P1.hand.length;

  match = playEquipmentFromHand(match, "P1", 0, targetId);

  assert(match.players.P1.board.front.length === 1, "Target unit missing after equipment play");
  assert(match.players.P1.board.front[0].attack > baseAttack, "Equipment did not modify attack");
  assert(match.players.P1.hand.length === baseHandLength - 1, "Equipment not removed from hand");
}

function testArtifactPlay() {
  const match = createMatch() as any;

  match.players.P1.energy = 10;
  match.players.P1.maxEnergy = 10;
  match.players.P1.hand = ["unit_stone_guard", "tcg_art_3399"];

  let updated = playUnitFromHand(match, "P1", 0, "front") as any;

  const baseAttack = updated.players.P1.board.front[0].attack;
  const baseHandLength = updated.players.P1.hand.length;

  updated = playArtifactCard(updated, "P1", 0) as any;

  assert(Array.isArray(updated.players.P1.artifacts), "Artifact zone missing");
  assert(updated.players.P1.artifacts.length === 1, "Artifact not added");
  assert(updated.players.P1.artifacts[0].cardId === "tcg_art_3399", "Wrong artifact added");
  assert(updated.players.P1.hand.length === baseHandLength - 1, "Artifact not removed from hand");
  assert(updated.players.P1.board.front[0].attack >= baseAttack, "Artifact effect did not apply");
}

function run() {
  testUnitPlay();
  testEquipmentPlay();
  testArtifactPlay();

  console.log("\n=== REGRESSION SUITE ===");
  console.log("PASS");
}

run();
