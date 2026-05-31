/**
 * dev:choice — end-to-end proof of the mid-resolution player-CHOICE primitive
 * (Discover / choose-one), the `pendingChoice` pause/resume state machine described
 * in `src/engine/CHOICE_DESIGN.md` and `src/engine/RESOLUTION_MODEL.md` §8.
 *
 * The corpus discrepancy (reported honestly): NO shipped card's ability text uses
 * the "discover" verb, so the live behavioral-coverage count moves by +0. The op is
 * nonetheless REAL and wired honestly — this proof drives it three ways:
 *
 *   1. COMPILER     — the honest regex emits a DISCOVER spec ONLY for the explicit
 *                     "discover a/an/one <unit|spell|card>" verb (type + offer size),
 *                     and a plain tutor/draw is NOT misrouted into a pausing choice.
 *   2. RESOLVER     — `resolveEffect` on a DISCOVER spec builds K seeded options from
 *                     the controller's OWN deck (filtered by type), advances rngCursor
 *                     by EXACTLY the draws consumed, and PAUSES via state.pendingChoice.
 *                     Empty pool = clean no-op (never pauses). Single candidate =
 *                     auto-resolves INLINE (card moved deck->hand, no pause).
 *   3. REDUCER GATE — while pendingChoice is set, EVERY non-RESOLVE_CHOICE action
 *                     reject-softs `choice-pending` (state unchanged); a stale
 *                     RESOLVE_CHOICE with no pending choice reject-softs
 *                     `no-pending-choice`; wrong player -> `not-your-choice`; bad
 *                     option id -> `illegal-option`. A valid RESOLVE_CHOICE runs the
 *                     resume tail (deck->hand), clears the pause, emits
 *                     CHOICE_RESOLVED, and is the ONLY way forward.
 *
 * DETERMINISM (the crown jewel) is proven directly: two independent resolves at the
 * same (seed, cursor) generate the IDENTICAL option list, and a full replay of the
 * logged (raise-choice, RESOLVE_CHOICE{optionId}) action pair is byte-identical to
 * the live run — the chosen optionId is captured in the log, never regenerated.
 *
 * Nothing here deals nexus damage or mutates a committed fixture.
 */

import { applyAction, autoPickOption, Action } from "../engine/reducer";
import { resolveEffect, seededDistinctPick } from "../engine/effectResolver";
import { compileAbility, EffectSpec } from "../engine/abilityCompiler";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, PendingChoice } from "../engine/state";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`OK: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

// Real catalog cardIds so the reducer's cardTypeOf (allPlayableCards + spellCards)
// resolves them: 6 units + 4 spells. The DISCOVER type filter keys off these.
const UNIT_IDS = ["tcg_2", "tcg_6", "tcg_8", "tcg_10", "tcg_14", "tcg_16"];
const SPELL_IDS = ["spell_mend", "spell_insight", "spell_embolden", "spell_strike"];

/** Clean arena: empty boards, a controlled deck/hand, energy 99, no winner. */
function arena(seed = 4040): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.winner = null;
  m.pendingChoice = null;
  m.rngCursor = 0;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    (m.players[p] as any).nexusHealth = 20;
    m.players[p].energy = 99;
    m.players[p].maxEnergy = 99;
    m.players[p].hand = [];
    m.players[p].discard = [];
    (m.players[p] as any).graveyard = [];
    m.players[p].deck = [...UNIT_IDS, ...SPELL_IDS];
    (m.players[p] as any).deckCount = m.players[p].deck.length;
  }
  return m;
}

// cardTypeOf mirror for the direct resolver calls (the reducer injects its own).
const TYPE_OF = (id: string) =>
  UNIT_IDS.includes(id) ? "unit" : SPELL_IDS.includes(id) ? "spell" : null;

// === 1. COMPILER: honest DISCOVER parse ==========================================
{
  const a = compileAbility("Battlecry: Discover a spell.");
  const spec = a.specs.find((s) => s.op === "DISCOVER");
  check("compiler: 'Discover a spell' emits a DISCOVER spec", !!spec, a.specs.map((s) => s.op));
  check("compiler: spell noun -> discoverType SPELL", spec?.discoverType === "SPELL", spec?.discoverType);
  check("compiler: default offer size is 3", spec?.discoverCount === 3, spec?.discoverCount);
  check("compiler: DISCOVER trigger is ON_SUMMON (battlecry)", spec?.trigger === "ON_SUMMON", spec?.trigger);

  const u = compileAbility("Discover a unit.").specs.find((s) => s.op === "DISCOVER");
  check("compiler: unit noun -> discoverType UNIT", u?.discoverType === "UNIT", u?.discoverType);

  const c = compileAbility("Discover one of 5 cards.").specs.find((s) => s.op === "DISCOVER");
  check("compiler: 'one of 5 cards' -> ANY, count 5", c?.discoverType === "ANY" && c?.discoverCount === 5, {
    t: c?.discoverType,
    n: c?.discoverCount,
  });

  // A plain tutor/draw must NOT be turned into a pausing choice.
  const tutor = compileAbility("Battlecry: search your deck for the lowest-cost unit.");
  check("compiler: a plain tutor is NOT misrouted to DISCOVER", !tutor.specs.some((s) => s.op === "DISCOVER"), tutor.specs.map((s) => s.op));
  const draw = compileAbility("Draw a card.");
  check("compiler: a plain draw is NOT misrouted to DISCOVER", !draw.specs.some((s) => s.op === "DISCOVER"), draw.specs.map((s) => s.op));
}

// A reusable DISCOVER spec built directly (no shipped card has the text).
function discoverSpec(type: "UNIT" | "SPELL" | "ANY", count = 3): EffectSpec {
  return { trigger: "ON_SUMMON", op: "DISCOVER", discoverType: type, discoverCount: count, raw: "Discover" };
}

// === 2. RESOLVER: raises pendingChoice, advances rngCursor deterministically =====
{
  const m = arena();
  const cursorBefore = m.rngCursor;
  resolveEffect(discoverSpec("UNIT", 3), { state: m, controller: "P1", cardTypeOf: TYPE_OF });
  const pc = m.pendingChoice;
  check("resolver: DISCOVER set state.pendingChoice (PAUSED)", !!pc, pc);
  check("resolver: pendingChoice.kind === DISCOVER", pc?.kind === "DISCOVER", pc?.kind);
  check("resolver: controller is P1", pc?.controller === "P1", pc?.controller);
  check("resolver: offered exactly 3 options", pc?.options.length === 3, pc?.options.length);
  check(
    "resolver: every option is a UNIT from the deck (type filter honest)",
    (pc?.options ?? []).every((o) => UNIT_IDS.includes(o.id)),
    pc?.options
  );
  check(
    "resolver: rngCursor advanced by exactly the draws consumed",
    m.rngCursor === cursorBefore + seededDistinctPick(m.seed, cursorBefore, UNIT_IDS.length, 3).draws,
    { before: cursorBefore, after: m.rngCursor }
  );
  check("resolver: resume tail is ADD_CARD_TO_HAND from deck", pc?.resume.op === "ADD_CARD_TO_HAND" && pc?.resume.source === "deck", pc?.resume);
}

// === 2b. RESOLVER: empty pool is a clean no-op (never pauses) =====================
{
  const m = arena();
  m.players.P1.deck = [...UNIT_IDS]; // no spells in deck
  const before = JSON.stringify(m.players.P1);
  resolveEffect(discoverSpec("SPELL", 3), { state: m, controller: "P1", cardTypeOf: TYPE_OF });
  check("resolver: empty pool raised NO choice (clean no-op)", m.pendingChoice == null, m.pendingChoice);
  check("resolver: empty pool left the player state untouched", JSON.stringify(m.players.P1) === before);
}

// === 2c. RESOLVER: single candidate auto-resolves INLINE (no pause) ===============
{
  const m = arena();
  m.players.P1.deck = [...UNIT_IDS, "spell_mend"]; // exactly ONE spell
  const cursorBefore = m.rngCursor;
  resolveEffect(discoverSpec("SPELL", 3), { state: m, controller: "P1", cardTypeOf: TYPE_OF });
  check("resolver: single candidate did NOT pause", m.pendingChoice == null, m.pendingChoice);
  check("resolver: single candidate moved straight to hand", m.players.P1.hand.includes("spell_mend"), m.players.P1.hand);
  check("resolver: single candidate removed from deck", !m.players.P1.deck.includes("spell_mend"), m.players.P1.deck);
  check("resolver: single candidate consumed NO rng (whole tiny pool)", m.rngCursor === cursorBefore, { before: cursorBefore, after: m.rngCursor });
}

// === 3. REDUCER GATE: while pending, all non-RESOLVE_CHOICE actions reject-soft ===
function pendingArena(): MatchState {
  // Build an arena already holding a pending DISCOVER choice (the reducer reads
  // pendingChoice identically regardless of how it was raised).
  const m = arena();
  const options = [UNIT_IDS[0], UNIT_IDS[1], UNIT_IDS[2]].map((id) => ({ id, cardId: id }));
  const pc: PendingChoice = { kind: "DISCOVER", controller: "P1", options, resume: { op: "ADD_CARD_TO_HAND", source: "deck" } };
  m.pendingChoice = pc;
  // Give P1 a unit in hand so an attempted PLAY_UNIT is otherwise-legal (only the
  // gate should stop it).
  m.players.P1.hand = [UNIT_IDS[0]];
  return m;
}
{
  const m = pendingArena();
  const otherActions: Action[] = [
    { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" },
    { type: "END_TURN", player: "P1" },
    { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "nope" },
    { type: "MULLIGAN", player: "P1" },
  ];
  for (const a of otherActions) {
    const r = applyAction(m, a);
    const rejected = r.events.some((e) => e.type === "REJECTED" && (e as any).reason === "choice-pending");
    check(`gate: ${a.type} while pending reject-softs 'choice-pending'`, rejected, r.events);
    check(`gate: ${a.type} returned the state UNCHANGED (same ref)`, r.state === m);
    check(`gate: ${a.type} left pendingChoice intact`, !!r.state.pendingChoice);
  }
}

// === 3b. REDUCER: RESOLVE_CHOICE legality order ===================================
{
  // no-pending-choice: a RESOLVE_CHOICE arriving with no pause is a clean no-op.
  const clean = arena();
  const r0 = applyAction(clean, { type: "RESOLVE_CHOICE", player: "P1", optionId: UNIT_IDS[0] });
  check("legality: RESOLVE_CHOICE with no pending choice -> 'no-pending-choice'", r0.events.some((e) => e.type === "REJECTED" && (e as any).reason === "no-pending-choice"), r0.events);
  check("legality: no-pending-choice left state unchanged", r0.state === clean);

  // not-your-choice: only the controller (P1) may resolve.
  const m = pendingArena();
  const rWrong = applyAction(m, { type: "RESOLVE_CHOICE", player: "P2", optionId: UNIT_IDS[0] });
  check("legality: wrong player -> 'not-your-choice'", rWrong.events.some((e) => e.type === "REJECTED" && (e as any).reason === "not-your-choice"), rWrong.events);
  check("legality: not-your-choice left the pause intact", rWrong.state === m && !!rWrong.state.pendingChoice);

  // illegal-option: an id not among the offered options.
  const rBad = applyAction(m, { type: "RESOLVE_CHOICE", player: "P1", optionId: "spell_strike" });
  check("legality: unoffered optionId -> 'illegal-option'", rBad.events.some((e) => e.type === "REJECTED" && (e as any).reason === "illegal-option"), rBad.events);
  check("legality: illegal-option left the pause intact", rBad.state === m && !!rBad.state.pendingChoice);
}

// === 3c. REDUCER: a VALID RESOLVE_CHOICE runs the resume tail =====================
{
  const m = pendingArena();
  const pick = m.pendingChoice!.options[1].id; // pick the SECOND option (not the auto-pick)
  const deckHad = m.players.P1.deck.includes(pick);
  const r = applyAction(m, { type: "RESOLVE_CHOICE", player: "P1", optionId: pick });
  check("resolve: deck contained the picked card before resolving", deckHad);
  check("resolve: CHOICE_RESOLVED emitted with the picked optionId", r.events.some((e) => e.type === "CHOICE_RESOLVED" && (e as any).optionId === pick), r.events);
  check("resolve: pendingChoice cleared", r.state.pendingChoice == null, r.state.pendingChoice);
  check("resolve: picked card moved into hand", r.state.players.P1.hand.includes(pick), r.state.players.P1.hand);
  check("resolve: picked card removed from deck (deck->hand, not minted)", !r.state.players.P1.deck.includes(pick), r.state.players.P1.deck);
}

// === 4. DETERMINISM: same (seed, cursor) -> identical options =====================
{
  const a = arena(98765);
  const b = arena(98765);
  resolveEffect(discoverSpec("ANY", 3), { state: a, controller: "P1", cardTypeOf: TYPE_OF });
  resolveEffect(discoverSpec("ANY", 3), { state: b, controller: "P1", cardTypeOf: TYPE_OF });
  check(
    "determinism: two resolves at the same (seed, cursor) yield byte-identical options",
    JSON.stringify(a.pendingChoice?.options) === JSON.stringify(b.pendingChoice?.options),
    { a: a.pendingChoice?.options, b: b.pendingChoice?.options }
  );
  check("determinism: both advanced rngCursor identically", a.rngCursor === b.rngCursor, { a: a.rngCursor, b: b.rngCursor });
}

// === 4b. REPLAY: logged optionId reproduces a byte-identical resume ===============
{
  // Live run: raise the choice (directly), auto-pick, resolve. Capture (optionId).
  const live = pendingArena();
  const optionId = autoPickOption(live);
  check("autopick: autoPickOption returns the FIRST option id (fixed, pure)", optionId === live.pendingChoice!.options[0].id, optionId);
  const liveResolved = applyAction(live, { type: "RESOLVE_CHOICE", player: "P1", optionId: optionId! });

  // Replay run: same starting arena, replay the SAME logged optionId.
  const rep = pendingArena();
  const repResolved = applyAction(rep, { type: "RESOLVE_CHOICE", player: "P1", optionId: optionId! });

  check(
    "replay: replaying the logged optionId is byte-identical to the live resume",
    JSON.stringify(liveResolved.state) === JSON.stringify(repResolved.state)
  );
}

// === 4c. AUTO-PICK DRAIN: a harness never deadlocks on a raised choice ============
{
  const m = pendingArena();
  // Simulate the harness drain loop: keep resolving via autoPickOption until settled.
  let state = m;
  let guard = 0;
  while (state.pendingChoice && guard < 8) {
    guard += 1;
    const opt = autoPickOption(state);
    if (opt == null) break;
    state = applyAction(state, { type: "RESOLVE_CHOICE", player: state.pendingChoice.controller, optionId: opt }).state;
  }
  check("drain: auto-pick drains the pending choice to a settled state (no deadlock)", state.pendingChoice == null, state.pendingChoice);
  check("drain: drained in a single RESOLVE_CHOICE (no re-raise in v1)", guard === 1, guard);
}

console.log(`\n=== CHOICE PRIMITIVE PROOF (pendingChoice pause/resume; DISCOVER) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} choice-primitive check(s) failed.`);
  process.exit(1);
}
console.log("ALL CHOICE PRIMITIVE PROOFS PASSED");
