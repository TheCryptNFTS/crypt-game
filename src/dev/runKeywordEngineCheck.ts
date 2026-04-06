import { createMatch } from "../engine/setup";
import {
  getAttackableEnemyUnits,
  canAttackEnemyPlayer,
  unitCanAttack
} from "../engine/keywordEngine";
import { MatchState } from "../engine/state";

function print(label: string, value: unknown) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(value, null, 2));
}

let match = createMatch() as MatchState;

(match as any).players.P1.board.front = [
  {
    instanceId: "p1_attacker",
    cardId: "tcg_unit_test_attacker",
    attack: 5,
    health: 5,
    armor: 0,
    exhausted: false,
    summoningSick: false,
    keywords: ["RANGED"]
  }
];

(match as any).players.P2.board.front = [
  {
    instanceId: "p2_guard_flying",
    cardId: "tcg_unit_test_guard",
    attack: 3,
    health: 7,
    armor: 0,
    exhausted: false,
    summoningSick: false,
    keywords: ["GUARD", "FLYING"]
  },
  {
    instanceId: "p2_normal",
    cardId: "tcg_unit_test_normal",
    attack: 4,
    health: 4,
    armor: 0,
    exhausted: false,
    summoningSick: false,
    keywords: []
  }
];

const attacker = (match as any).players.P1.board.front[0];

print("UNIT CAN ATTACK", {
  instanceId: attacker.instanceId,
  canAttack: unitCanAttack(attacker)
});

print(
  "ATTACKABLE ENEMY UNITS",
  getAttackableEnemyUnits(match, "P1", "p1_attacker").map((u: any) => ({
    instanceId: u.instanceId,
    cardId: u.cardId,
    keywords: u.keywords || []
  }))
);

print("CAN ATTACK ENEMY PLAYER", {
  canAttackEnemyPlayer: canAttackEnemyPlayer(match, "P1", "p1_attacker")
});

console.log("\n=== STATUS ===");
console.log("Keyword engine is working if GUARD blocked face damage and target filtering worked.");
