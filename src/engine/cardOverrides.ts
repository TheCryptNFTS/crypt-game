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
export const CARD_OVERRIDES_VERSION = "2026.06.01";

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

  // --- text-vs-behavior honesty fixes (2026.05.31) ---------------------------

  // tcg_3360 "I Am Death": printed "destroy RANDOM highest-cost enemy" but the
  // engine picks deterministically (highest cost, tie-break by board order).
  // Retext removes the false "random". Compiles to DESTROY_ENEMY_SELECT
  // HIGHEST_COST (ON_SUMMON) via parseNamedMechanics /highest[- ]?cost/.
  tcg_3360: {
    ability: "Cannot be targeted by spells. On play: destroy the highest-cost enemy unit.",
    note: "Honesty fix: removed false 'random' — engine is deterministic (highest cost, tie-break board order). Compiles to DESTROY_ENEMY_SELECT selector:HIGHEST_COST.",
  },

  // tcg_3395 "Skeletor": printed "raise a RANDOM unit from graveyard" but the
  // engine pops the most recent entry (LIFO), not a random pick. Retext clarifies
  // LIFO. Compiles to RESURRECT_AS_TOKEN ON_TURN_END via parseNamedMechanics
  // raiseToken regex ("raise...graveyard...as a 1/1 Wraith") + EOT check.
  tcg_3395: {
    ability: "End of your turn: raise the most recently fallen unit from your graveyard as a 1/1 Wraith.",
    note: "Honesty fix: removed false 'random' — engine pops graveyard LIFO. Compiles to RESURRECT_AS_TOKEN ON_TURN_END.",
  },

  // tcg_101 "D'Vile One": printed "Start of combat: destroy random enemy with
  // cost ≤ own attack" but the engine fires this as an ON_PLAY battlecry (once,
  // on summon), not each combat. Retext corrects the trigger. Compiles to
  // DESTROY_ENEMY_SELECT selector:RANDOM_COST_GATE (ON_SUMMON) via
  // parseNamedMechanics cost≤own-attack regex. Rush + Flying are wired keywords.
  tcg_101: {
    ability: "Rush, Flying. On play: destroy an enemy unit with cost ≤ own attack.",
    note: "Honesty fix: 'Start of combat' was wrong trigger — engine fires once ON_PLAY (battlecry). Compiles to DESTROY_ENEMY_SELECT selector:RANDOM_COST_GATE ON_SUMMON.",
  },

  // tcg_3420 "Walter": printed "Cannot be reduced below 1 HP by any single
  // source" but the floor only applies to combat damage; destroy/execute effects
  // bypass it. Retext adds 'combat damage' precision. Compiles to PASSIVE_FLOOR_HP
  // (parseNamedMechanics /cannot be reduced below 1 hp/) + GUARD (firstKeyword).
  tcg_3420: {
    ability: "Guard. Cannot be reduced below 1 HP by any single instance of combat damage.",
    note: "Honesty fix: floor is combat-damage only; destroy/execute bypass it. Compiles to KEYWORD_WIRED:GUARD + PASSIVE_FLOOR_HP.",
  },

  // tcg_2256 "Hokusai": printed "draw a spell" but the engine draws ANY top card
  // (no spell filter). Retext corrects the draw clause to 'draw a card'. The
  // 'spells cost 1 less' aura clause is honest and kept. Compiles to DRAW
  // ON_TURN_START (compileColonTrigger head:'turn start' + DRAW_RE on body) and
  // AURA_SPELL_COST PASSIVE (parseNamedMechanics /spells cost 1 less/).
  tcg_2256: {
    ability: "Turn start: draw a card. Spells cost 1 less while Hokusai is on board.",
    note: "Honesty fix: engine draws ANY top card, not a filtered spell. Compiles to DRAW ON_TURN_START + AURA_SPELL_COST PASSIVE.",
  },

  // tcg_3350 "Hear Speak See No Evil": printed "enemy units cannot trigger
  // abilities" (implies ALL abilities) but the engine silences only TRIGGERED
  // abilities; continuous auras and death-watchers still function. Retext adds a
  // parenthetical to be precise. Compiles to KEYWORD_WIRED:GUARD (firstKeyword
  // 'guard') + AURA_ABILITY_SILENCE PASSIVE (parseNamedMechanics
  // /enemy units cannot trigger abilit/).
  tcg_3350: {
    cost: 9,
    health: 8,
    ability: "Guard. While in play, enemy units cannot trigger abilities (triggered abilities only; auras still function).",
    note: "Honesty fix: silence applies to triggered abilities only; auras/death-watchers bypass it. Compiles to KEYWORD_WIRED:GUARD + AURA_ABILITY_SILENCE PASSIVE. Balance (2026.06.01): 8-mana 3/10 -> 9-mana 3/8. A permanent triggered-silence aura on a Guard body must pay a premium cost + reduced toughness to stay answerable (cf. HS Loatheb, a 5-mana 1-turn delay).",
  },

  // --- balance nerfs (2026.06.01) -------------------------------------------

  // tcg_3267 "Kiss of Death": SWAP_STATS_ALL_ENEMIES is a one-sided board wipe vs
  // high-hp/low-atk boards. At 7-mana 5/7 Flying the evasive body is above curve
  // for the effect. Reprice to the 8-mana board-wipe tier and trim the leftover
  // body to 4/5 (killable by any 5-atk unit). Effect scope unchanged (all enemies).
  tcg_3267: {
    cost: 8,
    attack: 4,
    health: 5,
    note: "Balance nerf: 7-mana 5/7 -> 8-mana 4/5 (Flying kept). Global atk/hp swap is a board wipe; priced to the 8-mana wipe tier (cf. LoR Ruination, 7-mana, leaves no body).",
  },

  // tcg_3345 "Harley": Rush + DOUBLE_ATTACK delivers ~12 split board damage the
  // turn it lands (no face-burn in this game, so it's pure board control burst).
  // Cost 7 -> 8 removes the "free" tempo turn; 5/4 keeps the double-attack fantasy
  // but makes her answerable on the counterswing. Rush + DOUBLE_ATTACK retained.
  tcg_3345: {
    cost: 8,
    attack: 5,
    health: 4,
    note: "Balance nerf: 7-mana 6/5 -> 8-mana 5/4 (Rush + DOUBLE_ATTACK kept). Multi-hit rush burst priced 1 mana above its statline (cf. HS multi-strike rush pricing).",
  },

  // --- marquee card ability wiring ------------------------------------------
  // tcg_2384 Amenadiel: printed "Flying, Divine Shield. Attacks deal 2 splash in lane."
  // The compiler's firstKeyword picks "flying" (KEYWORD_WIRED), then "Attacks deal 2
  // splash in lane." has no leading keyword and no colon-trigger, so it compiles to
  // UNKNOWN. Retext to the canonical Cleave phrasing (mirrors tcg_293) so the
  // leading "Cleave" keyword routes the full text through compileKeyword("cleave", ...),
  // which emits { trigger: ON_ATTACK, op: CLEAVE } — the intended splash op.
  // Flying and Divine Shield remain on the card's keywords tuple (reducer-wired).
  tcg_2384: {
    ability: "Cleave. This unit deals half its attack as damage to adjacent enemies on attack.",
    note: "Retext: 'Attacks deal 2 splash in lane' -> canonical Cleave phrasing. Flying+Divine Shield stay on keywords tuple.",
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
