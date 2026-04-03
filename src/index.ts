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
      hand: ["spell_firebolt"],
      discard: [],
      board: {
        front: [
          {
            instanceId: "unit_p1_guard",
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
        front: [
          {
            instanceId: "unit_p2_scout",
            cardId: "unit_bronze_scout",
            lane: "front",
            attack: 3,
            health: 8,
            speed: 4,
            armor: 0,
            keywords: ["RUSH"],
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
    }
  }
};

console.log("=== START ===");
console.log(JSON.stringify(match, null, 2));

applyEffect(match, {
  type: "DAMAGE_UNIT",
  targetId: "unit_p2_scout",
  amount: 3
});

console.log("=== AFTER FIREBOLT-STYLE UNIT DAMAGE ===");
console.log(JSON.stringify(match, null, 2));

applyEffect(match, {
  type: "DAMAGE_PLAYER",
  targetPlayerId: "P2",
  amount: 5
});

console.log("=== AFTER HERO DAMAGE ===");
console.log(JSON.stringify(match, null, 2));

applyEffect(match, {
  type: "HEAL_UNIT",
  targetId: "unit_p1_guard",
  amount: 4
});

console.log("=== AFTER HEAL ===");
console.log(JSON.stringify(match, null, 2));

applyEffect(match, {
  type: "BUFF_UNIT",
  targetId: "unit_p1_guard",
  attack: 2,
  health: 2
});

console.log("=== AFTER BUFF ===");
console.log(JSON.stringify(match, null, 2));