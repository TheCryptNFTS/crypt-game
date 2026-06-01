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

import { MatchState, PlayerId, Lane, BASE_MAX_ENERGY, ENERGY_CAP, STARTING_NEXUS_HEALTH, TriggerQueueEntry, ArmedSecret, ResponseStackEntry, ResponseEffectSpec } from "./state";
import { playUnitFromHand, playEquipmentFromHand } from "./setup";
import { playArtifactCard } from "./effectSystem";
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
import { resolveEffect, resolveSpecs, addCardToHand, moveCardDeckToHand, resolveResponseEffect } from "./effectResolver";
import { makeRng, shuffle as seededShuffle } from "./rng";

export type Action =
  | { type: "MULLIGAN"; player: PlayerId }
  | { type: "PLAY_UNIT"; player: PlayerId; handIndex: number; lane: Lane; targetInstanceId?: string }
  | { type: "PLAY_ARTIFACT"; player: PlayerId; handIndex: number }
  | { type: "EQUIP"; player: PlayerId; handIndex: number; targetInstanceId: string }
  | { type: "PLAY_SPELL"; player: PlayerId; handIndex: number; targetInstanceId?: string }
  | { type: "ATTACK_UNIT"; player: PlayerId; attackerInstanceId: string; defenderInstanceId: string }
  | { type: "ATTACK_FACE"; player: PlayerId; attackerInstanceId: string }
  | { type: "END_TURN"; player: PlayerId }
  // Resolve a paused mid-resolution CHOICE (Discover / choose-one). The ONLY
  // action accepted while `state.pendingChoice` is non-null; carries the chosen
  // `optionId` so a replay of (seed, actions) resolves the identical tail. See
  // RESOLUTION_MODEL.md §8.
  | { type: "RESOLVE_CHOICE"; player: PlayerId; optionId: string }
  // RESPONSE STACK (opt-in `rules.responseStack`). Push a FAST response onto the open
  // window's stack (LIFO). Carries an explicit response descriptor (a COUNTER that
  // fizzles the entry beneath it, or a self-contained fast EFFECT — pump/shield/unit-
  // damage/nexus-heal). No abilityCompiler edit: the effect shape is supplied here, not
  // parsed from card text. Legal ONLY while `state.pendingResponse` is open and it is
  // the actor's priority. See RESOLUTION_MODEL.md §9.
  | {
      type: "CAST_RESPONSE";
      player: PlayerId;
      response:
        | { kind: "COUNTER" }
        | { kind: "EFFECT"; effect: ResponseEffectSpec; targetInstanceId?: string };
    }
  // RESPONSE STACK: decline to respond. Two CONSECUTIVE passes (both players) close the
  // window and resolve the stack LIFO. Legal ONLY while the window is open and it is the
  // actor's priority. See RESOLUTION_MODEL.md §9.
  | { type: "PASS_RESPONSE"; player: PlayerId };

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
  // RESPONSE STACK (opt-in): a response window OPENED (a slow action was deferred onto
  // the stack). `priority` is whose turn it is to respond first.
  | { type: "RESPONSE_OPENED"; player: PlayerId; entryId: string; priority: PlayerId }
  // RESPONSE STACK: a FAST response was pushed onto the stack (LIFO).
  | { type: "RESPONSE_CAST"; player: PlayerId; entryId: string; kind: string }
  // RESPONSE STACK: a player passed priority in the open window.
  | { type: "RESPONSE_PASSED"; player: PlayerId; passes: number }
  // RESPONSE STACK: a COUNTER fizzled the entry directly beneath it (LIFO).
  | { type: "RESPONSE_FIZZLED"; entryId: string }
  // RESPONSE STACK: the window closed (both players passed) and the stack resolved LIFO.
  | { type: "RESPONSE_RESOLVED" }
  // One or more armed SECRETS sprang on the defending `player` against the enemy
  // attacker (#2). Deterministic, no pause — see `fireArmedSecrets`.
  | { type: "SECRET_FIRED"; player: PlayerId; secretIds: string[]; againstInstanceId: string }
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
function applyCombatDamage(unit: any, amount: number): void {
  if (amount <= 0) return;
  // Flat mitigation, applied last and floored at 0 (never heals / goes negative).
  const mitigated = Math.max(0, amount - mitigationFor(unit.cardId));
  if (mitigated <= 0) {
    // Fully absorbed: no damage landed. Zero the per-hit record so a downstream
    // ON_DAMAGE per-point grower reads 0 (no spurious buff off a stale value).
    unit.lastDamageTaken = 0;
    return;
  }
  // Damage-window bookkeeping on the points actually landed.
  unit.tookDamageThisTurn = true;
  unit.lastDamageTaken = mitigated;
  unit.damageTakenThisTurn = (unit.damageTakenThisTurn ?? 0) + mitigated;
  const after = unit.health - mitigated;
  if (unitHasOp(unit.cardId, "PASSIVE_FLOOR_HP") && unit.health > 1 && after < 1) {
    unit.health = 1;
  } else {
    unit.health = after;
  }
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
function detectWinner(state: MatchState): PlayerId | null {
  if (state.winner === "P1" || state.winner === "P2") return state.winner;
  const p1Dead = (state.players.P1.nexusHealth ?? 20) <= 0;
  const p2Dead = (state.players.P2.nexusHealth ?? 20) <= 0;
  // Lethal (nexus depletion) is always checked first, so a finishing blow still
  // wins even when an opponent is one tick from a control victory.
  if (p2Dead) return "P1";
  if (p1Dead) return "P2";
  // ASCENDANCY control victory (#4): only consulted when the match enabled it.
  // Indirect, no-burn — the meter is earned by sustained board dominance, not by
  // damaging the face. P1 is checked first purely for a deterministic tie-break.
  const threshold = state.rules?.ascendancyToWin;
  if (threshold && state.ascendancy) {
    if ((state.ascendancy.P1 ?? 0) >= threshold) return "P1";
    if ((state.ascendancy.P2 ?? 0) >= threshold) return "P2";
  }
  // ASSEMBLE / LIBRARY victory (alt win-con, opt-in `rules.assembleToWin`). A no-burn,
  // INDIRECT win earned by card advantage: holding >= N cards in hand. Checked AFTER
  // lethal-nexus / deckout (which still take precedence) and after ascendancy, and only
  // when the match enabled it — so a vanilla match is unaffected and the golden fixture
  // is unmoved. P1 first for a deterministic tie-break (mirrors ascendancy).
  const assemble = state.rules?.assembleToWin;
  if (assemble) {
    if ((state.players.P1.hand?.length ?? 0) >= assemble) return "P1";
    if ((state.players.P2.hand?.length ?? 0) >= assemble) return "P2";
  }
  return null;
}

/** Live (health>0) unit count across both lanes of a player's board. */
function liveUnitCount(state: MatchState, player: PlayerId): number {
  const board = state.players[player].board;
  let n = 0;
  for (const lane of ["front", "back"] as Lane[]) {
    for (const u of board?.[lane] ?? []) {
      if ((u?.health ?? 0) > 0) n += 1;
    }
  }
  return n;
}

/** Fire any armed SECRETS the defender holds against a matching enemy action (#2).
 *  Deterministic and inline — NO pause, NO priority pass (honors the locked
 *  no-stack / no-response model). Secrets fire in arm order; each is ONE-SHOT
 *  (consumed on fire). A "DEAL_DAMAGE" secret hits the triggering ENEMY UNIT only
 *  (never the face — no-burn). A pure no-op when the defender has no armed secret,
 *  so vanilla combat is byte-identical. Mutates `enemyUnit` in place; the caller
 *  re-checks its health to decide whether the attack fizzled. Returns the ids that
 *  fired (for events), empty when nothing fired. */
function fireArmedSecrets(
  state: MatchState,
  defender: PlayerId,
  trigger: ArmedSecret["trigger"],
  enemyUnit: any
): string[] {
  const armed = state.players[defender].secrets;
  if (!armed?.length) return [];
  const fired: string[] = [];
  const remaining: ArmedSecret[] = [];
  for (const secret of armed) {
    if (secret.trigger !== trigger) {
      remaining.push(secret);
      continue;
    }
    // Resolve the (small, no-burn) reaction. DEAL_DAMAGE lands on the triggering
    // enemy unit; armor is bypassed exactly like other DIRECT ability damage.
    if (secret.op === "DEAL_DAMAGE" && enemyUnit) {
      enemyUnit.health = (enemyUnit.health ?? 0) - (secret.amount ?? 0);
    }
    fired.push(secret.id);
    // one-shot: NOT pushed onto `remaining`, so it is consumed.
  }
  state.players[defender].secrets = remaining;
  return fired;
}

/** Advance the ASCENDANCY meter for the player whose turn just ended (#4). A
 *  clean no-op unless the match enabled `rules.ascendancyToWin`. Strict board
 *  dominance (more live units than the opponent) at turn end increments the
 *  ending player's counter; anything else resets it to 0 (dominance must be
 *  SUSTAINED). The opponent's counter is left untouched — it advances on THEIR
 *  own turn end. Never touches nexus health (no-burn). */
function advanceAscendancy(state: MatchState, ending: PlayerId): void {
  if (!state.rules?.ascendancyToWin) return;
  if (!state.ascendancy) state.ascendancy = { P1: 0, P2: 0 };
  const mine = liveUnitCount(state, ending);
  const theirs = liveUnitCount(state, opponentOf(ending));
  state.ascendancy[ending] = mine > theirs ? (state.ascendancy[ending] ?? 0) + 1 : 0;
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
      (state.players[enemy].nexusHealth ?? 20) - DEATHRATTLE_NEXUS_DAMAGE;
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
      q.length = 0;
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

/** LIFESTEAL heal: top the controller's nexus back up by `amount`, capped at the
 *  starting nexus health so lifesteal stabilizes a race without overhealing. */
function healNexus(state: MatchState, playerId: PlayerId, amount: number) {
  if (amount <= 0) return;
  const cur = state.players[playerId].nexusHealth ?? STARTING_NEXUS_HEALTH;
  state.players[playerId].nexusHealth = Math.min(STARTING_NEXUS_HEALTH, cur + amount);
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

/* ===========================================================================
 * RESPONSE STACK (opt-in `rules.responseStack`) — see RESOLUTION_MODEL.md §9.
 *
 * A real LIFO reactive-priority system, gated entirely behind the flag. With the
 * flag OFF nothing below ever runs: slow actions resolve immediately exactly as
 * before, so the 21 golden scenarios stay byte-identical. With it ON, a slow action
 * (a unit attack / face swing today) is DEFERRED onto `state.responseStack` and a
 * `state.pendingResponse` window opens. Players push FAST responses (CAST_RESPONSE)
 * onto the stack; when both pass consecutively the stack drains LIFO, so the
 * most-recent response resolves first and can fizzle / pump / shield the entry
 * beneath it before it resolves. Determinism: pure state mutation, no RNG / Date.now;
 * the response window is plain data, structuredClone-stable.
 * =========================================================================== */

/** Deterministic, collision-free response-entry id (mirrors the unit-id convention:
 *  `resp_<seed>_<idCounter>`, advancing the same monotonic counter). */
function nextResponseId(state: MatchState): string {
  const counter = state.idCounter ?? 0;
  state.idCounter = counter + 1;
  return `resp_${state.seed}_${counter}`;
}

/** Open a response window for a freshly-deferred BASE entry. The opponent of the
 *  entry's controller receives priority FIRST (they are the one who wants to react to
 *  the slow action). Emits RESPONSE_OPENED. No win check yet — the action only resolves
 *  when the window closes. */
function openResponseWindow(
  next: MatchState,
  base: ResponseStackEntry,
  events: GameEvent[]
): ApplyResult {
  const stack: ResponseStackEntry[] = next.responseStack ?? (next.responseStack = []);
  stack.push(base);
  const priority = opponentOf(base.controller);
  next.pendingResponse = { priority, passes: 0 };
  events.push({ type: "RESPONSE_OPENED", player: base.controller, entryId: base.id, priority });
  return { state: next, events };
}

/** CAST_RESPONSE: push a FAST response onto the open stack (LIFO). A COUNTER carries no
 *  effect (it fizzles the entry beneath it when it pops); an EFFECT carries an explicit
 *  self-contained descriptor. Casting RESETS the consecutive-pass count and hands
 *  priority to the OTHER player, so they may respond to the new top entry (enabling a
 *  counter-the-counter). Reject-soft on an illegal/empty response. */
function castResponse(
  next: MatchState,
  action: Extract<Action, { type: "CAST_RESPONSE" }>,
  events: GameEvent[]
): ApplyResult {
  const stack: ResponseStackEntry[] = next.responseStack ?? (next.responseStack = []);
  // Defensive: a window is only open with at least the base entry on the stack.
  if (stack.length === 0) return { state: next, events: [{ type: "REJECTED", reason: "no-response-window" }] };
  let entry: ResponseStackEntry;
  if (action.response.kind === "COUNTER") {
    entry = { id: nextResponseId(next), controller: action.player, kind: "COUNTER" };
  } else {
    const eff: ResponseEffectSpec | undefined = action.response.effect;
    if (!eff) return { state: next, events: [{ type: "REJECTED", reason: "response-effect-required" }] };
    entry = {
      id: nextResponseId(next),
      controller: action.player,
      kind: "EFFECT",
      effect: eff,
      targetInstanceId: action.response.targetInstanceId,
    };
  }
  stack.push(entry);
  // The opponent regains priority and the pass-count resets: both players must pass in
  // a row (against the CURRENT top) before the stack drains.
  next.pendingResponse = { priority: opponentOf(action.player), passes: 0 };
  events.push({ type: "RESPONSE_CAST", player: action.player, entryId: entry.id, kind: entry.kind });
  return { state: next, events };
}

/** PASS_RESPONSE: decline to respond. Two CONSECUTIVE passes (both players) close the
 *  window and drain the stack LIFO. A single pass hands priority to the opponent. */
function passResponse(
  next: MatchState,
  action: Extract<Action, { type: "PASS_RESPONSE" }>,
  events: GameEvent[]
): ApplyResult {
  const pr = next.pendingResponse!;
  const passes = (pr.passes ?? 0) + 1;
  events.push({ type: "RESPONSE_PASSED", player: action.player, passes });
  if (passes >= 2) {
    // Both players passed in a row: close the window and resolve the stack LIFO.
    resolveResponseStack(next, events);
    finalizeWin(next, events);
    return { state: next, events };
  }
  next.pendingResponse = { priority: opponentOf(action.player), passes };
  return { state: next, events };
}

/** Drain the response stack LIFO once the window closes. The TOP entry resolves first.
 *  A COUNTER fizzles the entry directly beneath it (marking `fizzled`), so a counter
 *  neutralizes what it answered — and a counter-the-counter (a COUNTER under another
 *  COUNTER) is itself fizzled before it can act, resolving correctly LIFO. EFFECT and
 *  ATTACK entries resolve through the shared resolver / combat helpers, reading the LIVE
 *  (already-pumped/shielded) board so earlier-resolving responses truly change the
 *  outcome. A fizzled entry is a clean no-op. Bounded by the stack length (finite). */
function resolveResponseStack(next: MatchState, events: GameEvent[]) {
  const stack: ResponseStackEntry[] = next.responseStack ?? [];
  while (stack.length > 0) {
    const entry = stack.pop() as ResponseStackEntry;
    if (entry.fizzled) {
      // Neutralized by a counter above it — resolves to nothing.
      continue;
    }
    if (entry.kind === "COUNTER") {
      // Fizzle the entry DIRECTLY BENEATH this counter (the one it was played in
      // response to). With the counter already popped, that is the new stack top.
      const beneath = stack[stack.length - 1];
      if (beneath) {
        beneath.fizzled = true;
        events.push({ type: "RESPONSE_FIZZLED", entryId: beneath.id });
      }
      continue;
    }
    if (entry.kind === "EFFECT" && entry.effect) {
      // Resolve a fast effect via the shared resolver. The target is re-located against
      // the LIVE board (it may have changed since the response was cast). PUMP/SHIELD
      // target the controller's OWN board; DAMAGE_UNIT targets an ENEMY unit; HEAL_NEXUS
      // is self-only. A missing target is a clean no-op (handled in the resolver).
      let target: any = undefined;
      if (entry.targetInstanceId) {
        const ownSide = entry.effect.op === "DAMAGE_UNIT" ? opponentOf(entry.controller) : entry.controller;
        const ref = findUnitByInstance(next, ownSide, entry.targetInstanceId);
        if (ref) target = ref.unit;
      }
      resolveResponseEffect(next, entry.controller, entry.effect, target);
      // A fast effect can kill a unit (DAMAGE_UNIT) — reap it like any ability damage.
      resolveDeaths(next);
      continue;
    }
    if (entry.kind === "ATTACK") {
      // The deferred slow swing finally lands, reading the LIVE units (which a response
      // beneath-resolving-EARLIER may have pumped/shielded/killed). Re-validate
      // defensively: the attacker may have died to a response, or the defender may be
      // gone — in which case the swing simply does not occur (clean no-op).
      if (entry.face) {
        resolveAttackFaceCombat(next, entry.controller, entry.attackerInstanceId ?? "", events);
      } else {
        resolveAttackUnitCombat(next, entry.controller, entry.attackerInstanceId ?? "", entry.defenderInstanceId ?? "", events);
      }
      continue;
    }
  }
  next.responseStack = [];
  next.pendingResponse = null;
  events.push({ type: "RESPONSE_RESOLVED" });
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

  // SECRETS (#2): the DEFENDER's armed reactive triggers spring as the swing resolves.
  const secretsFired = fireArmedSecrets(next, opponentOf(attacker), "ON_ENEMY_ATTACK", attackerRef.unit);
  if (secretsFired.length) {
    events.push({
      type: "SECRET_FIRED",
      player: opponentOf(attacker),
      secretIds: secretsFired,
      againstInstanceId: attackerInstanceId,
    });
  }
  if ((attackerRef.unit.health ?? 0) <= 0) {
    // The secret destroyed the attacker before it could strike: the attack FIZZLES.
    markAttacked(attackerRef.unit);
    attackerRef.unit.stealthed = false;
    resolveDeaths(next);
    events.push({
      type: "ATTACK",
      player: attacker,
      attackerInstanceId,
      defenderInstanceId,
      outgoing: 0,
      mitigated: 0,
      counter: 0,
    });
    return;
  }

  const outgoing = resolveOutgoingDamage(attackerRef.unit);
  const attackerPierces = !!passiveSpec(attackerRef.unit.cardId, "PIERCE_ARMOR");
  const rawOnDefender = attackerPierces ? outgoing : resolveMitigatedDamage(attackerRef.unit, defenderRef.unit);
  const mitigated = absorbDamage(defenderRef.unit, rawOnDefender);
  const counter = absorbDamage(attackerRef.unit, resolveMitigatedDamage(defenderRef.unit, attackerRef.unit));

  const defHpBefore = defenderRef.unit.health;
  applyCombatDamage(defenderRef.unit, mitigated);
  applyCombatDamage(attackerRef.unit, counter);
  if (executesTarget(attackerRef.unit, defenderRef.unit)) {
    defenderRef.unit.health = 0;
  }
  if (unitHasKeyword(attackerRef.unit, "CRUSH") && defenderRef.unit.health <= 0) {
    const overflow = Math.max(0, mitigated - Math.max(0, defHpBefore));
    if (overflow > 0) {
      const target = opponentOf(attacker);
      next.players[target].nexusHealth = (next.players[target].nexusHealth ?? 20) - overflow;
    }
  }
  healNexus(next, attacker, lifestealHeal(attackerRef.unit, mitigated));
  healNexus(next, opponentOf(attacker), lifestealHeal(defenderRef.unit, counter));

  markAttacked(attackerRef.unit);
  attackerRef.unit.stealthed = false;

  fireTrigger(next, attacker, attackerRef.unit, "ON_ATTACK", defenderRef.unit);
  if (mitigated > 0) {
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
    applyCombatDamage(defenderRef.unit, phantomDmg);
    if (executesTarget(attackerRef.unit, defenderRef.unit)) {
      defenderRef.unit.health = 0;
    }
    if (unitHasKeyword(attackerRef.unit, "CRUSH") && defenderRef.unit.health <= 0) {
      const overflow = Math.max(0, phantomDmg - Math.max(0, defHpPre));
      if (overflow > 0) {
        const tgt = opponentOf(attacker);
        next.players[tgt].nexusHealth = (next.players[tgt].nexusHealth ?? 20) - overflow;
      }
    }
    healNexus(next, attacker, lifestealHeal(attackerRef.unit, phantomDmg));
    if (phantomDmg > 0 && defenderRef.unit.health > 0) {
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
  next.players[target].nexusHealth = (next.players[target].nexusHealth ?? 20) - damage;
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
  const result = applyActionCore(state, action);
  // Continuous faction auras are recomputed once per action at this single
  // chokepoint. A rejected action returns the ORIGINAL `state` reference
  // unchanged, so the identity check skips the (pointless) recompute and leaves
  // rejects a true no-op; every successful branch returns a fresh clone.
  if (result.state !== state) recomputeAuras(result.state);
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

  // GLOBAL RESPONSE GATE (RESOLUTION_MODEL.md §9, opt-in `rules.responseStack`). While a
  // response window is open the model is single-threaded on the WINDOW (not the active
  // player): the ONLY legal actions are CAST_RESPONSE / PASS_RESPONSE, by whoever holds
  // priority. Both players may act here (priority alternates), so this gate REPLACES the
  // active-player check for those two actions. Every other action type reject-softs
  // `response-pending`; a CAST_RESPONSE / PASS_RESPONSE from the wrong player reject-softs
  // `not-your-priority`. A window is NEVER open in a vanilla match (flag off), so this is a
  // clean no-op there and the golden fixture is unmoved.
  if (next.pendingResponse) {
    if (action.type !== "CAST_RESPONSE" && action.type !== "PASS_RESPONSE") {
      return reject(state, "response-pending");
    }
    if (action.player !== next.pendingResponse.priority) {
      return reject(state, "not-your-priority");
    }
    if (action.type === "CAST_RESPONSE") return castResponse(next, action, events);
    return passResponse(next, action, events);
  }
  // A response action arriving with NO open window is a clean no-op.
  if (action.type === "CAST_RESPONSE" || action.type === "PASS_RESPONSE") {
    return reject(state, "no-response-window");
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
      // AURA_COST_REDUCTION (e.g. King Tomb): friendly units cost N less. The
      // reduction is re-derived from the live board, so it is idempotent. The
      // legality check uses the reduced cost; setup.ts charges the full cost
      // (minus its own first-unit reduction), so the aura amount is refunded
      // after the play resolves. Floored at 0.
      const unitReduction = costReductionFor(next, action.player, "AURA_COST_REDUCTION");
      const effUnitCost = Math.max(0, costOf(cardId) - unitReduction);
      if (effUnitCost > (player.energy ?? 0)) return reject(state, "not-enough-energy");
      // Delegate the already-correct play (energy deduction incl. first-unit
      // reduction, instance-id minting, commander modifiers) to the engine.
      const played = playUnitFromHand(next, action.player, action.handIndex, action.lane) as MatchState;
      // Refund the continuous cost-reduction aura. setup.ts charged
      // `max(0, cardCost - firstUnitReduction)`; the desired spend is
      // `max(0, cardCost - firstUnitReduction - unitReduction)`. We compute what
      // setup actually charged (energyBefore - energyAfter) and the desired final
      // spend, then credit the difference so both reductions stack correctly and
      // the spend never goes negative.
      if (unitReduction > 0) {
        const ppl = played.players[action.player];
        const charged = (player.energy ?? 0) - (ppl.energy ?? 0);
        const desired = Math.max(0, charged - unitReduction);
        const refund = charged - desired;
        if (refund > 0) ppl.energy = (ppl.energy ?? 0) + refund;
      }
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
          if (ref) battlecryTarget = ref.unit;
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
      if (action.handIndex < 0 || action.handIndex >= player.hand.length) {
        return reject(state, "hand-index-out-of-bounds");
      }
      const cardId = player.hand[action.handIndex];
      if (cardTypeOf(cardId) !== "artifact") return reject(state, "not-an-artifact");
      if (costOf(cardId) > (player.energy ?? 0)) return reject(state, "not-enough-energy");
      const played = playArtifactCard(next, action.player, action.handIndex) as MatchState;
      played.lastCardPlayed = { cardId, owner: action.player };
      events.push({ type: "ARTIFACT_PLAYED", player: action.player, cardId });
      return { state: played, events };
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

      // RESPONSE STACK (opt-in): once the attack is LEGAL, DEFER it onto the stack and
      // open a response window instead of resolving immediately, so the opponent (and
      // then the attacker) may play FAST responses that resolve LIFO before this swing
      // lands. Flag OFF (default) falls straight through to the immediate-resolution
      // path below — byte-identical to today. The base ATTACK entry resolves through the
      // SAME `resolveAttackUnitCombat` helper when the stack drains, reading the LIVE
      // (possibly pumped/shielded) units, so a response truly changes the outcome.
      if (next.rules?.responseStack) {
        return openResponseWindow(next, {
          id: nextResponseId(next),
          controller: action.player,
          kind: "ATTACK",
          attackerInstanceId: action.attackerInstanceId,
          defenderInstanceId: action.defenderInstanceId,
        }, events);
      }

      resolveAttackUnitCombat(next, action.player, action.attackerInstanceId, action.defenderInstanceId, events);
      finalizeWin(next, events);
      return { state: next, events };
    }

    case "ATTACK_FACE": {
      const attackerRef = findUnitByInstance(next, action.player, action.attackerInstanceId);
      if (!attackerRef) return reject(state, "attacker-not-found");
      if (attackerRef.unit.exhausted) return reject(state, "attacker-exhausted");
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

      // RESPONSE STACK (opt-in): defer a legal face swing onto the stack and open a
      // window (see ATTACK_UNIT). Flag OFF = immediate, byte-identical to today.
      if (next.rules?.responseStack) {
        return openResponseWindow(next, {
          id: nextResponseId(next),
          controller: action.player,
          kind: "ATTACK",
          attackerInstanceId: action.attackerInstanceId,
          face: true,
        }, events);
      }

      resolveAttackFaceCombat(next, action.player, action.attackerInstanceId, events);
      finalizeWin(next, events);
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

      // ASCENDANCY (#4): score board control for the ending player now that their
      // turn's board is settled. ENTIRELY gated on the opt-in ruleset so a vanilla
      // match is byte-identical (no extra field, no extra finalizeWin / WIN event)
      // and the reducer-equivalence golden JSON stays unmoved. Reaching the
      // threshold ends the match by control victory before control even passes.
      if (next.rules?.ascendancyToWin) {
        advanceAscendancy(next, ending);
        finalizeWin(next, events);
        if (next.winner) {
          return { state: next, events };
        }
      }

      // ASSEMBLE / LIBRARY win (alt win-con, opt-in `rules.assembleToWin`). Scored at the
      // END of the ending player's turn (their board/hand are settled). detectWinner now
      // consults the hand size; finalizeWin stamps the winner if anyone is at/above the
      // threshold. Lethal-nexus / deckout still precede inside detectWinner. ENTIRELY
      // gated, so a vanilla match is byte-identical and the golden fixture is unmoved.
      if (next.rules?.assembleToWin) {
        finalizeWin(next, events);
        if (next.winner) {
          return { state: next, events };
        }
      }

      const nextPlayerId = opponentOf(ending);
      const np = next.players[nextPlayerId];

      next.activePlayer = nextPlayerId;
      next.turn = (next.turn ?? 1) + 1;

      // Ramp + refill energy for the player whose turn is beginning.
      np.maxEnergy = Math.min(ENERGY_CAP, (np.maxEnergy ?? BASE_MAX_ENERGY) + 1);
      np.energy = np.maxEnergy;

      // Refresh exhausted units (the lived rule does NOT reset summoning sick).
      // REGROW units also regenerate to full at the start of their turn.
      // ON_TURN_START fires for the player whose turn is beginning: PATIENT units
      // grow +1/+1 each turn they remain in play (regrow first, then grow).
      for (const lane of ["front", "back"] as Lane[]) {
        for (const unit of np.board?.[lane] ?? []) {
          unit.exhausted = false;
          unit.windfuryStruck = false; // WINDFURY bonus attack refreshes each turn
          unit.attacksThisTurn = 0; // DOUBLE_ATTACK tally refreshes each turn
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

      const drew = drawForPlayer(next, nextPlayerId);
      if (!drew) {
        events.push({ type: "DECK_OUT", player: nextPlayerId });
        finalizeWin(next, events);
      } else {
        events.push({ type: "TURN_START", player: nextPlayerId, energy: np.energy, maxEnergy: np.maxEnergy });
        // ASSEMBLE / LIBRARY win (alt win-con, opt-in `rules.assembleToWin`). The
        // start-of-turn draw can carry the player whose turn is beginning across the
        // hand-size threshold — a "draw into the library win". Re-score AFTER the draw
        // so that crossing is stamped. Fully gated, so a vanilla match is byte-identical
        // and the golden fixture is unmoved. Lethal-nexus / deckout still precede.
        if (next.rules?.assembleToWin) {
          finalizeWin(next, events);
        }
      }
      return { state: next, events };
    }

    case "MULLIGAN": {
      // One-time opening redraw. Lived rule: P1 only, before any action on
      // turn 1. We reproduce the hook's exact reshuffle: return the hand to the
      // BOTTOM of the library in order, then redraw OPENING_HAND_SIZE off the top.
      if (action.player !== "P1") return reject(state, "mulligan-p1-only");
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

/** If the position is now decided, stamp the winner and emit WIN once. */
function finalizeWin(state: MatchState, events: GameEvent[]) {
  const w = detectWinner(state);
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
