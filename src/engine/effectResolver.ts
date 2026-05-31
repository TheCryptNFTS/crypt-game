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

import { MatchState, PlayerId, Lane, UnitInPlay, STARTING_NEXUS_HEALTH } from "./state";
import { EffectSpec } from "./abilityCompiler";

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

function mintToken(ctx: EffectContext, spec: EffectSpec): UnitInPlay {
  const { state, controller } = ctx;
  const counter = state.idCounter ?? 0;
  state.idCounter = counter + 1;
  const lane: Lane = ctx.lane ?? ctx.source?.lane ?? "front";
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
      }
      break;
    }
    // PASSIVE / STATIC / no-op classifications are resolved elsewhere or never.
    // AURA_FACTION_STAT is continuous — applied by the reducer's recomputeAuras
    // pass (which has the cardId -> faction catalog), never as a one-shot here.
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
