/**
 * dev:expressiveness — pins the three new compiler/resolver capabilities
 * end-to-end:
 *
 *   A) Conditional triggers (`spec.condition`): a gated effect fires when the
 *      predicate is TRUE and cleanly no-ops when it is FALSE.
 *        - ALLY_COUNT_GTE    ("gain +N/+M if you control K or more allies")
 *        - SELF_HEALTH_BELOW  ("gain +N/+M if this unit has K or less health")
 *        - SURVIVED           ("if it survives, gain +N/+M") — ON_DAMAGE gate
 *   B) Generic per-X scaling (`spec.scaleBy`): a BUFF_SELF multiplied by a live
 *      board / hand count (ALLY_COUNT / ENEMY_COUNT / CARDS_IN_HAND).
 *   C) Summon-body cleanup: "summon two N/M X" mints the right count, and
 *      "summon a N/M X with <keyword>" stamps the keyword onto the token.
 *
 * Each block compiles a REAL ability string with `compileAbility` (parser +
 * resolver proven together) and applies the spec(s) to a live arena via
 * `resolveEffect`, then asserts the live-shape mutation. A handful of real
 * catalog cards (found by probing `allPlayableCards`) anchor the summon path.
 */

import { compileAbility } from "../engine/abilityCompiler";
import { resolveEffect, resolveSpecs, EffectContext } from "../engine/effectResolver";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, UnitInPlay, PlayerId } from "../engine/state";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`OK: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

function unit(over: Partial<UnitInPlay> & { instanceId: string }): UnitInPlay {
  return {
    cardId: "tcg_test", // no ability — a clean crafted body
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

function arena(seed = 9200): MatchState {
  const m = makeSeededMatch(seed);
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

// ============================================================================
// A) CONDITIONAL TRIGGERS
// ============================================================================

// --- ALLY_COUNT_GTE: fires when the controller has >= K allies ----------------
{
  const ability = "When this unit is summoned, gain +2/+2 if you control 3 or more allies.";
  const { compiled, spec } = firstSpec(ability);
  check("ALLY_COUNT_GTE compiles to a conditional BUFF_SELF", compiled.recognized && spec?.op === "BUFF_SELF" && spec?.condition?.kind === "ALLY_COUNT_GTE" && spec?.condition?.value === 3, spec);

  // TRUE branch: 3 allies on board -> buff applies.
  {
    const m = arena();
    const self = unit({ instanceId: "self", attack: 2, health: 4, maxHealth: 4 });
    m.players.P1.board.front = [self, unit({ instanceId: "a2" }), unit({ instanceId: "a3" })];
    resolveEffect(spec, ctx(m, "P1", { source: self }));
    check("ALLY_COUNT_GTE fires with 3 allies (2/4 -> 4/6)", self.attack === 4 && self.health === 6, self);
  }
  // FALSE branch: only 2 allies -> clean no-op.
  {
    const m = arena();
    const self = unit({ instanceId: "self", attack: 2, health: 4, maxHealth: 4 });
    m.players.P1.board.front = [self, unit({ instanceId: "a2" })];
    resolveEffect(spec, ctx(m, "P1", { source: self }));
    check("ALLY_COUNT_GTE no-ops with only 2 allies (stays 2/4)", self.attack === 2 && self.health === 4, self);
  }
}

// --- SELF_HEALTH_BELOW: fires only while the unit is at/below the threshold ----
{
  const ability = "When this unit is summoned, gain +3/+0 if this unit has 2 or less health.";
  const { compiled, spec } = firstSpec(ability);
  check("SELF_HEALTH_BELOW compiles to a conditional BUFF_SELF", compiled.recognized && spec?.condition?.kind === "SELF_HEALTH_BELOW" && spec?.condition?.value === 2, spec);

  {
    const m = arena();
    const self = unit({ instanceId: "self", attack: 1, health: 2, maxHealth: 6 });
    m.players.P1.board.front = [self];
    resolveEffect(spec, ctx(m, "P1", { source: self }));
    check("SELF_HEALTH_BELOW fires at 2 health (atk 1 -> 4)", self.attack === 4, self);
  }
  {
    const m = arena();
    const self = unit({ instanceId: "self", attack: 1, health: 5, maxHealth: 6 });
    m.players.P1.board.front = [self];
    resolveEffect(spec, ctx(m, "P1", { source: self }));
    check("SELF_HEALTH_BELOW no-ops at 5 health (atk stays 1)", self.attack === 1, self);
  }
}

// --- SURVIVED: an ON_DAMAGE buff that fires only if the source is still alive --
{
  const ability = "When this unit deals damage, Regrow 1. If it survives, gain +1/+1.";
  const { compiled, spec } = firstSpec(ability);
  check("SURVIVED compiles to an ON_DAMAGE BUFF_SELF gated by SURVIVED", compiled.recognized && spec?.trigger === "ON_DAMAGE" && spec?.op === "BUFF_SELF" && spec?.condition?.kind === "SURVIVED", spec);

  {
    const m = arena();
    const self = unit({ instanceId: "self", attack: 3, health: 4, maxHealth: 4 });
    resolveEffect(spec, ctx(m, "P1", { source: self }));
    check("SURVIVED fires when source health > 0 (3/4 -> 4/5)", self.attack === 4 && self.health === 5, self);
  }
  {
    const m = arena();
    const dead = unit({ instanceId: "self", attack: 3, health: 0, maxHealth: 4 });
    resolveEffect(spec, ctx(m, "P1", { source: dead }));
    check("SURVIVED no-ops when source health <= 0 (no buff on a corpse)", dead.attack === 3, dead);
  }
}

// ============================================================================
// B) GENERIC PER-X SCALING
// ============================================================================

// --- ENEMY_COUNT: real card tcg_873 "gains +1/+0 for each enemy unit" ----------
{
  const ability = "Charge. When this unit enters the battlefield, it gains +1/+0 for each enemy unit.";
  const c = compileAbility(ability);
  const spec = c.specs.find((s) => s.op === "BUFF_SELF" && s.scaleBy === "ENEMY_COUNT");
  check("ENEMY_COUNT scaler compiles (scaleBy=ENEMY_COUNT)", !!spec, c.specs);
  if (spec) {
    const m = arena();
    const self = unit({ instanceId: "self", attack: 2, health: 5, maxHealth: 5 });
    m.players.P1.board.front = [self];
    m.players.P2.board.front = [unit({ instanceId: "e1" }), unit({ instanceId: "e2" })];
    m.players.P2.board.back = [unit({ instanceId: "e3" })];
    resolveEffect(spec, ctx(m, "P1", { source: self }));
    check("ENEMY_COUNT multiplies +1/+0 by 3 enemies (atk 2 -> 5)", self.attack === 5 && self.health === 5, self);
  }
}

// --- ALLY_COUNT: "+1/+1 for each ally" multiplies by the controller's board ----
{
  const ability = "When this unit is summoned, gain +1/+1 for each ally.";
  const c = compileAbility(ability);
  const spec = c.specs.find((s) => s.op === "BUFF_SELF" && s.scaleBy === "ALLY_COUNT");
  check("ALLY_COUNT scaler compiles (scaleBy=ALLY_COUNT)", !!spec, c.specs);
  if (spec) {
    const m = arena();
    const self = unit({ instanceId: "self", attack: 1, health: 3, maxHealth: 3 });
    // 3 allies total (incl. self) -> +3/+3.
    m.players.P1.board.front = [self, unit({ instanceId: "a2" }), unit({ instanceId: "a3" })];
    resolveEffect(spec, ctx(m, "P1", { source: self }));
    check("ALLY_COUNT multiplies +1/+1 by 3 allies (1/3 -> 4/6)", self.attack === 4 && self.health === 6, self);
  }
}

// --- CARDS_IN_HAND: "+1/+1 for each card in your hand" -------------------------
{
  const ability = "When this unit is summoned, gain +1/+1 for each card in your hand.";
  const c = compileAbility(ability);
  const spec = c.specs.find((s) => s.op === "BUFF_SELF" && s.scaleBy === "CARDS_IN_HAND");
  check("CARDS_IN_HAND scaler compiles (scaleBy=CARDS_IN_HAND)", !!spec, c.specs);
  if (spec) {
    const m = arena();
    const self = unit({ instanceId: "self", attack: 0, health: 2, maxHealth: 2 });
    m.players.P1.board.front = [self];
    m.players.P1.hand = ["tcg_test", "tcg_test"]; // 2 cards
    resolveEffect(spec, ctx(m, "P1", { source: self }));
    check("CARDS_IN_HAND multiplies +1/+1 by 2 cards (0/2 -> 2/4)", self.attack === 2 && self.health === 4, self);
  }
}

// ============================================================================
// C) SUMMON-BODY CLEANUP
// ============================================================================

// --- multi-summon: real card tcg_2967 "summon two 2/2 Tentacles with Guard" ----
{
  const ability = "Guard, Trample. On play: summon two 2/2 Tentacles with Guard adjacent.";
  const c = compileAbility(ability);
  const spec = c.specs.find((s) => s.op === "SUMMON_TOKEN");
  check("multi-summon compiles with count=2 and tokenKeyword=GUARD", spec?.count === 2 && spec?.tokenKeyword === "GUARD", spec);
  if (spec) {
    const m = arena();
    const src = unit({ instanceId: "src" });
    m.players.P1.board.front = [src];
    resolveEffect(spec, ctx(m, "P1", { source: src, lane: "front" }));
    const tokens = m.players.P1.board.front.filter((u) => u.cardId === "token_tentacles");
    check("multi-summon mints exactly 2 tokens (2/2 each)", tokens.length === 2 && tokens.every((t) => t.attack === 2 && t.maxHealth === 2), tokens);
    check("multi-summon tokens carry the GUARD keyword", tokens.every((t) => (t.keywords ?? []).includes("GUARD")), tokens.map((t) => t.keywords));
  }
}

// --- token-with-keyword: real card tcg_2949 "summon a 6/6 ... with Flying" ------
{
  const ability = "Scry-3. On play: summon a 6/6 Skeleton Dragon with Flying adjacent.";
  const c = compileAbility(ability);
  const spec = c.specs.find((s) => s.op === "SUMMON_TOKEN");
  check("token-with-keyword compiles (6/6, tokenKeyword=FLYING, count defaults 1)", spec?.attack === 6 && spec?.health === 6 && spec?.tokenKeyword === "FLYING" && (spec?.count ?? 1) === 1, spec);
  if (spec) {
    const m = arena();
    const src = unit({ instanceId: "src" });
    m.players.P1.board.front = [src];
    resolveEffect(spec, ctx(m, "P1", { source: src, lane: "front" }));
    const tok = m.players.P1.board.front.find((u) => u.cardId === "token_skeleton_dragon");
    check("token-with-keyword mints one 6/6 with FLYING", !!tok && tok.attack === 6 && (tok.keywords ?? []).includes("FLYING"), tok);
  }
}

// --- on-death summon-with-keyword: real card tcg_209 "summon a 1/1 ... Taunt" ---
{
  const ability = "When this unit dies, summon a 1/1 stonechild with Taunt.";
  const c = compileAbility(ability);
  const spec = c.specs.find((s) => s.op === "SUMMON_TOKEN" && s.trigger === "ON_DEATH");
  check("on-death summon compiles with tokenKeyword=TAUNT", spec?.tokenKeyword === "TAUNT", spec);
  if (spec) {
    const m = arena();
    const src = unit({ instanceId: "src" });
    m.players.P1.board.front = [src];
    resolveSpecs([spec], ctx(m, "P1", { source: src, lane: "front" }));
    const tok = m.players.P1.board.front.find((u) => u.cardId === "token_stonechild");
    check("on-death summon mints a 1/1 Taunt token", !!tok && (tok.keywords ?? []).includes("TAUNT"), tok);
  }
}

console.log(`\n=== EXPRESSIVENESS PROOF (conditions + generic scaling + summon-body) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} expressiveness check(s) failed.`);
  process.exit(1);
}
console.log("ALL EXPRESSIVENESS PROOFS PASSED");
