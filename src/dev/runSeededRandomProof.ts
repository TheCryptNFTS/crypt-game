/**
 * dev:seeded-random — pins the SEEDED-RANDOM target-selection primitive that
 * closes the last text/behavior honesty gap for the "random" cards:
 *
 *   - DESTROY_ENEMY_SELECT { random: true }  (tcg_3360 "I Am Death":  destroy a
 *       random highest-cost enemy; tcg_101 "D'Vile One": destroy a random enemy
 *       with cost <= own attack — random WITHIN the highest-cost eligible tier).
 *   - RESURRECT_AS_TOKEN   { random: true }  (tcg_3395 "Skeletor":   raise a
 *       random graveyard unit as a 1/1 Wraith).
 *   - RESURRECT_RANDOM                        (a brand-new op: resurrect a random
 *       friendly unit from the graveyard onto the board, full HP).
 *
 * The crux is DETERMINISM: the engine is determinism-locked (no Math.random / no
 * Date). All randomness is drawn from the match's SEEDED mulberry32 stream
 * (state.seed + state.rngCursor) via seededDistinctPick — exactly the stream the
 * DISCOVER op already uses. This proof asserts the four contract properties:
 *
 *   (a) the random op FIRES (it actually picks and mutates board state),
 *   (b) SAME seed -> SAME pick (replay-stable determinism),
 *   (c) DIFFERENT seeds -> the distribution actually VARIES (not hardcoded), and
 *   (d) NO-BURN: the enemy nexus is never touched by a random removal.
 *
 * Plus the byte-identical-safety invariant: a SINGLETON eligible pool consumes
 * ZERO rng draws and leaves state.rngCursor UNCHANGED, so any card whose pool is
 * a singleton composes identically to the deterministic (non-random) path.
 */

import { applyAction } from "../engine/reducer";
import { resolveEffect, EffectContext } from "../engine/effectResolver";
import { getPlayableCardById } from "../engine/cards";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, UnitInPlay } from "../engine/state";
import { GraveyardRecord } from "../engine/state";

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

function grave(cardId: string, attack = 2, maxHealth = 3): GraveyardRecord {
  return { cardId, attack, maxHealth, keywords: [] };
}

function arena(seed: number): MatchState {
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

function ctxFor(state: MatchState, controller: "P1" | "P2", source?: UnitInPlay): EffectContext {
  return {
    state,
    controller,
    source,
    costOf: (id) => getPlayableCardById(id)?.cost ?? 0,
    cardTypeOf: (id) => getPlayableCardById(id)?.type ?? null,
    factionOf: (id) => getPlayableCardById(id)?.faction ?? null,
  };
}

// === (a) the random op FIRES: RESURRECT_RANDOM puts a graveyard unit on board ===
{
  const m = arena(1234);
  m.players.P1.graveyard = [grave("tcg_2"), grave("tcg_33"), grave("tcg_4655")];
  const before = m.players.P1.board.front.length;
  resolveEffect({ trigger: "ON_SUMMON", op: "RESURRECT_RANDOM", raw: "" }, ctxFor(m, "P1"));
  check("RESURRECT_RANDOM fires: a unit is revived onto the board", m.players.P1.board.front.length === before + 1, m.players.P1.board.front.map((u) => u.cardId));
  check("RESURRECT_RANDOM removed exactly one grave record (3 -> 2)", m.players.P1.graveyard.length === 2, m.players.P1.graveyard.length);
  check("RESURRECT_RANDOM advanced the rng cursor (a real draw was consumed)", (m.rngCursor ?? 0) > 0, m.rngCursor);
}

// === (b) SAME seed -> SAME pick (determinism) ===================================
{
  const run = (seed: number) => {
    const m = arena(seed);
    m.players.P1.graveyard = [grave("A"), grave("B"), grave("C"), grave("D"), grave("E")];
    resolveEffect({ trigger: "ON_SUMMON", op: "RESURRECT_RANDOM", raw: "" }, ctxFor(m, "P1"));
    return m.players.P1.board.front[0]?.cardId;
  };
  check("RESURRECT_RANDOM same seed -> same pick (seed 777 twice)", run(777) === run(777), { a: run(777), b: run(777) });
  check("RESURRECT_RANDOM same seed -> same pick (seed 4242 twice)", run(4242) === run(4242), { a: run(4242), b: run(4242) });
}

// === (c) DIFFERENT seeds -> the picked card VARIES (not hardcoded) ==============
{
  const pickFor = (seed: number) => {
    const m = arena(seed);
    m.players.P1.graveyard = [grave("A"), grave("B"), grave("C"), grave("D"), grave("E"), grave("F"), grave("G"), grave("H")];
    resolveEffect({ trigger: "ON_SUMMON", op: "RESURRECT_RANDOM", raw: "" }, ctxFor(m, "P1"));
    return m.players.P1.board.front[0]?.cardId;
  };
  const picks = new Set<string | undefined>();
  for (let s = 1; s <= 40; s += 1) picks.add(pickFor(s));
  check("RESURRECT_RANDOM varies across seeds (>= 3 distinct picks over 40 seeds)", picks.size >= 3, [...picks]);
}

// === byte-identical-safety: a SINGLETON grave consumes ZERO rng draws ==========
{
  const m = arena(999);
  m.players.P1.graveyard = [grave("ONLY")];
  const cursorBefore = m.rngCursor ?? 0;
  resolveEffect({ trigger: "ON_SUMMON", op: "RESURRECT_RANDOM", raw: "" }, ctxFor(m, "P1"));
  check("RESURRECT_RANDOM single-entry grave revives the only unit", m.players.P1.board.front[0]?.cardId === "ONLY", m.players.P1.board.front.map((u) => u.cardId));
  check("RESURRECT_RANDOM single-entry grave consumes NO rng draw (cursor unchanged)", (m.rngCursor ?? 0) === cursorBefore, { before: cursorBefore, after: m.rngCursor });
}

// === RESURRECT_AS_TOKEN { random: true } (Skeletor) fires + varies + no-burn ====
{
  const tokenPick = (seed: number) => {
    const m = arena(seed);
    m.players.P1.graveyard = [grave("tcg_2"), grave("tcg_33"), grave("tcg_4655"), grave("tcg_6")];
    resolveEffect({ trigger: "ON_TURN_END", op: "RESURRECT_AS_TOKEN", random: true, reviveKeyword: "WRAITH", raw: "" }, ctxFor(m, "P1"));
    const tok = m.players.P1.board.front[0];
    return { cardId: tok?.cardId, atk: tok?.attack, hp: tok?.health, kw: tok?.keywords?.join(",") };
  };
  const a = tokenPick(55);
  check("RESURRECT_AS_TOKEN random: fires (a 1/1 Wraith token is minted)", a.atk === 1 && a.hp === 1 && a.kw === "WRAITH", a);
  check("RESURRECT_AS_TOKEN random: same seed -> same source (55 twice)", JSON.stringify(tokenPick(55)) === JSON.stringify(tokenPick(55)));
  const tokenSet = new Set<string | undefined>();
  for (let s = 1; s <= 40; s += 1) tokenSet.add(tokenPick(s).cardId);
  check("RESURRECT_AS_TOKEN random varies across seeds (>= 2 distinct sources)", tokenSet.size >= 2, [...tokenSet]);
}

// === (d) NO-BURN + fire + determinism for DESTROY_ENEMY_SELECT { random } =======
// Random highest-cost tie-break: stage TWO equal-highest-cost enemies so the pick
// is genuinely random (and never the nexus). Catalog costs: tcg_4655 = 10.
{
  const destroyPick = (seed: number) => {
    const m = arena(seed);
    m.players.P2.board.front = [
      unit({ instanceId: "top1", cardId: "tcg_4655", attack: 5, health: 6, maxHealth: 6 }),
      unit({ instanceId: "top2", cardId: "tcg_4655", attack: 5, health: 6, maxHealth: 6 }),
      unit({ instanceId: "low", cardId: "tcg_33", attack: 1, health: 4, maxHealth: 4 }),
    ];
    const nexusBefore = m.players.P2.nexusHealth;
    const src = unit({ instanceId: "killer", cardId: "tcg_3360", attack: 9, health: 9, maxHealth: 9 });
    resolveEffect({ trigger: "ON_SUMMON", op: "DESTROY_ENEMY_SELECT", selector: "HIGHEST_COST", random: true, raw: "" }, ctxFor(m, "P1", src));
    const dead = m.players.P2.board.front.filter((u) => u.health <= 0).map((u) => u.instanceId);
    return { dead: dead[0], nexus: m.players.P2.nexusHealth, nexusBefore, lowAlive: m.players.P2.board.front.some((u) => u.instanceId === "low" && u.health > 0) };
  };
  const r = destroyPick(3);
  check("DESTROY random: fires (a highest-cost enemy is reaped)", r.dead === "top1" || r.dead === "top2", r);
  check("DESTROY random: NEVER hits the low-cost enemy (only the top tier is eligible)", r.lowAlive, r);
  check("DESTROY random: NO-BURN — enemy nexus untouched (stays 20)", r.nexus === r.nexusBefore && r.nexus === 20, r);
  check("DESTROY random: same seed -> same victim (seed 3 twice)", destroyPick(3).dead === destroyPick(3).dead);
  const victims = new Set<string | undefined>();
  for (let s = 1; s <= 40; s += 1) victims.add(destroyPick(s).dead);
  check("DESTROY random: tie-break varies across seeds (both top1 and top2 picked)", victims.has("top1") && victims.has("top2"), [...victims]);
}

// Singleton top tier stays deterministic (the marquee-summon contract): a UNIQUE
// costliest enemy is always reaped, no rng draw consumed.
{
  const m = arena(123);
  m.players.P2.board.front = [
    unit({ instanceId: "unique", cardId: "tcg_4655", attack: 5, health: 6, maxHealth: 6 }), // cost 10, unique
    unit({ instanceId: "cheap", cardId: "tcg_33", attack: 1, health: 4, maxHealth: 4 }),
  ];
  const cursorBefore = m.rngCursor ?? 0;
  const src = unit({ instanceId: "killer", cardId: "tcg_3360", attack: 9, health: 9, maxHealth: 9 });
  resolveEffect({ trigger: "ON_SUMMON", op: "DESTROY_ENEMY_SELECT", selector: "HIGHEST_COST", random: true, raw: "" }, ctxFor(m, "P1", src));
  check("DESTROY random unique-top: reaps the unique costliest enemy deterministically", m.players.P2.board.front.find((u) => u.instanceId === "unique")?.health === 0, m.players.P2.board.front.map((u) => ({ id: u.instanceId, h: u.health })));
  check("DESTROY random unique-top: consumes NO rng draw (cursor unchanged)", (m.rngCursor ?? 0) === cursorBefore, { before: cursorBefore, after: m.rngCursor });
}

// === END-TO-END no-burn through the REAL play path (PLAY_UNIT -> ON_SUMMON) =====
// Play tcg_3360 (I Am Death, random highest-cost) from hand against a board with a
// unique top-cost enemy; assert the enemy nexus is never touched.
{
  const m = arena(2026);
  m.players.P2.board.front = [
    unit({ instanceId: "big", cardId: "tcg_4655", attack: 5, health: 6, maxHealth: 6 }),
    unit({ instanceId: "small", cardId: "tcg_33", attack: 1, health: 4, maxHealth: 4 }),
  ];
  m.players.P1.hand = ["tcg_3360"];
  const nexusBefore = m.players.P2.nexusHealth;
  const res = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  check("E2E: I Am Death summons and reaps the costliest enemy", !res.state.players.P2.board.front.some((u) => u.instanceId === "big"), res.state.players.P2.board.front.map((u) => u.instanceId));
  check("E2E: random removal deals NO face damage to enemy nexus", res.state.players.P2.nexusHealth === nexusBefore && res.state.players.P2.nexusHealth === 20, res.state.players.P2.nexusHealth);
  check("E2E: caster's own nexus untouched too", res.state.players.P1.nexusHealth === 20, res.state.players.P1.nexusHealth);
}

console.log(`\n=== SEEDED-RANDOM PROOF (RESURRECT_RANDOM / RESURRECT_AS_TOKEN random / DESTROY_ENEMY_SELECT random) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} seeded-random check(s) failed.`);
  process.exit(1);
}
console.log("ALL SEEDED-RANDOM PROOFS PASSED");
