/**
 * dev:response-stack — proof of the REAL LIFO reactive response stack
 * (opt-in `rules.responseStack`), the headline interactivity primitive described in
 * `src/engine/RESOLUTION_MODEL.md` §9.
 *
 * The previous "no-stack model is locked" constraint has been LIFTED by the owner. This
 * adds a genuine response stack as a NEW resolution mode, gated entirely behind the flag:
 *
 *   - FLAG OFF (default): a slow action (unit attack / face swing) resolves IMMEDIATELY,
 *     EXACTLY as before — so the 21 golden reducer-equivalence scenarios stay byte-
 *     identical and the fixture is NOT regenerated. This proof asserts that directly.
 *   - FLAG ON: a legal slow action is DEFERRED onto `state.responseStack` and a
 *     `state.pendingResponse` window opens. Players push FAST responses (CAST_RESPONSE)
 *     onto the stack; when BOTH pass consecutively the stack drains LIFO — the most
 *     recent response resolves first and can fizzle / pump / shield the entry beneath it.
 *
 * What is PROVEN here (depth, not surface):
 *   1. flag OFF behaves like today (no window; attack resolves inline).
 *   2. flag ON opens a window; PASS + PASS closes it and the deferred attack lands.
 *   3. a fast COUNTER fizzles the action beneath it (the attack never lands).
 *   4. a fast PUMP changes a combat outcome mid-resolution (defender survives a lethal
 *      swing because it was pumped before the swing resolved).
 *   5. a fast SHIELD changes a combat outcome (the swing's damage is absorbed).
 *   6. a response-to-a-response (counter-the-counter) resolves correctly LIFO: counter2
 *      fizzles counter1, so the base attack lands after all.
 *   7. DETERMINISM: same (seed, actions) -> byte-identical state.
 *   8. NO-BURN: a DAMAGE_UNIT response can never touch a nexus/face.
 *   9. REJECT-SOFT: illegal responses (wrong priority, response with no window, a normal
 *      action while a window is open) no-op cleanly (state unchanged).
 *
 * Nothing here regenerates a committed fixture; the flag-OFF path is asserted unchanged.
 */

import { applyAction, Action } from "../engine/reducer";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, UnitInPlay, PlayerId, Lane } from "../engine/state";

let failed = 0;
function assert(cond: boolean, msg: string, detail?: unknown): void {
  if (cond) {
    console.log(`OK: ${msg}`);
  } else {
    console.error(`FAIL: ${msg}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
    failed += 1;
  }
}

/** A plain test unit (no abilities — cardId "tcg_test" is not in the catalog, so it
 *  compiles to zero specs and carries no keywords/triggers). Fully controllable stats. */
function unit(instanceId: string, lane: Lane, attack: number, health: number): UnitInPlay {
  return {
    cardId: "tcg_test",
    instanceId,
    lane,
    attack,
    health,
    maxHealth: health,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: false,
    summoningSick: false,
  } as UnitInPlay;
}

/** Clean arena: empty boards, full nexuses, P1 to act, optional responseStack flag. */
function arena(seed = 4040, responseStack = false): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.turn = 1;
  m.winner = null;
  m.pendingChoice = null;
  m.responseStack = [];
  m.pendingResponse = null;
  m.rules = responseStack ? { responseStack: true } : null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].hand = [];
  }
  return m;
}

function apply(m: MatchState, a: Action) {
  return applyAction(m, a);
}

// Find a live unit's health by instanceId across both players (or undefined if reaped).
function hp(m: MatchState, instanceId: string): number | undefined {
  for (const p of ["P1", "P2"] as const) {
    for (const lane of ["front", "back"] as Lane[]) {
      const u = m.players[p].board[lane].find((x) => x.instanceId === instanceId);
      if (u) return u.health;
    }
  }
  return undefined;
}

// === 1. FLAG OFF: slow action resolves IMMEDIATELY (byte-identical to today) =====
{
  const m = arena(1, /*responseStack*/ false);
  m.players.P1.board.front = [unit("A", "front", 3, 5)];
  m.players.P2.board.front = [unit("D", "front", 1, 5)];
  const r = apply(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "A", defenderInstanceId: "D" });
  assert(r.state.pendingResponse == null, "flag OFF: no response window is opened", r.state.pendingResponse);
  assert((r.state.responseStack ?? []).length === 0, "flag OFF: response stack stays empty");
  assert(hp(r.state, "D") === 2, "flag OFF: attack resolved INLINE (defender 5 - 3 = 2)", hp(r.state, "D"));
  assert(r.events.some((e) => e.type === "ATTACK"), "flag OFF: emitted ATTACK immediately");
}

// === 2. FLAG ON: window opens; PASS + PASS closes it and the deferred attack lands =
{
  let m = arena(2, /*responseStack*/ true);
  m.players.P1.board.front = [unit("A", "front", 3, 5)];
  m.players.P2.board.front = [unit("D", "front", 1, 5)];
  let r = apply(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "A", defenderInstanceId: "D" });
  assert(r.state.pendingResponse != null, "flag ON: ATTACK opens a response window", r.state.pendingResponse);
  assert(r.state.pendingResponse?.priority === "P2", "flag ON: opponent (P2) gets priority first", r.state.pendingResponse?.priority);
  assert((r.state.responseStack ?? []).length === 1, "flag ON: the base ATTACK entry is on the stack");
  assert(hp(r.state, "D") === 5, "flag ON: attack has NOT landed yet (deferred)", hp(r.state, "D"));
  assert(r.events.some((e) => e.type === "RESPONSE_OPENED"), "flag ON: RESPONSE_OPENED emitted");

  // P2 passes, then P1 passes -> window closes, stack drains LIFO, attack lands.
  r = apply(r.state, { type: "PASS_RESPONSE", player: "P2" });
  assert(r.state.pendingResponse?.priority === "P1", "after P2 pass: priority returns to P1", r.state.pendingResponse?.priority);
  assert(r.state.pendingResponse?.passes === 1, "after one pass: passes=1");
  r = apply(r.state, { type: "PASS_RESPONSE", player: "P1" });
  assert(r.state.pendingResponse == null, "after both pass: window closed", r.state.pendingResponse);
  assert(hp(r.state, "D") === 2, "after both pass: deferred attack landed (5 - 3 = 2)", hp(r.state, "D"));
  assert(r.events.some((e) => e.type === "RESPONSE_RESOLVED"), "RESPONSE_RESOLVED emitted on window close");
}

// === 3. FAST COUNTER fizzles the action beneath it (the attack never lands) =======
{
  let m = arena(3, /*responseStack*/ true);
  m.players.P1.board.front = [unit("A", "front", 4, 5)];
  m.players.P2.board.front = [unit("D", "front", 1, 5)];
  let r = apply(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "A", defenderInstanceId: "D" });
  // P2 counters the attack.
  r = apply(r.state, { type: "CAST_RESPONSE", player: "P2", response: { kind: "COUNTER" } });
  assert((r.state.responseStack ?? []).length === 2, "counter pushed onto the stack (base + counter)");
  assert(r.state.pendingResponse?.priority === "P1", "after P2 counters: priority to P1");
  assert(r.state.pendingResponse?.passes === 0, "casting reset the pass count");
  // Both pass -> resolve LIFO: counter pops first and fizzles the attack beneath it.
  r = apply(r.state, { type: "PASS_RESPONSE", player: "P1" });
  r = apply(r.state, { type: "PASS_RESPONSE", player: "P2" });
  assert(r.events.some((e) => e.type === "RESPONSE_FIZZLED"), "counter emitted RESPONSE_FIZZLED");
  assert(hp(r.state, "D") === 5, "countered attack FIZZLED — defender took NO damage", hp(r.state, "D"));
  assert(hp(r.state, "A") === 5, "countered attack FIZZLED — attacker took no counter-damage either", hp(r.state, "A"));
}

// === 4. FAST PUMP changes a combat outcome mid-resolution =========================
{
  // A (3 atk) attacks D (3 hp). Unmodified that is lethal. P2 pumps D +0/+3 in response,
  // so when the deferred swing lands D survives (6 hp - 3 = 3).
  let m = arena(4, /*responseStack*/ true);
  m.players.P1.board.front = [unit("A", "front", 3, 10)];
  m.players.P2.board.front = [unit("D", "front", 0, 3)];
  let r = apply(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "A", defenderInstanceId: "D" });
  r = apply(r.state, {
    type: "CAST_RESPONSE",
    player: "P2",
    response: { kind: "EFFECT", effect: { op: "PUMP_ALLY", attack: 0, health: 3 }, targetInstanceId: "D" },
  });
  // Resolve: pump pops first (D -> 6 hp), then the attack lands (6 - 3 = 3, survives).
  r = apply(r.state, { type: "PASS_RESPONSE", player: "P1" });
  r = apply(r.state, { type: "PASS_RESPONSE", player: "P2" });
  assert(hp(r.state, "D") === 3, "PUMP applied BEFORE the swing — D survived (6 - 3 = 3)", hp(r.state, "D"));
}

// === 5. FAST SHIELD changes a combat outcome (absorbs the swing) ==================
{
  let m = arena(5, /*responseStack*/ true);
  m.players.P1.board.front = [unit("A", "front", 4, 10)];
  m.players.P2.board.front = [unit("D", "front", 0, 3)];
  let r = apply(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "A", defenderInstanceId: "D" });
  r = apply(r.state, {
    type: "CAST_RESPONSE",
    player: "P2",
    response: { kind: "EFFECT", effect: { op: "SHIELD_ALLY" }, targetInstanceId: "D" },
  });
  r = apply(r.state, { type: "PASS_RESPONSE", player: "P1" });
  r = apply(r.state, { type: "PASS_RESPONSE", player: "P2" });
  assert(hp(r.state, "D") === 3, "SHIELD absorbed the swing — D at full (3) despite a 4-atk strike", hp(r.state, "D"));
}

// === 6. COUNTER-THE-COUNTER resolves LIFO (counter2 fizzles counter1) =============
{
  // P1 attacks. P2 counters (counter1). P1 counters the counter (counter2). On resolve,
  // counter2 pops first and fizzles counter1; counter1 (now fizzled) is a no-op, so the
  // BASE attack survives and lands. This proves correct LIFO depth.
  let m = arena(6, /*responseStack*/ true);
  m.players.P1.board.front = [unit("A", "front", 4, 10)];
  m.players.P2.board.front = [unit("D", "front", 1, 5)];
  let r = apply(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "A", defenderInstanceId: "D" });
  r = apply(r.state, { type: "CAST_RESPONSE", player: "P2", response: { kind: "COUNTER" } }); // counter1
  r = apply(r.state, { type: "CAST_RESPONSE", player: "P1", response: { kind: "COUNTER" } }); // counter2
  assert((r.state.responseStack ?? []).length === 3, "stack holds base + counter1 + counter2", (r.state.responseStack ?? []).length);
  // Both pass -> drain LIFO.
  r = apply(r.state, { type: "PASS_RESPONSE", player: "P2" });
  r = apply(r.state, { type: "PASS_RESPONSE", player: "P1" });
  const fizzles = r.events.filter((e) => e.type === "RESPONSE_FIZZLED");
  assert(fizzles.length === 1, "exactly ONE fizzle (counter2 fizzled counter1)", fizzles.length);
  assert(hp(r.state, "D") === 1, "counter-the-counter let the BASE attack land (D 5 - A 4 atk = 1)", hp(r.state, "D"));
}

// === 7. DETERMINISM: same (seed, actions) -> byte-identical final state ===========
{
  function run(seed: number): MatchState {
    let m = arena(seed, true);
    m.players.P1.board.front = [unit("A", "front", 3, 8)];
    m.players.P2.board.front = [unit("D", "front", 2, 8)];
    const actions: Action[] = [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "A", defenderInstanceId: "D" },
      { type: "CAST_RESPONSE", player: "P2", response: { kind: "EFFECT", effect: { op: "PUMP_ALLY", attack: 1, health: 1 }, targetInstanceId: "D" } },
      { type: "PASS_RESPONSE", player: "P1" },
      { type: "PASS_RESPONSE", player: "P2" },
    ];
    let s = m;
    for (const a of actions) s = apply(s, a).state;
    return s;
  }
  const a = run(777);
  const b = run(777);
  assert(JSON.stringify(a) === JSON.stringify(b), "determinism: identical (seed, actions) -> byte-identical state");
}

// === 8. NO-BURN: a DAMAGE_UNIT response can never touch a nexus/face ==============
{
  let m = arena(8, /*responseStack*/ true);
  m.players.P1.board.front = [unit("A", "front", 1, 10)];
  m.players.P2.board.front = [unit("D", "front", 1, 10)];
  const p2NexusBefore = m.players.P2.nexusHealth;
  let r = apply(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "A", defenderInstanceId: "D" });
  // P2 (priority first) passes, handing priority to the attacker P1.
  r = apply(r.state, { type: "PASS_RESPONSE", player: "P2" });
  // P1 fast-damages the enemy unit D for 4. There is NO way to target a face — the
  // descriptor only carries a unit instanceId, and DAMAGE_UNIT resolves against the
  // ENEMY board only.
  r = apply(r.state, {
    type: "CAST_RESPONSE",
    player: "P1",
    response: { kind: "EFFECT", effect: { op: "DAMAGE_UNIT", amount: 4 }, targetInstanceId: "D" },
  });
  // Casting handed priority to P2; both now pass to close the window.
  r = apply(r.state, { type: "PASS_RESPONSE", player: "P2" });
  r = apply(r.state, { type: "PASS_RESPONSE", player: "P1" });
  assert(r.state.players.P2.nexusHealth === p2NexusBefore, "no-burn: enemy nexus untouched by a DAMAGE_UNIT response", r.state.players.P2.nexusHealth);
  // D took the 4 unit-damage plus the eventual 1-atk swing = 10 - 4 - 1 = 5.
  assert(hp(r.state, "D") === 5, "no-burn: DAMAGE_UNIT hit the enemy UNIT (10 - 4 - 1 = 5)", hp(r.state, "D"));
}

// === 9. REJECT-SOFT: illegal responses no-op cleanly ==============================
{
  // (a) a response action with NO open window.
  const clean = arena(9, true);
  const r0 = apply(clean, { type: "PASS_RESPONSE", player: "P1" });
  assert(r0.events.some((e) => e.type === "REJECTED" && (e as any).reason === "no-response-window"), "reject-soft: PASS with no window -> 'no-response-window'", r0.events);
  assert(r0.state === clean, "reject-soft: no-response-window left state unchanged (same ref)");

  // Open a window for the rest.
  let m = arena(10, true);
  m.players.P1.board.front = [unit("A", "front", 2, 6)];
  m.players.P2.board.front = [unit("D", "front", 2, 6)];
  const opened = apply(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "A", defenderInstanceId: "D" }).state;

  // (b) wrong priority: P1 tries to act but it's P2's priority.
  const rWrong = apply(opened, { type: "CAST_RESPONSE", player: "P1", response: { kind: "COUNTER" } });
  assert(rWrong.events.some((e) => e.type === "REJECTED" && (e as any).reason === "not-your-priority"), "reject-soft: wrong priority -> 'not-your-priority'", rWrong.events);
  assert(rWrong.state === opened, "reject-soft: not-your-priority left the window intact (same ref)");

  // (c) a NORMAL action while the window is open reject-softs 'response-pending'.
  const rNormal = apply(opened, { type: "END_TURN", player: "P1" });
  assert(rNormal.events.some((e) => e.type === "REJECTED" && (e as any).reason === "response-pending"), "reject-soft: normal action while window open -> 'response-pending'", rNormal.events);
  assert(rNormal.state === opened, "reject-soft: response-pending left the window intact (same ref)");
}

console.log(`\n=== RESPONSE STACK PROOF (opt-in rules.responseStack; LIFO reactive priority) ===`);
if (failed > 0) {
  console.error(`FAILED: ${failed} response-stack check(s) failed.`);
  process.exit(1);
}
console.log("ALL RESPONSE STACK PROOFS PASSED");
