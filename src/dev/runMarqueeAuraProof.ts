/**
 * dev:marquee-aura — pins the CONTINUOUS-AURA and LIFECYCLE marquee ops. Auras
 * are "while in play" passives (the source's cardId carries the compiled op), so
 * the SOURCE is a crafted board unit. The TRIGGERED behaviors (cost-reduced play,
 * end-of-turn resurrect, death-watch summon, on-death revive) are driven through
 * the REAL reducer path: PLAY_UNIT / ATTACK_UNIT / END_TURN.
 *
 *   AURA_COST_REDUCTION  (tcg_3370 "King Tomb")  friendly units cost 1 less.
 *   AURA_SPELL_COST      (tcg_2256 "Hokusai")    friendly spells cost 1 less.
 *   AURA_ABILITY_SILENCE (tcg_3350 "Hear/Speak/See No Evil") an enemy unit's
 *                         normal trigger does NOT fire while the silencer is up.
 *   RESURRECT_AS_TOKEN   (tcg_3395 "Skeletor")   end of controller's turn, a
 *                         graveyard unit is raised as a 1/1 token.
 *   SUMMON_ON_ANY_DEATH  (tcg_3380 "Crypt Keeper") ANY unit dies -> controller
 *                         gets a token.
 *   ONCEDEATH_REVIVE     (tcg_3355 "Jean")        dies once -> returns full HP;
 *                         dies again -> actually dies (one-per-match).
 *
 * NOTE / COVERAGE GAP: the shipped corpus contains ZERO type:"spell" cards
 * (only unit / equipment / artifact). The reducer's PLAY_SPELL path rejects a
 * non-spell cardId, so AURA_SPELL_COST cannot be exercised through a real
 * PLAY_SPELL today. It is wired through the SAME `costReductionFor` helper as
 * AURA_COST_REDUCTION (which IS proven behaviorally below), and we pin Hokusai's
 * compiled spec so a regression that drops the op is caught.
 */

import { applyAction } from "../engine/reducer";
import { compileAbility } from "../engine/abilityCompiler";
import { getPlayableCardById } from "../engine/cards";
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

function arena(seed = 9500): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].energy = 99;
    m.players[p].maxEnergy = 99;
    m.players[p].hand = [];
    m.players[p].discard = [];
    m.players[p].graveyard = [];
  }
  return m;
}

// --- AURA_COST_REDUCTION (King Tomb): the controller's OTHER units cost 1 less.
// tcg_2 is a real cost-2 unit; baseline spend is 2, with King Tomb it is 1, and
// when the source leaves the board the discount is gone. -------------------------
{
  // baseline: no King Tomb -> full cost 2 spent.
  const base = arena();
  base.players.P1.hand = ["tcg_2"];
  const eBefore = base.players.P1.energy;
  const rBase = applyAction(base, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  check("AURA_COST_REDUCTION baseline: cost-2 unit spends 2 with no source", eBefore - (rBase.state.players.P1.energy ?? 0) === 2, eBefore - (rBase.state.players.P1.energy ?? 0));

  // with King Tomb on board -> cost-2 unit spends only 1.
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "kt", cardId: "tcg_3370", attack: 6, health: 12, maxHealth: 12, keywords: ["GUARD"] })];
  m.players.P1.hand = ["tcg_2"];
  const before = m.players.P1.energy;
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  check("AURA_COST_REDUCTION: King Tomb makes a cost-2 unit spend only 1", before - (r.state.players.P1.energy ?? 0) === 1, before - (r.state.players.P1.energy ?? 0));

  // source removed -> discount gone (spend back to full 2).
  const m2 = arena();
  m2.players.P1.hand = ["tcg_2"]; // no King Tomb on board
  const before2 = m2.players.P1.energy;
  const r2 = applyAction(m2, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  check("AURA_COST_REDUCTION drops cleanly when the source is absent (spend 2)", before2 - (r2.state.players.P1.energy ?? 0) === 2, before2 - (r2.state.players.P1.energy ?? 0));
}

// --- AURA_SPELL_COST (Hokusai): no spell cards exist in the corpus (see header).
// Pin the compiled spec so a regression that drops the op is caught, and assert
// the op shares the AURA_*_COST contract (PASSIVE, amount 1). ---------------------
{
  const meta: any = getPlayableCardById("tcg_2256");
  const compiled = compileAbility(meta?.rawTraits?.Ability ?? "");
  const spell = compiled.specs.find((s: any) => s.op === "AURA_SPELL_COST");
  check("AURA_SPELL_COST: Hokusai compiles to a PASSIVE AURA_SPELL_COST amount 1", !!spell && spell.trigger === "PASSIVE" && spell.amount === 1, spell);
  check("AURA_SPELL_COST: corpus has zero spell cards, so PLAY_SPELL is unreachable (documented gap)", getPlayableCardById("tcg_2256")?.type === "unit", { note: "no type=spell card exists to drive PLAY_SPELL" });
}

// --- AURA_ABILITY_SILENCE: a silenced enemy unit's normal trigger does NOT fire.
// P2's Decay attacker (tcg_52, ON_ATTACK DEBUFF_ENEMY -1) strikes a P1 victim.
// With a P1 silencer (tcg_3350) up, the debuff is suppressed; without it, it lands.
{
  const m = arena();
  m.activePlayer = "P2";
  m.players.P2.board.front = [unit({ instanceId: "decay", cardId: "tcg_52", attack: 4, health: 8, maxHealth: 8 })];
  m.players.P1.board.front = [
    unit({ instanceId: "sil", cardId: "tcg_3350", attack: 3, health: 12, maxHealth: 12, keywords: ["GUARD"] }),
    unit({ instanceId: "vic", cardId: "tcg_test", attack: 2, health: 20, maxHealth: 20 }),
  ];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "decay", defenderInstanceId: "vic" });
  const vic = r.state.players.P1.board.front.find((u) => u.instanceId === "vic");
  check("AURA_ABILITY_SILENCE: silenced Decay attacker's DEBUFF does NOT fire (victim atk stays 2)", vic?.attack === 2, vic?.attack);

  // control: same combat WITHOUT the silencer -> the DEBUFF fires (atk 2 -> 1).
  const m2 = arena();
  m2.activePlayer = "P2";
  m2.players.P2.board.front = [unit({ instanceId: "decay", cardId: "tcg_52", attack: 4, health: 8, maxHealth: 8 })];
  m2.players.P1.board.front = [unit({ instanceId: "vic", cardId: "tcg_test", attack: 2, health: 20, maxHealth: 20 })];
  const r2 = applyAction(m2, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "decay", defenderInstanceId: "vic" });
  const vic2 = r2.state.players.P1.board.front.find((u) => u.instanceId === "vic");
  check("AURA_ABILITY_SILENCE control: WITHOUT a silencer the DEBUFF fires (victim atk 2 -> 1)", vic2?.attack === 1, vic2?.attack);
}

// --- RESURRECT_AS_TOKEN (Skeletor): at end of the controller's turn, a graveyard
// unit is raised as a 1/1 token. Driven via real PLAY_UNIT + END_TURN. -----------
{
  const m = arena();
  m.players.P1.graveyard = [{ cardId: "tcg_19", attack: 3, maxHealth: 4, keywords: [] }];
  m.players.P1.hand = ["tcg_3395"];
  const rPlay = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  check("RESURRECT_AS_TOKEN: playing Skeletor does NOT raise yet (grave still 1)", rPlay.state.players.P1.graveyard.length === 1, rPlay.state.players.P1.graveyard);

  const r = applyAction(rPlay.state, { type: "END_TURN", player: "P1" });
  const board = r.state.players.P1.board.front;
  const token = board.find((u) => u.cardId.startsWith("token_"));
  check("RESURRECT_AS_TOKEN: end of turn raises a 1/1 token from the graveyard", !!token && token.attack === 1 && token.health === 1 && token.maxHealth === 1, token);
  check("RESURRECT_AS_TOKEN: the graveyard record is consumed (now empty)", r.state.players.P1.graveyard.length === 0, r.state.players.P1.graveyard);

  // guard: empty graveyard -> end of turn raises NOTHING.
  const m2 = arena();
  m2.players.P1.board.front = [unit({ instanceId: "sk", cardId: "tcg_3395", attack: 6, health: 7, maxHealth: 7 })];
  m2.players.P1.graveyard = [];
  const r2 = applyAction(m2, { type: "END_TURN", player: "P1" });
  check("RESURRECT_AS_TOKEN with empty grave is a clean no-op (no token raised)", !r2.state.players.P1.board.front.some((u) => u.cardId.startsWith("token_")), r2.state.players.P1.board.front.map((u) => u.cardId));
}

// --- SUMMON_ON_ANY_DEATH (Crypt Keeper): when ANY unit dies, the controller gets
// a token. P1 fields Crypt Keeper + an executioner; a P2 enemy dies in combat. ----
{
  const m = arena();
  m.players.P1.board.front = [
    unit({ instanceId: "ck", cardId: "tcg_3380", attack: 6, health: 8, maxHealth: 8 }),
    unit({ instanceId: "exec", cardId: "tcg_test", attack: 10, health: 10, maxHealth: 10 }),
  ];
  m.players.P2.board.front = [unit({ instanceId: "v", cardId: "tcg_19", attack: 1, health: 1, maxHealth: 1 })];
  const p1Before = m.players.P1.board.front.length;
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "exec", defenderInstanceId: "v" });
  const tokens = r.state.players.P1.board.front.filter((u) => u.cardId.startsWith("token_"));
  check("SUMMON_ON_ANY_DEATH: an enemy death mints a token for the Crypt Keeper's controller", tokens.length === 1, r.state.players.P1.board.front.map((u) => u.cardId));
  check("SUMMON_ON_ANY_DEATH: P1 board grew by exactly the one token (no double-mint)", r.state.players.P1.board.front.length === p1Before + 1, { before: p1Before, after: r.state.players.P1.board.front.length });

  // guard: with NO Crypt Keeper, an enemy death mints nothing for P1.
  const m2 = arena();
  m2.players.P1.board.front = [unit({ instanceId: "exec", cardId: "tcg_test", attack: 10, health: 10, maxHealth: 10 })];
  m2.players.P2.board.front = [unit({ instanceId: "v", cardId: "tcg_19", attack: 1, health: 1, maxHealth: 1 })];
  const r2 = applyAction(m2, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "exec", defenderInstanceId: "v" });
  check("SUMMON_ON_ANY_DEATH: no watcher -> a death mints no token", !r2.state.players.P1.board.front.some((u) => u.cardId.startsWith("token_")), r2.state.players.P1.board.front.map((u) => u.cardId));
}

// --- ONCEDEATH_REVIVE (Jean): dies once -> returns full HP; dies again -> dies.
// Jean's printed FLYING would block a ground attacker, so the crafted victim omits
// FLYING (the cardId tcg_3355 still carries the ONCEDEATH_REVIVE op). -------------
{
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "exec", cardId: "tcg_test", attack: 10, health: 50, maxHealth: 50 })];
  m.players.P2.board.front = [unit({ instanceId: "jean", cardId: "tcg_3355", attack: 2, health: 6, maxHealth: 6 })];
  const r1 = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "exec", defenderInstanceId: "jean" });
  const j1 = r1.state.players.P2.board.front.find((u) => u.instanceId === "jean");
  check("ONCEDEATH_REVIVE: first lethal returns Jean to the board at FULL HP (6/6)", !!j1 && j1.health === 6 && j1.maxHealth === 6, j1);
  check("ONCEDEATH_REVIVE: the revive flag is now set (reviveUsed)", (j1 as any)?.reviveUsed === true, (j1 as any)?.reviveUsed);
  check("ONCEDEATH_REVIVE: a revived (never-truly-died) unit does NOT enter the graveyard", r1.state.players.P2.graveyard.length === 0, r1.state.players.P2.graveyard);

  // Second lethal on the SAME match: Jean actually dies now.
  const next = structuredClone(r1.state);
  next.players.P1.board.front.forEach((u: any) => (u.exhausted = false));
  const r2 = applyAction(next, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "exec", defenderInstanceId: "jean" });
  check("ONCEDEATH_REVIVE: SECOND lethal actually kills Jean (off the board)", !r2.state.players.P2.board.front.some((u) => u.instanceId === "jean"), r2.state.players.P2.board.front.map((u) => u.cardId));
  check("ONCEDEATH_REVIVE: the real (second) death records Jean to the graveyard", r2.state.players.P2.graveyard.some((g) => g.cardId === "tcg_3355"), r2.state.players.P2.graveyard);
}

console.log(`\n=== MARQUEE AURA PROOF (AURA_COST_REDUCTION / AURA_SPELL_COST / AURA_ABILITY_SILENCE / RESURRECT_AS_TOKEN / SUMMON_ON_ANY_DEATH / ONCEDEATH_REVIVE) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} marquee-aura check(s) failed.`);
  process.exit(1);
}
console.log("ALL MARQUEE AURA PROOFS PASSED");
