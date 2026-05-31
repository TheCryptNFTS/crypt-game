/**
 * CARD-OVERRIDE / VERSIONING LAYER — the balance-patch spine.
 *
 * Major TCGs (HS / MTG Arena / LoR) hot-patch card stats, text, and keywords
 * server-side without regenerating their whole catalog. This file is that hook
 * for the engine: a thin, deterministic, *versioned* layer that MODIFIES base
 * catalog entries on top of the generated data (`runtimeMatchPlayableCards.json`
 * + `generatedTcgCards.json`).
 *
 * Contract (deliberately narrow):
 *   - Overrides MODIFY or SOFT-DISABLE existing cards. They NEVER add or remove
 *     catalog entries — card-count audits stay green.
 *   - Applied once, at the single build chokepoint in `cards.ts`, so EVERYTHING
 *     downstream (reducer `cardMetaById`, `costOf`, `cardTypeOf`, `compileAbility`
 *     recompile path, deck legality, balance reports) inherits the patched values
 *     from one source of truth.
 *   - Deterministic: static data, fixed merge order, clone-then-override, no
 *     `Math.random` / `Date`. The version stamp is a literal string. The patched
 *     catalog is byte-identical across runs.
 *
 * To ship a balance patch: bump `CARD_OVERRIDES_VERSION`, add/adjust entries
 * below, re-run the gate sweep (`npm run dev:card-override` + the suites).
 */

export interface CardOverride {
  /** Replaces the card's mana/energy cost when present. */
  cost?: number;
  /** Replaces base attack when present. */
  attack?: number;
  /** Replaces base health when present. */
  health?: number;
  /** Replaces base speed when present. */
  speed?: number;
  /** Replaces base armor when present. */
  armor?: number;
  /** Replaces the WHOLE keyword list when present (not merged). */
  keywords?: string[];
  /**
   * Replaces `rawTraits.Ability` when present, so the ability RECOMPILES to a new
   * `EffectSpec[]` via `compileAbility` (the reducer's `compiledFor` picks it up).
   * Honor the engine's content rules: NO new burn / enemy-nexus face damage via a
   * retext, and don't alter STAT_LINE classification semantics.
   */
  ability?: string;
  /**
   * Soft-ban. The card STAYS in the catalog (count audits unaffected) but is
   * flagged `disabled` on the `PlayableCard`; deck legality excludes it.
   */
  disabled?: boolean;
  /** Balance-patch rationale (documentation only; never affects runtime). */
  note?: string;
}

/** Patch version stamp. A literal string — never a runtime date. */
export const CARD_OVERRIDES_VERSION = "2026.05.30";

/**
 * The live balance patch. Keyed by `cardId`. Only a few illustrative entries
 * ship — the point is the MECHANISM, not the balance calls.
 */
export const cardOverrides: Record<string, CardOverride> = {
  // --- stat nerf: shave a point off an over-statted 10-drop ------------------
  // Harbinger of Erosion was an 18/9 for 10 — the highest raw attack in the set.
  // Trim attack 18 -> 16 to bring it in line with sibling 10-drops (~15-16 atk).
  tcg_1428: {
    attack: 16,
    note: "Nerf: 18/9 -> 16/9. Highest raw attack in the set; trimmed to peer 10-drops.",
  },

  // --- stat nerf + cost bump: another over-statted 10-drop -------------------
  // Eternal Stonewarden, a 17/9 Deathrattle for 10. Shave attack 17 -> 15 and
  // (already cost 10, kept) — the cost field demonstrates the cost-patch path and
  // is enforced by the reducer's energy check via costOf().
  tcg_475: {
    cost: 10,
    attack: 15,
    note: "Nerf: 17/9 -> 15/9. Over-statted Deathrattle body; cost re-stamped at 10.",
  },

  // --- ability RETEXT (recompile proof) -------------------------------------
  // Base ability was an ON_DAMAGE self-buff ("Taunt. When this unit takes damage,
  // gain +1/+1...") compiling to { trigger: ON_DAMAGE, op: BUFF_SELF, +1/+1 }.
  // Retext to a plain battlecry so it RECOMPILES to a DIFFERENT EffectSpec:
  // { trigger: ON_SUMMON, op: BUFF_SELF, +3/+3 }. Pure self-value — no removal,
  // no burn, no enemy-nexus face damage.
  tcg_86: {
    ability: "On play: gain +3/+3.",
    note: "Retext: ON_DAMAGE +1/+1 -> ON_SUMMON +3/+3 battlecry. Proves the recompile path (new trigger + amounts).",
  },

  // --- soft-ban (disabled) --------------------------------------------------
  // Demonstrates a deck-illegal flag without deleting the card from the catalog.
  // tcg_45 is a vanilla 2/2 used by NO deck builder (curated/default/owned), so the
  // soft-ban is purely illustrative and disturbs no existing fixture — only legality.
  tcg_45: {
    disabled: true,
    note: "Soft-ban demo: kept in catalog (count audits unaffected) but marked deck-illegal.",
  },
};

/**
 * Pure, immutable override application. Given a base `PlayableCard`-like object,
 * returns a NEW object with the matching override merged field-by-field. The base
 * is never mutated and no nested references are shared (stats/keywords/rawTraits
 * are cloned), so determinism holds and `applyCardOverride` is idempotent.
 *
 * Typed loosely (`T extends { id: string; ... }`) so it works for both
 * `PlayableCard` and `SpellCard` without importing `cards.ts` (avoids a cycle).
 */
export function applyCardOverride<
  T extends {
    id: string;
    cost: number;
    stats: { attack: number; health: number; speed: number; armor: number };
    keywords?: string[];
    rawTraits?: Record<string, string>;
  }
>(card: T): T & { disabled?: boolean } {
  const ov = cardOverrides[card.id];

  // Always clone (no shared nested refs), even when there is no override, so the
  // returned object is a safe, independent copy. `keywords`/`rawTraits` may be
  // absent on some unit-card shapes (e.g. the engine's local UnitCard) — clone
  // only what's present so we never inject fields a consumer doesn't expect.
  const next: T & { disabled?: boolean } = {
    ...card,
    stats: { ...card.stats },
    ...(card.keywords !== undefined ? { keywords: [...card.keywords] } : {}),
    ...(card.rawTraits !== undefined ? { rawTraits: { ...card.rawTraits } } : {}),
  };

  if (!ov) return next;

  if (ov.cost !== undefined) next.cost = ov.cost;
  if (ov.attack !== undefined) next.stats.attack = ov.attack;
  if (ov.health !== undefined) next.stats.health = ov.health;
  if (ov.speed !== undefined) next.stats.speed = ov.speed;
  if (ov.armor !== undefined) next.stats.armor = ov.armor;
  if (ov.keywords !== undefined) (next as { keywords?: string[] }).keywords = [...ov.keywords];

  // Replace the ability TEXT so the reducer's compileAbility() recompiles it to
  // a fresh EffectSpec[]. We patch the raw trait, not the IR — single source.
  if (ov.ability !== undefined) {
    (next as { rawTraits?: Record<string, string> }).rawTraits = {
      ...(next.rawTraits ?? {}),
      Ability: ov.ability,
    };
  }

  if (ov.disabled !== undefined) next.disabled = ov.disabled;

  return next;
}
