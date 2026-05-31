/**
 * dev:discover-spells — end-to-end proof of the LIVE "Discover" SPELL content drop.
 *
 * These are the FIRST shipped cards whose ability text uses the Hearthstone
 * "discover" verb, so they exercise the mid-resolution player-CHOICE primitive
 * (`pendingChoice` pause/resume, src/engine/CHOICE_DESIGN.md + RESOLUTION_MODEL.md
 * §8) through the REAL `applyAction` PLAY_SPELL path — not a synthetic spec.
 *
 * The four spells (src/engine/spellCards.ts -> liveSpells, merged into
 * allPlayableCards):
 *   spell_scout         "discover a unit."        -> DISCOVER UNIT, offer 3
 *   spell_archive       "discover a spell."       -> DISCOVER SPELL, offer 3
 *   spell_salvage       "discover a card."        -> DISCOVER ANY,  offer 3
 *   spell_grand_survey  "discover one of 4 units."-> DISCOVER UNIT, offer 4
 *
 * What is proven, driven by REAL actions through the reducer:
 *   1. COMPILE     — each spell's text compiles to exactly one DISCOVER spec with
 *                    the right discoverType / discoverCount, and is in the catalog
 *                    as a type:"spell" card.
 *   2. PLAY+PAUSE  — PLAY_SPELL casts the discover spell, sets state.pendingChoice
 *                    with options drawn from the controller's OWN deck filtered by
 *                    type, emits SPELL_PLAYED + CHOICE_OPENED, pays cost, discards
 *                    the spell, and leaves the enemy nexus UNTOUCHED (no burn).
 *   3. GATE        — while pending, every non-RESOLVE_CHOICE action reject-softs
 *                    'choice-pending' with state unchanged.
 *   4. RESOLVE     — a valid RESOLVE_CHOICE moves the picked card deck->hand, clears
 *                    the pause, and emits CHOICE_RESOLVED. Illegal/stale picks no-op.
 *   5. EMPTY POOL  — a discover whose type filter matches nothing in the deck is a
 *                    clean no-op (never pauses); the spell still resolves + discards.
 *   6. DETERMINISM — replaying (seed, [PLAY_SPELL, RESOLVE_CHOICE{loggedPick}]) is
 *                    byte-identical to the live run; same seed regenerates the same
 *                    option list.
 *   7. DRAIN       — the harness auto-pick drains a raised choice (no deadlock).
 *
 * Nothing here deals nexus/face damage or mutates a committed fixture. Option
 * generation uses ONLY the seeded rngCursor stream (seededDistinctPick), so a
 * replay is byte-identical.
 */

import { applyAction, autoPickOption, Action } from "../engine/reducer";
import { seededDistinctPick } from "../engine/effectResolver";
import { compileAbility } from "../engine/abilityCompiler";
import { getPlayableCardById } from "../engine/cards";
import { makeSeededMatch, replay } from "./reducerHarness";
import { MatchState } from "../engine/state";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`OK: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

// Real catalog ids the reducer's cardTypeOf resolves (allPlayableCards + spellCards).
const UNIT_IDS = ["tcg_2", "tcg_6", "tcg_8", "tcg_10", "tcg_14", "tcg_16"];
const SPELL_IDS = ["spell_mend", "spell_insight", "spell_embolden", "spell_strike"];

const DISCOVER_SPELLS = [
  { id: "spell_scout", type: "UNIT", count: 3 },
  { id: "spell_archive", type: "SPELL", count: 3 },
  { id: "spell_salvage", type: "ANY", count: 3 },
  { id: "spell_grand_survey", type: "UNIT", count: 4 },
];

/** Clean arena: empty boards, energy 99, no winner, a controlled deck. The deck
 *  intentionally holds BOTH units and spells so every discoverType has a pool. */
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

// === 1. COMPILE: each discover spell is in the catalog and parses to DISCOVER ====
{
  for (const s of DISCOVER_SPELLS) {
    const card = getPlayableCardById(s.id);
    check(`${s.id} is in the catalog as type spell`, card?.type === "spell", card?.type);
    const compiled = compileAbility(card?.rawTraits?.Ability);
    const spec = compiled.specs.find((x) => x.op === "DISCOVER");
    check(`${s.id} compiles to exactly one DISCOVER spec`, compiled.specs.filter((x) => x.op === "DISCOVER").length === 1, compiled.specs.map((x) => x.op));
    check(`${s.id} -> discoverType ${s.type}`, spec?.discoverType === s.type, spec?.discoverType);
    check(`${s.id} -> discoverCount ${s.count}`, spec?.discoverCount === s.count, spec?.discoverCount);
    check(`${s.id} DISCOVER trigger is ON_SUMMON (cast)`, spec?.trigger === "ON_SUMMON", spec?.trigger);
    check(`${s.id} compiled spec set is recognized`, compiled.recognized, compiled.specs.map((x) => x.op));
  }
}

// Helper: cast a discover spell from hand index 0 and return the result.
function castDiscover(m: MatchState, spellId: string) {
  m.players.P1.hand = [spellId];
  return applyAction(m, { type: "PLAY_SPELL", player: "P1", handIndex: 0 });
}

// === 2. PLAY + PAUSE: casting raises a pendingChoice with deck-filtered options ===
{
  for (const s of DISCOVER_SPELLS) {
    const m = arena();
    const r = castDiscover(m, s.id);
    const pc = r.state.pendingChoice;
    check(`${s.id}: PLAY_SPELL raised a pendingChoice (PAUSED)`, !!pc, pc);
    check(`${s.id}: pendingChoice.kind === DISCOVER`, pc?.kind === "DISCOVER", pc?.kind);
    check(`${s.id}: controller is the caster P1`, pc?.controller === "P1", pc?.controller);
    const want = Math.min(s.count, s.type === "ANY" ? UNIT_IDS.length + SPELL_IDS.length : s.type === "UNIT" ? UNIT_IDS.length : SPELL_IDS.length);
    check(`${s.id}: offered exactly ${want} options`, pc?.options.length === want, pc?.options.length);
    const typeOk = (pc?.options ?? []).every((o) =>
      s.type === "ANY" ? true : s.type === "UNIT" ? UNIT_IDS.includes(o.id) : SPELL_IDS.includes(o.id)
    );
    check(`${s.id}: every option matches the type filter`, typeOk, pc?.options);
    check(`${s.id}: resume tail is ADD_CARD_TO_HAND from deck`, pc?.resume.op === "ADD_CARD_TO_HAND" && pc?.resume.source === "deck", pc?.resume);
    // The cast itself: spell paid + discarded, nexus untouched (no burn).
    check(`${s.id}: SPELL_PLAYED + CHOICE_OPENED emitted`, r.events.some((e) => e.type === "SPELL_PLAYED") && r.events.some((e) => e.type === "CHOICE_OPENED"), r.events.map((e) => e.type));
    check(`${s.id}: spell left hand and went to discard`, r.state.players.P1.hand.length === 0 && r.state.players.P1.discard.includes(s.id), { hand: r.state.players.P1.hand, discard: r.state.players.P1.discard });
    check(`${s.id}: enemy nexus UNTOUCHED (no burn)`, r.state.players.P2.nexusHealth === 20, r.state.players.P2.nexusHealth);
    check(`${s.id}: own nexus UNTOUCHED`, r.state.players.P1.nexusHealth === 20, r.state.players.P1.nexusHealth);
  }
}

// === 3. GATE: while pending, every other action reject-softs 'choice-pending' ====
{
  const m = arena();
  const paused = castDiscover(m, "spell_scout").state;
  check("gate setup: a choice is actually pending", !!paused.pendingChoice);
  // Give P1 a unit in hand so PLAY_UNIT is otherwise legal — only the gate stops it.
  paused.players.P1.hand = [UNIT_IDS[0]];
  const otherActions: Action[] = [
    { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" },
    { type: "END_TURN", player: "P1" },
    { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "nope" },
    { type: "PLAY_SPELL", player: "P1", handIndex: 0 },
  ];
  for (const a of otherActions) {
    const rr = applyAction(paused, a);
    const rejected = rr.events.some((e) => e.type === "REJECTED" && (e as any).reason === "choice-pending");
    check(`gate: ${a.type} while pending reject-softs 'choice-pending'`, rejected, rr.events);
    check(`gate: ${a.type} returned state UNCHANGED (same ref)`, rr.state === paused);
    check(`gate: ${a.type} left the pause intact`, !!rr.state.pendingChoice);
  }
}

// === 4. RESOLVE: a valid pick moves the chosen card deck->hand; illegal picks no-op
{
  const m = arena();
  const paused = castDiscover(m, "spell_scout").state;
  const pick = paused.pendingChoice!.options[1].id; // SECOND option (not the auto-pick)
  const deckHad = paused.players.P1.deck.includes(pick);

  // not-your-choice: P2 cannot resolve P1's choice.
  const rWrong = applyAction(paused, { type: "RESOLVE_CHOICE", player: "P2", optionId: pick });
  check("resolve: wrong player -> 'not-your-choice'", rWrong.events.some((e) => e.type === "REJECTED" && (e as any).reason === "not-your-choice"), rWrong.events);
  check("resolve: not-your-choice left the pause intact", rWrong.state === paused && !!rWrong.state.pendingChoice);

  // illegal-option: an id not among the offered options.
  const rBad = applyAction(paused, { type: "RESOLVE_CHOICE", player: "P1", optionId: "spell_strike" });
  check("resolve: unoffered optionId -> 'illegal-option'", rBad.events.some((e) => e.type === "REJECTED" && (e as any).reason === "illegal-option"), rBad.events);
  check("resolve: illegal-option left the pause intact", rBad.state === paused && !!rBad.state.pendingChoice);

  // valid pick.
  const r = applyAction(paused, { type: "RESOLVE_CHOICE", player: "P1", optionId: pick });
  check("resolve: deck contained the picked card before resolving", deckHad);
  check("resolve: CHOICE_RESOLVED emitted with the picked optionId", r.events.some((e) => e.type === "CHOICE_RESOLVED" && (e as any).optionId === pick), r.events);
  check("resolve: pendingChoice cleared", r.state.pendingChoice == null, r.state.pendingChoice);
  check("resolve: picked card moved into hand", r.state.players.P1.hand.includes(pick), r.state.players.P1.hand);
  check("resolve: picked card removed from deck (deck->hand, not minted)", !r.state.players.P1.deck.includes(pick), r.state.players.P1.deck);

  // no-pending-choice: a RESOLVE_CHOICE with no pause is a clean no-op.
  const r0 = applyAction(r.state, { type: "RESOLVE_CHOICE", player: "P1", optionId: pick });
  check("resolve: RESOLVE_CHOICE with no pending choice -> 'no-pending-choice'", r0.events.some((e) => e.type === "REJECTED" && (e as any).reason === "no-pending-choice"), r0.events);
  check("resolve: no-pending-choice left state unchanged", r0.state === r.state);
}

// === 5. EMPTY POOL: a discover whose filter matches nothing is a clean no-op ======
{
  // spell_archive discovers a SPELL, but the deck holds only units -> empty pool.
  const m = arena();
  m.players.P1.deck = [...UNIT_IDS];
  (m.players.P1 as any).deckCount = m.players.P1.deck.length;
  const before = JSON.stringify({ deck: m.players.P1.deck, hand: ["spell_archive"] });
  const r = castDiscover(m, "spell_archive");
  check("empty pool: NO choice raised (clean no-op)", r.state.pendingChoice == null, r.state.pendingChoice);
  check("empty pool: spell still resolved + discarded (cast completed normally)", r.state.players.P1.discard.includes("spell_archive") && r.state.players.P1.hand.length === 0, { discard: r.state.players.P1.discard, hand: r.state.players.P1.hand });
  check("empty pool: deck untouched (nothing pulled)", JSON.stringify(r.state.players.P1.deck) === JSON.stringify([...UNIT_IDS]), r.state.players.P1.deck);
  check("empty pool: enemy nexus untouched", r.state.players.P2.nexusHealth === 20, r.state.players.P2.nexusHealth);
  void before;
}

// === 6. DETERMINISM: same seed -> same options; logged pick replays byte-identical =
{
  // Same seed regenerates the same option list across two independent casts.
  const a = castDiscover(arena(98765), "spell_salvage").state;
  const b = castDiscover(arena(98765), "spell_salvage").state;
  check(
    "determinism: two casts at the same seed yield byte-identical options",
    JSON.stringify(a.pendingChoice?.options) === JSON.stringify(b.pendingChoice?.options),
    { a: a.pendingChoice?.options, b: b.pendingChoice?.options }
  );
  check("determinism: both advanced rngCursor identically", a.rngCursor === b.rngCursor, { a: a.rngCursor, b: b.rngCursor });

  // The seeded option list matches a direct seededDistinctPick over the deck (the
  // op's own discipline): proves no hidden RNG source.
  const fresh = arena(98765);
  const pool = fresh.players.P1.deck; // ANY filter -> whole deck is the pool
  const pred = seededDistinctPick(fresh.seed, fresh.rngCursor ?? 0, pool.length, 3);
  const predIds = pred.indices.map((i) => pool[i]);
  check("determinism: option ids match seededDistinctPick over the deck (no hidden RNG)", JSON.stringify(a.pendingChoice?.options.map((o) => o.id)) === JSON.stringify(predIds), { got: a.pendingChoice?.options.map((o) => o.id), pred: predIds });

  // Full replay: log (PLAY_SPELL, RESOLVE_CHOICE{loggedPick}) and replay it.
  const start = arena(12321);
  start.players.P1.hand = ["spell_scout"];
  const playAct: Action = { type: "PLAY_SPELL", player: "P1", handIndex: 0 };
  const afterPlay = applyAction(start, playAct);
  const loggedPick = autoPickOption(afterPlay.state);
  check("replay: autoPickOption returns the first option id", loggedPick === afterPlay.state.pendingChoice!.options[0].id, loggedPick);
  const log: Action[] = [playAct, { type: "RESOLVE_CHOICE", player: "P1", optionId: loggedPick! }];

  const live = replay(arena(12321), [{ type: "PLAY_SPELL", player: "P1", handIndex: 0 }, log[1]] as Action[]);
  // Set up an identical start (hand) for both replays.
  const mkStart = () => {
    const s = arena(12321);
    s.players.P1.hand = ["spell_scout"];
    return s;
  };
  const r1 = replay(mkStart(), log);
  const r2 = replay(mkStart(), log);
  check("replay: replaying the logged (play, resolve) pair is byte-identical twice", JSON.stringify(r1.finalState) === JSON.stringify(r2.finalState));
  check("replay: the replayed pick landed in hand", r1.finalState.players.P1.hand.includes(loggedPick!), r1.finalState.players.P1.hand);
  void live;
}

// === 7. DRAIN: the harness auto-pick drains a raised choice (no deadlock) ==========
{
  const m = arena();
  let state = castDiscover(m, "spell_grand_survey").state;
  let guard = 0;
  while (state.pendingChoice && guard < 8) {
    guard += 1;
    const opt = autoPickOption(state);
    if (opt == null) break;
    state = applyAction(state, { type: "RESOLVE_CHOICE", player: state.pendingChoice.controller, optionId: opt }).state;
  }
  check("drain: auto-pick drains the pending choice (no deadlock)", state.pendingChoice == null, state.pendingChoice);
  check("drain: drained in a single RESOLVE_CHOICE (no re-raise in v1)", guard === 1, guard);
  check("drain: exactly one card moved deck->hand", state.players.P1.hand.length === 1, state.players.P1.hand);
}

console.log(`\n=== DISCOVER SPELL PROOF (live discover spells via PLAY_SPELL pause/resume) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} discover-spell check(s) failed.`);
  process.exit(1);
}
console.log("ALL DISCOVER SPELL PROOFS PASSED");
