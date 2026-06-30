/**
 * THE reducer — the single, pure, server-authority-ready rules core.
 *
 * Everything players actually experience in the local Crypt match now flows
 * through `applyAction`. It consolidates what used to be split between
 * `engine/setup.ts` (card plays) and the React hook `useLocalCryptMatch.ts`
 * (combat, turn flow, draw, mulligan, win detection). The reducer reproduces
 * the HOOK's lived rules exactly — that is the behavior the owner's players
 * know — NOT setup.ts's old phase/summoning-sickness model.
 *
 * Contract:
 *   - PURE. `structuredClone(state)` once at entry, mutate the copy, return it.
 *   - No `Date.now()` / `Math.random()` — all randomness is rebuilt from
 *     `state.seed` + `state.rngCursor` so `(seed, actionList)` fully determines
 *     the result on both client and (future) server.
 *   - Reject-soft: illegal actions return the state UNCHANGED plus a single
 *     REJECTED event, so an AI driver's per-action loop is a clean no-op.
 *   - SECURITY: card identity is taken from `player.hand[handIndex]`, never from
 *     a raw cardId in the action. Index-based validation only.
 *
 * RESOLUTION MODEL (no-stack, immediate, deterministic) — canonical reference:
 * see `src/engine/RESOLUTION_MODEL.md`. In brief:
 *   - NO STACK / NO PRIORITY / NO RESPONSES. Effects resolve IMMEDIATELY and
 *     depth-first the instant they trigger (Hearthstone / Marvel Snap style).
 *     This is a deliberate design choice, not a missing feature.
 *   - SIMULTANEOUS triggers/deaths from one action resolve in a STABLE board
 *     order: owner P1-before-P2, lane front-before-back, array index ascending
 *     (see `resolveDeaths`). Multi-token summons mint left-to-right via an
 *     ascending `idCounter`. Game-affecting logic NEVER depends on Object/Map/Set
 *     iteration order.
 *   - DEATHS are reaped by `resolveDeaths` after each trigger batch (firing each
 *     corpse's ON_DEATH/deathrattle before it is cleared), and continuous AURAS
 *     are recomputed idempotently at the single `applyAction` chokepoint.
 */

import { MatchState, PlayerId, Lane, BASE_MAX_ENERGY, ENERGY_CAP, SURGE_ENERGY, STARTING_NEXUS_HEALTH, MAX_LANE_UNITS, TriggerQueueEntry } from "./state";
import { playUnitFromHand, playEquipmentFromHand } from "./setup";
import { resolveOutgoingDamage, resolveMitigatedDamage } from "./resolveCombatBonuses";
import {
  initShield,
  armorOnSummon,
  relicOnSummon,
  ritualOnSummon,
  initStealth,
  unitIsStealthed,
  lifestealHeal,
  absorbDamage,
  applyDamageInstance,
  executesTarget,
  regrowAtTurnStart,
  hasDeathrattle,
  scryDeck,
  unitHasKeyword,
  consumeWindfuryStrike,
  DEATHRATTLE_NEXUS_DAMAGE,
} from "./keywordEngine";
import {
  commanderOnUnitSummon,
  commanderOnEquip,
  commanderOnTurnStart,
} from "./commanderPassives";
import {
  factionOnUnitSummon,
  factionOnEquip,
  factionOnTurnStart,
} from "./factionIdentity";
import { resonanceOnUnitSummon } from "./traitResonance";
import { allPlayableCards } from "./cards";
import { spellCards } from "./spellCards";
import { compileAbility, CompiledAbility, EffectTrigger, EffectOp } from "./abilityCompiler";
import { resolveEffect, resolveSpecs, addCardToHand, moveCardDeckToHand } from "./effectResolver";
import { makeRng, shuffle as seededShuffle } from "./rng";

export type Action =
  // OPENING MULLIGAN (PART 1). Two shapes, both replay-stable from (seed, actions):
  //   - LEGACY (no `cards`): the historical P1-only full-hand bottom-cycle redraw. This
  //     is what the committed "mulligan-then-end" golden scenario uses, so it MUST stay
  //     byte-identical (no RNG draw, deterministic bottom rotation).
  //   - SELECTIVE (`cards` present): Hearthstone-style — the chosen opening-hand indices
  //     are returned to the deck, the deck is reshuffled with the SEEDED rng, and an equal
  //     number of cards are drawn off the top. Either player may take it, exactly once,
  //     while their side is `pending` in `state.mulligan`.
  | { type: "MULLIGAN"; player: PlayerId; cards?: number[] }
  | { type: "PLAY_UNIT"; player: PlayerId; handIndex: number; lane: Lane; targetInstanceId?: string }
  | { type: "PLAY_ARTIFACT"; player: PlayerId; handIndex: number }
  | { type: "EQUIP"; player: PlayerId; handIndex: number; targetInstanceId: string }
  | { type: "PLAY_SPELL"; player: PlayerId; handIndex: number; targetInstanceId?: string }
  | { type: "ATTACK_UNIT"; player: PlayerId; attackerInstanceId: string; defenderInstanceId: string }
  | { type: "ATTACK_FACE"; player: PlayerId; attackerInstanceId: string }
  | { type: "END_TURN"; player: PlayerId }
  // THE SURGE (#4 — the "Snap" beat). Once per match, on your OWN turn: spike +2
  // energy now and ready your whole side (clear summoning sickness) for an all-in
  // alpha-strike. Gated by `rules.surge`; self-only, NO-BURN, and NOT a response
  // stack (it never interrupts the opponent). Pure state edit, fully replay-stable.
  | { type: "SURGE"; player: PlayerId }
  // Resolve a paused mid-resolution CHOICE (Discover / choose-one). The ONLY
  // action accepted while `state.pendingChoice` is non-null; carries the chosen
  // `optionId` so a replay of (seed, actions) resolves the identical tail. See
  // RESOLUTION_MODEL.md §8.
  | { type: "RESOLVE_CHOICE"; player: PlayerId; optionId: string };

export type GameEvent =
  | { type: "UNIT_PLAYED"; player: PlayerId; cardId: string; lane: Lane }
  | { type: "ARTIFACT_PLAYED"; player: PlayerId; cardId: string }
  | { type: "EQUIPPED"; player: PlayerId; cardId: string; targetInstanceId: string }
  | { type: "SPELL_PLAYED"; player: PlayerId; cardId: string; targetInstanceId?: string }
  | { type: "ATTACK"; player: PlayerId; attackerInstanceId: string; defenderInstanceId: string; outgoing: number; mitigated: number; counter: number }
  | { type: "NEXUS_DAMAGE"; player: PlayerId; targetPlayer: PlayerId; attackerInstanceId: string; damage: number }
  | { type: "TURN_END"; player: PlayerId }
  | { type: "TURN_START"; player: PlayerId; energy: number; maxEnergy: number }
  | { type: "DECK_OUT"; player: PlayerId }
  | { type: "WIN"; player: PlayerId }
  // A mid-resolution CHOICE was raised (Discover). The action that raised it ends
  // here with `state.pendingChoice` set; the controller must follow up with a
  // RESOLVE_CHOICE. `options` are the catalog cardIds offered, in seeded order.
  | { type: "CHOICE_OPENED"; player: PlayerId; kind: string; options: string[] }
  // A pending CHOICE was resolved with `optionId`; the resume tail has run.
  | { type: "CHOICE_RESOLVED"; player: PlayerId; optionId: string }
  // OPENING MULLIGAN resolved for `player` (PART 1): `redrawn` is how many cards were
  // returned-and-redrawn. Emitted by the phase path (`resolveMulligan`).
  | { type: "MULLIGAN_RESOLVED"; player: PlayerId; redrawn: number }
  // THE SURGE fired (#4): `player` spiked energy by `energyGained` (post-cap) and
  // readied `readied` of their summoning-sick units for an all-in turn.
  | { type: "SURGED"; player: PlayerId; energyGained: number; readied: number }
  | { type: "REJECTED"; reason: string };

export interface ApplyResult {
  state: MatchState;
  events: GameEvent[];
}

const OPENING_HAND_SIZE = 6;

// Spell fixtures are merged in for lookup ONLY (cost/type/faction/ability). They
// are intentionally absent from `allPlayableCards`, so the shipped catalog,
// deck legality and coreset balance are untouched — the reducer just needs to
// know a spell's shape to resolve a PLAY_SPELL action.
const cardMetaById = new Map<string, any>(
  [...(allPlayableCards as any[]), ...(spellCards as any[])].map((c) => [c.id, c])
);

function costOf(cardId: string): number {
  return cardMetaById.get(cardId)?.cost ?? 0;
}

function cardTypeOf(cardId: string): string | null {
  return cardMetaById.get(cardId)?.type ?? null;
}

/** Resolve a cardId to the stat line a GRAVEYARD record needs (attack / maxHealth
 *  / keywords). Used by REVEAL_AND_CULL (tcg_3375 Darius), which destroys revealed
 *  DECK cards for which no live unit exists to read stats from. Mirrors costOf /
 *  cardTypeOf: a missing card yields a conservative 0/1 record. */
function graveStatsOf(cardId: string): { attack: number; maxHealth: number; keywords: string[] } {
  const meta = cardMetaById.get(cardId);
  return {
    attack: meta?.stats?.attack ?? 0,
    maxHealth: meta?.stats?.health ?? 1,
    keywords: Array.isArray(meta?.keywords) ? meta.keywords : [],
  };
}

function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

/** Compiled-ability cache. Abilities are static per card id, so we compile each
 *  card's `rawTraits.Ability` once and reuse the IR for every trigger. */
const compiledAbilityCache = new Map<string, CompiledAbility>();
function compiledFor(cardId: string): CompiledAbility {
  let c = compiledAbilityCache.get(cardId);
  if (!c) {
    const meta = cardMetaById.get(cardId);
    c = compileAbility(meta?.rawTraits?.Ability);
    // RAISE-THE-FLOOR (flag-gated, reversible): merge the catalog's off-chain
    // enrichment specs onto the authored IR. `enrichmentSpecs` is ONLY present
    // when the enrichment flag was ON at catalog build AND the card is a vanilla
    // (zero-op) body of the slice faction — so with the flag OFF this branch
    // never runs and the compiled IR is byte-identical to today (the isolation
    // guarantee the reducer-equivalence golden pins). The merge is additive: the
    // enrichment specs join both `specs` (executed by fireTrigger) and
    // `classified` (so coverage tooling sees them).
    const enrich = meta?.enrichmentSpecs as CompiledAbility["specs"] | undefined;
    if (Array.isArray(enrich) && enrich.length > 0) {
      c = {
        ...c,
        specs: [...c.specs, ...enrich],
        classified: [...c.classified, ...enrich],
      };
    }
    compiledAbilityCache.set(cardId, c);
  }
  return c;
}

/**
 * Fire a unit's compiled ability for a given trigger against the (already-cloned)
 * live state. Only runtime ops with a matching trigger resolve; untargeted ops
 * that need a target safely no-op in the resolver until Phase E targeting lands.
 * Tokens (cardId not in the catalog) compile to an empty spec list, so this is
 * naturally non-recursive.
 */
function fireTrigger(
  state: MatchState,
  controller: PlayerId,
  source: any,
  trigger: EffectTrigger,
  target?: any
) {
  // AURA_ABILITY_SILENCE: while an enemy silencer is in play, this unit's
  // ability triggers are fully suppressed (a clean no-op). The silencer itself
  // is never silenced (it is on the opposing board to its own controller).
  if (abilitiesSilenced(state, controller)) return;
  for (const spec of compiledFor(source.cardId).specs) {
    if (spec.trigger !== trigger) continue;
    resolveEffect(spec, {
      state,
      controller,
      source,
      target,
      lane: source.lane,
      factionOf: (id: string) => cardMetaById.get(id)?.faction ?? null,
      costOf,
      // DISCOVER battlecries filter the controller's deck by card type; supply the
      // catalog lookup so the option pool is built honestly (absent -> empty pool
      // -> clean no-op, never a fake choice).
      cardTypeOf,
      // REVEAL_AND_CULL (Darius) destroys revealed DECK cards: supply the stat-line
      // lookup so each destroyed card gets a faithful graveyard record.
      graveStatsOf,
      // Spell/ability DEAL_DAMAGE honors the SAME flat mitigation + floor-HP combat
      // does (shield-absorb is built into applyDamageInstance regardless).
      mitigationOf: mitigationFor,
      hasFloorHp: (id: string) => unitHasOp(id, "PASSIVE_FLOOR_HP"),
    });
  }
}

/** Look up a unit's PASSIVE combat modifier (Judgment / Fear) from its compiled
 *  ability, if any. Passives are not one-shot effects; they alter combat math /
 *  legality and are consulted directly at attack time. */
function passiveSpec(cardId: string, op: "PIERCE_ARMOR" | "RESTRICT_ATTACK") {
  // Only true PASSIVE combat modifiers (Judgment / Fear) qualify. Patient also
  // emits a RESTRICT_ATTACK, but as a STATIC "this unit cannot attack" marker —
  // it must NOT bleed into Fear's defender logic, so the trigger gate excludes it.
  return compiledFor(cardId).specs.find((s) => s.op === op && s.trigger === "PASSIVE");
}

/** True if a unit carries PATIENT's self-restriction: a RESTRICT_ATTACK spec with
 *  trigger "STATIC" ("this unit cannot attack"). This is the ATTACKER-SIDE marker
 *  PATIENT emits in every branch of its compiler (abilityCompiler.ts ~926-985),
 *  and is DISTINCT from Fear's defender-side RESTRICT_ATTACK (trigger "PASSIVE",
 *  consumed by passiveSpec). Gating on trigger === "STATIC" keeps Fear untouched. */
function attackerIsRestricted(cardId: string): boolean {
  return compiledFor(cardId).specs.some((s) => s.op === "RESTRICT_ATTACK" && s.trigger === "STATIC");
}

/** True if a unit's compiled ability carries a given op (any trigger). Used for
 *  combat-legality passives (COMMANDER_SHIELD, DOUBLE_ATTACK, PASSIVE_FLOOR_HP). */
function unitHasOp(cardId: string, op: EffectOp): boolean {
  return compiledFor(cardId).specs.some((s) => s.op === op);
}

/** True if ANY live unit on a player's board carries a given passive op. */
function boardHasOp(state: MatchState, playerId: PlayerId, op: EffectOp): boolean {
  const b = state.players[playerId].board;
  return [...(b?.front ?? []), ...(b?.back ?? [])].some((u: any) => unitHasOp(u.cardId, op));
}

/** Track A2 (1): a unit's flat COMBAT-damage mitigation (Armored/Patient "reduce
 *  damage by N"). Summed from the unit's compiled MITIGATE_DAMAGE specs and
 *  re-derived from the static ability each call, so it is idempotent and
 *  deterministic. Reject-soft: a missing/illegal cardId yields 0 (no mitigation).
 *  This is SEPARATE from `armor` (already applied in resolveMitigatedDamage) and
 *  from WARD/DIVINE_SHIELD absorb — see applyCombatDamage for the layering order. */
function mitigationFor(cardId: string): number {
  let total = 0;
  for (const s of compiledFor(cardId).specs) {
    if (s.op === "MITIGATE_DAMAGE") total += Math.max(0, s.amount ?? 0);
  }
  return total;
}

/** Apply a single combat-damage instance to a unit, honoring PASSIVE_FLOOR_HP
 *  (e.g. Walter): a unit with that passive can never be dropped below 1 HP by ONE
 *  damage instance. EXECUTE / hard-removal that set health to 0 directly bypass
 *  this (they are not "damage instances"). A unit already at/below 1 is untouched
 *  by the floor (it doesn't get healed up to 1).
 *
 *  TRACK A2 layering (documented order): the incoming `amount` reaches here AFTER
 *  armor (resolveMitigatedDamage subtracts the defender's `armor` field) and AFTER
 *  WARD/DIVINE_SHIELD absorb (absorbDamage in the reducer). This function then
 *  applies the unit's flat MITIGATE_DAMAGE reduction LAST, floored at 0 so it can
 *  never heal or push damage negative. Mitigation is intentionally kept distinct
 *  from armor (a different field/mechanic) so it never double-counts with
 *  PIERCE_ARMOR (which only ignores `armor`, not this reduction — by design, since
 *  Judgment pierces armor, not the bearer's Armored "reduce damage by N" passive).
 *
 *  Damage-window trackers (A2 (2)/(3)) are also stamped here on the ACTUAL points
 *  landed: `tookDamageThisTurn` flags the undamaged-window grower, and
 *  `lastDamageTaken` / `damageTakenThisTurn` feed the per-point grower. */
function applyCombatDamage(unit: any, amount: number): number {
  if (amount <= 0) return 0;
  // SINGLE SOURCE OF TRUTH: delegate the flat-mitigation → floor-HP → subtract
  // stack to applyDamageInstance (shared with spell/ability damage). The shield
  // has already been consumed upstream (absorbDamage in resolveAttackUnitCombat),
  // so the helper's shield step is a no-op here (no double absorb). We pass this
  // unit's compiled mitigation + PASSIVE_FLOOR_HP flag as the injected layers.
  const landed = applyDamageInstance(unit, amount, {
    mitigation: mitigationFor(unit.cardId),
    floorHp: unitHasOp(unit.cardId, "PASSIVE_FLOOR_HP"),
  });
  if (landed <= 0) {
    // Fully absorbed by flat mitigation: no damage landed. Zero the per-hit
    // record so a downstream ON_DAMAGE per-point grower reads 0 (no spurious
    // buff off a stale value).
    unit.lastDamageTaken = 0;
    return 0;
  }
  // Damage-window bookkeeping on the points actually landed.
  unit.tookDamageThisTurn = true;
  unit.lastDamageTaken = landed;
  unit.damageTakenThisTurn = (unit.damageTakenThisTurn ?? 0) + landed;
  return landed;
}

/** Post-swing bookkeeping shared by ATTACK_UNIT / ATTACK_FACE. Increments the
 *  unit's per-turn attack tally, then decides whether it stays ready:
 *   - WINDFURY: the existing one-bonus-swing rule (delegated, unchanged).
 *   - DOUBLE_ATTACK (e.g. Harley): may strike twice; stays ready until its 2nd
 *     swing, then exhausts. Reset to 0 attacks at the controller's turn start.
 *  A unit with neither keeps the vanilla "exhaust after one swing" behavior. */
function markAttacked(unit: any): void {
  unit.attacksThisTurn = (unit.attacksThisTurn ?? 0) + 1;
  if (consumeWindfuryStrike(unit)) return; // WINDFURY granted a bonus swing
  if (unitHasOp(unit.cardId, "DOUBLE_ATTACK") && (unit.attacksThisTurn ?? 0) < 2) return;
  unit.exhausted = true;
}

/** AURA_ABILITY_SILENCE: a unit's abilities are suppressed while ANY enemy unit
 *  carrying the silence aura is in play. The owner of `source` is `controller`,
 *  so the silencer must be on the OPPOSING board. */
function abilitiesSilenced(state: MatchState, controller: PlayerId): boolean {
  return boardHasOp(state, opponentOf(controller), "AURA_ABILITY_SILENCE");
}

/** Continuous cost-reduction aura total for the controller. Sums every friendly
 *  source's reduction op (AURA_COST_REDUCTION for units, AURA_SPELL_COST for
 *  spells) — re-derived from the live board each call, so it is idempotent and
 *  drops cleanly when a source leaves play. Floors at 0 at the call site. */
function costReductionFor(state: MatchState, controller: PlayerId, op: EffectOp): number {
  const b = state.players[controller].board;
  let total = 0;
  for (const u of [...(b?.front ?? []), ...(b?.back ?? [])]) {
    for (const s of compiledFor((u as any).cardId).specs) {
      if (s.op === op) total += s.amount ?? 0;
    }
  }
  return total;
}

/** Win detection on the LIVED shape: nexusHealth + deck-out only. Mirrors the
 *  hook's `detectWinner` — the dead `health`-based path is never consulted. */
function detectWinner(state: MatchState, initiator?: PlayerId): PlayerId | null {
  if (state.winner === "P1" || state.winner === "P2") return state.winner;
  const p1Dead = (state.players.P1.nexusHealth ?? STARTING_NEXUS_HEALTH) <= 0;
  const p2Dead = (state.players.P2.nexusHealth ?? STARTING_NEXUS_HEALTH) <= 0;
  // Lethal (nexus depletion) is always checked first, so a finishing blow still
  // wins even when an opponent is one tick from a control victory.
  // TRUE SIMULTANEOUS DEATH: if BOTH hexes hit <=0 in the SAME action, a draw is not
  // representable (`winner: PlayerId | null`), so the player who INITIATED the lethal
  // action (the attacker) wins — deterministic and fair (their action caused resolution).
  // When the initiator is unknown (non-attack resolution) we fall back to the historical
  // P1-first order, keeping the golden fixture unmoved.
  if (p1Dead && p2Dead) return initiator ?? "P1";
  if (p2Dead) return "P1";
  if (p1Dead) return "P2";
  return null;
}

function removeDead(board: { front: any[]; back: any[] }) {
  board.front = (board.front ?? []).filter((u: any) => (u?.health ?? 0) > 0);
  board.back = (board.back ?? []).filter((u: any) => (u?.health ?? 0) > 0);
}

/** A minted token (cardId `token_*` / `unit_*`) has no catalog card, so it ceases
 *  to exist on death and never enters the graveyard. Mirrors effectResolver's
 *  isTokenCard(). */
function isTokenCardId(cardId: string): boolean {
  return cardId.startsWith("token_") || cardId.startsWith("unit_");
}

/** SUMMON_ON_ANY_DEATH watchers (e.g. Crypt Keeper): when ANY unit dies, every
 *  live watcher on the board mints its token for the watcher's controller. Walks
 *  both boards in the canonical P1-front → P2-back order so multi-watcher mints
 *  are deterministic. The just-dead unit (`dead`) is excluded as a watcher source
 *  so a dying Crypt Keeper does not spawn off its own death twice. */
function fireDeathWatchers(state: MatchState, dead: any) {
  for (const owner of ["P1", "P2"] as PlayerId[]) {
    const board = state.players[owner].board;
    for (const lane of ["front", "back"] as Lane[]) {
      for (const w of board?.[lane] ?? []) {
        if (w === dead || (w.health ?? 0) <= 0) continue;
        const spec = compiledFor(w.cardId).specs.find((s) => s.op === "SUMMON_ON_ANY_DEATH");
        if (!spec) continue;
        resolveEffect(
          { trigger: "PASSIVE", op: "SUMMON_TOKEN", attack: spec.attack, health: spec.health, token: spec.token, raw: spec.raw },
          {
            state,
            controller: owner,
            source: w,
            lane: w.lane,
            factionOf: (id: string) => cardMetaById.get(id)?.faction ?? null,
            costOf,
          }
        );
      }
    }
  }
}

/** Hard cap on `drainTriggerQueue` iterations. Each drained entry either resolves
 *  a finite ON_DEATH/watcher batch or is a no-op; a pathological mutual-death
 *  cycle (two watchers minting tokens that kill each other) is already bounded by
 *  the MAX_LANE_UNITS lane cap, but this is a second, absolute backstop: after
 *  this many drains the queue is abandoned (cleared) and death resolution stops
 *  CLEANLY — never throws, never loops forever. 1000 is far above any legitimate
 *  chain depth (a real board tops out at 28 units across 4 lanes), so it can only
 *  fire on a true cycle, and stopping there is deterministic (state-only). */
const DRAIN_ITERATION_CAP = 1000;

/** Process ONE newly-dead unit: run its ONCEDEATH_REVIVE gate, deathrattle nexus
 *  burst, and graveyard record, then ENQUEUE its ON_DEATH and SUMMON_ON_ANY_DEATH
 *  triggers (ON_DEATH first, watchers second — the SAME relative order the old
 *  inline pass fired them in). The corpse is NOT removed here: it stays on the
 *  board so its queued ON_DEATH summon enters its own lane when the queue drains.
 *  Returns true if the unit truly died (was reaped + enqueued), false if it was
 *  revived instead (no triggers). Marks the corpse `_reaped` so a re-scan never
 *  double-processes a unit still sitting at health<=0 awaiting its drain. */
function reapAndEnqueue(state: MatchState, owner: PlayerId, u: any): boolean {
  // ONCEDEATH_REVIVE (e.g. Jean): once per match, a unit returns to the board at
  // full HP INSTEAD of dying. It never truly died, so no deathrattle / ON_DEATH /
  // graveyard / death-watcher fires for it.
  if (unitHasOp(u.cardId, "ONCEDEATH_REVIVE") && !u.reviveUsed) {
    u.reviveUsed = true;
    u.health = u.maxHealth ?? 1;
    return false;
  }
  u._reaped = true;
  if (hasDeathrattle(u)) {
    const enemy = opponentOf(owner);
    state.players[enemy].nexusHealth =
      (state.players[enemy].nexusHealth ?? STARTING_NEXUS_HEALTH) - DEATHRATTLE_NEXUS_DAMAGE;
  }
  // GRAVEYARD: a non-token corpse is recorded for its owner (most-recent last),
  // carrying enough to reconstruct a playable unit. Tokens vanish. Recorded here
  // (at reap time, in canonical sweep order) — identical to the old pass, which
  // recorded the corpse in the same per-unit order before clearing the lane.
  if (!isTokenCardId(u.cardId)) {
    const grave = state.players[owner].graveyard ?? (state.players[owner].graveyard = []);
    grave.push({
      cardId: u.cardId,
      // Strip any live aura bonus so the recorded stat line is the unit's own
      // base (auras are re-derived on resurrect via recomputeAuras).
      attack: Math.max(0, (u.attack ?? 0) - (u.auraAtk ?? 0)),
      maxHealth: Math.max(1, (u.maxHealth ?? u.health ?? 1) - (u.auraHp ?? 0)),
      keywords: [...(u.keywords ?? [])],
    });
  }
  const q: TriggerQueueEntry[] = state.triggerQueue ?? (state.triggerQueue = []);
  q.push({ kind: "ON_DEATH", controller: owner, source: u, dead: u });
  q.push({ kind: "SUMMON_ON_ANY_DEATH", controller: owner, source: u, dead: u });
  return true;
}

/** Scan BOTH boards in the canonical P1-front-asc → P1-back-asc → P2-front-asc →
 *  P2-back-asc order for newly-dead units (`health <= 0`) that have not yet been
 *  reaped, reaping + enqueuing each via `reapAndEnqueue`. Returns the count of
 *  units newly enqueued this sweep (0 means no new deaths to chain). The dying
 *  set per lane is snapshotted before iterating so an ON_DEATH summon already on
 *  the board does not perturb the index walk. */
function sweepNewDeaths(state: MatchState): number {
  let enqueued = 0;
  for (const owner of ["P1", "P2"] as PlayerId[]) {
    const board = state.players[owner].board;
    for (const lane of ["front", "back"] as Lane[]) {
      const dying = (board?.[lane] ?? []).filter((u: any) => (u?.health ?? 0) <= 0 && !u._reaped);
      for (const u of dying) {
        if (reapAndEnqueue(state, owner, u)) enqueued += 1;
      }
    }
  }
  return enqueued;
}

/** Remove every reaped corpse from both boards (corpses that survived as revived
 *  units have `_reaped` unset and stay). Also strips the transient `_reaped` flag
 *  off any survivor so it never leaks into a structuredClone / event payload. */
function removeReaped(state: MatchState) {
  for (const owner of ["P1", "P2"] as PlayerId[]) {
    const board = state.players[owner].board;
    for (const lane of ["front", "back"] as Lane[]) {
      board[lane] = (board?.[lane] ?? []).filter((u: any) => !u._reaped);
    }
  }
}

/** Drain the death-trigger queue to completion (FIFO), firing each entry's
 *  ON_DEATH / SUMMON_ON_ANY_DEATH effect. AFTER every entry resolves, re-scan for
 *  units it newly killed and enqueue THEIR triggers (in canonical board order) —
 *  so a chained death ("X dies → its ON_DEATH kills Y → Y's ON_DEATH fires → Y's
 *  death-watchers mint") resolves within the SAME action, FIFO with new deaths
 *  appended. Reaped corpses are spliced off the board only after the whole queue
 *  drains, so an ON_DEATH summon still enters its dead unit's lane. Bounded by
 *  DRAIN_ITERATION_CAP for a clean stop against a pathological mutual-death loop. */
function drainTriggerQueue(state: MatchState) {
  const q: TriggerQueueEntry[] = state.triggerQueue ?? (state.triggerQueue = []);
  let iterations = 0;
  while (q.length > 0) {
    if (++iterations > DRAIN_ITERATION_CAP) {
      // Clean termination backstop: abandon the remaining queue and stop. The cap
      // is unreachable by any legitimate chain, so this only fires on a true cycle.
      // Before bailing, finalize: a mid-resolution board may already be decided
      // (a hex at <=0), so stamp the winner now rather than leaving the match hung
      // with no winner. detectWinner is pure/idempotent and a no-op if undecided.
      q.length = 0;
      const w = detectWinner(state);
      if (w && state.winner !== w) state.winner = w;
      break;
    }
    const entry = q.shift() as TriggerQueueEntry;
    if (entry.kind === "ON_DEATH") {
      // ON_DEATH effect specs (e.g. summon-a-token-on-death, return-from-grave)
      // resolve while the corpse is still on the board, so a summoned token enters
      // the dead unit's lane.
      fireTrigger(state, entry.controller, entry.source, "ON_DEATH");
    } else {
      // SUMMON_ON_ANY_DEATH (e.g. Crypt Keeper): every live watcher mints a token
      // for ITS controller in response to this death. The dead unit is excluded as
      // a watcher source so a dying watcher does not spawn off its own death twice.
      fireDeathWatchers(state, entry.dead);
    }
    // Chain: an effect above may have set another unit to health<=0. Reap + enqueue
    // those NEW deaths now, in canonical order, so they resolve later in this drain.
    sweepNewDeaths(state);
  }
  removeReaped(state);
}

/** Resolve combat deaths across BOTH boards. Newly-dead units are reaped and
 *  their death triggers ENQUEUED in the canonical order below, then the queue is
 *  drained to completion (`drainTriggerQueue`) so chained deaths resolve in the
 *  same action. Each corpse fires DEATHRATTLE (a fixed nexus burst against the
 *  enemy of the dead unit's owner) and records into its OWNER's graveyard at reap
 *  time; its ON_DEATH and death-watchers fire when the queue drains, before the
 *  corpse is spliced off the board.
 *
 *  CANONICAL SIMULTANEOUS-DEATH ORDER (see src/engine/RESOLUTION_MODEL.md).
 *  When one action kills several units at once (AoE, cleave, aura-loss combined
 *  with combat, etc.) every dead unit is reaped in a single STABLE board order
 *  that depends only on state — never on Object/Map iteration order:
 *
 *    1. by OWNER       — P1 before P2 (fixed literal array, NOT active-player
 *                        relative; the order is absolute so a replay is identical
 *                        regardless of whose action caused the storm)
 *    2. by LANE        — front before back (fixed literal array)
 *    3. by ARRAY INDEX — ascending (Array.filter preserves index order)
 *
 *  Because the queue is seeded in this exact sweep and drained FIFO, ON_DEATH
 *  effects fire — and graveyard records land — in the same
 *  P1-front-asc → P1-back-asc → P2-front-asc → P2-back-asc order as the old inline
 *  pass for SIMULTANEOUS deaths. CHAINED deaths (caused by a drained trigger) are
 *  appended after the current batch, FIFO, so they resolve later in the same drain
 *  rather than being silently dropped to the next action. An on-death summon mints
 *  into the dead unit's lane via SUMMON_TOKEN (ascending idCounter ids,
 *  left-to-right); a minted token is not itself dead, so it survives this pass and
 *  is not double-reaped. */
function resolveDeaths(state: MatchState) {
  sweepNewDeaths(state);
  drainTriggerQueue(state);
}

/**
 * Continuous-effects layer. Every "while this unit is in play" effect is
 * RECOMPUTED from scratch after every board change so it tracks the live aura
 * sources exactly — it is never applied as a one-shot mutation. Covered ops:
 *
 *   AURA_FACTION_STAT — "[your] [other] <Faction> gain +A/+B" (faction-scoped)
 *   AURA_ALLY_STAT    — "[your] [other] allied units gain +A/+B" (any ally)
 *   AURA_ADJACENT_STAT— "adjacent [ally|Faction] gain +A/+B" (same-lane index ±1)
 *   AURA_KEYWORD      — "[adjacent] [other] allies gain <KEYWORD>"
 *
 * The pass:
 *   1. STRIP every unit's previously-applied stat bonus (auraAtk/auraHp) from
 *      attack/maxHealth/health back to base, and CLEAR its derived keyword set.
 *   2. DERIVE the active sources on each board from the compiled specs.
 *   3. APPLY each source's grant to its beneficiaries (controller's board only),
 *      re-recording the stat bonus (auraAtk/auraHp) and stamping derived
 *      keywords (auraKeywords). Stacking is additive and order-independent.
 *
 * Because step 1 removes precisely what step 3 added last pass, recompute is
 * idempotent: a still-active aura nets zero change, while a source that just
 * left play cleanly drops its grant. A beneficiary reduced to <=0 by losing a
 * +health aura is reaped by removeDead WITHOUT a deathrattle (aura-loss is not a
 * combat death). Adjacency uses the same-lane array index ±1 convention used by
 * DAMAGE_ADJACENT_ENEMIES / "for each adjacent unit".
 */
function recomputeAuras(state: MatchState) {
  for (const owner of ["P1", "P2"] as PlayerId[]) {
    const board = state.players[owner].board;
    const lanes: Lane[] = ["front", "back"];
    const units: any[] = [...(board?.front ?? []), ...(board?.back ?? [])];

    // 1. Strip prior stat bonuses back to base and clear derived keywords.
    //    Remember the keywords each unit was granted LAST pass so step 3 can
    //    detect a NEWLY-granted shield (arm-once, no infinite re-shield).
    const prevAuraKw = new Map<any, string[]>();
    for (const u of units) {
      const aAtk = u.auraAtk ?? 0;
      const aHp = u.auraHp ?? 0;
      u.attack -= aAtk;
      // BUG 1 FIX: lowering the aura's +health drops maxHealth, then CLAMPS
      // current health to the new max. A beneficiary already chipped BELOW the
      // new max keeps its real (non-aura) current health — it does NOT take
      // phantom damage (and is not healed). Health only falls if it was above
      // the new cap. (Old code did `health -= aHp` unconditionally, silently
      // dealing real damage and able to reap a chipped unit.)
      u.maxHealth -= aHp;
      if ((u.health ?? 0) > u.maxHealth) u.health = u.maxHealth;
      u.auraAtk = 0;
      u.auraHp = 0;
      prevAuraKw.set(u, u.auraKeywords ?? []);
      u.auraKeywords = [];
    }

    const factionOf = (u: any): string | undefined => cardMetaById.get(u.cardId)?.faction;
    // Normalize a parsed faction-noun ("silver sentinel") to the catalog enum
    // ("SILVER_SENTINELS") so the scaleFaction filter matches a unit's faction.
    const normFaction = (s?: string): string | undefined =>
      s ? `${s.trim().toUpperCase().replace(/\s+/g, "_")}S` : undefined;

    // Same-lane neighbours (index ±1) of a source unit on this board.
    const adjacentTo = (src: any): any[] => {
      for (const lane of lanes) {
        const arr = board?.[lane] ?? [];
        const i = arr.indexOf(src);
        if (i < 0) continue;
        const out: any[] = [];
        if (arr[i - 1]) out.push(arr[i - 1]);
        if (arr[i + 1]) out.push(arr[i + 1]);
        return out;
      }
      return [];
    };

    const applyStat = (u: any, attack: number, health: number) => {
      u.attack += attack;
      u.maxHealth += health;
      u.health += health;
      u.auraAtk = (u.auraAtk ?? 0) + attack;
      u.auraHp = (u.auraHp ?? 0) + health;
    };
    const SHIELD_KW = new Set(["DIVINE_SHIELD", "WARD"]);
    const applyKeyword = (u: any, kw: string) => {
      const set: string[] = u.auraKeywords ?? (u.auraKeywords = []);
      if (!set.includes(kw)) set.push(kw);
      // BUG 5 FIX: a shield keyword granted by aura must ARM the one-shot
      // `shielded` flag (normally only `initShield` arms it, at summon). Arm
      // ONLY on the pass where the unit NEWLY gains the shield via aura — i.e.
      // it did not have this shield keyword in its PREVIOUS aura-keyword set.
      // This is idempotent: a still-active shield aura does NOT re-arm each
      // recompute (prevAuraKw already had it), so a consumed shield is not
      // refilled = no infinite-shield exploit. A printed-keyword unit is armed
      // by initShield at summon and is untouched here unless it lacked the kw.
      if (SHIELD_KW.has(kw)) {
        const hadBefore = (prevAuraKw.get(u) ?? []).includes(kw);
        const printed = Array.isArray(u.keywords) && u.keywords.includes(kw);
        if (!hadBefore && !printed && !u.shielded) {
          u.shielded = true;
        }
      }
    };

    // 2 + 3. Derive every continuous source and apply its grant. Each source's
    // beneficiary set is computed fresh from the current board, so the pass is
    // order-independent: applying sources in any order yields the same result.
    for (const src of units) {
      const srcFaction = factionOf(src);
      for (const spec of compiledFor(src.cardId).specs) {
        switch (spec.op) {
          case "AURA_FACTION_STAT": {
            // Faction-scoped stat aura. "other" semantics by default; an
            // inclusive ("your X") aura also buffs the source.
            if (!srcFaction) break;
            for (const u of units) {
              if (u === src && !spec.includeSelf) continue;
              if (factionOf(u) !== srcFaction) continue;
              applyStat(u, spec.attack ?? 0, spec.health ?? 0);
            }
            break;
          }
          case "AURA_ALLY_STAT": {
            // Generic ally stat aura (any ally on the controller's board).
            for (const u of units) {
              if (u === src && !spec.includeSelf) continue;
              applyStat(u, spec.attack ?? 0, spec.health ?? 0);
            }
            break;
          }
          case "AURA_ADJACENT_STAT": {
            // Same-lane neighbours (index ±1). Optional faction filter.
            const wantFaction = normFaction(spec.scaleFaction);
            for (const u of adjacentTo(src)) {
              if (wantFaction && factionOf(u) !== wantFaction) continue;
              applyStat(u, spec.attack ?? 0, spec.health ?? 0);
            }
            break;
          }
          case "AURA_KEYWORD": {
            // Continuous keyword grant. allAdjacent => same-lane neighbours;
            // otherwise the controller's other/all allies. Optional faction
            // filter scopes a faction-noun subject.
            if (!spec.keyword) break;
            const wantFaction = normFaction(spec.scaleFaction);
            const targets = spec.allAdjacent ? adjacentTo(src) : units;
            for (const u of targets) {
              if (!spec.allAdjacent && u === src && !spec.includeSelf) continue;
              if (wantFaction && factionOf(u) !== wantFaction) continue;
              applyKeyword(u, spec.keyword);
            }
            break;
          }
          default:
            break;
        }
      }
    }

    // A unit brought to <=0 by losing aura max-health is cleared (no deathrattle).
    removeDead(board);
  }
}

/** GUARD (taunt): a defender carrying GUARD must be cleared before its
 *  controller's nexus or non-GUARD units can be attacked. */
function playerHasGuard(state: MatchState, playerId: PlayerId): boolean {
  const b = state.players[playerId].board;
  return [...(b?.front ?? []), ...(b?.back ?? [])].some((u: any) => unitHasKeyword(u, "GUARD"));
}

/** FLYING (evasion): a flyer can only be targeted by another flyer or a RANGED
 *  attacker. Ground attackers without reach cannot hit it. */
function canTargetDefender(attacker: any, defender: any): boolean {
  if (!unitHasKeyword(defender, "FLYING")) return true;
  return unitHasKeyword(attacker, "FLYING") || unitHasKeyword(attacker, "RANGED");
}

/** LIFESTEAL / ability heal: top the controller's nexus back up by `amount`,
 *  capped at the player's OWN starting face HP (`maxNexusHealth`, e.g. the live
 *  solo 25-Hex newcomer cushion) — and NEVER reducing: a player already above
 *  the cap keeps their current total. (Teardown D1: the old hard
 *  STARTING_NEXUS_HEALTH clamp made heals actively DAMAGE a 25-start player.) */
function healNexus(state: MatchState, playerId: PlayerId, amount: number) {
  if (amount <= 0) return;
  const p = state.players[playerId];
  const cur = p.nexusHealth ?? STARTING_NEXUS_HEALTH;
  const cap = Math.max(p.maxNexusHealth ?? STARTING_NEXUS_HEALTH, cur);
  p.nexusHealth = Math.min(cap, cur + amount);
}

function findUnitByInstance(state: MatchState, playerId: PlayerId, instanceId: string) {
  for (const lane of ["front", "back"] as Lane[]) {
    const arr = state.players[playerId].board?.[lane] ?? [];
    const idx = arr.findIndex((u: any) => u.instanceId === instanceId);
    if (idx >= 0) return { lane, idx, unit: arr[idx] };
  }
  return null;
}

/** Highest-cost enemy unit on a player's board (COPY_UNIT auto-target). Ties
 *  break on board order (front lane first). Returns undefined for an empty board. */
function highestCostEnemyUnit(state: MatchState, enemy: PlayerId): any {
  let best: any = undefined;
  let bestCost = -1;
  for (const lane of ["front", "back"] as Lane[]) {
    for (const u of state.players[enemy].board?.[lane] ?? []) {
      const c = costOf((u as any).cardId);
      if (c > bestCost) {
        best = u;
        bestCost = c;
      }
    }
  }
  return best;
}

function reject(state: MatchState, reason: string): ApplyResult {
  // State returned UNCHANGED (same reference is fine; reducer never mutates the
  // input before validation). Callers treat REJECTED as a no-op.
  return { state, events: [{ type: "REJECTED", reason }] };
}

/** Build the CHOICE_OPENED event from a state that just raised a pending choice.
 *  Pure projection of `pendingChoice`; the controller is the `player`. */
function choiceOpenedEvent(state: MatchState): GameEvent {
  const pc = state.pendingChoice!;
  return {
    type: "CHOICE_OPENED",
    player: pc.controller,
    kind: pc.kind,
    options: pc.options.map((o) => o.id),
  };
}

/**
 * Deterministic auto-pick for harnesses (AI / sim / e2e) that must drain a raised
 * choice with no human in the loop. ALWAYS returns the FIRST option's id — a fixed,
 * pure function of state, so a replay drains identically (RESOLUTION_MODEL.md §8 /
 * CHOICE_DESIGN §6). Returns null only if there is no pending choice (no option to
 * pick), letting callers skip cleanly. Never advances RNG.
 */
export function autoPickOption(state: MatchState): string | null {
  const pc = state.pendingChoice;
  if (!pc || pc.options.length === 0) return null;
  return pc.options[0].id;
}

/**
 * Resolve a pending CHOICE. Entered ONLY from the global gate with `next` already
 * cloned and `next.pendingChoice` non-null. Legality (after no-pending-choice,
 * which the gate handled): not-your-choice -> illegal-option. On a valid pick it
 * runs the resume tail (move the chosen card deck->hand, or mint pool->hand),
 * clears `pendingChoice`, reaps deaths + checks the win (deferred from the action
 * that raised the choice), and emits CHOICE_RESOLVED. No RNG is consumed here — the
 * option list was already generated deterministically when the choice opened.
 */
function resolvePendingChoice(
  next: MatchState,
  action: { type: "RESOLVE_CHOICE"; player: PlayerId; optionId: string },
  original: MatchState,
  events: GameEvent[]
): ApplyResult {
  const pc = next.pendingChoice!;
  // Only the choice's controller may resolve it.
  if (action.player !== pc.controller) {
    return reject(original, "not-your-choice");
  }
  // The optionId must be one of the offered options (stale / spoofed picks no-op).
  const picked = pc.options.find((o) => o.id === action.optionId);
  if (!picked) {
    return reject(original, "illegal-option");
  }
  // Run the resume tail. For a Discover the picked id IS the cardId.
  const cardId = picked.cardId ?? picked.id;
  if (pc.resume.op === "ADD_CARD_TO_HAND") {
    if (pc.resume.source === "deck") {
      moveCardDeckToHand(next, pc.controller, cardId);
    } else {
      addCardToHand(next, pc.controller, cardId);
    }
  }
  // Clear the pause BEFORE the deferred reap / win check so downstream logic sees a
  // settled state, then finalize exactly as the raising action would have.
  next.pendingChoice = null;
  resolveDeaths(next);
  events.push({ type: "CHOICE_RESOLVED", player: pc.controller, optionId: action.optionId });
  finalizeWin(next, events);
  return { state: next, events };
}

/**
 * Resolve an OPENING MULLIGAN during an explicit mulligan phase (PART 1). Entered ONLY
 * from the global mulligan gate, with `next` already cloned and `next.mulligan` present
 * AND at least one side still `pending`. Either player may resolve their OWN side (the
 * gate does not bind this to `activePlayer`), exactly once.
 *
 * Hearthstone-style selective redraw: the chosen opening-hand indices (`action.cards`)
 * are removed from hand and returned to the deck; the deck is then RESHUFFLED with the
 * match's SEEDED rng and an equal number of fresh cards are drawn off the top. The hand's
 * non-mulliganed cards keep their original order; the redrawn cards are appended.
 *
 * DETERMINISM: the reshuffle uses ONLY `makeRng(state.seed)` fast-forwarded to
 * `state.rngCursor` (mirroring effectResolver's `seededReshuffle` / `rngAt`), then advances
 * `state.rngCursor` by exactly the draws Fisher-Yates consumed (`max(0, n-1)` for a deck
 * of n>=2; ZERO for n<2). So the same seed yields the same post-mulligan deck+hand on
 * every replay, and a no-op mulligan (empty `cards`, or `cards` omitted) consumes no RNG.
 *
 * Legality (state returned UNCHANGED on any reject): not-your-... is implicit (a side
 * resolves its own seat); a side already `done` -> `mulligan-already-done`; an index out
 * of range or duplicated -> `mulligan-bad-index`.
 */
function resolveMulligan(
  next: MatchState,
  action: { type: "MULLIGAN"; player: PlayerId; cards?: number[] },
  original: MatchState,
  events: GameEvent[]
): ApplyResult {
  const mull = next.mulligan!;
  const seat = action.player;
  if (mull[seat] !== "pending") {
    return reject(original, "mulligan-already-done");
  }
  const player = next.players[seat];
  const hand: string[] = Array.isArray(player.hand) ? player.hand : [];

  // Normalize the chosen indices: an omitted `cards` (the "keep everything" mulligan) is
  // an empty selection — a clean no-op redraw. Validate every index is a real, distinct
  // hand slot BEFORE mutating, so a bad request rejects with state untouched.
  const chosen = action.cards ?? [];
  const seen = new Set<number>();
  for (const idx of chosen) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= hand.length || seen.has(idx)) {
      return reject(original, "mulligan-bad-index");
    }
    seen.add(idx);
  }

  // Partition the hand: kept cards retain original order; returned cards go back to deck.
  const kept: string[] = [];
  const returned: string[] = [];
  for (let i = 0; i < hand.length; i += 1) {
    if (seen.has(i)) returned.push(hand[i]);
    else kept.push(hand[i]);
  }

  // Return the chosen cards to the deck, then reshuffle the WHOLE deck deterministically
  // with the seeded stream (so returned cards are genuinely shuffled back in, not just
  // bottom-stacked — a mulliganed card CAN legitimately be redrawn, Hearthstone-style),
  // advancing rngCursor by exactly the draws consumed. An EMPTY selection returns nothing,
  // so we SKIP the reshuffle entirely: zero RNG consumed and the deck/hand are untouched,
  // making a no-op mulligan byte-identical to "no mulligan at all".
  const redrawCount = returned.length;
  let deck: string[] = [...(Array.isArray(player.deck) ? player.deck : []), ...returned];
  const drawn: string[] = [];
  if (redrawCount > 0) {
    const n = deck.length;
    if (n >= 2) {
      const rng = makeRng(next.seed);
      const cursor = next.rngCursor ?? 0;
      for (let i = 0; i <= cursor; i += 1) rng();
      deck = seededShuffle(deck, rng);
      next.rngCursor = cursor + (n - 1);
    }
    // Redraw an equal number of cards off the (reshuffled) top.
    for (let i = 0; i < redrawCount; i += 1) {
      const c = deck.shift();
      if (c) drawn.push(c);
    }
    player.deck = deck;
    player.deckCount = deck.length;
  }
  player.hand = [...kept, ...drawn];

  // Flip this side to done. The match "starts" once BOTH sides are done.
  mull[seat] = "done";

  events.push({ type: "MULLIGAN_RESOLVED", player: seat, redrawn: redrawCount });
  return { state: next, events };
}

/** Shared start-of-turn draw. Mutates the cloned state. Returns false on
 *  deck-out (fatigue): sets `winner` to the opponent, exactly like the hook.
 *
 *  DECKOUT (alt win-con, `rules.deckoutLoss`): drawing from an empty deck loses you the
 *  game. The historical (vanilla) behavior ALREADY loses on an empty draw, so this is
 *  the DEFAULT and the golden fixture is unmoved. The flag exists to let a ruleset
 *  EXPLICITLY DISABLE it (`deckoutLoss: false`) for a no-fatigue variant; absent/true =
 *  the proven loss. Lethal-nexus still precedes (detectWinner checks nexus first). */
function drawForPlayer(state: MatchState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  const lib: string[] = Array.isArray(player.deck) ? player.deck : [];
  if (lib.length === 0) {
    // Default (vanilla / flag absent / flag true): empty draw loses. Only an explicit
    // `deckoutLoss: false` opts out, leaving the drawing player alive with no card.
    if (state.rules?.deckoutLoss !== false) {
      state.winner = opponentOf(playerId);
    }
    return false;
  }
  const drawn = lib.shift() as string;
  player.deck = lib;
  player.deckCount = lib.length;
  player.hand = [...(player.hand ?? []), drawn];
  return true;
}

/**
 * Resolve a unit-vs-unit attack against the LIVE state (extracted from the ATTACK_UNIT
 * case so the response stack can run the SAME combat when a deferred entry pops). Units
 * are re-located by instanceId each call. Defensive guards make a stale/missing attacker
 * or defender a clean no-op (e.g. the attacker died to a response before this lands).
 * This body is verbatim the immediate-resolution path — under the flag-OFF default the
 * case calls it directly, so the proven combat is byte-identical.
 */
function resolveAttackUnitCombat(
  next: MatchState,
  attacker: PlayerId,
  attackerInstanceId: string,
  defenderInstanceId: string,
  events: GameEvent[]
): void {
  const attackerRef = findUnitByInstance(next, attacker, attackerInstanceId);
  const defenderRef = findUnitByInstance(next, opponentOf(attacker), defenderInstanceId);
  // Deferred-resolution guard: a response may have removed either combatant. No swing.
  if (!attackerRef || !defenderRef) return;
  if ((attackerRef.unit.health ?? 0) <= 0) return;

  const outgoing = resolveOutgoingDamage(attackerRef.unit);
  const attackerPierces = !!passiveSpec(attackerRef.unit.cardId, "PIERCE_ARMOR");
  const rawOnDefender = attackerPierces ? outgoing : resolveMitigatedDamage(attackerRef.unit, defenderRef.unit);
  const mitigated = absorbDamage(defenderRef.unit, rawOnDefender);
  const counter = absorbDamage(attackerRef.unit, resolveMitigatedDamage(defenderRef.unit, attackerRef.unit));

  const defHpBefore = defenderRef.unit.health;
  // `landed` is the post-mitigation damage that actually hit the defender. CRUSH
  // overflow must be computed from THIS (not the pre-flat-mitigation `mitigated`),
  // otherwise overflow over-counts by the defender's flat MITIGATE_DAMAGE.
  const landed = applyCombatDamage(defenderRef.unit, mitigated);
  applyCombatDamage(attackerRef.unit, counter);
  // BUG (#3) — EXECUTE + CRUSH must not leak overflow PASSIVE_FLOOR_HP would have
  // stopped. applyCombatDamage already floor-clamped the defender (a floor-HP unit
  // above 1 can't be dropped below 1 by one instance), so if the defender is still
  // alive HERE, the damage alone did NOT kill it. A subsequent EXECUTE then sets
  // health=0 as a NON-damage finisher. CRUSH overflow is `landed - defHpBefore`,
  // but for a floored unit `landed` exceeds what the floor let through, so that
  // formula leaks face damage the floor should have absorbed. Record whether the
  // damage instance itself left the defender alive so the CRUSH math can suppress
  // overflow on an EXECUTE kill of a floor-HP unit.
  const defAliveAfterDamage = (defenderRef.unit.health ?? 0) > 0;
  const defHasFloorHp = unitHasOp(defenderRef.unit.cardId, "PASSIVE_FLOOR_HP");
  // EXECUTE / lifesteal / ON_DAMAGE all key off damage that ACTUALLY LANDED.
  // `landed` is the post-shield, post-flat-mitigation value (returned by
  // applyCombatDamage); for every card except a flat-mitigation defender it
  // equals `mitigated`, so this is byte-identical to the old behavior there. A
  // defender whose WARD/DIVINE_SHIELD absorbed the hit (landed === 0) "survived
  // the hit" untouched, so the finisher does not fire — honoring the shield's
  // "first instance of damage absorbed" contract.
  let killedByExecute = false;
  if (landed > 0 && executesTarget(attackerRef.unit, defenderRef.unit)) {
    defenderRef.unit.health = 0;
    killedByExecute = true;
  }
  if (unitHasKeyword(attackerRef.unit, "CRUSH") && defenderRef.unit.health <= 0) {
    let overflow = Math.max(0, landed - Math.max(0, defHpBefore));
    // EXECUTE-overflow through a floor: when an EXECUTE finisher killed a floor-HP
    // unit the damage alone left standing, the floor would have stopped any
    // damage-overflow, so CRUSH leaks nothing (the kill came from the non-damage
    // finisher, not from damage punching through).
    if (killedByExecute && defHasFloorHp && defAliveAfterDamage) overflow = 0;
    if (overflow > 0) {
      const target = opponentOf(attacker);
      next.players[target].nexusHealth = (next.players[target].nexusHealth ?? STARTING_NEXUS_HEALTH) - overflow;
    }
  }
  healNexus(next, attacker, lifestealHeal(attackerRef.unit, landed));
  healNexus(next, opponentOf(attacker), lifestealHeal(defenderRef.unit, counter));

  markAttacked(attackerRef.unit);
  attackerRef.unit.stealthed = false;

  fireTrigger(next, attacker, attackerRef.unit, "ON_ATTACK", defenderRef.unit);
  if (landed > 0) {
    fireTrigger(next, opponentOf(attacker), defenderRef.unit, "ON_DAMAGE", attackerRef.unit);
  }
  if (counter > 0) {
    fireTrigger(next, attacker, attackerRef.unit, "ON_DAMAGE", defenderRef.unit);
  }

  if (
    unitHasOp(attackerRef.unit.cardId, "MIRROR_ATTACK") &&
    (attackerRef.unit.attacksThisTurn ?? 0) === 1 &&
    defenderRef.unit.health > 0
  ) {
    const phantomPierces = attackerPierces;
    const phantomRaw = phantomPierces
      ? resolveOutgoingDamage(attackerRef.unit)
      : resolveMitigatedDamage(attackerRef.unit, defenderRef.unit);
    const phantomDmg = absorbDamage(defenderRef.unit, phantomRaw);
    const defHpPre = defenderRef.unit.health;
    const phantomLanded = applyCombatDamage(defenderRef.unit, phantomDmg);
    // Same floor-HP capture as the primary swing (BUG #3): if the floor left the
    // defender alive after the phantom damage and EXECUTE then finishes it, CRUSH
    // must not leak overflow the floor would have absorbed.
    const phantomDefAlive = (defenderRef.unit.health ?? 0) > 0;
    const phantomDefHasFloorHp = unitHasOp(defenderRef.unit.cardId, "PASSIVE_FLOOR_HP");
    // Same EXECUTE gate as the primary swing, keyed off the post-mitigation
    // landed value: a phantom strike whose damage was shield-absorbed OR fully
    // flat-mitigated (phantomLanded === 0) does not trigger the finisher.
    let phantomKilledByExecute = false;
    if (phantomLanded > 0 && executesTarget(attackerRef.unit, defenderRef.unit)) {
      defenderRef.unit.health = 0;
      phantomKilledByExecute = true;
    }
    if (unitHasKeyword(attackerRef.unit, "CRUSH") && defenderRef.unit.health <= 0) {
      // Overflow from the points that actually landed (post flat mitigation),
      // not the pre-mitigation phantomDmg — same fix as the primary swing.
      let overflow = Math.max(0, phantomLanded - Math.max(0, defHpPre));
      // EXECUTE-overflow through a floor: suppressed exactly as the primary swing.
      if (phantomKilledByExecute && phantomDefHasFloorHp && phantomDefAlive) overflow = 0;
      if (overflow > 0) {
        const tgt = opponentOf(attacker);
        next.players[tgt].nexusHealth = (next.players[tgt].nexusHealth ?? STARTING_NEXUS_HEALTH) - overflow;
      }
    }
    healNexus(next, attacker, lifestealHeal(attackerRef.unit, phantomLanded));
    if (phantomLanded > 0 && defenderRef.unit.health > 0) {
      fireTrigger(next, opponentOf(attacker), defenderRef.unit, "ON_DAMAGE", attackerRef.unit);
    }
  }

  resolveDeaths(next);

  events.push({
    type: "ATTACK",
    player: attacker,
    attackerInstanceId,
    defenderInstanceId,
    outgoing,
    mitigated,
    counter,
  });
}

/**
 * Resolve a face (nexus) swing against the LIVE state (extracted from the ATTACK_FACE
 * case so the response stack can run the SAME path when a deferred entry pops). The
 * attacker is re-located by instanceId; a stale/missing attacker is a clean no-op.
 * Verbatim the immediate path, so the flag-OFF default stays byte-identical.
 */
function resolveAttackFaceCombat(
  next: MatchState,
  attacker: PlayerId,
  attackerInstanceId: string,
  events: GameEvent[]
): void {
  const attackerRef = findUnitByInstance(next, attacker, attackerInstanceId);
  if (!attackerRef) return;
  if ((attackerRef.unit.health ?? 0) <= 0) return;

  const target = opponentOf(attacker);
  const damage = resolveOutgoingDamage(attackerRef.unit);
  next.players[target].nexusHealth = (next.players[target].nexusHealth ?? STARTING_NEXUS_HEALTH) - damage;
  healNexus(next, attacker, lifestealHeal(attackerRef.unit, damage));
  markAttacked(attackerRef.unit);
  attackerRef.unit.stealthed = false;
  fireTrigger(next, attacker, attackerRef.unit, "ON_ATTACK");

  events.push({
    type: "NEXUS_DAMAGE",
    player: attacker,
    targetPlayer: target,
    attackerInstanceId,
    damage,
  });
}

export function applyAction(state: MatchState, action: Action): ApplyResult {
  // REJECT-SOFT CONTAINMENT (teardown D2 class): an engine exception must never
  // escape applyAction mid-match. applyActionCore mutates only its own
  // structuredClone, so on a throw the INPUT state is still pristine — returning
  // it is a clean rollback, surfaced like any soft reject. An engine bug should
  // never be a session-ender.
  let result: ApplyResult;
  try {
    result = applyActionCore(state, action);
    // Continuous faction auras are recomputed once per action at this single
    // chokepoint. A rejected action returns the ORIGINAL `state` reference
    // unchanged, so the identity check skips the (pointless) recompute and leaves
    // rejects a true no-op; every successful branch returns a fresh clone.
    if (result.state !== state) recomputeAuras(result.state);
  } catch (err) {
    return {
      state,
      events: [
        {
          type: "REJECTED",
          reason: `internal-error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }
  return result;
}

function applyActionCore(state: MatchState, action: Action): ApplyResult {
  // PURE: clone once at entry, mutate the copy only.
  const next: MatchState = structuredClone(state);
  // The death-trigger queue is transient within a single action: reset it to
  // empty at entry so a (defensively) stale queue never leaks across actions and
  // the drain always starts clean. It is always empty between actions, so this is
  // a no-op in practice but pins the invariant.
  next.triggerQueue = [];
  const events: GameEvent[] = [];

  // Global guard: once decided, nothing further is legal.
  if (detectWinner(next)) {
    return reject(state, "match-over");
  }

  // GLOBAL CHOICE GATE (RESOLUTION_MODEL.md §8). While a choice is pending the
  // model is single-threaded: the ONLY legal action is a matching RESOLVE_CHOICE.
  // Legality order: no-pending-choice -> not-your-choice -> illegal-option. Any
  // other action type, or a stale/illegal RESOLVE_CHOICE, reject-softs cleanly
  // (state unchanged) so the pause is never corrupted. Conversely a RESOLVE_CHOICE
  // arriving with NO pending choice is itself a clean no-op.
  if (next.pendingChoice) {
    if (action.type !== "RESOLVE_CHOICE") {
      return reject(state, "choice-pending");
    }
    return resolvePendingChoice(next, action, state, events);
  }
  if (action.type === "RESOLVE_CHOICE") {
    return reject(state, "no-pending-choice");
  }

  // GLOBAL MULLIGAN GATE (PART 1). Active ONLY when `state.mulligan` is present (an
  // explicit opening-mulligan phase). While any side is still `pending`, the match has
  // NOT started: the ONLY legal action is a `MULLIGAN` from a side that is still pending,
  // and it is NOT bound by `activePlayer` (either player resolves their own opening hand,
  // in any order). Every other action reject-softs `mulligan-pending`. A side that has
  // already mulliganed reject-softs `mulligan-already-done`. Once BOTH sides are `done`
  // the gate is inert and normal turn-ownership rules below take over. ABSENT (vanilla /
  // legacy) this whole block is skipped, so the historical P1-only MULLIGAN action still
  // flows through the active-player check and the golden fixtures stay byte-identical.
  if (next.mulligan) {
    const pendingExists = next.mulligan.P1 === "pending" || next.mulligan.P2 === "pending";
    if (pendingExists) {
      if (action.type !== "MULLIGAN") {
        return reject(state, "mulligan-pending");
      }
      return resolveMulligan(next, action, state, events);
    }
    // Both sides resolved: a stray MULLIGAN after the phase closed is a clean no-op.
    if (action.type === "MULLIGAN") {
      return reject(state, "mulligan-already-done");
    }
  }

  // Turn ownership applies to every action.
  if (next.activePlayer !== action.player) {
    return reject(state, "not-your-turn");
  }

  const player = next.players[action.player];

  switch (action.type) {
    case "PLAY_UNIT": {
      if (action.handIndex < 0 || action.handIndex >= player.hand.length) {
        return reject(state, "hand-index-out-of-bounds");
      }
      const cardId = player.hand[action.handIndex];
      if (cardTypeOf(cardId) !== "unit") return reject(state, "not-a-unit");
      // Lane capacity: a lane holds at most MAX_LANE_UNITS. Token-summon effects
      // already respect this cap (effectResolver), but the hand-played path did
      // NOT — so a player could stack 10+ units in one lane. Enforce it here.
      if ((player.board[action.lane]?.length ?? 0) >= MAX_LANE_UNITS) {
        return reject(state, "lane-full");
      }
      // AURA_COST_REDUCTION (e.g. King Tomb): friendly units cost N less. The
      // reduction is re-derived from the live board, so it is idempotent. The
      // legality check uses the reduced cost; setup.ts charges the full cost
      // (minus its own first-unit reduction), so the aura amount is refunded
      // after the play resolves. Floored at 0.
      const unitReduction = costReductionFor(next, action.player, "AURA_COST_REDUCTION");
      const effUnitCost = Math.max(0, costOf(cardId) - unitReduction);
      if (effUnitCost > (player.energy ?? 0)) return reject(state, "not-enough-energy");
      // Delegate the play (energy deduction incl. first-unit reduction,
      // instance-id minting, commander modifiers) to the engine, PASSING the
      // aura reduction so legality and the charge use the SAME effective cost.
      // (Teardown D2: the old shape validated the discounted cost here, then
      // setup re-derived the printed cost and THREW "Not enough energy" on a
      // legal discounted play — and the old post-hoc refund could not run
      // because the throw escaped applyAction first.)
      const played = playUnitFromHand(
        next,
        action.player,
        action.handIndex,
        action.lane,
        unitReduction
      ) as MatchState;
      // Summon-time keyword mechanics on the live path: arm WARD/DIVINE_SHIELD,
      // and let SCRY smooth the top of the deck. The just-played unit is the
      // last one pushed into its lane by playUnitFromHand.
      const pl = played.players[action.player];
      const laneArr = pl.board[action.lane];
      const summoned = laneArr[laneArr.length - 1];
      if (summoned) {
        initShield(summoned);
        armorOnSummon(summoned); // ARMORED: +1 armor on enter
        relicOnSummon(summoned); // RELIC: +1 armor on enter (enduring artifact)
        ritualOnSummon(summoned); // RITUAL: +1 max health on enter (consecration ward)
        initStealth(summoned); // STEALTH: untargetable until it acts
        if (unitHasKeyword(summoned, "SCRY")) {
          pl.deck = scryDeck(pl.deck, costOf);
        }
        // ON_SUMMON battlecries: token summons, ally buffs, self buffs, plus
        // single-target battlecries (deal/heal/debuff a chosen unit). A targeted
        // battlecry resolves only if the player supplied `targetInstanceId`; the
        // unit's ON_SUMMON op decides which board is searched — DEAL_DAMAGE /
        // DEBUFF_ENEMY hit the opponent, HEAL targets the controller's own board.
        // Untargeted ops (token/aura/self-buff) ignore the extra target harmlessly.
        let battlecryTarget: any = undefined;
        const summonSpecs = compiledFor(summoned.cardId).specs.filter((s) => s.trigger === "ON_SUMMON");
        const wantsEnemy = summonSpecs.some(
          (s) => s.op === "DEAL_DAMAGE" || s.op === "DEBUFF_ENEMY" || s.op === "COPY_UNIT"
        );
        if (action.targetInstanceId) {
          const side = wantsEnemy ? opponentOf(action.player) : action.player;
          const ref = findUnitByInstance(played, side, action.targetInstanceId);
          // STEALTH: a targeted battlecry aimed at an ENEMY unit cannot resolve onto
          // an un-revealed stealthed unit (same rule as combat/spells). Own-board
          // targets (heals/buffs) are unaffected. Leaving battlecryTarget undefined
          // makes the battlecry a clean no-op rather than an illegal stealth hit.
          if (ref && !(wantsEnemy && unitIsStealthed(ref.unit))) battlecryTarget = ref.unit;
        }
        // COPY_UNIT with no explicit target auto-selects the highest-cost enemy.
        if (!battlecryTarget && summonSpecs.some((s) => s.op === "COPY_UNIT")) {
          battlecryTarget = highestCostEnemyUnit(played, opponentOf(action.player));
        }
        fireTrigger(played, action.player, summoned, "ON_SUMMON", battlecryTarget);
        // Commander summon passive (Stone Warden GUARD durability, Golden Emperor
        // elite scaling, Bronze Raider nexus pressure). Runs after the unit's own
        // battlecry so it modifies the resolved unit / fully-on-board state.
        commanderOnUnitSummon(played, action.player, summoned);
        // Faction identity summon hook (STONE Bedrock armor, BRONZE Onslaught
        // Rush, GOLD Largesse +0/+2). Gated by rules.factionIdentities; a clean
        // no-op otherwise, so vanilla matches are byte-identical. Stacks on top of
        // the commander passive on a distinct axis.
        factionOnUnitSummon(
          played,
          action.player,
          summoned,
          (id: string) => cardMetaById.get(id)?.faction ?? null,
          costOf
        );
        // Trait Resonance summon hook (the signature mechanic): if the summoned
        // unit shares a Keyword with another unit the controller already commands,
        // it enters RESONANT (+1/+1). Gated by rules.traitResonance; a clean no-op
        // otherwise, so vanilla matches stay byte-identical. Reads the live board
        // keywords directly (no catalog lookup) and stacks on a distinct axis from
        // the faction identity above (faction vs. keyword overlap).
        resonanceOnUnitSummon(played, action.player, summoned);
      }
      // LAST-CARD-PLAYED slot (feeds RETURN_LAST_PLAYED / tcg_3425). Recorded AFTER
      // this unit's own ON_SUMMON fired, so a played "Yesterday Is History" bounces
      // the PREVIOUS card — not itself.
      played.lastCardPlayed = { cardId, owner: action.player };
      // A battlecry may have raised a mid-resolution CHOICE (Discover). If so the
      // action ENDS here with `pendingChoice` set: emit UNIT_PLAYED + CHOICE_OPENED
      // and short-circuit WITHOUT reaping deaths / checking the win. The board is in
      // a clean, queue-empty state (the choice spec is ordered last), and the win /
      // death reap runs in the matching RESOLVE_CHOICE tail. See RESOLUTION_MODEL §8.
      if (played.pendingChoice) {
        events.push({ type: "UNIT_PLAYED", player: action.player, cardId, lane: action.lane });
        events.push(choiceOpenedEvent(played));
        return { state: played, events };
      }
      // Bronze Raider's pressure can deal lethal to the enemy nexus, so reap and
      // check the win exactly like combat (no-op when nothing died / decided).
      resolveDeaths(played);
      events.push({ type: "UNIT_PLAYED", player: action.player, cardId, lane: action.lane });
      finalizeWin(played, events);
      return { state: played, events };
    }

    case "PLAY_ARTIFACT": {
      // ARTIFACTS CUT FROM V1 (teardown §11 P1): artifacts are disabled. They do
      // nothing for their cost and the play path's resetUnitToBase WIPES friendly
      // equipment/growth/commander buffs (D3). Decks no longer draft them and the
      // AI never plans them; this reject is the safety net so a legacy/hand-built
      // artifact in hand can never trigger the self-harm. Re-enable only after the
      // resolver is rebuilt (effectSystem.ts). A clean reject = dead card in hand.
      return reject(state, "artifacts-disabled");
    }

    case "EQUIP": {
      if (action.handIndex < 0 || action.handIndex >= player.hand.length) {
        return reject(state, "hand-index-out-of-bounds");
      }
      const cardId = player.hand[action.handIndex];
      if (cardTypeOf(cardId) !== "equipment") return reject(state, "not-equipment");
      if (costOf(cardId) > (player.energy ?? 0)) return reject(state, "not-enough-energy");
      // Equip can only target the player's OWN board.
      if (!findUnitByInstance(next, action.player, action.targetInstanceId)) {
        return reject(state, "equip-target-not-on-own-board");
      }
      const played = playEquipmentFromHand(next, action.player, action.handIndex, action.targetInstanceId) as MatchState;
      // Iron Warlord: the equipped unit gains bonus Attack each time it is geared.
      const equipped = findUnitByInstance(played, action.player, action.targetInstanceId);
      if (equipped) commanderOnEquip(played, action.player, equipped.unit);
      // IRON Tempered: gear also hardens the unit (+1 Armor; +1/+0 too at 3+ Iron
      // live). Gated no-op otherwise.
      if (equipped)
        factionOnEquip(
          played,
          action.player,
          equipped.unit,
          (id: string) => cardMetaById.get(id)?.faction ?? null
        );
      played.lastCardPlayed = { cardId, owner: action.player };
      events.push({ type: "EQUIPPED", player: action.player, cardId, targetInstanceId: action.targetInstanceId });
      return { state: played, events };
    }

    case "ATTACK_UNIT": {
      const attackerRef = findUnitByInstance(next, action.player, action.attackerInstanceId);
      const defenderRef = findUnitByInstance(next, opponentOf(action.player), action.defenderInstanceId);
      if (!attackerRef || !defenderRef) return reject(state, "attacker-or-defender-not-found");
      if (attackerRef.unit.exhausted) return reject(state, "attacker-exhausted");
      // SUMMONING SICKNESS: a unit cannot attack the turn it entered play unless it
      // has RUSH (setup.ts seeds RUSH units non-sick). The flag is cleared at the start
      // of its controller's NEXT turn (END_TURN refresh loop). RUSH = attack immediately.
      if (attackerRef.unit.summoningSick) return reject(state, "attacker-summoning-sick");
      // PATIENT (STATIC RESTRICT_ATTACK): a unit whose ability says "this unit cannot
      // attack" is barred from swinging while it keeps its grow/mitigate upside. This
      // is the attacker-side self-restriction ONLY (trigger "STATIC"); Fear's
      // defender-side RESTRICT_ATTACK (trigger "PASSIVE") is handled separately below.
      if (attackerIsRestricted(attackerRef.unit.cardId)) return reject(state, "attacker-cannot-attack");
      // GUARD: a non-GUARD defender cannot be attacked while a GUARD stands.
      if (!unitHasKeyword(defenderRef.unit, "GUARD") && playerHasGuard(next, opponentOf(action.player))) {
        return reject(state, "guard-must-be-cleared");
      }
      // FLYING: ground attackers without reach cannot hit a flyer.
      if (!canTargetDefender(attackerRef.unit, defenderRef.unit)) {
        return reject(state, "defender-is-flying");
      }
      // STEALTH: an un-revealed stealthed unit cannot be targeted.
      if (unitIsStealthed(defenderRef.unit)) {
        return reject(state, "defender-is-stealthed");
      }
      // FEAR (RESTRICT_ATTACK): a low-cost attacker cannot strike a Fear unit.
      const fear = passiveSpec(defenderRef.unit.cardId, "RESTRICT_ATTACK");
      if (fear && costOf(attackerRef.unit.cardId) <= (fear.costThreshold ?? 0)) {
        return reject(state, "attacker-feared");
      }

      resolveAttackUnitCombat(next, action.player, action.attackerInstanceId, action.defenderInstanceId, events);
      finalizeWin(next, events, action.player);
      return { state: next, events };
    }

    case "ATTACK_FACE": {
      const attackerRef = findUnitByInstance(next, action.player, action.attackerInstanceId);
      if (!attackerRef) return reject(state, "attacker-not-found");
      if (attackerRef.unit.exhausted) return reject(state, "attacker-exhausted");
      // SUMMONING SICKNESS: see ATTACK_UNIT — a freshly-played non-RUSH unit cannot
      // swing the face the turn it arrives. Cleared at its controller's next turn start.
      if (attackerRef.unit.summoningSick) return reject(state, "attacker-summoning-sick");
      // PATIENT (STATIC RESTRICT_ATTACK): see ATTACK_UNIT — a "this unit cannot
      // attack" unit cannot swing the face either.
      if (attackerIsRestricted(attackerRef.unit.cardId)) return reject(state, "attacker-cannot-attack");
      // GUARD: the nexus cannot be hit while a GUARD defender is on the board.
      if (playerHasGuard(next, opponentOf(action.player))) {
        return reject(state, "guard-blocks-face");
      }
      // COMMANDER_SHIELD (e.g. Skull Island): while the defending player controls
      // a unit with this passive, their nexus/commander cannot be hit directly —
      // an attacker must clear the board first.
      if (boardHasOp(next, opponentOf(action.player), "COMMANDER_SHIELD")) {
        return reject(state, "commander-shielded");
      }

      resolveAttackFaceCombat(next, action.player, action.attackerInstanceId, events);
      finalizeWin(next, events, action.player);
      return { state: next, events };
    }

    case "END_TURN": {
      const ending = action.player;

      // ON_TURN_END fires for the ENDING player's units before control passes:
      // self-decay units lose health (and may grow attack), EOT regenerators
      // self-heal. A unit decayed to <=0 is reaped by the outer removeDead pass.
      for (const lane of ["front", "back"] as Lane[]) {
        for (const unit of next.players[ending].board?.[lane] ?? []) {
          fireTrigger(next, ending, unit, "ON_TURN_END");
        }
      }

      // DEBUFF_ALL_ENEMIES expiry (e.g. Lucifer's "-N attack THIS TURN"): the
      // temp attack reduction was applied during this turn, so restore it now,
      // at this turn's end, across BOTH boards. Adding the stored amount back
      // (rather than recomputing base) preserves any other permanent buffs/
      // debuffs the unit accrued meanwhile.
      for (const owner of ["P1", "P2"] as PlayerId[]) {
        for (const lane of ["front", "back"] as Lane[]) {
          for (const unit of next.players[owner].board?.[lane] ?? []) {
            if (unit.tempAtkDebuff) {
              unit.attack += unit.tempAtkDebuff;
              unit.tempAtkDebuff = 0;
            }
          }
        }
      }

      // "WARD until end of turn" expiry (GRANT_SELF_WARD, tcg_938): a ward granted
      // this turn lasts only until the granting controller's turn ends. Clear the
      // shield AND the marker now, at this turn's end, on the ENDING player's units
      // (the granter), whether or not the ward already absorbed a hit. A ward that
      // absorbed earlier already cleared `shielded` via absorbDamage; this also
      // clears the stale marker so it never carries past the turn.
      for (const lane of ["front", "back"] as Lane[]) {
        for (const unit of next.players[ending].board?.[lane] ?? []) {
          if (unit.wardExpiresEot) {
            unit.shielded = false;
            unit.wardExpiresEot = false;
          }
        }
      }

      // UNIFIED DEATH PIPELINE (teardown D4): END_TURN kills go through the SAME
      // death resolution as combat and spells. ON_TURN_END damage (DECAY
      // self-damage, end-of-turn burns) used to leave corpses for the
      // recomputeAuras sweep to silently filter — no graveyard record, no
      // DEATHRATTLE, no ON_DEATH, no death-watchers. resolveDeaths is a clean
      // no-op when nothing died; a deathrattle face burst here can decide the
      // match, so score it exactly like combat (the ending player initiated).
      resolveDeaths(next);
      finalizeWin(next, events, ending);
      if (next.winner) {
        return { state: next, events };
      }

      const nextPlayerId = opponentOf(ending);
      const np = next.players[nextPlayerId];

      next.activePlayer = nextPlayerId;
      next.turn = (next.turn ?? 1) + 1;

      // Ramp + refill energy for the player whose turn is beginning.
      np.maxEnergy = Math.min(ENERGY_CAP, (np.maxEnergy ?? BASE_MAX_ENERGY) + 1);
      np.energy = np.maxEnergy;

      // Refresh exhausted units AND clear summoning sickness for the player whose turn
      // is beginning: a unit played on turn N becomes un-sick at the start of its
      // controller's turn N+1 (correct timing). RUSH units already start non-sick.
      // REGROW units also regenerate to full at the start of their turn.
      // ON_TURN_START fires for the player whose turn is beginning: PATIENT units
      // grow +1/+1 each turn they remain in play (regrow first, then grow).
      for (const lane of ["front", "back"] as Lane[]) {
        for (const unit of np.board?.[lane] ?? []) {
          unit.exhausted = false;
          unit.summoningSick = false;
          unit.windfuryStruck = false; // WINDFURY bonus attack refreshes each turn
          unit.attacksThisTurn = 0; // DOUBLE_ATTACK tally refreshes each turn
          // STEALTH EXPIRY (teardown D6): stealth lapses at its controller's next
          // turn start — exactly one full enemy turn of protection (it still
          // breaks immediately when the unit attacks). Kills the STEALTH+GUARD
          // "opponent can legally attack nothing forever" lock. Guarded so units
          // that never had the flag keep their serialized shape (golden fixtures).
          if (unit.stealthed) unit.stealthed = false;
          regrowAtTurnStart(unit);
          // TRACK A2 (2): the "per turn undamaged" grower (BUFF_IF_UNDAMAGED) reads
          // `tookDamageThisTurn` here — it grows the unit only if it went the round
          // untouched. We fire FIRST (so the resolver sees the round's damage
          // state), then reset the damage-window trackers, opening a fresh window
          // for this controller's turn. The window boundary is the controller's own
          // turn start (ON_TURN_START), matching "each turn it remains undamaged".
          fireTrigger(next, nextPlayerId, unit, "ON_TURN_START");
          unit.tookDamageThisTurn = false;
          // TRACK A2 (3): reset the per-point damage accumulator at the same
          // boundary (its grower already fired on ON_DAMAGE during the round).
          unit.damageTakenThisTurn = 0;
          unit.lastDamageTaken = 0;
        }
      }

      // Commander start-of-turn passive (e.g. Silver Oracle's Scry) for the
      // player whose turn is beginning.
      commanderOnTurnStart(next, nextPlayerId, costOf);
      // SILVER Insight: start-of-turn Scry 1 (Scry 2 at 3+ Silver live; deck
      // smoothing, no draw). Gated no-op otherwise, so vanilla matches are
      // byte-identical.
      factionOnTurnStart(
        next,
        nextPlayerId,
        costOf,
        (id: string) => cardMetaById.get(id)?.faction ?? null
      );

      events.push({ type: "TURN_END", player: ending });

      // UNIFIED DEATH PIPELINE (teardown D4, cont.): ON_TURN_START triggers fired
      // in the refresh loop above can also kill — route those corpses through the
      // same pipeline before the draw. No-op when nothing died.
      resolveDeaths(next);
      finalizeWin(next, events, ending);
      if (next.winner) {
        return { state: next, events };
      }

      const drew = drawForPlayer(next, nextPlayerId);
      if (!drew) {
        events.push({ type: "DECK_OUT", player: nextPlayerId });
        finalizeWin(next, events);
      } else {
        events.push({ type: "TURN_START", player: nextPlayerId, energy: np.energy, maxEnergy: np.maxEnergy });
      }
      return { state: next, events };
    }

    case "SURGE": {
      // THE SURGE (#4 — the "Snap" beat). Opt-in via the ruleset: a clean reject-soft
      // when the flag is off, so no client can spike energy in a vanilla match (and the
      // golden, which runs ruleset-less, never reaches this body). Turn-ownership,
      // match-over and choice-pending are already enforced by the entry guards above.
      if (!next.rules?.surge) return reject(state, "surge-disabled");
      // Once per match per player.
      if (player.surgeUsed) return reject(state, "surge-already-used");

      // Spike energy NOW (capped at ENERGY_CAP) — the fuel to over-commit this turn.
      const energyBefore = player.energy;
      player.energy = Math.min(ENERGY_CAP, player.energy + SURGE_ENERGY);
      const energyGained = player.energy - energyBefore;

      // Ready the whole side for an all-in alpha-strike: clear summoning sickness so
      // freshly-summoned units can swing THIS turn. Exhaustion is deliberately NOT
      // cleared (no bonus second attacks) — the Surge buys commitment, not a double
      // turn. Self-only: the enemy board and nexus are never touched (NO-BURN; the
      // face is only ever reached through the ordinary ATTACK_FACE that follows).
      let readied = 0;
      for (const lane of ["front", "back"] as Lane[]) {
        for (const unit of player.board?.[lane] ?? []) {
          if (unit.summoningSick) {
            unit.summoningSick = false;
            readied += 1;
          }
        }
      }

      player.surgeUsed = true;
      events.push({ type: "SURGED", player: action.player, energyGained, readied });
      return { state: next, events };
    }

    case "MULLIGAN": {
      // LEGACY opening redraw — reachable ONLY when there is NO explicit mulligan phase
      // (`state.mulligan` absent); the phase path is handled by the global mulligan gate
      // above via `resolveMulligan`. Lived rule: P1 only, before any action on turn 1. We
      // reproduce the hook's exact reshuffle: return the hand to the BOTTOM of the library
      // in order, then redraw OPENING_HAND_SIZE off the top. This is the byte-identical
      // behavior the "mulligan-then-end" golden scenario pins, so it is left UNCHANGED.
      if (action.player !== "P1") return reject(state, "mulligan-p1-only");
      // ONCE-ONLY GUARD: the legacy redraw may fire exactly once, on turn 1, before
      // the match has advanced. Without this a client could re-send MULLIGAN to cycle
      // the deck for free. Mirrors the phase path's "already done" intent (P1 only,
      // before any other action on turn 1). The flag is undefined on a fresh match, so
      // the legitimate FIRST legacy mulligan and the golden "mulligan-then-end" scenario
      // are unaffected.
      if (next.turn !== 1) return reject(state, "mulligan-too-late");
      if (next.legacyMulliganUsed) return reject(state, "mulligan-already-done");
      next.legacyMulliganUsed = true;
      const p1 = next.players.P1;
      const returned: string[] = [...(p1.hand ?? [])];
      p1.deck = [...(p1.deck ?? []), ...returned];
      p1.hand = [];
      for (let i = 0; i < OPENING_HAND_SIZE; i += 1) {
        const c = p1.deck.shift();
        if (c) p1.hand.push(c);
      }
      p1.deckCount = p1.deck.length;
      // Advance rngCursor for determinism bookkeeping even though the lived
      // mulligan is a deterministic bottom-cycle (no RNG draw today). Keeping
      // the cursor monotonic future-proofs a server-side shuffle variant.
      void rngAt(next.seed, next.rngCursor);
      return { state: next, events };
    }

    case "PLAY_SPELL": {
      if (action.handIndex < 0 || action.handIndex >= player.hand.length) {
        return reject(state, "hand-index-out-of-bounds");
      }
      const cardId = player.hand[action.handIndex];
      if (cardTypeOf(cardId) !== "spell") return reject(state, "not-a-spell");
      // AURA_SPELL_COST (e.g. Hokusai): friendly spells cost N less while a source
      // is in play. Re-derived from the live board (idempotent), floored at 0.
      const spellReduction = costReductionFor(next, action.player, "AURA_SPELL_COST");
      const effSpellCost = Math.max(0, costOf(cardId) - spellReduction);
      if (effSpellCost > (player.energy ?? 0)) return reject(state, "not-enough-energy");

      const specs = compiledFor(cardId).specs;
      // Resolve an optional single target. Damage / debuff spells hit the
      // opponent's board; heal / buff spells target the caster's own board. A
      // required-but-missing/invalid target is a clean reject (mirrors EQUIP).
      const ENEMY_OPS = ["DEAL_DAMAGE", "DEBUFF_ENEMY", "DESTROY_UNIT", "RETURN_TO_HAND"];
      const ALLY_OPS = ["HEAL", "BUFF_SELF"];
      const wantsEnemy = specs.some((s) => ENEMY_OPS.includes(s.op));
      const needsTarget = specs.some((s) => ENEMY_OPS.includes(s.op) || ALLY_OPS.includes(s.op));
      let chosen: any = undefined;
      if (needsTarget) {
        if (!action.targetInstanceId) return reject(state, "spell-target-required");
        const side = wantsEnemy ? opponentOf(action.player) : action.player;
        const ref = findUnitByInstance(next, side, action.targetInstanceId);
        if (!ref) return reject(state, "spell-target-not-found");
        // STEALTH: an un-revealed stealthed ENEMY unit cannot be the target of a
        // spell, mirroring combat's "defender-is-stealthed". Only protects the
        // opponent's units — your own stealthed units stay targetable by your spells.
        if (wantsEnemy && unitIsStealthed(ref.unit)) return reject(state, "spell-target-stealthed");
        chosen = ref.unit;
      }

      // Pay, cast, discard. A spell resolves its compiled specs immediately (cast
      // == ON_SUMMON) then goes to the discard pile (graveyard) — never the board.
      // `chosen` is wired as BOTH source and target: HEAL/DEAL_DAMAGE/DEBUFF_ENEMY
      // read ctx.target, while BUFF_SELF (buff-an-ally) reads ctx.source.
      player.energy = (player.energy ?? 0) - effSpellCost;
      resolveSpecs(specs, {
        state: next,
        controller: action.player,
        source: chosen,
        target: chosen,
        factionOf: (id: string) => cardMetaById.get(id)?.faction ?? null,
        costOf,
        cardTypeOf,
        // Spell DEAL_DAMAGE honors flat mitigation + floor-HP (and always the shield).
        mitigationOf: mitigationFor,
        hasFloorHp: (id: string) => unitHasOp(id, "PASSIVE_FLOOR_HP"),
      });
      player.hand = [...player.hand.slice(0, action.handIndex), ...player.hand.slice(action.handIndex + 1)];
      player.discard = [...(player.discard ?? []), cardId];
      // LAST-CARD-PLAYED slot (feeds RETURN_LAST_PLAYED / tcg_3425). Recorded AFTER
      // the spell's own specs resolved, so a cast that bounces the last card targets
      // the PREVIOUS card, not this spell.
      next.lastCardPlayed = { cardId, owner: action.player };

      // A cast may have raised a mid-resolution CHOICE (Discover spell). The action
      // ENDS here with `pendingChoice` set: emit SPELL_PLAYED + CHOICE_OPENED and
      // short-circuit (death reap / win check run in the RESOLVE_CHOICE tail).
      if (next.pendingChoice) {
        events.push({ type: "SPELL_PLAYED", player: action.player, cardId, targetInstanceId: action.targetInstanceId });
        events.push(choiceOpenedEvent(next));
        return { state: next, events };
      }
      // A spell that dealt lethal damage triggers deathrattles / on-death summons
      // and may end the match, exactly like combat. resolveDeaths is a no-op when
      // nothing died.
      resolveDeaths(next);
      events.push({ type: "SPELL_PLAYED", player: action.player, cardId, targetInstanceId: action.targetInstanceId });
      finalizeWin(next, events);
      return { state: next, events };
    }

    default:
      return reject(state, "unknown-action");
  }
}

/** If the position is now decided, stamp the winner and emit WIN once. The optional
 *  `initiator` is the player whose action triggered resolution; it ONLY matters on a
 *  true simultaneous double-kill, where the initiator (attacker) wins instead of the
 *  historical P1-first tie-break. */
function finalizeWin(state: MatchState, events: GameEvent[], initiator?: PlayerId) {
  const w = detectWinner(state, initiator);
  if (w && state.winner !== w) {
    state.winner = w;
    events.push({ type: "WIN", player: w });
  } else if (w && !events.some((e) => e.type === "WIN")) {
    state.winner = w;
    events.push({ type: "WIN", player: w });
  }
}

/** Deterministic RNG sample at an absolute cursor from the seed. Pure: rebuilds
 *  the stream from scratch and fast-forwards, so it depends on state alone. */
function rngAt(seed: number, cursor: number): number {
  const rng = makeRng(seed);
  let v = 0;
  for (let i = 0; i <= cursor; i += 1) v = rng();
  return v;
}

// Re-exported so test harnesses and any future server-side shuffle can reuse the
// exact deterministic stream the reducer derives from match state.
export { seededShuffle };
