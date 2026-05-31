/**
 * dev:secret (#2) — two-sided interactivity via deterministic SECRETS / TRAPS.
 *
 * The engine is no-stack / no-priority and that is LOCKED (RESOLUTION_MODEL.md §1:
 * "no responses/counterspells"; §8: the choice pause is the ONLY pause and must
 * not be generalized into a stack). So interactivity is added WITHOUT a response
 * window: a player arms a face-down SECRET on their turn that fires AUTOMATICALLY
 * the instant the opponent declares a matching action. No live decision, no pause,
 * no priority pass — a pre-committed, deterministic reaction. The attacker now has
 * to play around the threat of an armed secret, which is the interaction #2 wanted.
 *
 * This proof drives the mechanism through the REAL combat path (applyAction /
 * ATTACK_UNIT):
 *   - a Counterstrike secret fires on an enemy attack and damages the ATTACKER,
 *   - a big enough secret FIZZLES the attack (attacker dies before it strikes),
 *   - secrets are ONE-SHOT (consumed on fire),
 *   - the secret hits the enemy UNIT only — never the face (no-burn),
 *   - a match with NO armed secret is byte-identical (no SECRET_FIRED, normal combat),
 *   - the whole thing is deterministic.
 */

import { applyAction, Action } from "../engine/reducer";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, UnitInPlay, PlayerId, ArmedSecret } from "../engine/state";

let failed = 0;
function assert(cond: boolean, msg: string, detail?: unknown): void {
  if (cond) {
    console.log(`OK: ${msg}`);
  } else {
    console.error(`FAIL: ${msg}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
    failed += 1;
  }
}

function unit(instanceId: string, owner: PlayerId, health: number): UnitInPlay {
  return {
    cardId: "tcg_test",
    instanceId,
    lane: "front",
    attack: 2,
    health,
    maxHealth: health,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: false,
    summoningSick: false,
  } as UnitInPlay;
}

function arena(seed = 55): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.turn = 2;
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].hand = [];
    m.players[p].secrets = undefined;
  }
  return m;
}

function counterstrike(id: string, amount: number): ArmedSecret {
  return { id, trigger: "ON_ENEMY_ATTACK", op: "DEAL_DAMAGE", amount, name: "Counterstrike" };
}

function attack(m: MatchState, attackerId: string, defenderId: string): { state: MatchState; events: any[] } {
  const action: Action = {
    type: "ATTACK_UNIT",
    player: "P1",
    attackerInstanceId: attackerId,
    defenderInstanceId: defenderId,
  } as Action;
  return applyAction(m, action) as any;
}

// --- a big secret FIZZLES the attack (attacker dies before it strikes) -------
{
  let m = arena();
  m.players.P1.board.front = [unit("atk", "P1", 3)]; // 3 HP attacker
  m.players.P2.board.front = [unit("def", "P2", 6)]; // 6 HP defender
  m.players.P2.secrets = [counterstrike("s1", 5)]; // 5 > 3 -> kills attacker

  const { state, events } = attack(m, "atk", "def");
  const atkAlive = state.players.P1.board.front.some((u) => u.instanceId === "atk");
  assert(!atkAlive, "fizzle: the attacker is destroyed by the secret before striking");
  assert(state.players.P2.board.front[0]?.health === 6, "fizzle: defender took NO combat damage (attack fizzled)", state.players.P2.board.front[0]?.health);
  assert(events.some((e) => e.type === "SECRET_FIRED" && e.secretIds.includes("s1")), "fizzle: a SECRET_FIRED event was emitted", events.map((e) => e.type));
  assert((state.players.P2.secrets ?? []).length === 0, "fizzle: the secret is consumed (one-shot)", state.players.P2.secrets);
  assert(state.players.P1.nexusHealth === 20, "fizzle: the secret never touched the enemy face (no-burn)");
}

// --- a small secret damages the attacker but combat still proceeds -----------
{
  let m = arena();
  m.players.P1.board.front = [unit("atk", "P1", 5)]; // survives a 2-dmg secret
  m.players.P2.board.front = [unit("def", "P2", 6)];
  m.players.P2.secrets = [counterstrike("s1", 2)];

  const { state, events } = attack(m, "atk", "def");
  const atk = state.players.P1.board.front.find((u) => u.instanceId === "atk");
  assert(!!atk && atk.health === 1, "survive: attacker took the secret's 2 (5 -> 3) then 2 counter from combat (-> 1)", atk?.health);
  assert(state.players.P2.board.front[0]?.health === 4, "survive: combat still landed on the defender (6 -> 4)", state.players.P2.board.front[0]?.health);
  assert(events.some((e) => e.type === "SECRET_FIRED"), "survive: SECRET_FIRED still emitted");
  assert((state.players.P2.secrets ?? []).length === 0, "survive: the secret is still consumed (one-shot)");
}

// --- no armed secret -> byte-identical normal combat, no SECRET_FIRED --------
{
  let m = arena();
  m.players.P1.board.front = [unit("atk", "P1", 5)];
  m.players.P2.board.front = [unit("def", "P2", 6)];
  // no secrets armed
  const { state, events } = attack(m, "atk", "def");
  assert(!events.some((e) => e.type === "SECRET_FIRED"), "vanilla: no SECRET_FIRED event when nothing is armed");
  assert(state.players.P2.board.front[0]?.health === 4, "vanilla: normal combat damage lands (6 -> 4)", state.players.P2.board.front[0]?.health);
  assert(state.players.P2.secrets == null || state.players.P2.secrets.length === 0, "vanilla: no secrets zone materialized");
}

// --- determinism: identical setup -> identical outcome twice -----------------
{
  function run(): unknown {
    let m = arena(123);
    m.players.P1.board.front = [unit("atk", "P1", 4)];
    m.players.P2.board.front = [unit("def", "P2", 6)];
    m.players.P2.secrets = [counterstrike("s1", 3)];
    const { state, events } = attack(m, "atk", "def");
    return {
      atk: state.players.P1.board.front.find((u) => u.instanceId === "atk")?.health ?? null,
      def: state.players.P2.board.front[0]?.health ?? null,
      secrets: state.players.P2.secrets?.length ?? 0,
      fired: events.filter((e) => e.type === "SECRET_FIRED").length,
    };
  }
  assert(JSON.stringify(run()) === JSON.stringify(run()), "secret resolution is deterministic", run());
}

if (failed > 0) {
  console.error(`\nSECRET (interactivity) PROOF FAILED: ${failed} assertion(s).`);
  process.exit(1);
}
console.log("\nALL SECRET (interactivity) PROOFS PASSED");
