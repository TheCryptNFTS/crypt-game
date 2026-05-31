/**
 * dev:effects — pins the Phase B effect resolver. Each block compiles a REAL
 * ability string with `compileAbility` (so the parser and resolver are proven
 * together, end-to-end) and applies the resulting `EffectSpec` to a live arena
 * via `resolveEffect`, then asserts the live-shape mutation.
 *
 * Covers the seven active ops: DEAL_DAMAGE, HEAL, BUFF_SELF, BUFF_ALLIES,
 * DEBUFF_ENEMY, SUMMON_TOKEN, DRAW. Confirms the two passive combat modifiers
 * (PIERCE_ARMOR / RESTRICT_ATTACK) are intentionally inert in the resolver.
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

function unit(overrides: Partial<UnitInPlay> & { instanceId: string }): UnitInPlay {
  return {
    cardId: "tcg_test",
    lane: "front",
    attack: 1,
    health: 1,
    maxHealth: 1,
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

// Helper: compile and return the first runtime spec (the array excludes no-ops).
function firstSpec(ability: string) {
  const c = compileAbility(ability);
  return { compiled: c, spec: c.specs[0] };
}

// --- DEAL_DAMAGE: Taunt retaliate "deal N damage to the attacker". ------------
{
  const { spec } = firstSpec("Taunt. When this unit takes damage, deal 2 damage to the attacker.");
  const m = arena();
  const tgt = unit({ instanceId: "victim", health: 5, maxHealth: 5, armor: 3 });
  m.players.P2.board.front = [tgt];
  check("DEAL_DAMAGE compiled to op", spec?.op === "DEAL_DAMAGE", spec);
  resolveEffect(spec, ctx(m, "P1", { target: tgt }));
  // Ability damage is DIRECT — armor is ignored (5 - 2 = 3, armor 3 not applied).
  check("DEAL_DAMAGE ignores armor (5 -> 3)", tgt.health === 3, tgt.health);
}

// --- HEAL: colon-trigger "On play: heal 3." -----------------------------------
{
  const { spec } = firstSpec("On play: heal 3 health.");
  const m = arena();
  const wounded = unit({ instanceId: "hurt", health: 2, maxHealth: 8 });
  m.players.P1.board.front = [wounded];
  check("HEAL compiled to op", spec?.op === "HEAL", spec);
  resolveEffect(spec, ctx(m, "P1", { target: wounded }));
  check("HEAL restores 3 (2 -> 5)", wounded.health === 5, wounded.health);

  // Heal is capped at maxHealth.
  const full = unit({ instanceId: "near", health: 7, maxHealth: 8 });
  resolveEffect(spec, ctx(m, "P1", { target: full }));
  check("HEAL caps at maxHealth (7 + 3 -> 8)", full.health === 8, full.health);
}

// --- BUFF_SELF: Taunt rider "When takes damage, gain +1/+1." (FIXED buff). -----
// NOTE: the per-point scaling variant ("...gain +1/+1 for each damage taken.")
// now compiles to BUFF_PER_DAMAGE_TAKEN (Track A2), not a flat BUFF_SELF, and is
// proven in dev:track-a2. This block uses the non-scaling phrasing, which is the
// canonical fixed BUFF_SELF on ON_DAMAGE.
{
  const { spec } = firstSpec("Taunt. When this unit takes damage, gain +1/+1.");
  const m = arena();
  const self = unit({ instanceId: "grow", attack: 2, health: 4, maxHealth: 4 });
  m.players.P1.board.front = [self];
  check("BUFF_SELF compiled to op", spec?.op === "BUFF_SELF", spec);
  resolveEffect(spec, ctx(m, "P1", { source: self }));
  check("BUFF_SELF +1/+1 (atk 2->3, hp 4->5, max 4->5)",
    self.attack === 3 && self.health === 5 && self.maxHealth === 5, self);
}

// --- BUFF_ALLIES: Rally "Other allies gain +1 attack when this attacks". ------
{
  const { spec } = firstSpec("Rally. Other allies gain +1 attack when this attacks.");
  const m = arena();
  const leader = unit({ instanceId: "leader", attack: 3, health: 3, maxHealth: 3 });
  const ally1 = unit({ instanceId: "a1", attack: 2, health: 2, maxHealth: 2 });
  const ally2 = unit({ instanceId: "a2", attack: 1, health: 1, maxHealth: 1, lane: "back" });
  m.players.P1.board.front = [leader, ally1];
  m.players.P1.board.back = [ally2];
  check("BUFF_ALLIES compiled to op", spec?.op === "BUFF_ALLIES", spec);
  resolveEffect(spec, ctx(m, "P1", { source: leader }));
  check("BUFF_ALLIES buffs OTHER allies only (leader unchanged)", leader.attack === 3, leader.attack);
  check("BUFF_ALLIES hits front+back allies (a1 2->3, a2 1->2)",
    ally1.attack === 3 && ally2.attack === 2, { a1: ally1.attack, a2: ally2.attack });
}

// --- DEBUFF_ENEMY: Decay "reduce the target's attack by 1". -------------------
{
  const { spec } = firstSpec("Decay. The struck enemy loses 2 attack.");
  const m = arena();
  const enemy = unit({ instanceId: "foe", attack: 1, health: 5, maxHealth: 5 });
  m.players.P2.board.front = [enemy];
  check("DEBUFF_ENEMY compiled to op", spec?.op === "DEBUFF_ENEMY", spec);
  resolveEffect(spec, ctx(m, "P1", { target: enemy }));
  check("DEBUFF_ENEMY floors attack at 0 (1 - 2 -> 0)", enemy.attack === 0, enemy.attack);
}

// --- SUMMON_TOKEN: "Summon. Create a 1/1 Revenant token." ---------------------
{
  const { spec } = firstSpec("Summon. Create a 1/1 Revenant token.");
  const m = arena();
  const summoner = unit({ instanceId: "necro", lane: "back" });
  m.players.P1.board.back = [summoner];
  const idBefore = m.idCounter;
  check("SUMMON_TOKEN compiled to op", spec?.op === "SUMMON_TOKEN", spec);
  resolveEffect(spec, ctx(m, "P1", { source: summoner }));
  const token = m.players.P1.board.back.find((u) => u.instanceId !== "necro");
  check("SUMMON_TOKEN mints a 1/1 in the source's lane", !!token && token.attack === 1 && token.health === 1 && token.lane === "back", token);
  check("SUMMON_TOKEN advances idCounter (deterministic id)", m.idCounter === idBefore + 1 && token?.instanceId === `unit_${m.seed}_${idBefore}`, { idCounter: m.idCounter, id: token?.instanceId });
  check("SUMMON_TOKEN can act this turn (no summoning sickness)", token?.exhausted === false, token);
}

// --- DRAW: Taunt rider "gain 2 life and draw a card". -------------------------
{
  const { compiled } = firstSpec("Taunt. When this unit takes damage, gain 2 life and draw a card.");
  const drawSpec = compiled.specs.find((s) => s.op === "DRAW");
  const m = arena();
  m.players.P1.deck = ["card_a", "card_b", "card_c"];
  m.players.P1.deckCount = 3;
  m.players.P1.hand = [];
  check("DRAW present in compiled specs", !!drawSpec, compiled.specs.map((s) => s.op));
  if (drawSpec) resolveEffect(drawSpec, ctx(m, "P1"));
  check("DRAW moves 1 card deck->hand (deck 3->2, hand 0->1)",
    m.players.P1.hand.length === 1 && m.players.P1.deck.length === 2, { hand: m.players.P1.hand, deck: m.players.P1.deck });

  // DRAW never overdraws an empty deck.
  const m2 = arena();
  m2.players.P1.deck = [];
  m2.players.P1.deckCount = 0;
  m2.players.P1.hand = [];
  if (drawSpec) resolveEffect(drawSpec, ctx(m2, "P1"));
  check("DRAW on empty deck is a safe no-op", m2.players.P1.hand.length === 0, m2.players.P1.hand);
}

// --- PASSIVE modifiers are inert in the resolver (resolved at combat time). ---
{
  const judgment = firstSpec("Judgment. Strike ignores enemy armor.").spec;
  const fear = firstSpec("Fear. Enemy units 2 cost or less cannot attack this.").spec;
  const m = arena();
  const before = JSON.stringify(m.players);
  if (judgment) resolveEffect(judgment, ctx(m, "P1"));
  if (fear) resolveEffect(fear, ctx(m, "P1"));
  check("PIERCE_ARMOR is classified but inert in resolver", judgment?.op === "PIERCE_ARMOR", judgment);
  check("RESTRICT_ATTACK is classified but inert in resolver", fear?.op === "RESTRICT_ATTACK", fear);
  check("passive ops mutate nothing", JSON.stringify(m.players) === before);
}

// --- resolveSpecs fans a whole ability through in order. ----------------------
{
  const compiled = compileAbility("Taunt. When this unit takes damage, gain 2 life and draw a card.");
  const m = arena();
  m.players.P1.deck = ["x", "y"];
  m.players.P1.hand = [];
  const self = unit({ instanceId: "multi", attack: 1, health: 5, maxHealth: 5 });
  m.players.P1.board.front = [self];
  resolveSpecs(compiled.specs, ctx(m, "P1", { source: self, target: self }));
  check("resolveSpecs applies every runtime spec (drew a card)", m.players.P1.hand.length === 1, m.players.P1.hand);
}

console.log(`\n=== EFFECT RESOLVER PROOF (Phase B: 7 active ops) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} effect-resolver check(s) failed.`);
  process.exit(1);
}
console.log("ALL EFFECT RESOLVER PROOFS PASSED");
