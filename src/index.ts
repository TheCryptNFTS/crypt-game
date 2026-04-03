import { applyEffect } from "./engine/effects";

const match: any = {
  turn: 1,
  activePlayer: "P1",
  phase: "main",
  winner: null,
  players: {
    P1: {
      id: "P1",
      health: 30,
      energy: 10,
      maxEnergy: 10,
      commanderId: "cmd_stone_warden",
      deck: [],
      hand: [],
      discard: [],
      board: {
        front: [
          {
            instanceId: "unit_test_guard",
            cardId: "unit_stone_guard",
            lane: "front",
            attack: 3,
            health: 12,
            speed: 2,
            armor: 0,
            keywords: [],
            exhausted: false,
            summoningSick: false
          }
        ],
        back: []
      },
      turnFlags: {
        firstUnitCostReduction: 0,
        firstUnitPlayed: false
      }
    },
    P2: {
      id: "P2",
      health: 30,
      energy: 10,
      maxEnergy: 10,
      commanderId: "cmd_bronze_raider",
      deck: [],
      hand: [],
      discard: [],
      board: {
        front: [],
        back: []
      },
      turnFlags: {
        firstUnitCostReduction: 0,
        firstUnitPlayed: false
      }
    }
  }
};

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

applyEffect(match, {
  type: "DAMAGE_UNIT",
  targetId: "unit_test_guard",
  amount: 4
});

console.log("=== AFTER UNIT DAMAGE ===");
console.log(JSON.stringify(match, null, 2));

applyEffect(match, {
  type: "DAMAGE_PLAYER",
  targetPlayerId: "P2",
  amount: 5
});

console.log("=== AFTER PLAYER DAMAGE ===");
console.log(JSON.stringify(match, null, 2));