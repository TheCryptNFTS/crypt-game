/**
 * dev:combat-parity — pins the reducer's combat math (the HOOK's
 * `resolveMitigatedDamage` / `resolveOutgoingDamage` + `removeDead`) for the
 * tricky armor / mitigation edge cases. Drives everything through `applyAction`
 * so it proves the LIVE path, not a reimplementation.
 */

import { applyAction } from "../engine/reducer";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState } from "../engine/state";
import { planP2Combat } from "../game-ui/cryptMatchAI";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

function unit(id: string, over: Partial<any> = {}): any {
  return {
    instanceId: id,
    cardId: "t",
    lane: "front",
    attack: 0,
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

function withBoard(seed: number, p1: any[], p2: any[]): MatchState {
  const s = makeSeededMatch(seed);
  s.players.P1.board.front = p1;
  s.players.P2.board.front = p2;
  return s;
}

// 1. Zero armor: full attack lands.
{
  const s = withBoard(3001, [unit("a", { attack: 4, health: 6 })], [unit("d", { attack: 0, health: 6, armor: 0 })]);
  const { state } = applyAction(s, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "a", defenderInstanceId: "d" });
  const def = state.players.P2.board.front.find((u) => u.instanceId === "d");
  assert(!!def && def.health === 2, "zero-armor: 4 dmg vs 6hp -> 2hp left");
}

// 2. Armor reduces incoming (no utility): armor - 0 mitigation.
{
  const s = withBoard(3002, [unit("a", { attack: 5, health: 6 })], [unit("d", { attack: 0, health: 6, armor: 2 })]);
  const { state } = applyAction(s, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "a", defenderInstanceId: "d" });
  const def = state.players.P2.board.front.find((u) => u.instanceId === "d");
  // mitigated = max(0, 5 - max(0, 2 - 0)) = 3 -> 6 - 3 = 3
  assert(!!def && def.health === 3, "armor 2 vs atk 5 -> 3 dmg lands (3hp left)");
}

// 3. Utility pierces armor: effective armor = max(0, armor - utility).
{
  const a = unit("a", { attack: 5, health: 6, utility: 3 });
  const s = withBoard(3003, [a], [unit("d", { attack: 0, health: 6, armor: 4 })]);
  const { state } = applyAction(s, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "a", defenderInstanceId: "d" });
  const def = state.players.P2.board.front.find((u) => u.instanceId === "d");
  // effArmor = max(0, 4 - 3) = 1; mitigated = max(0, 5 - 1) = 4 -> 6 - 4 = 2
  assert(!!def && def.health === 2, "utility 3 pierces armor 4 -> 4 dmg lands (2hp left)");
}

// 4. Utility fully negates armor (utility >= armor): full attack lands.
{
  const a = unit("a", { attack: 4, health: 6, utility: 5 });
  const s = withBoard(3004, [a], [unit("d", { attack: 0, health: 6, armor: 3 })]);
  const { state } = applyAction(s, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "a", defenderInstanceId: "d" });
  const def = state.players.P2.board.front.find((u) => u.instanceId === "d");
  assert(!!def && def.health === 2, "utility 5 >= armor 3 -> full 4 dmg (2hp left)");
}

// 5. Exact lethal trade: attacker exactly kills defender; defender's counter does not over-apply post-death (counter still applies in this lived model).
{
  const s = withBoard(3005, [unit("a", { attack: 3, health: 4 })], [unit("d", { attack: 2, health: 3 })]);
  const { state } = applyAction(s, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "a", defenderInstanceId: "d" });
  const defGone = !state.players.P2.board.front.find((u) => u.instanceId === "d");
  const atk = state.players.P1.board.front.find((u) => u.instanceId === "a");
  assert(defGone, "exact-lethal: 3 atk kills 3hp defender (removed)");
  assert(!!atk && atk.health === 2 && atk.exhausted === true, "attacker takes 2 counter (2hp) and is exhausted");
}

// 6. Crit (outgoing) adds to raw damage in the event/outgoing path.
{
  const a = unit("a", { attack: 3, health: 6, crit: 2 });
  const s = withBoard(3006, [a], [unit("d", { attack: 0, health: 10, armor: 0 })]);
  const { state, events } = applyAction(s, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "a", defenderInstanceId: "d" });
  const atkEvent = events.find((e) => e.type === "ATTACK") as any;
  const def = state.players.P2.board.front.find((u) => u.instanceId === "d");
  assert(atkEvent && atkEvent.outgoing === 5 && atkEvent.mitigated === 5, "crit 2 -> outgoing 5, mitigated 5");
  assert(!!def && def.health === 5, "crit damage lands (10 -> 5)");
}

// 7. Face damage uses raw outgoing (no armor on nexus).
{
  const a = unit("a", { attack: 4, health: 6, crit: 1 });
  const s = withBoard(3007, [a], []);
  const { state, events } = applyAction(s, { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "a" });
  const ev = events.find((e) => e.type === "NEXUS_DAMAGE") as any;
  assert(ev && ev.damage === 5, "face: outgoing 5 (atk4+crit1)");
  assert(state.players.P2.nexusHealth === 15, "nexus 20 -> 15");
}

// --- PLANNER PARITY: the AI planner must never plan a swing the reducer rejects.
// These pin the two fixes in cryptMatchAI.ts (COMMANDER_SHIELD + FEAR gaps).
// P2 is the AI; planP2Combat reads P2's board as attackers, P1's as defenders.

// 8. COMMANDER_SHIELD: with a shielded (non-GUARD) enemy commander, the HARD AI
//    must NOT plan any ATTACK_FACE (reducer rejects with "commander-shielded").
//    It should attack the commander instead to clear toward an opening.
{
  const s = withBoard(
    3008,
    // Enemy commander: Skull Island (COMMANDER_SHIELD). keywords:[] strips GUARD
    // so we isolate the COMMANDER_SHIELD face-block, not the guard-blocks-face path.
    [unit("cmd", { cardId: "tcg_3405", attack: 0, health: 8, keywords: [] })],
    // AI attacker: enough face damage to "look lethal" vs a 20-nexus if it ignored
    // the shield (atk 10, ready).
    [unit("ai", { cardId: "tcg_14", attack: 10, health: 6 })],
  );
  s.players.P1.nexusHealth = 8; // make face look lethal to bait the lethal block
  const plan = planP2Combat(s as any, "hard");
  const planuedFace = plan.some((a) => a.kind === "attackFace");
  const hitsCommander = plan.some(
    (a) => a.kind === "attackUnit" && a.defenderInstanceId === "cmd",
  );
  assert(!planuedFace, "planner: no ATTACK_FACE planned under COMMANDER_SHIELD");
  assert(hitsCommander, "planner: attacks the shielded commander instead of face");
}

// 9. FEAR: a sub-threshold attacker (cost 2 <= Fear threshold 2) must NOT be
//    planned into the Fear unit (reducer rejects "attacker-feared"). With ONLY a
//    feared low-cost attacker and no other legal target, the planner emits no
//    illegal unit swing against it (it may legally hit face — Fear never blocks
//    face — so we assert specifically that it does not plan attackUnit -> dread).
{
  const s = withBoard(
    3009,
    // Enemy Fear unit (tcg_373, threshold 2). No GUARD/COMMANDER_SHIELD so face is
    // legal; the ONLY restriction is the Fear matchup.
    [unit("dread", { cardId: "tcg_373", attack: 0, health: 6, keywords: [] })],
    // AI attacker cost 2 (tcg_2) -> at/below Fear threshold 2 -> feared.
    [unit("small", { cardId: "tcg_2", attack: 3, health: 2 })],
  );
  const plan = planP2Combat(s as any, "hard");
  const fearedUnitSwing = plan.some(
    (a) => a.kind === "attackUnit" && a.defenderInstanceId === "dread",
  );
  assert(!fearedUnitSwing, "planner: no ATTACK_UNIT into a Fear unit by a sub-threshold attacker");
  // Cross-check the reducer agrees the unit swing would be illegal but face is fine.
  const swing = applyAction(s, {
    type: "ATTACK_UNIT",
    player: "P2",
    attackerInstanceId: "small",
    defenderInstanceId: "dread",
  } as any);
  assert(
    swing.events.some((e) => (e as any).type === "REJECTED" && (e as any).reason === "attacker-feared"),
    "reducer cross-check: feared sub-threshold ATTACK_UNIT is rejected (attacker-feared)",
  );
}

// 10. FEAR: an ABOVE-threshold attacker (cost 4 > threshold 2) is NOT feared and
//     MUST still be planned into the Fear unit when it is the only target.
{
  const s = withBoard(
    3010,
    [unit("dread", { cardId: "tcg_373", attack: 0, health: 6, keywords: [] })],
    // AI attacker cost 4 (tcg_14) -> above Fear threshold 2 -> NOT feared.
    [unit("big", { cardId: "tcg_14", attack: 5, health: 4 })],
  );
  const plan = planP2Combat(s as any, "normal");
  assert(
    plan.some((a) => a.kind === "attackUnit" && a.defenderInstanceId === "dread"),
    "planner: above-threshold attacker still attacks the Fear unit (not over-excluded)",
  );
}

console.log("\nALL COMBAT PARITY PROOFS PASSED\n");
