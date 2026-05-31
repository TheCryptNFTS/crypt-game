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

import { MatchState, PlayerId, Lane, BASE_MAX_ENERGY, ENERGY_CAP, STARTING_NEXUS_HEALTH, TriggerQueueEntry } from "./state";
import { playUnitFromHand, playEquipmentFromHand } from "./setup";
import { playArtifactCard } from "./effectSystem";
import { resolveOutgoingDamage, resolveMitigatedDamage } from "./resolveCombatBonuses";
import {
  initShield,
  armorOnSummon,
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
import { allPlayableCards } from "./cards";
import { spellCards } from "./spellCards";
import { compileAbility, CompiledAbility, EffectTrigger, EffectOp } from "./abilityCompiler";
import { resolveEffect, resolveSpecs } from "./effectResolver";
import { makeRng, shuffle as seededShuffle } from "./rng";

export type Action =
  | { type: "MULLIGAN"; player: PlayerId }
  | { type: "PLAY_UNIT"; player: PlayerId; handIndex: number; lane: Lane; targetInstanceId?: string }
  | { type: "PLAY_ARTIFACT"; player: PlayerId; handIndex: number }
  | { type: "EQUIP"; player: PlayerId; handIndex: number; targetInstanceId: string }
  | { type: "PLAY_SPELL"; player: PlayerId; handIndex: number; targetInstanceId?: string }
  | { type: "ATTACK_UNIT"; player: PlayerId; attackerInstanceId: string; defenderInstanceId: string }
  | { type: "ATTACK_FACE"; player: PlayerId; attackerInstanceId: string }
  | { type: "END_TURN"; player: PlayerId };

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

function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

/** Compiled-ability cache. Abilities are static per card id, so we compile each
 *  card's `rawTraits.Ability` once and reuse the IR for every trigger. */
const compiledAbilityCache = new Map<string, CompiledAbility>();
function compiledFor(cardId: string): CompiledAbility {
  let c = compiledAbilityCache.get(cardId);
  if (!c) {
    c = compileAbility(cardMetaById.get(cardId)?.rawTraits?.Ability);
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

/** Apply a single combat-damage instance to a unit, honoring PASSIVE_FLOOR_HP
 *  (e.g. Walter): a unit with that passive can never be dropped below 1 HP by ONE
 *  damage instance. EXECUTE / hard-removal that set health to 0 directly bypass
 *  this (they are not "damage instances"). A unit already at/below 1 is untouched
 *  by the floor (it doesn't get healed up to 1). */
function applyCombatDamage(unit: any, amount: number): void {
  if (amount <= 0) return;
  const after = unit.health - amount;
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

/** Shared start-of-turn draw. Mutates the cloned state. Returns false on
 *  deck-out (fatigue): sets `winner` to the opponent, exactly like the hook. */
function drawForPlayer(state: MatchState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  const lib: string[] = Array.isArray(player.deck) ? player.deck : [];
  if (lib.length === 0) {
    state.winner = opponentOf(playerId);
    return false;
  }
  const drawn = lib.shift() as string;
  player.deck = lib;
  player.deckCount = lib.length;
  player.hand = [...(player.hand ?? []), drawn];
  return true;
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

      const outgoing = resolveOutgoingDamage(attackerRef.unit);
      // JUDGMENT (PIERCE_ARMOR): the attacker's strike ignores the defender's
      // armor entirely (full outgoing lands, pre-shield). The defender's counter
      // is unaffected — Judgment rides only on the attacker's own strike.
      const attackerPierces = !!passiveSpec(attackerRef.unit.cardId, "PIERCE_ARMOR");
      const rawOnDefender = attackerPierces ? outgoing : resolveMitigatedDamage(attackerRef.unit, defenderRef.unit);
      // WARD / DIVINE_SHIELD absorb the first instance of damage on each side.
      const mitigated = absorbDamage(defenderRef.unit, rawOnDefender);
      const counter = absorbDamage(attackerRef.unit, resolveMitigatedDamage(defenderRef.unit, attackerRef.unit));

      const defHpBefore = defenderRef.unit.health;
      applyCombatDamage(defenderRef.unit, mitigated);
      applyCombatDamage(attackerRef.unit, counter);
      // EXECUTE: finish a defender that survived but was left at/below half HP.
      if (executesTarget(attackerRef.unit, defenderRef.unit)) {
        defenderRef.unit.health = 0;
      }
      // CRUSH (trample): lethal-and-then-some spills the leftover damage to the
      // defending nexus. Uses post-mitigation damage, so armor/shield reduce it.
      if (unitHasKeyword(attackerRef.unit, "CRUSH") && defenderRef.unit.health <= 0) {
        const overflow = Math.max(0, mitigated - Math.max(0, defHpBefore));
        if (overflow > 0) {
          const target = opponentOf(action.player);
          next.players[target].nexusHealth = (next.players[target].nexusHealth ?? 20) - overflow;
        }
      }
      // LIFESTEAL: each side heals its controller for the damage it dealt.
      healNexus(next, action.player, lifestealHeal(attackerRef.unit, mitigated));
      healNexus(next, opponentOf(action.player), lifestealHeal(defenderRef.unit, counter));

      // WINDFURY / DOUBLE_ATTACK: the unit may stay ready for a bonus/second
      // swing; otherwise it exhausts as normal.
      markAttacked(attackerRef.unit);
      // STEALTH breaks the moment the unit acts.
      attackerRef.unit.stealthed = false;

      // ON_ATTACK: Rally buffs the attacker's other allies (target ignored);
      // Decay debuffs the struck defender ("enemy hit by this loses attack").
      fireTrigger(next, action.player, attackerRef.unit, "ON_ATTACK", defenderRef.unit);
      // ON_DAMAGE (Taunt riders): each side that actually took damage retaliates
      // / self-buffs / draws. Retaliate damage targets the OTHER combatant.
      if (mitigated > 0) {
        fireTrigger(next, opponentOf(action.player), defenderRef.unit, "ON_DAMAGE", attackerRef.unit);
      }
      if (counter > 0) {
        fireTrigger(next, action.player, attackerRef.unit, "ON_DAMAGE", defenderRef.unit);
      }

      // MIRROR_ATTACK (e.g. T2): a phantom copy of the attacker lands ONE more
      // identical strike on the SAME defender. The phantom never enters the board
      // and leaves no corpse, so we apply only its outgoing damage (re-mitigated
      // against the live defender) — no counter is dealt back to the phantom. The
      // mirror does not fire the attacker's ON_ATTACK again (no recursion). Only
      // resolves while the defender is still alive after the first strike.
      // BUG M1 FIX: gate MIRROR to the unit's FIRST swing this turn. `markAttacked`
      // above already incremented `attacksThisTurn`, so a unit's first attack reads
      // 1 here. Without this gate a DOUBLE_ATTACK + MIRROR unit would mirror on BOTH
      // real swings (2 real + 2 phantom = 4 strikes); gating to the first swing caps
      // it at 3 (swing1 + its mirror + swing2). A pure MIRROR unit attacks once, so
      // attacksThisTurn === 1 and it still mirrors as before (2 strikes total).
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
        // CRUSH spillover from the phantom's lethal mirrors the real strike's rule.
        if (unitHasKeyword(attackerRef.unit, "CRUSH") && defenderRef.unit.health <= 0) {
          const overflow = Math.max(0, phantomDmg - Math.max(0, defHpPre));
          if (overflow > 0) {
            const tgt = opponentOf(action.player);
            next.players[tgt].nexusHealth = (next.players[tgt].nexusHealth ?? 20) - overflow;
          }
        }
        // LIFESTEAL: the controller heals for the phantom's damage too.
        healNexus(next, action.player, lifestealHeal(attackerRef.unit, phantomDmg));
        if (phantomDmg > 0 && defenderRef.unit.health > 0) {
          fireTrigger(next, opponentOf(action.player), defenderRef.unit, "ON_DAMAGE", attackerRef.unit);
        }
      }

      // Death resolution fires DEATHRATTLE before clearing dead units.
      resolveDeaths(next);

      events.push({
        type: "ATTACK",
        player: action.player,
        attackerInstanceId: action.attackerInstanceId,
        defenderInstanceId: action.defenderInstanceId,
        outgoing,
        mitigated,
        counter,
      });
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

      const target = opponentOf(action.player);
      const damage = resolveOutgoingDamage(attackerRef.unit);
      next.players[target].nexusHealth = (next.players[target].nexusHealth ?? 20) - damage;
      // LIFESTEAL: heal the attacking controller for the face damage dealt.
      healNexus(next, action.player, lifestealHeal(attackerRef.unit, damage));
      // WINDFURY / DOUBLE_ATTACK: keep the unit ready for its bonus/second swing;
      // else it exhausts.
      markAttacked(attackerRef.unit);
      // STEALTH breaks the moment the unit acts.
      attackerRef.unit.stealthed = false;
      // ON_ATTACK (Rally) fires on face swings too ("when this attacks").
      fireTrigger(next, action.player, attackerRef.unit, "ON_ATTACK");

      events.push({
        type: "NEXUS_DAMAGE",
        player: action.player,
        targetPlayer: target,
        attackerInstanceId: action.attackerInstanceId,
        damage,
      });
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
          fireTrigger(next, nextPlayerId, unit, "ON_TURN_START");
        }
      }

      // Commander start-of-turn passive (e.g. Silver Oracle's Scry) for the
      // player whose turn is beginning.
      commanderOnTurnStart(next, nextPlayerId, costOf);

      events.push({ type: "TURN_END", player: ending });

      const drew = drawForPlayer(next, nextPlayerId);
      if (!drew) {
        events.push({ type: "DECK_OUT", player: nextPlayerId });
        finalizeWin(next, events);
      } else {
        events.push({ type: "TURN_START", player: nextPlayerId, energy: np.energy, maxEnergy: np.maxEnergy });
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
