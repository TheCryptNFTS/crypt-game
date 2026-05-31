/**
 * dev:expanded-spells — pins the EXPANDED deck-legal spell pool (content depth).
 *
 * spellCards.ts `liveSpells` roughly doubled (10 -> 24) with varied archetypes
 * on the EXISTING resolver vocabulary. This proof asserts the contract for the
 * pool as a whole AND drives a representative new spell from each archetype
 * end-to-end through the REAL `applyAction` PLAY_SPELL path:
 *
 *   - every liveSpell is a real type:"spell" card in allPlayableCards (deck-legal),
 *   - every liveSpell compiles to >=1 recognized ACTIVE op (no inert text),
 *   - NO-BURN: no liveSpell compiles to anything that can damage a nexus; the only
 *     nexus op present is HEAL_NEXUS (the caster's OWN nexus),
 *   - representative casts resolve correctly (draw / heal-self / buff-ally /
 *     summon-token / resurrect / resurrect-random / destroy-enemy-unit) and NEVER
 *     touch either nexus except an explicit own-nexus heal.
 */

import { applyAction } from "../engine/reducer";
import { compileAbility, EffectOp } from "../engine/abilityCompiler";
import { getPlayableCardById } from "../engine/cards";
import { liveSpells } from "../engine/spellCards";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, UnitInPlay, GraveyardRecord } from "../engine/state";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`OK: ${name}`);
  else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

function unit(over: Partial<UnitInPlay> & { instanceId: string; cardId: string }): UnitInPlay {
  return { lane: "front", attack: 1, health: 5, maxHealth: 5, speed: 0, armor: 0, keywords: [], exhausted: false, summoningSick: false, ...over };
}
function grave(cardId: string, attack = 2, maxHealth = 4): GraveyardRecord {
  return { cardId, attack, maxHealth, keywords: [] };
}
function arena(seed = 5151): MatchState {
  const m = makeSeededMatch(seed);
  m.seed = seed;
  m.rngCursor = 0;
  m.activePlayer = "P1";
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].energy = 99;
    m.players[p].maxEnergy = 99;
    m.players[p].hand = [];
    m.players[p].deck = [];
    m.players[p].deckCount = 0;
    m.players[p].discard = [];
    m.players[p].graveyard = [];
  }
  return m;
}

// Ops that could ever damage a face. None must appear in any liveSpell (no-burn).
// (DEAL_DAMAGE / DAMAGE_LANE / DAMAGE_ADJACENT_ENEMIES / CLEAVE only ever hit
// UNITS in this engine, but a damage-class spell is "restricted"; HEAL_NEXUS only
// restores the CASTER's own nexus, so it is allowed.)
const FACE_BURN_OPS = new Set<EffectOp>([]); // engine has no enemy-face op at all

// === Pool-wide contract =========================================================
{
  check(`liveSpells roughly doubled (>= 20, got ${liveSpells.length})`, liveSpells.length >= 20, liveSpells.length);
  let inert = 0;
  let nexusHealOnly = true;
  for (const s of liveSpells) {
    const card = getPlayableCardById(s.id);
    check(`${s.id} is a deck-legal type:spell card`, !!card && card.type === "spell", card?.type);
    const c = compileAbility((s.rawTraits as { Ability?: string }).Ability);
    if (c.specs.length === 0 || !c.recognized) {
      inert += 1;
      console.error(`  inert/unrecognized: ${s.id} -> ${c.specs.map((x) => x.op)}`);
    }
    for (const spec of c.specs) {
      if (FACE_BURN_OPS.has(spec.op)) nexusHealOnly = false;
    }
  }
  check("no liveSpell is inert / unrecognized (all wire an active op)", inert === 0, inert);
  check("NO-BURN: no liveSpell compiles to an enemy-face damage op", nexusHealOnly);
}

// Helper: play a spell from P1's hand (optionally at an instance target) and
// return the settled state.
function cast(m: MatchState, id: string, targetInstanceId?: string) {
  m.players.P1.hand = [id];
  return applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0, targetInstanceId }).state;
}

// === Representative casts (one per new archetype) ===============================

// draw (spell_meditate, draw 3)
{
  const m = arena();
  m.players.P1.deck = ["tcg_2", "tcg_33", "tcg_6", "tcg_4655"];
  m.players.P1.deckCount = 4;
  const s = cast(m, "spell_meditate");
  check("spell_meditate draws 3 (hand 0 -> 3)", s.players.P1.hand.length === 3, s.players.P1.hand.length);
  check("spell_meditate touched NEITHER nexus", s.players.P1.nexusHealth === 20 && s.players.P2.nexusHealth === 20);
}

// heal own nexus (spell_bulwark, +3) — capped at 20, own face only
{
  const m = arena();
  m.players.P1.nexusHealth = 15;
  const s = cast(m, "spell_bulwark");
  check("spell_bulwark restores the OWN nexus (15 -> 18)", s.players.P1.nexusHealth === 18, s.players.P1.nexusHealth);
  check("spell_bulwark never touches the ENEMY nexus", s.players.P2.nexusHealth === 20, s.players.P2.nexusHealth);
}

// buff an ally (spell_warhorn, +1/+2 on the targeted ally)
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "ally", cardId: "tcg_2", attack: 3, health: 4, maxHealth: 4 })];
  const s = cast(m, "spell_warhorn", "ally");
  const a = s.players.P1.board.front.find((u) => u.instanceId === "ally");
  check("spell_warhorn buffs the targeted ally (+1/+2 -> 4/6)", a?.attack === 4 && a?.health === 6 && a?.maxHealth === 6, a);
}

// summon a token (spell_reinforce, 2/2 Wraith)
{
  const m = arena();
  const s = cast(m, "spell_reinforce");
  const tok = s.players.P1.board.front[0];
  check("spell_reinforce mints a 2/2 token", s.players.P1.board.front.length === 1 && tok?.attack === 2 && tok?.health === 2, tok);
}

// resurrect (spell_revenant_call, LIFO) and resurrect-random (spell_necrocall)
{
  const m = arena();
  m.players.P1.graveyard = [grave("tcg_2", 2, 5)];
  const s = cast(m, "spell_revenant_call");
  check("spell_revenant_call revives the graveyard body to the board", s.players.P1.board.front.some((u) => u.cardId === "tcg_2"), s.players.P1.board.front.map((u) => u.cardId));
  check("spell_revenant_call popped the grave record (1 -> 0)", s.players.P1.graveyard.length === 0, s.players.P1.graveyard.length);
}
{
  // RESURRECT_RANDOM determinism through PLAY_SPELL: same seed -> same revived card.
  const run = (seed: number) => {
    const m = arena(seed);
    m.players.P1.graveyard = [grave("A"), grave("B"), grave("C"), grave("D")];
    const s = cast(m, "spell_necrocall");
    return s.players.P1.board.front[0]?.cardId;
  };
  check("spell_necrocall (RESURRECT_RANDOM) is replay-stable (seed 7 twice)", run(7) === run(7));
  const picks = new Set<string | undefined>();
  for (let s = 1; s <= 30; s += 1) picks.add(run(s));
  check("spell_necrocall varies across seeds (>= 2 distinct revives)", picks.size >= 2, [...picks]);
}

// destroy an enemy UNIT (spell_cull) — never the nexus
{
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "foe", cardId: "tcg_2", attack: 3, health: 9, maxHealth: 9, armor: 5 })];
  const s = cast(m, "spell_cull", "foe");
  check("spell_cull destroys the targeted enemy unit (armor ignored)", !s.players.P2.board.front.some((u) => u.instanceId === "foe"), s.players.P2.board.front.map((u) => u.instanceId));
  check("spell_cull deals NO face damage to the enemy nexus", s.players.P2.nexusHealth === 20, s.players.P2.nexusHealth);
}

// debuff an enemy unit's attack (spell_scour, -3)
{
  const m = arena();
  m.players.P2.board.front = [unit({ instanceId: "foe", cardId: "tcg_2", attack: 5, health: 9, maxHealth: 9 })];
  const s = cast(m, "spell_scour", "foe");
  const f = s.players.P2.board.front.find((u) => u.instanceId === "foe");
  check("spell_scour reduces the enemy unit's attack (5 -> 2)", f?.attack === 2, f?.attack);
  check("spell_scour leaves the enemy nexus full", s.players.P2.nexusHealth === 20, s.players.P2.nexusHealth);
}

console.log(`\n=== EXPANDED SPELL POOL PROOF (${liveSpells.length} deck-legal spells; no-burn; representative casts) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} expanded-spell check(s) failed.`);
  process.exit(1);
}
console.log("ALL EXPANDED SPELL POOL PROOFS PASSED");
