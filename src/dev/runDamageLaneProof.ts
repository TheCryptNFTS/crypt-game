/**
 * dev:damage-lane (#11) — make LANE PLACEMENT mechanically meaningful.
 *
 * Adds the DAMAGE_LANE effect op: an on-summon battlecry that sweeps every enemy
 * unit in ONE enemy lane. The default "densest" target hits whichever enemy lane
 * holds the most units (ties -> front), so CLUSTERING bodies in a single lane is
 * now punishable — the front/back placement decision finally carries a real
 * trade-off. This proof drives the ability END-TO-END (compile -> resolve):
 *
 *   - the natural-language text compiles to a single DAMAGE_LANE spec,
 *   - "densest" sweeps the fuller enemy lane and LEAVES the other lane untouched,
 *   - "front"/"back" name a fixed lane,
 *   - it hits ENEMY units only and NEVER the nexus (locked no-burn constraint),
 *   - an empty enemy board is a clean no-op.
 */

import { compileAbility } from "../engine/abilityCompiler";
import { resolveEffect, EffectContext } from "../engine/effectResolver";
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

function unit(overrides: Partial<UnitInPlay> & { instanceId: string }): UnitInPlay {
  return {
    cardId: "tcg_test",
    lane: "front",
    attack: 1,
    health: 5,
    maxHealth: 5,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: false,
    summoningSick: false,
    ...overrides,
  };
}

function arena(): MatchState {
  const m = makeSeededMatch(4242);
  m.activePlayer = "P1";
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].hand = [];
  }
  return m;
}

function ctx(m: MatchState, controller: PlayerId, extra: Partial<EffectContext> = {}): EffectContext {
  return { state: m, controller, ...extra };
}

function firstSpec(ability: string) {
  const c = compileAbility(ability);
  return { compiled: c, spec: c.specs[0] };
}

function makeLane(prefix: string, lane: Lane, n: number): UnitInPlay[] {
  return Array.from({ length: n }, (_, i) =>
    unit({ instanceId: `${prefix}_${i}`, lane, health: 5, maxHealth: 5 })
  );
}

// --- Compile: natural text -> a single DAMAGE_LANE spec ----------------------
{
  const { compiled, spec } = firstSpec(
    "On play: deal 3 damage to every enemy unit in a lane."
  );
  assert(spec?.op === "DAMAGE_LANE", "text compiles to DAMAGE_LANE", spec?.op);
  assert(spec?.amount === 3, "DAMAGE_LANE carries amount 3", spec?.amount);
  assert(spec?.targetLane === "densest", "default targetLane is 'densest'", spec?.targetLane);
  assert(compiled.recognized, "ability fully recognized (no UNKNOWN)", compiled.classified.map((s) => s.op));
}

// --- "lane" wins over the generic "all enemies" adjacency splash -------------
{
  const { spec } = firstSpec(
    "On play: deal 2 damage to all enemy units in a lane."
  );
  assert(spec?.op === "DAMAGE_LANE", "'all enemies in a lane' routes to DAMAGE_LANE, not adjacency", spec?.op);
}

// --- densest: sweep the fuller enemy lane, leave the other lane untouched ----
{
  const { spec } = firstSpec("On play: deal 3 damage to every enemy unit in a lane.");
  const m = arena();
  m.players.P2.board.front = makeLane("f", "front", 1); // sparse
  m.players.P2.board.back = makeLane("b", "back", 3); // densest
  resolveEffect(spec, ctx(m, "P1"));
  assert(
    m.players.P2.board.back.every((u) => u.health === 2),
    "densest (back, 3 units) all took 3 (5 -> 2)",
    m.players.P2.board.back.map((u) => u.health)
  );
  assert(
    m.players.P2.board.front.every((u) => u.health === 5),
    "the sparse front lane is untouched",
    m.players.P2.board.front.map((u) => u.health)
  );
  assert(m.players.P2.nexusHealth === 20, "enemy nexus untouched (no-burn)");
}

// --- densest ties break to FRONT (determinism) ------------------------------
{
  const { spec } = firstSpec("On play: deal 1 damage to every enemy unit in a lane.");
  const m = arena();
  m.players.P2.board.front = makeLane("f", "front", 2);
  m.players.P2.board.back = makeLane("b", "back", 2);
  resolveEffect(spec, ctx(m, "P1"));
  assert(
    m.players.P2.board.front.every((u) => u.health === 4),
    "tie -> FRONT lane is swept",
    m.players.P2.board.front.map((u) => u.health)
  );
  assert(
    m.players.P2.board.back.every((u) => u.health === 5),
    "tie -> back lane untouched",
    m.players.P2.board.back.map((u) => u.health)
  );
}

// --- named front/back lanes -------------------------------------------------
{
  const { spec } = firstSpec("On play: deal 2 damage to every enemy unit in the back lane.");
  assert(spec?.targetLane === "back", "'back lane' compiles to targetLane back", spec?.targetLane);
  const m = arena();
  m.players.P2.board.front = makeLane("f", "front", 3); // densest, but NOT targeted
  m.players.P2.board.back = makeLane("b", "back", 1);
  resolveEffect(spec, ctx(m, "P1"));
  assert(m.players.P2.board.back[0].health === 3, "named back lane is swept regardless of density", m.players.P2.board.back[0].health);
  assert(
    m.players.P2.board.front.every((u) => u.health === 5),
    "denser front lane spared when 'back' is named",
    m.players.P2.board.front.map((u) => u.health)
  );
}

// --- friendly fire guard: the controller's OWN units are never hit ----------
{
  const { spec } = firstSpec("On play: deal 9 damage to every enemy unit in a lane.");
  const m = arena();
  m.players.P1.board.front = makeLane("ally", "front", 3); // controller's own
  m.players.P2.board.front = makeLane("foe", "front", 1);
  resolveEffect(spec, ctx(m, "P1"));
  assert(
    m.players.P1.board.front.every((u) => u.health === 5),
    "controller's own units never take DAMAGE_LANE",
    m.players.P1.board.front.map((u) => u.health)
  );
  assert(m.players.P2.board.front[0].health <= 0, "the enemy unit is hit", m.players.P2.board.front[0].health);
}

// --- empty enemy board is a clean no-op -------------------------------------
{
  const { spec } = firstSpec("On play: deal 5 damage to every enemy unit in a lane.");
  const m = arena();
  // both enemy lanes empty
  resolveEffect(spec, ctx(m, "P1"));
  assert(m.players.P2.nexusHealth === 20, "empty enemy board: nexus untouched (no-burn no-op)");
}

if (failed > 0) {
  console.error(`\nDAMAGE_LANE PROOF FAILED: ${failed} assertion(s).`);
  process.exit(1);
}
console.log("\nALL DAMAGE_LANE PROOFS PASSED");
