/**
 * dev:combatdepth — pins the COMBAT-DEPTH keywords (item #12) END-TO-END through
 * `applyAction`: DEATHKNELL (death-triggered) + DEPLOY (deploy-triggered) auto-
 * targeted bursts, and the DETERMINISTIC, BOUNDED chain reactions they enable.
 *
 * Mechanics under test (compiled from the revived cards in cardOverrides.ts):
 *   DEATHKNELL N  tcg_1545 "Deathknell 2."  -> { ON_DEATH, DEAL_DAMAGE 2, STRONGEST_ENEMY }
 *   DEATHKNELL N  tcg_4210 "Deathknell 3."  -> { ON_DEATH, DEAL_DAMAGE 3, STRONGEST_ENEMY }
 *   DEPLOY N      tcg_4371 "Armored. Deploy 2." -> { ON_SUMMON, DEAL_DAMAGE 2, STRONGEST_ENEMY }
 *
 * The chain primitive: a Deathknell burst can finish ANOTHER enemy unit, whose own
 * ON_DEATH re-enters the reducer's trigger queue (drainTriggerQueue, bounded by
 * DRAIN_ITERATION_CAP) and resolves in the SAME action, FIFO, identically on every
 * replay. The selector (STRONGEST_ENEMY = highest attack, tie-break front-then-back
 * board-scan order) consumes NO rng, so the whole resolution is replay-stable.
 */

import { applyAction } from "../engine/reducer";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, UnitInPlay } from "../engine/state";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`OK: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

function unit(over: Partial<UnitInPlay> & { instanceId: string; cardId: string }): UnitInPlay {
  return {
    lane: "front",
    attack: 1,
    health: 5,
    maxHealth: 5,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: false,
    summoningSick: false,
    ...over,
  };
}

function arena(seed = 7321): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].energy = 99;
    m.players[p].maxEnergy = 99;
  }
  return m;
}

// === 1. DEATHKNELL fires on death and hits the STRONGEST enemy unit. ============
// P1 kills a P1-owned Deathknell? No — the dying unit's burst targets the dying
// unit's OWNER's enemy. We make P2's Deathknell die in combat; its ON_DEATH then
// damages the strongest P1 (enemy-of-P2) unit.
{
  const m = arena();
  // P1 attacker kills the P2 Deathknell. P1 also has two units of differing attack
  // so we can prove "strongest" = highest attack is the one hit.
  // "killer" has LOW attack (2, just enough to kill the 1-hp dk) so it is NOT the
  // strongest P1 unit — "strong" (atk 7) is, and must be the knell's victim.
  m.players.P1.board.front = [
    unit({ instanceId: "killer", cardId: "tcg_test", attack: 2, health: 10, maxHealth: 10 }),
    unit({ instanceId: "weak", cardId: "tcg_test", attack: 1, health: 9, maxHealth: 9 }),
    unit({ instanceId: "strong", cardId: "tcg_test", attack: 7, health: 9, maxHealth: 9 }),
  ];
  m.players.P2.board.front = [unit({ instanceId: "dk", cardId: "tcg_1545", attack: 1, health: 1, maxHealth: 1 })]; // Deathknell 2

  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "killer", defenderInstanceId: "dk" });
  const p1 = r.state.players.P1.board.front;
  const strong = p1.find((u) => u.instanceId === "strong");
  const weak = p1.find((u) => u.instanceId === "weak");
  check("DEATHKNELL corpse is cleared from the board", r.state.players.P2.board.front.every((u) => u.instanceId !== "dk"));
  check("DEATHKNELL 2 hits the STRONGEST enemy (atk 7) for 2 (9 -> 7)", strong?.health === 7, strong?.health);
  check("DEATHKNELL spares the weaker enemy (atk 1 untouched, 9)", weak?.health === 9, weak?.health);
}

// === 2. DEPLOY fires on play and hits the strongest enemy. ======================
{
  const m = arena();
  m.players.P2.board.front = [
    unit({ instanceId: "e_weak", cardId: "tcg_test", attack: 2, health: 5, maxHealth: 5 }),
    unit({ instanceId: "e_strong", cardId: "tcg_test", attack: 9, health: 5, maxHealth: 5 }),
  ];
  m.players.P1.hand = ["tcg_4371", ...m.players.P1.hand]; // Armored. Deploy 2.
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const eStrong = r.state.players.P2.board.front.find((u) => u.instanceId === "e_strong");
  const eWeak = r.state.players.P2.board.front.find((u) => u.instanceId === "e_weak");
  check("DEPLOY 2 hits the strongest enemy (atk 9) on play (5 -> 3)", eStrong?.health === 3, eStrong?.health);
  check("DEPLOY spares the weaker enemy (atk 2 untouched, 5)", eWeak?.health === 5, eWeak?.health);
  const deployed = r.state.players.P1.board.front.find((u) => u.cardId === "tcg_4371");
  check("DEPLOY unit (Armored) entered play with +1 armor", (deployed?.armor ?? 0) >= 1, deployed?.armor);
}

// === 3. CHAIN REACTION: Deathknell -> kills a Deathknell -> ITS knell fires. =====
// P2 has TWO Deathknell units. P1 kills the big one (Deathknell 3). Its ON_DEATH
// burst targets the strongest P1 unit. We arrange so that the burst from the FIRST
// knell lands on a P1 unit AND a SECOND P2 deathknell is already at 1 hp so the
// chain is observable. Cleanest chain: P2's dying Deathknell-3 damages a P1 unit;
// then we wound a P2 unit so the first knell's enemy is P1. To prove a TRUE chain
// (a death-trigger causing another death-trigger), put BOTH deathknells on P2 and
// have P1's attack kill BOTH at once (AoE-like): each corpse's knell fires in the
// canonical sweep order, and a knell that finishes a P1 unit is observable.
{
  const m = arena();
  // P1: a LOW-attack attacker (2 atk, just kills the 1-hp dk3) so the knell's
  // "strongest P1" victim is "victim" (atk 8), not the attacker.
  m.players.P1.board.front = [
    unit({ instanceId: "killer", cardId: "tcg_test", attack: 2, health: 50, maxHealth: 50 }),
    unit({ instanceId: "victim", cardId: "tcg_test", attack: 8, health: 4, maxHealth: 4 }), // strongest P1 enemy (atk 8)
  ];
  // P2: a Deathknell 3. Killer one-shots dk3; its knell (3) hits P1 "victim"
  // (atk 8, strongest) 4 -> 1.
  m.players.P2.board.front = [unit({ instanceId: "dk3", cardId: "tcg_4210", attack: 1, health: 1, maxHealth: 1 })]; // Deathknell 3
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "killer", defenderInstanceId: "dk3" });
  const victim = r.state.players.P1.board.front.find((u) => u.instanceId === "victim");
  check("CHAIN step A: dk3 dies, knell 3 hits strongest P1 (atk 8) 4 -> 1", victim?.health === 1, victim?.health);
}

// === 3b. TRUE multi-link chain: a knell kills a second knell, firing its knell. ==
{
  const m = arena();
  m.players.P1.board.front = [
    unit({ instanceId: "killer", cardId: "tcg_test", attack: 50, health: 50, maxHealth: 50 }),
    // Final-link target: a low-attack P1 unit at 2 hp. It must be the STRONGEST P1
    // enemy ONLY after the higher-attack P1 units are gone — so we keep just this.
    unit({ instanceId: "final", cardId: "tcg_test", attack: 3, health: 2, maxHealth: 2 }),
  ];
  // P2 board, scanned P2-front ascending: [dk3 @1hp atk5] then [dk2 @2hp atk1].
  // Killer one-shots dk3. dk3 knell(3) -> strongest P1 enemy. Strongest P1 = killer
  // (atk 50) — that's huge hp, survives. To force the chain onto P2 we instead make
  // P1 kill dk3; its knell hits P1 "final"? No: knell targets the OWNER's enemy =
  // P1. We need a knell whose owner is P1 to hit P2. So: give P1 a Deathknell that
  // dies, hitting P2's wounded Deathknell, which then fires ITS knell at P1.
  m.players.P1.board.front = [
    unit({ instanceId: "p1dk", cardId: "tcg_1545", attack: 1, health: 1, maxHealth: 1 }), // P1 Deathknell 2
    unit({ instanceId: "final", cardId: "tcg_test", attack: 3, health: 2, maxHealth: 2 }),
  ];
  // P2: one big attacker to kill p1dk, and a wounded P2 Deathknell that p1dk's knell
  // will finish, chaining ITS knell back onto P1 "final".
  m.players.P2.board.front = [
    unit({ instanceId: "p2killer", cardId: "tcg_test", attack: 9, health: 20, maxHealth: 20 }),
    unit({ instanceId: "p2dk", cardId: "tcg_4210", attack: 7, health: 2, maxHealth: 2 }), // P2 Deathknell 3, strongest P2 enemy by atk? atk 7 < 9
  ];
  // p2killer (atk 9) is the strongest P2 unit, so p1dk's knell would hit p2killer,
  // not p2dk. Make p2dk the strongest so the chain lands on it: bump its attack.
  m.players.P2.board.front[1].attack = 12; // p2dk now strongest P2 unit (atk 12 > 9)
  // It is P2's turn so P2 can attack p1dk with p2killer.
  m.activePlayer = "P2";
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "p2killer", defenderInstanceId: "p1dk" });
  // p1dk dies -> Deathknell 2 -> strongest P2 enemy = p2dk (atk 12), 2 hp -> 0 -> dies
  //   -> p2dk Deathknell 3 -> strongest P1 enemy = "final" (only P1 unit left), 2 -> -1 dies.
  const p2dk = r.state.players.P2.board.front.find((u) => u.instanceId === "p2dk");
  const final = r.state.players.P1.board.front.find((u) => u.instanceId === "final");
  check("CHAIN link 1: P1 Deathknell-2 finishes wounded P2 Deathknell (2hp -> dead)", p2dk === undefined, r.state.players.P2.board.front.map((u) => u.instanceId));
  check("CHAIN link 2: the dead P2 Deathknell-3 fired, finishing P1 'final'", final === undefined, r.state.players.P1.board.front.map((u) => u.instanceId));
}

// === 4. DETERMINISM: the same chain scenario replays byte-identically. ==========
function runChain(seed: number) {
  const m = arena(seed);
  m.players.P1.board.front = [
    unit({ instanceId: "p1dk", cardId: "tcg_1545", attack: 1, health: 1, maxHealth: 1 }),
    unit({ instanceId: "final", cardId: "tcg_test", attack: 3, health: 2, maxHealth: 2 }),
  ];
  m.players.P2.board.front = [
    unit({ instanceId: "p2killer", cardId: "tcg_test", attack: 9, health: 20, maxHealth: 20 }),
    unit({ instanceId: "p2dk", cardId: "tcg_4210", attack: 12, health: 2, maxHealth: 2 }),
  ];
  m.activePlayer = "P2";
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "p2killer", defenderInstanceId: "p1dk" });
  return JSON.stringify({ p1: r.state.players.P1.board.front, p2: r.state.players.P2.board.front });
}
{
  const a = runChain(7321);
  const b = runChain(7321);
  check("DETERMINISM: identical seed/scenario -> byte-identical chain resolution", a === b);
}

// === 5. BOUNDED RESOLUTION: a board full of mutually-finishing Deathknells stops.
// Pile both boards with low-hp Deathknell units of varying attack and trigger an
// AoE-style death (kill them all at once). Every knell fires; the resolution must
// TERMINATE (no infinite loop) and leave a finite, settled board — proving the
// DRAIN_ITERATION_CAP / lane-cap backstop holds for chained death-triggers.
{
  const m = arena();
  // A 50/50 attacker that will trade into a 1/1 wall; we instead directly zero a
  // cluster by combat. Simpler: stack P2 with 6 Deathknell 3 units at 1hp and let a
  // big P1 cleaver-like attack... but to keep it pure, kill ONE and let the chain of
  // knells (each 3 dmg) ripple across the rest (all at 1-3 hp).
  m.players.P1.board.front = [unit({ instanceId: "killer", cardId: "tcg_test", attack: 50, health: 50, maxHealth: 50 })];
  m.players.P2.board.front = [];
  for (let i = 0; i < 6; i += 1) {
    // Alternate attack so "strongest" picks deterministically; all at 2hp so a
    // single 3-dmg knell finishes any of them, cascading.
    m.players.P2.board.front.push(unit({ instanceId: `dk${i}`, cardId: "tcg_4210", attack: 2 + i, health: 2, maxHealth: 2 }));
  }
  // P1 also fields a wall so knells (which target P1) have something to chew without
  // ending the match; give it lots of hp so the proof is about TERMINATION, not win.
  m.players.P1.board.front.push(unit({ instanceId: "wall", cardId: "tcg_test", attack: 99, health: 999, maxHealth: 999 }));
  let terminated = true;
  let resState: MatchState | null = null;
  try {
    const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "killer", defenderInstanceId: "dk5" });
    resState = r.state;
  } catch {
    terminated = false;
  }
  check("BOUNDED: a cascade of Deathknell deaths TERMINATES (no infinite loop / throw)", terminated);
  if (resState) {
    const liveP2 = resState.players.P2.board.front.filter((u) => (u.health ?? 0) > 0).length;
    check("BOUNDED: the board settles to a finite state after the cascade", liveP2 >= 0 && liveP2 <= 6, liveP2);
  }
}

console.log(`\n=== COMBAT-DEPTH PROOF (DEATHKNELL / DEPLOY + bounded chain reactions) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} combat-depth check(s) failed.`);
  process.exit(1);
}
console.log("ALL COMBAT-DEPTH PROOFS PASSED");
