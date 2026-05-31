/**
 * effectResolver — Phase B of the effect system.
 *
 * Consumes the typed Effect IR from `abilityCompiler` (`EffectSpec`) and applies
 * a single effect to the LIVE match shape (`nexusHealth`, `board.front/back`,
 * `idCounter`-minted units). Mirrors the reducer's contract:
 *
 *   - IMPURE-IN-PLACE: it mutates the state it is handed. The reducer already
 *     `structuredClone`s once at entry, so the resolver composes inside it
 *     (Phase C) without a second clone. Proofs pass a fresh arena.
 *   - Deterministic: token instance ids are minted from `state.idCounter` using
 *     the same `unit_${seed}_${counter}` convention as `setup.makeInstanceId`,
 *     so summoned tokens are stable for a given (seed, action order).
 *
 * Scope: this layer resolves the seven ACTIVE ops the live corpus needs —
 * DEAL_DAMAGE, HEAL, BUFF_SELF, BUFF_ALLIES, DEBUFF_ENEMY, SUMMON_TOKEN, DRAW.
 * The two PASSIVE combat modifiers (PIERCE_ARMOR / RESTRICT_ATTACK) are NOT
 * one-shot effects — they alter combat legality/resolution and are consumed at
 * attack time (Phase C), so the resolver intentionally no-ops them here.
 */

import { MatchState, PlayerId, Lane, UnitInPlay, STARTING_NEXUS_HEALTH, MAX_LANE_UNITS, ChoiceOption } from "./state";
import { EffectSpec } from "./abilityCompiler";
import { scryDeck } from "./keywordEngine";
import { makeRng } from "./rng";

export interface EffectContext {
  /** The already-cloned state to mutate in place. */
  state: MatchState;
  /** Player who controls the source unit / owns the effect. */
  controller: PlayerId;
  /** The unit that triggered the effect (BUFF_SELF target, token owner). */
  source?: UnitInPlay;
  /** Explicit target unit for targeted ops (DEAL_DAMAGE / HEAL / DEBUFF_ENEMY). */
  target?: UnitInPlay;
  /** Lane a SUMMON_TOKEN should enter (defaults to the source's lane, else front). */
  lane?: Lane;
  /** Resolves a cardId to its faction (injected by the reducer from cardMetaById).
   *  Required only for faction-scaled BUFF_SELF (Oath/Vow/Martyr). */
  factionOf?: (cardId: string) => string | null | undefined;
  /** Resolves a cardId to its play cost (injected by the reducer from
   *  cardMetaById). Required only for DESTROY_ENEMY_SELECT's deterministic
   *  highest-cost / cost-gate selection. Defaults to 0 when absent. */
  costOf?: (cardId: string) => number;
  /** Resolves a cardId to its card type ("unit" | "spell" | ...), injected by the
   *  reducer from cardMetaById. Required only for the deck-manipulation ops
   *  (TUTOR_FROM_DECK / DRAW_FILTERED) that select cards by type. Defaults to a
   *  null lookup (no card matches a type) when absent, so those ops cleanly
   *  no-op rather than guessing. */
  cardTypeOf?: (cardId: string) => string | null | undefined;
}

/** Maps the faction NOUN as it appears in ability text ("Stone Keeper you
 *  control") to the canonical faction enum used by `cardMetaById.faction`. */
const FACTION_NOUNS: Array<[RegExp, string]> = [
  [/stone keeper/i, "STONE_KEEPERS"],
  [/iron defender/i, "IRON_DEFENDERS"],
  [/bronze guardian/i, "BRONZE_GUARDIANS"],
  [/silver sentinel/i, "SILVER_SENTINELS"],
  [/golden sovereign/i, "GOLDEN_SOVEREIGNS"],
  [/\bgod\b/i, "GODS"],
];

/**
 * The faction-scaling multiplier for an Oath/Vow/Martyr buff: counts the
 * controller's board units whose faction matches the noun in `scaleText`. When
 * the text says "other ... you control", the source itself is excluded.
 *
 * Returns 1 (an un-scaled single application) when the noun is unrecognized
 * (e.g. "oath fulfilled") or when no faction lookup is wired, so a buff is never
 * silently zeroed out.
 */
function factionScaleCount(ctx: EffectContext, scaleText: string): number {
  const match = FACTION_NOUNS.find(([re]) => re.test(scaleText));
  if (!match || !ctx.factionOf) return 1;
  const wanted = match[1];
  const excludeSource = /\b(other|ally|allied)\b/i.test(scaleText);
  let count = 0;
  for (const u of alliedUnits(ctx.state, ctx.controller)) {
    if (excludeSource && u === ctx.source) continue;
    if (ctx.factionOf(u.cardId) === wanted) count += 1;
  }
  return count;
}

/** Direct (armor-ignoring) damage to a unit. Ability damage is spell-like and
 *  bypasses armor — combat damage (which respects armor) stays in the reducer. */
function damageUnit(unit: UnitInPlay, amount: number) {
  if (amount <= 0) return;
  unit.health -= amount;
}

function healUnit(unit: UnitInPlay, amount: number) {
  // amount <= 0 in the IR means "to full" (HEAL_RE matched with no number).
  const cap = unit.maxHealth ?? unit.health;
  unit.health = amount > 0 ? Math.min(cap, unit.health + amount) : cap;
}

function buffUnit(unit: UnitInPlay, attack: number, health: number) {
  unit.attack += attack;
  if (health) {
    unit.maxHealth = (unit.maxHealth ?? unit.health) + health;
    unit.health += health;
  }
}

function alliedUnits(state: MatchState, controller: PlayerId): UnitInPlay[] {
  const b = state.players[controller].board;
  return [...(b?.front ?? []), ...(b?.back ?? [])];
}

function mintToken(ctx: EffectContext, spec: EffectSpec): UnitInPlay | undefined {
  const { state, controller } = ctx;
  const lane: Lane = ctx.lane ?? ctx.source?.lane ?? "front";
  // BUG L1 FIX: bound the board. SUMMON_ON_ANY_DEATH watchers can mint tokens off
  // every death; two mutually-watching watchers (or a watcher that mints a token
  // whose death is itself watched) could mint without bound. If the target lane is
  // already at the MAX_LANE_UNITS cap, the mint is a clean no-op (no id consumed,
  // nothing pushed). Checked BEFORE incrementing idCounter so a refused mint stays
  // fully inert and deterministic.
  if ((state.players[controller].board[lane]?.length ?? 0) >= MAX_LANE_UNITS) {
    return undefined;
  }
  const counter = state.idCounter ?? 0;
  state.idCounter = counter + 1;
  const attack = spec.attack ?? 1;
  const health = spec.health ?? 1;
  // A keyword captured from "summon a N/M X with <keyword>" rides onto the token.
  const keywords = spec.tokenKeyword ? [spec.tokenKeyword] : [];
  const token: UnitInPlay = {
    instanceId: `unit_${state.seed}_${counter}`,
    cardId: `token_${(spec.token ?? "token").toLowerCase().replace(/\s+/g, "_")}`,
    lane,
    attack,
    health,
    maxHealth: health,
    speed: 0,
    armor: 0,
    keywords,
    // Lived model has no summoning sickness: a fresh token may act this turn.
    exhausted: false,
    summoningSick: false,
  };
  state.players[controller].board[lane].push(token);
  return token;
}

/** Generic per-X multiplier for a scaled BUFF_SELF. Counts the controller's
 *  board allies, the opponent's board units, or the controller's hand size. */
function genericScaleCount(ctx: EffectContext, scaleBy: NonNullable<EffectSpec["scaleBy"]>): number {
  const { state, controller } = ctx;
  switch (scaleBy) {
    case "ALLY_COUNT":
      return alliedUnits(state, controller).length;
    case "ENEMY_COUNT": {
      const enemy: PlayerId = controller === "P1" ? "P2" : "P1";
      return alliedUnits(state, enemy).length;
    }
    case "CARDS_IN_HAND":
      return (state.players[controller].hand ?? []).length;
    case "ADJACENT_UNITS": {
      // Count the source's own same-lane board-neighbors at index ±1 (mirrors
      // CLEAVE's neighbor logic, anchored on ctx.source instead of ctx.target).
      // No source / not on a board -> 0 neighbors -> the buff cleanly no-ops.
      if (!ctx.source) return 0;
      const loc = locateUnit(state, ctx.source);
      if (!loc) return 0;
      const laneArr = state.players[loc.owner].board[loc.lane];
      let n = 0;
      if (laneArr[loc.idx - 1]) n += 1;
      if (laneArr[loc.idx + 1]) n += 1;
      return n;
    }
    default:
      return 1;
  }
}

/** Evaluate a spec's optional condition against the live ctx. Honest &
 *  deterministic: returns true (allow) when no condition is present. */
function conditionMet(spec: EffectSpec, ctx: EffectContext): boolean {
  const cond = spec.condition;
  if (!cond) return true;
  switch (cond.kind) {
    case "SURVIVED":
      // "If it survives": the source unit is still alive after combat resolved.
      return (ctx.source?.health ?? 0) > 0;
    case "ALLY_COUNT_GTE":
      return alliedUnits(ctx.state, ctx.controller).length >= (cond.value ?? 0);
    case "SELF_HEALTH_BELOW":
      // "N or less health" / "below N": inclusive at the threshold.
      return ctx.source !== undefined && ctx.source.health <= (cond.value ?? 0);
    default:
      return true;
  }
}

/** Locate which player's board a live unit ref sits on, and its lane + index, by
 *  identity. Used by removal / bounce ops that must mutate the owner's board. */
function locateUnit(state: MatchState, unit: UnitInPlay): { owner: PlayerId; lane: Lane; idx: number } | null {
  for (const owner of ["P1", "P2"] as PlayerId[]) {
    const board = state.players[owner].board;
    for (const lane of ["front", "back"] as Lane[]) {
      const idx = (board?.[lane] ?? []).indexOf(unit);
      if (idx >= 0) return { owner, lane, idx };
    }
  }
  return null;
}

/** A token (minted by SUMMON_TOKEN) has no real card to return to hand. Its
 *  cardId is `token_*` / `unit_*`, never a catalog id. */
function isTokenCard(cardId: string): boolean {
  return cardId.startsWith("token_") || cardId.startsWith("unit_");
}

function drawCards(state: MatchState, controller: PlayerId, n: number) {
  const player = state.players[controller];
  const lib: string[] = Array.isArray(player.deck) ? player.deck : [];
  for (let i = 0; i < n && lib.length > 0; i += 1) {
    player.hand = [...(player.hand ?? []), lib.shift() as string];
  }
  player.deck = lib;
  player.deckCount = lib.length;
}

/**
 * Deterministic, seeded selection of K distinct option indices from a pool of
 * `size` candidates. Uses ONLY `makeRng(seed)` fast-forwarded `cursor` steps (the
 * same stream the reducer's rngAt derives), so the draw is a pure function of
 * (seed, cursor, size, k). Returns the chosen indices AND the number of RNG draws
 * consumed, so the caller can advance `state.rngCursor` by exactly that count and
 * keep the cursor in lockstep across a replay. A Fisher-Yates partial shuffle over
 * an index array guarantees distinct picks; when k >= size it returns all indices
 * in order with zero draws (no choice needed beyond the whole pool).
 */
export function seededDistinctPick(
  seed: number,
  cursor: number,
  size: number,
  k: number
): { indices: number[]; draws: number } {
  const want = Math.min(Math.max(0, k), size);
  if (want <= 0) return { indices: [], draws: 0 };
  if (want >= size) {
    // Whole pool offered, in deterministic deck order — no RNG consumed.
    return { indices: Array.from({ length: size }, (_, i) => i), draws: 0 };
  }
  // Rebuild the stream and fast-forward to the absolute cursor (mirror rngAt: the
  // value AT `cursor` is the (cursor+1)-th draw). We then consume `want` fresh
  // draws for the partial shuffle, so the cursor advances by exactly `want`.
  const rng = makeRng(seed);
  for (let i = 0; i <= cursor; i += 1) rng();
  const pool = Array.from({ length: size }, (_, i) => i);
  let draws = 0;
  for (let i = 0; i < want; i += 1) {
    // pick j in [i, size) and swap to the front segment.
    const j = i + Math.floor(rng() * (size - i));
    draws += 1;
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return { indices: pool.slice(0, want), draws };
}

/** Append a cardId to a player's hand (the RESOLVE_CHOICE resume tail for a
 *  Discover whose source is "pool"). Pure mutation, no RNG. */
export function addCardToHand(state: MatchState, controller: PlayerId, cardId: string): void {
  const player = state.players[controller];
  player.hand = [...(player.hand ?? []), cardId];
}

/** Resume tail for a Discover whose options came from the controller's OWN deck:
 *  move the chosen cardId from deck to hand (first matching copy). If the card is
 *  no longer in the deck (defensive; shouldn't happen between paired actions) it
 *  is a clean no-op. */
export function moveCardDeckToHand(state: MatchState, controller: PlayerId, cardId: string): void {
  const player = state.players[controller];
  const deck: string[] = Array.isArray(player.deck) ? player.deck : [];
  const idx = deck.indexOf(cardId);
  if (idx < 0) return; // not in deck anymore — clean no-op
  const next = [...deck.slice(0, idx), ...deck.slice(idx + 1)];
  player.deck = next;
  player.deckCount = next.length;
  player.hand = [...(player.hand ?? []), cardId];
}

/**
 * Apply one EffectSpec to the live state. Returns nothing; mutates in place.
 * Unknown / passive / no-op classifications are silently ignored so callers can
 * fan a whole `CompiledAbility.specs` array through without pre-filtering.
 */
export function resolveEffect(spec: EffectSpec, ctx: EffectContext): void {
  const { state, controller } = ctx;
  // Conditional gate (Part A): a spec whose predicate is false is a clean no-op.
  if (!conditionMet(spec, ctx)) return;
  switch (spec.op) {
    case "DEAL_DAMAGE": {
      // `self` ops (end-of-turn decay) target the source unit; otherwise an
      // explicit target must be supplied by the caller.
      const tgt = spec.self ? ctx.source : ctx.target;
      if (tgt) damageUnit(tgt, spec.amount ?? 0);
      break;
    }
    case "HEAL": {
      const tgt = spec.self ? ctx.source : ctx.target;
      if (tgt) healUnit(tgt, spec.amount ?? 0);
      break;
    }
    case "BUFF_SELF": {
      if (ctx.source) {
        // Faction scaling and generic per-X scaling are mutually exclusive on a
        // spec; both multiply the printed delta the same way.
        const mult = spec.scaleFaction
          ? factionScaleCount(ctx, spec.scaleFaction)
          : spec.scaleBy
            ? genericScaleCount(ctx, spec.scaleBy)
            : 1;
        buffUnit(ctx.source, (spec.attack ?? 0) * mult, (spec.health ?? 0) * mult);
      }
      break;
    }
    case "BUFF_IF_UNDAMAGED": {
      // Track A2 (2): "Patient/Ward. Gains +N/+N for each turn it remains
      // undamaged." A genuine TRIGGERED stat-grower. Fired by the reducer at the
      // controller's ON_TURN_START; it grows the unit ONLY when the unit took no
      // damage during the round window (gate: `tookDamageThisTurn` falsy). The
      // reducer resets that flag AFTER this fires, opening a fresh window. No-op
      // without a source or when the unit was hit (clean, deterministic).
      if (ctx.source && !(ctx.source as any).tookDamageThisTurn) {
        buffUnit(ctx.source, spec.attack ?? 0, spec.health ?? 0);
      }
      break;
    }
    case "BUFF_PER_DAMAGE_TAKEN": {
      // Track A2 (3): "Taunt/Patient. When this unit takes damage, gain +N/+N for
      // each point of damage taken." Fires on ON_DAMAGE; the points of THAT hit are
      // recorded on the unit as `lastDamageTaken` by the reducer immediately before
      // firing. Scale the printed delta by that count (capped at `cap` when the
      // text said "up to M"). A non-positive / missing hit is a clean no-op so the
      // buff never applies spuriously or negatively.
      if (ctx.source) {
        let pts = Math.max(0, (ctx.source as any).lastDamageTaken ?? 0);
        if (spec.cap !== undefined) pts = Math.min(pts, spec.cap);
        if (pts > 0) buffUnit(ctx.source, (spec.attack ?? 0) * pts, (spec.health ?? 0) * pts);
      }
      break;
    }
    case "BUFF_ALLIES": {
      for (const u of alliedUnits(state, controller)) {
        if (u === ctx.source) continue; // "Other allies"
        buffUnit(u, spec.attack ?? 0, spec.health ?? 0);
      }
      break;
    }
    case "DEBUFF_ENEMY": {
      const tgt = ctx.target;
      if (tgt) tgt.attack = Math.max(0, tgt.attack - (spec.amount ?? 0));
      break;
    }
    case "SUMMON_TOKEN": {
      // "summon two N/M X" mints `count` copies; default 1.
      const n = Math.max(1, spec.count ?? 1);
      for (let i = 0; i < n; i += 1) mintToken(ctx, spec);
      break;
    }
    case "DRAW": {
      drawCards(state, controller, spec.amount ?? 1);
      break;
    }
    case "HEAL_NEXUS": {
      // Restore the controller's own nexus, capped at the starting HP so a heal
      // never inflates face beyond 20.
      const amount = spec.amount ?? 0;
      if (amount > 0) {
        const cur = state.players[controller].nexusHealth ?? STARTING_NEXUS_HEALTH;
        state.players[controller].nexusHealth = Math.min(STARTING_NEXUS_HEALTH, cur + amount);
      }
      break;
    }
    case "DESTROY_UNIT": {
      // Hard removal: drop the target to 0. The reducer's resolveDeaths /
      // recomputeAuras pass reaps it (and fires its deathrattle / on-death specs).
      if (ctx.target) ctx.target.health = 0;
      break;
    }
    case "RETURN_TO_HAND": {
      // Bounce: lift the target off its owner's board and return its card to that
      // owner's hand. Tokens have no card and simply vanish.
      const tgt = ctx.target;
      if (tgt) {
        const loc = locateUnit(state, tgt);
        if (loc) {
          state.players[loc.owner].board[loc.lane].splice(loc.idx, 1);
          if (!isTokenCard(tgt.cardId)) {
            const owner = state.players[loc.owner];
            owner.hand = [...(owner.hand ?? []), tgt.cardId];
          }
        }
      }
      break;
    }
    case "RESURRECT": {
      // Take the most-recent record from the controller's graveyard and put a
      // fresh, full-health live copy on their board. No-op if the grave is empty.
      const grave = state.players[controller].graveyard ?? [];
      const rec = grave.pop();
      if (rec) {
        const counter = state.idCounter ?? 0;
        state.idCounter = counter + 1;
        const lane: Lane = ctx.source?.lane ?? ctx.lane ?? "front";
        const revived: UnitInPlay = {
          instanceId: `unit_${state.seed}_${counter}`,
          cardId: rec.cardId,
          lane,
          attack: rec.attack,
          health: rec.maxHealth,
          maxHealth: rec.maxHealth,
          speed: 0,
          armor: 0,
          keywords: [...(rec.keywords ?? [])],
          exhausted: false,
          summoningSick: false,
        };
        state.players[controller].board[lane].push(revived);
        state.players[controller].graveyard = grave;
      }
      break;
    }
    case "RETURN_FROM_GRAVE": {
      // Pop the most-recent graveyard record for the controller and hand its card
      // back. No-op if the grave is empty.
      const grave = state.players[controller].graveyard ?? [];
      const rec = grave.pop();
      if (rec) {
        const player = state.players[controller];
        player.hand = [...(player.hand ?? []), rec.cardId];
        player.graveyard = grave;
      }
      break;
    }
    case "CLEAVE": {
      // On-attack splash: hit the STRUCK defender's board-neighbors (same lane,
      // index ±1). amount fixed if given, else floor(attacker.attack / 2).
      if (ctx.target && ctx.source) {
        const loc = locateUnit(state, ctx.target);
        if (loc) {
          const laneArr = state.players[loc.owner].board[loc.lane];
          const amount = spec.amount ?? Math.floor((ctx.source.attack ?? 0) / 2);
          for (const nb of [laneArr[loc.idx - 1], laneArr[loc.idx + 1]]) {
            if (nb) damageUnit(nb, amount);
          }
        }
      }
      break;
    }
    case "DAMAGE_ADJACENT_ENEMIES": {
      // Self-anchored adjacency splash (mirrors CLEAVE's neighbor math, but keyed
      // off ctx.source's OWN board position rather than the struck defender).
      //
      // Adjacency model (deterministic, array-only — NO cross-lane column grid):
      // an "adjacent enemy" is an opponent unit in the SOURCE's same lane at an
      // index neighboring the source's index. We map the source's index onto the
      // opponent's same-lane array and read indices [srcIdx-1, srcIdx, srcIdx+1].
      //   - allAdjacent: hit every opponent unit at those three indices.
      //   - single ("an adjacent enemy"): hit the nearest one — the opponent at
      //     the source's own index if present, else fall back to index 0.
      if (ctx.source) {
        const loc = locateUnit(state, ctx.source);
        if (loc) {
          const enemy: PlayerId = loc.owner === "P1" ? "P2" : "P1";
          const foeArr = state.players[enemy].board[loc.lane] ?? [];
          const amount = spec.amount ?? 0;
          if (spec.allAdjacent) {
            for (const i of [loc.idx - 1, loc.idx, loc.idx + 1]) {
              if (foeArr[i]) damageUnit(foeArr[i], amount);
            }
          } else {
            const tgt = foeArr[loc.idx] ?? foeArr[0];
            if (tgt) damageUnit(tgt, amount);
          }
        }
      }
      break;
    }
    case "DAMAGE_LANE": {
      // Sweep every enemy unit in ONE enemy lane. Default "densest" picks the
      // enemy lane holding the most units (ties -> "front" for determinism), so
      // clustering bodies in a single lane is punished and the PLACEMENT choice
      // becomes mechanically meaningful. Enemy units only — never the nexus
      // (locked no-burn constraint). A clean no-op when the enemy board is empty.
      const enemy: PlayerId = controller === "P1" ? "P2" : "P1";
      const enemyBoard = state.players[enemy].board;
      const front = enemyBoard.front ?? [];
      const back = enemyBoard.back ?? [];
      let lane: UnitInPlay[];
      if (spec.targetLane === "front") lane = front;
      else if (spec.targetLane === "back") lane = back;
      else lane = back.length > front.length ? back : front; // "densest" (front wins ties)
      const amount = spec.amount ?? 0;
      for (const u of [...lane]) {
        if (u) damageUnit(u, amount);
      }
      break;
    }
    case "COPY_UNIT": {
      // Become a copy of the target: take its cardId (so its abilities follow),
      // stat line, and keywords. instanceId / lane / controller stay ours.
      if (ctx.source && ctx.target) {
        ctx.source.cardId = ctx.target.cardId;
        ctx.source.attack = ctx.target.attack;
        ctx.source.maxHealth = ctx.target.maxHealth ?? ctx.target.health;
        ctx.source.health = ctx.target.health;
        ctx.source.armor = ctx.target.armor ?? 0;
        ctx.source.speed = ctx.target.speed ?? 0;
        ctx.source.keywords = [...(ctx.target.keywords ?? [])];
        // Reset the copier's aura bookkeeping: the copied stat line is a fresh
        // base, so any aura the copier had accrued is now stale. Zero it so the
        // next recomputeAuras strips nothing spurious and re-derives the bonus
        // from the copier's OWN board context. (Do NOT copy the target's aura —
        // auras are positional/board-derived, not part of the copied identity.)
        ctx.source.auraAtk = 0;
        ctx.source.auraHp = 0;
        // BUG H2 FIX: COPY fully REPLACES the copier's attack with the target's
        // stat line, so any temp "-N attack this turn" debuff recorded against the
        // copier's OLD attack no longer corresponds to its base. Clear it so the
        // END_TURN restore can't add a stale delta onto the copied line (drift).
        ctx.source.tempAtkDebuff = 0;
        // BUG M3 FIX: COPY inherits the target's cardId — including a Jean-style
        // ONCEDEATH_REVIVE op. A copy must NOT gain a fresh once-per-match revive,
        // so deny it by marking the inherited revive as already used. (resolveDeaths
        // only revives a unit with ONCEDEATH_REVIVE when `reviveUsed` is falsy.)
        ctx.source.reviveUsed = true;
      }
      break;
    }
    case "DESTROY_ENEMY_SELECT": {
      // Deterministic hard removal of ONE enemy board unit, chosen by selector.
      // No matching enemy / empty board -> clean no-op.
      const enemy: PlayerId = controller === "P1" ? "P2" : "P1";
      const foes = alliedUnits(state, enemy);
      if (foes.length === 0) break;
      const cost = (u: UnitInPlay) => (ctx.costOf ? ctx.costOf(u.cardId) : 0);
      let pool = foes;
      if (spec.selector === "RANDOM_COST_GATE") {
        // "cost <= own attack": gate by the SOURCE's live attack, then take the
        // highest-cost survivor (deterministic; tie-break board index via the
        // ascending front-then-back scan order of alliedUnits).
        const gate = ctx.source?.attack ?? 0;
        pool = foes.filter((u) => cost(u) <= gate);
      } else if (spec.selector === "ATTACK_GATE") {
        // Mr LOL: "destroy unit with attack >= N". Gate by the foe's own attack.
        const threshold = spec.amount ?? 0;
        pool = foes.filter((u) => (u.attack ?? 0) >= threshold);
      }
      if (pool.length === 0) break;
      // Pick the highest-cost candidate; first-seen wins ties (board order).
      let victim = pool[0];
      let bestCost = cost(victim);
      for (const u of pool) {
        const c = cost(u);
        if (c > bestCost) {
          victim = u;
          bestCost = c;
        }
      }
      victim.health = 0; // reaped (with deathrattles/on-death) by resolveDeaths
      break;
    }
    case "DEBUFF_ALL_ENEMIES": {
      // -N attack to EVERY enemy unit, THIS TURN ONLY. The reduction is recorded
      // in `tempAtkDebuff` so the reducer's turn-end hook restores it. Floor at 0
      // so attack never goes negative. Stacks additively across applications.
      const enemy: PlayerId = controller === "P1" ? "P2" : "P1";
      const n = spec.amount ?? 0;
      if (n > 0) {
        for (const u of alliedUnits(state, enemy)) {
          const applied = Math.min(n, u.attack); // never push attack below 0
          if (applied <= 0) continue;
          u.attack -= applied;
          u.tempAtkDebuff = (u.tempAtkDebuff ?? 0) + applied;
        }
      }
      break;
    }
    case "RESURRECT_AS_TOKEN": {
      // Pop the controller's most-recent graveyard record and resummon it as a
      // 1/1 token (original stats ignored), optionally stamped with a keyword.
      // No-op on an empty grave.
      const grave = state.players[controller].graveyard ?? [];
      const rec = grave.pop();
      if (rec) {
        const counter = state.idCounter ?? 0;
        state.idCounter = counter + 1;
        const lane: Lane = ctx.source?.lane ?? ctx.lane ?? "front";
        const token: UnitInPlay = {
          instanceId: `unit_${state.seed}_${counter}`,
          cardId: `token_${rec.cardId.toLowerCase().replace(/\s+/g, "_")}`,
          lane,
          attack: 1,
          health: 1,
          maxHealth: 1,
          speed: 0,
          armor: 0,
          keywords: spec.reviveKeyword ? [spec.reviveKeyword] : [],
          exhausted: false,
          summoningSick: false,
        };
        state.players[controller].board[lane].push(token);
        state.players[controller].graveyard = grave;
      }
      break;
    }
    case "SWAP_STATS_ALL_ENEMIES": {
      // Swap a unit's BASE attack <-> BASE max-health on every enemy in place.
      // BUG H1 FIX: `u.attack`/`u.maxHealth` already INCLUDE the unit's continuous
      // aura bonus (auraAtk/auraHp). Swapping those inflated values and leaving the
      // aura bookkeeping intact would let the next recomputeAuras strip the OLD aura
      // off the SWAPPED value and re-add it on the wrong base — corrupting the line
      // (a debuff could become a buff). So we strip auras to BASE, swap the base,
      // and ZERO the aura fields (exactly like COPY_UNIT) so recomputeAuras strips
      // nothing spurious and re-derives the bonus fresh from the live board. The
      // post-recompute line is then precisely "base atk and base hp swapped, auras
      // re-applied on top". A unit swapped to 0 base health dies via resolveDeaths.
      const enemy: PlayerId = controller === "P1" ? "P2" : "P1";
      for (const u of alliedUnits(state, enemy)) {
        // Strip the aura portion to recover the unit's OWN base stats. The value
        // swapped INTO attack is the base current health (matching the original
        // current-health swap semantics); the value swapped INTO max/current
        // health is the base attack.
        const baseAtk = u.attack - (u.auraAtk ?? 0);
        const baseHp = u.health - (u.auraHp ?? 0);
        u.attack = baseHp;
        u.maxHealth = baseAtk;
        u.health = baseAtk;
        // Aura portion is now stale against the swapped base — zero it so the next
        // recomputeAuras re-derives cleanly (no double-count off the swapped line).
        u.auraAtk = 0;
        u.auraHp = 0;
        // BUG H2 FIX: SWAP fully REPLACES the attack value, so any "-N attack this
        // turn" temp debuff recorded against the OLD attack is now meaningless. If
        // left set, the END_TURN restore would add a stale delta onto the swapped
        // base and drift the attack permanently wrong. The swapped-in value is the
        // unit's fresh (already-correct) line, so clear the temp debuff here.
        u.tempAtkDebuff = 0;
      }
      break;
    }
    case "TUTOR_FROM_DECK": {
      // Search the controller's deck for ONE card matching the selector, move it
      // to hand. Deterministic: pick by the selector's cost ordering, tie-break by
      // the earliest deck index (first-seen). Empty deck / no match = clean no-op.
      const player = state.players[controller];
      const deck: string[] = Array.isArray(player.deck) ? player.deck : [];
      if (deck.length === 0) break;
      const cost = (id: string) => (ctx.costOf ? ctx.costOf(id) : 0);
      const typeOf = (id: string) => (ctx.cardTypeOf ? ctx.cardTypeOf(id) : undefined);
      const sel = spec.tutorSelector ?? "LOWEST_COST_UNIT";
      const wantType = sel === "LOWEST_COST_SPELL" ? "spell" : "unit";
      const wantHighest = sel === "HIGHEST_COST_UNIT";
      let bestIdx = -1;
      for (let i = 0; i < deck.length; i += 1) {
        if (typeOf(deck[i]) !== wantType) continue;
        if (bestIdx < 0) {
          bestIdx = i;
          continue;
        }
        const c = cost(deck[i]);
        const best = cost(deck[bestIdx]);
        // Strict comparison so the earliest deck index wins ties (first-seen).
        if (wantHighest ? c > best : c < best) bestIdx = i;
      }
      if (bestIdx < 0) break; // no card of the wanted type — clean no-op
      const [pulled] = deck.splice(bestIdx, 1);
      player.hand = [...(player.hand ?? []), pulled];
      player.deck = deck;
      player.deckCount = deck.length;
      break;
    }
    case "DRAW_FILTERED": {
      // Move the first N cards of the given type from the deck TOP to hand,
      // skipping (leaving in place) non-matching cards. Deterministic: deck order
      // only, no RNG. Empty deck / fewer than N matches = draws what it can.
      const player = state.players[controller];
      const deck: string[] = Array.isArray(player.deck) ? player.deck : [];
      const want = (spec.drawType ?? "UNIT").toLowerCase();
      const typeOf = (id: string) => (ctx.cardTypeOf ? ctx.cardTypeOf(id) : undefined);
      const n = Math.max(0, spec.amount ?? 0);
      let taken = 0;
      const remaining: string[] = [];
      const drawn: string[] = [];
      for (const id of deck) {
        if (taken < n && typeOf(id) === want) {
          drawn.push(id);
          taken += 1;
        } else {
          remaining.push(id);
        }
      }
      if (drawn.length > 0) {
        player.hand = [...(player.hand ?? []), ...drawn];
        player.deck = remaining;
        player.deckCount = remaining.length;
      }
      break;
    }
    case "SCRY_DYNAMIC": {
      // Reorder the top N of the controller's deck deterministically, reusing the
      // pure scryDeck (ascending cost, stable id tie-break). No RNG; depth comes
      // from the spec. Deck of <2 / N<2 is a no-op inside scryDeck.
      const player = state.players[controller];
      const deck: string[] = Array.isArray(player.deck) ? player.deck : [];
      const depth = Math.max(0, spec.amount ?? 2);
      const cost = (id: string) => (ctx.costOf ? ctx.costOf(id) : 0);
      player.deck = scryDeck(deck, cost, depth);
      // deckCount unchanged (a reorder moves no cards) — kept in sync defensively.
      player.deckCount = player.deck.length;
      break;
    }
    case "MILL_FROM_DECK": {
      // Move the top N cards of the controller's deck to their discard pile (no
      // hand). Deterministic: deck order only. Empty deck = clean no-op; N beyond
      // the deck size mills what remains.
      const player = state.players[controller];
      const deck: string[] = Array.isArray(player.deck) ? player.deck : [];
      const n = Math.min(Math.max(0, spec.amount ?? 0), deck.length);
      if (n === 0) break;
      const milled = deck.slice(0, n);
      player.deck = deck.slice(n);
      player.deckCount = player.deck.length;
      player.discard = [...(player.discard ?? []), ...milled];
      break;
    }
    case "DISCOVER": {
      // Mid-resolution CHOICE (Discover). Generate K seeded options from the
      // controller's OWN deck, filtered to the requested type, then PAUSE by
      // setting state.pendingChoice — the ONLY op that returns control to the
      // caller rather than completing. The reducer detects pendingChoice after
      // resolveSpecs and short-circuits with a CHOICE_OPENED event.
      //
      // Determinism: option selection uses ONLY makeRng(seed)+rngCursor via
      // seededDistinctPick, and advances state.rngCursor by exactly the draws
      // consumed, so a replay regenerates the identical option list. The chosen
      // optionId is then logged in RESOLVE_CHOICE -> byte-identical resume.
      const player = state.players[controller];
      const deck: string[] = Array.isArray(player.deck) ? player.deck : [];
      const want = spec.discoverType ?? "ANY";
      const typeOf = (id: string) => (ctx.cardTypeOf ? ctx.cardTypeOf(id) : undefined);
      // Candidate pool = deck cards matching the type filter, in deck order. We
      // pick from DISTINCT deck positions so a card appearing twice can be offered
      // twice (each is a real, removable copy). De-dup is NOT applied: the option
      // id is the cardId and the resume removes the FIRST matching copy.
      const poolIdx: number[] = [];
      for (let i = 0; i < deck.length; i += 1) {
        const t = (typeOf(deck[i]) ?? "").toLowerCase();
        if (want === "ANY" || (want === "UNIT" && t === "unit") || (want === "SPELL" && t === "spell")) {
          poolIdx.push(i);
        }
      }
      if (poolIdx.length === 0) break; // empty pool -> clean no-op, never pauses
      const k = Math.max(1, spec.discoverCount ?? 3);
      const pick = seededDistinctPick(state.seed, state.rngCursor ?? 0, poolIdx.length, k);
      state.rngCursor = (state.rngCursor ?? 0) + pick.draws;
      const chosenCardIds = pick.indices.map((pi) => deck[poolIdx[pi]]);
      const options: ChoiceOption[] = chosenCardIds.map((cardId) => ({ id: cardId, cardId }));
      // Single option (k>=1 but only one candidate matched): auto-resolve INLINE
      // to avoid a trivial round-trip (RESOLUTION_MODEL.md §8 / CHOICE_DESIGN §6).
      // Behavior is identical to opening a 1-option choice and immediately picking.
      if (options.length === 1) {
        moveCardDeckToHand(state, controller, options[0].id);
        break;
      }
      // Raise the choice: the reducer detects this and ends the action with a
      // CHOICE_OPENED event. controller is the active player in v1.
      state.pendingChoice = {
        kind: "DISCOVER",
        controller,
        options,
        resume: { op: "ADD_CARD_TO_HAND", source: "deck" },
      };
      break;
    }
    // PASSIVE / STATIC / no-op classifications are resolved elsewhere or never.
    // AURA_FACTION_STAT is continuous — applied by the reducer's recomputeAuras
    // pass (which has the cardId -> faction catalog), never as a one-shot here.
    // COMMANDER_SHIELD / AURA_COST_REDUCTION / AURA_SPELL_COST /
    // AURA_ABILITY_SILENCE / DOUBLE_ATTACK / PASSIVE_FLOOR_HP are continuous or
    // combat-legality passives consumed by the reducer (Phase C), never one-shot.
    // MIRROR_ATTACK / SUMMON_ON_ANY_DEATH / ONCEDEATH_REVIVE are reducer hooks.
    case "COMMANDER_SHIELD":
    case "AURA_COST_REDUCTION":
    case "AURA_SPELL_COST":
    case "AURA_ABILITY_SILENCE":
    // MITIGATE_DAMAGE is a combat-legality/damage passive consumed by the reducer
    // (mitigationFor() at applyCombatDamage time), never a one-shot effect here.
    case "MITIGATE_DAMAGE":
    case "DOUBLE_ATTACK":
    case "PASSIVE_FLOOR_HP":
    case "MIRROR_ATTACK":
    case "SUMMON_ON_ANY_DEATH":
    case "ONCEDEATH_REVIVE":
    case "AURA_FACTION_STAT":
    case "AURA_ALLY_STAT":
    case "AURA_KEYWORD":
    case "AURA_ADJACENT_STAT":
    case "PIERCE_ARMOR":
    case "RESTRICT_ATTACK":
    case "STAT_LINE":
    case "GRANT_KEYWORD":
    case "KEYWORD_WIRED":
    case "GLOBAL_UNPARSED":
    case "UNKNOWN":
    default:
      break;
  }
}

/** Convenience: fan a whole compiled ability's runtime specs through the
 *  resolver in order. (The compiler already excludes static/no-op specs from
 *  `CompiledAbility.specs`, so this only fires real ops.) */
export function resolveSpecs(specs: EffectSpec[], ctx: EffectContext): void {
  for (const spec of specs) resolveEffect(spec, ctx);
}
