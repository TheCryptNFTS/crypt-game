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
  /**
   * Replaces the card's display NAME when present. Purely cosmetic — never affects
   * stats, cost, compilation, legality, or determinism. Used to AUTHOR bespoke,
   * collision-free names over the procedurally-generated catalog (e.g. dedupe four
   * near-identical "Verdant Oath" cards, retire joke auto-names) so the cards a
   * newcomer actually sees feel hand-crafted.
   */
  name?: string;
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
export const CARD_OVERRIDES_VERSION = "2026.06.02";

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
    ability: "Cannot be targeted by spells. On play: destroy a random highest-cost enemy unit.",
    note: "Honesty fix: 'random' is now WIRED — DESTROY_ENEMY_SELECT selector:HIGHEST_COST with random:true picks a SEEDED-RANDOM victim among the highest-cost tier (deterministic when that tier is a singleton; identical seeds -> identical pick). Was a deterministic-only retext.",
  },

  // tcg_3395 "Skeletor": printed "raise a RANDOM unit from graveyard" but the
  // engine pops the most recent entry (LIFO), not a random pick. Retext clarifies
  // LIFO. Compiles to RESURRECT_AS_TOKEN ON_TURN_END via parseNamedMechanics
  // raiseToken regex ("raise...graveyard...as a 1/1 Wraith") + EOT check.
  tcg_3395: {
    ability: "End of your turn: raise a random unit from your graveyard as a 1/1 Wraith.",
    note: "Honesty fix: 'random' is now WIRED — RESURRECT_AS_TOKEN ON_TURN_END with random:true picks a SEEDED-RANDOM graveyard record (deterministic for a single-entry grave; identical seeds -> identical pick). Was a deterministic LIFO retext.",
  },

  // tcg_101 "D'Vile One": printed "Start of combat: destroy random enemy with
  // cost ≤ own attack" but the engine fires this as an ON_PLAY battlecry (once,
  // on summon), not each combat. Retext corrects the trigger. Compiles to
  // DESTROY_ENEMY_SELECT selector:RANDOM_COST_GATE (ON_SUMMON) via
  // parseNamedMechanics cost≤own-attack regex. Rush + Flying are wired keywords.
  tcg_101: {
    name: "Ironclad Devastator",
    ability: "Rush, Flying. On play: destroy a random enemy unit with cost ≤ own attack.",
    note: "Honesty fix: 'Start of combat' was the wrong trigger (engine fires once ON_PLAY) and 'random' is now WIRED — DESTROY_ENEMY_SELECT selector:RANDOM_COST_GATE with random:true picks a SEEDED-RANDOM victim among the highest-cost in-gate tier (deterministic when unique; identical seeds -> identical pick). Authored name (was 'D'Vile One', a joke auto-name).",
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

  // === HONESTY RETEXT: unwired conditional riders (50 cards, 2026.06.02) ===
  // Each printed text led with a LIVE keyword (Charge/Taunt/Ward/Veil/Shield) but
  // tacked on a conditional rider ("when it deals damage, gain +X" / "if it
  // destroys an enemy, draw" / "deal N damage to ...") that the compiler does NOT
  // wire to any behaviorally-active op — the reducer fires nothing for it, so the
  // displayed text over-promised. Retext drops the false rider and keeps ONLY the
  // keyword reminder the engine actually honors. No burn / no face-damage text is
  // introduced (some riders that PROMISED commander damage are removed, never
  // added); no static stat line is converted into a buff. Ranked worst-first by
  // number of false claims, then text length. See runBehavioralCoverageReport.ts
  // (TEXT/BEHAVIOR MISMATCH section) for how these were detected.
  tcg_2112: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired deal_damage/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately upon being summoned. When it ...'" },
  tcg_715: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired destroy/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately after being summoned. If it d...'" },
  tcg_2241: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired destroy/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately after being summoned. If it d...'" },
  tcg_1819: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired destroy/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately after being summoned. If it d...'" },
  tcg_1680: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: removed unwired draw/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live VEIL keyword. Was: 'Veil. When this unit enters play, draw a card and reveal it. If it is ...'" },
  tcg_1881: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired destroy/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. Can attack enemies immediately upon being summoned. Gains +1/+...'" },
  tcg_1687: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired destroy/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately after being summoned. If it d...'" },
  tcg_2113: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired destroy/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately upon summoning. It gains +1/+...'" },
  tcg_230: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired deal_damage/draw rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately after being summoned. If it d...'" },
  tcg_2517: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired deal_damage/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately after being summoned. If it d...'" },
  tcg_3785: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired destroy/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately upon summon. If it destroys a...'" },
  tcg_2055: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired destroy/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. When this unit destroys an enemy, gain +1/+1 for each enemy de...'" },
  tcg_1862: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired deal_damage/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. If this unit deals damage to a foe, gain +2/+0 until end of tu...'" },
  tcg_2587: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired deal_damage/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. When this unit deals damage, it gains +1/+1 until end of turn....'" },
  tcg_6544: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: removed unwired deal_damage/buff rider (compiler emits no active op for the conditional clause). Card keeps only its live TAUNT keyword. Was: 'Taunt. When this unit deals damage, gain +1/+1 for each enemy struck....'" },
  tcg_1356: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired deal_damage/summon rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. On summon, deal 1 damage to target enemy unit....'" },
  tcg_4783: { ability: "Shield. Absorbs the first instance of damage dealt to this unit.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live SHIELD keyword. Was: 'Shield. While this unit is in play, adjacent allies gain +1 armor and ...'" },
  tcg_1068: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately after being summoned. Gain +1...'" },
  tcg_164: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately upon being summoned and gains...'" },
  tcg_1152: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack the turn it is summoned. On death, gain +...'" },
  tcg_3555: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately upon being summoned. It gains...'" },
  tcg_1923: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately after being summoned. If it a...'" },
  tcg_2155: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately after being summoned. Gains +...'" },
  tcg_2410: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately upon summoning and gains +1/+...'" },
  tcg_4214: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately after being summoned. Gains +...'" },
  tcg_1489: { ability: "Shield. Absorbs the first instance of damage dealt to this unit.", note: "Honesty retext: removed unwired deal_damage rider (compiler emits no active op for the conditional clause). Card keeps only its live SHIELD keyword. Was: 'Shield. Prevent the next 4 damage dealt to this unit. When it is attac...'" },
  tcg_206: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired deal_damage rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately upon being summoned. Deals da...'" },
  tcg_1243: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired deal_damage rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately upon being summoned. Deals 2 ...'" },
  tcg_2061: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: removed unwired deal_damage rider (compiler emits no active op for the conditional clause). Card keeps only its live WARD keyword. Was: 'Ward. Prevent the next 3 damage dealt to this unit. When it takes dama...'" },
  tcg_5824: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired destroy rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately after being summoned. If it d...'" },
  tcg_1958: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired deal_damage rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately after being summoned. Deal 1 ...'" },
  tcg_2855: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired destroy rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack immediately after being summoned. If it d...'" },
  tcg_1075: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: removed unwired debuff rider (compiler emits no active op for the conditional clause). Card keeps only its live TAUNT keyword. Was: 'Taunt. When this unit takes damage, reduce the damage of the next atta...'" },
  tcg_2213: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack the turn it is summoned. Gain +1/+0 for e...'" },
  tcg_4438: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live TAUNT keyword. Was: 'Taunt. Enemies must attack this unit before targeting others. Gains +1...'" },
  tcg_5441: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live TAUNT keyword. Was: 'Taunt. Gains +1/+1 for each consecutive turn it remains on the battlef...'" },
  tcg_3544: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack the turn it is summoned and gains +1/+0 f...'" },
  tcg_5511: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired deal_damage rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack the turn it is summoned. Deal 2 damage to...'" },
  tcg_1600: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired deal_damage rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. When this unit enters battle, it may attack immediately and de...'" },
  tcg_1893: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: removed unwired debuff rider (compiler emits no active op for the conditional clause). Card keeps only its live TAUNT keyword. Was: 'Taunt. When this unit takes damage, reduce the attack of an enemy unit...'" },
  tcg_3907: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: removed unwired debuff rider (compiler emits no active op for the conditional clause). Card keeps only its live TAUNT keyword. Was: 'Taunt. When this unit takes damage, reduce the attacking unit's attack...'" },
  tcg_1892: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. When this unit deals combat damage, your Iron Defenders gain +...'" },
  tcg_3713: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack the turn it is played. If it does, gain +...'" },
  tcg_4582: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired deal_damage rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack the turn it is summoned. On death, deal 1...'" },
  tcg_5745: { ability: "Shield. Absorbs the first instance of damage dealt to this unit.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live SHIELD keyword. Was: 'Shield. While this unit is on the field, all Silver Sentinels gain +1 ...'" },
  tcg_2822: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired deal_damage rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack after summoning. When it does, deal 2 dam...'" },
  tcg_904: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: removed unwired buff rider (compiler emits no active op for the conditional clause). Card keeps only its live CHARGE keyword. Was: 'Charge. This unit may attack the turn it is summoned. Gains +1/+1 when...'" },
  tcg_993: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: removed unwired deal_damage rider (was promised commander/face damage on death — NOT wired and never permitted; dropped). Card keeps only its live TAUNT keyword. Was: 'Taunt. Enemies must attack this unit first. When defeated, deal 1 dama...'" },
  tcg_1464: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: removed unwired deal_damage rider (was promised commander/face damage on death — NOT wired and never permitted; dropped). Card keeps only its live TAUNT keyword. Was: 'Taunt. Enemies must attack this unit if able. When it dies, deal 2 dam...'" },


  // === HONESTY RETEXT: next tranche of unwired keyword riders (168 cards, 2026.05.31) ===
  // Same pattern as the 2026.06.02 tranche: each printed text led with a LIVE
  // keyword (Charge/Guard/Ward/Veil/Shield/Armored/Lifesteal/Trample/Scry/Regrow/
  // Deathrattle/Flying) but appended a conditional rider the compiler wires to NO
  // behaviorally-active op (verified zero active ops via the behavioral-coverage
  // audit before each retext). Retext drops the false rider, keeping ONLY the
  // reminder the reducer honors. No burn / no face-damage introduced; no static
  // stat line converted to a buff.
  tcg_6075: { ability: "Regrow. Restores this unit health over time.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live REGROW keyword. Was: 'At the end of your turn, heal a friendly unit by 1. Regrow: Restore 2...'" },
  tcg_2456: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit may attack immediately after being summoned. Deals ...'" },
  tcg_4386: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit may attack immediately after being summoned. Deals ...'" },
  tcg_5761: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit may attack immediately upon being summoned. If it d...'" },
  tcg_6085: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit may attack immediately after being summoned. Deal 3...'" },
  tcg_6248: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. Enemies must attack this unit if able. When this unit survives...'" },
  tcg_100: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. Upon entering the battlefield, gain +1/+1 for each Golden Sov...'" },
  tcg_1423: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. When this unit enters battle, it gains +1/+0 for each Iron De...'" },
  tcg_3183: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. Enemy units must attack this unit if able. Gain +1/+0 for each...'" },
  tcg_438: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. This unit gains +1/+1 until your next turn if you control anoth...'" },
  tcg_2005: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. At the start of your turn, this unit gains +1/+1 until the end ...'" },
  tcg_2881: { ability: "Lifesteal. This unit restores your hero health when it strikes.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live LIFESTEAL keyword. Was: 'Lifesteal. Whenever this unit deals damage, restore that amount of he...'" },
  tcg_3560: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit may attack immediately. On destruction, deal 1 dama...'" },
  tcg_623: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. Enemy units must attack this unit if able. Gains +1/+0 for eac...'" },
  tcg_1122: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. This unit cannot be targeted by enemy spells or abilities until...'" },
  tcg_5634: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. This unit cannot be targeted by enemy spells or abilities until...'" },
  tcg_5658: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. While this unit is on the field, prevent the first instance of ...'" },
  tcg_576: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +1 Health for each Iron Defe...'" },
  tcg_5795: { ability: "Shield. Absorbs the first instance of damage dealt to this unit.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live SHIELD keyword. Was: 'Shield. This unit gains +1/+1 until the end of your turn whenever it ...'" },
  tcg_6193: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired draw rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. Prevent all damage dealt to this unit once. When it absorbs dam...'" },
  tcg_1609: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit may attack the turn it is summoned. Deals 6 damage ...'" },
  tcg_5306: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. Enemies must attack this unit if able. Gains +1/+0 for each at...'" },
  tcg_5470: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit may attack immediately upon summoning; gains +1/+0 ...'" },
  tcg_5501: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. Other units must attack this one, and it gains +1/+1 for each ...'" },
  tcg_960: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +1 health for each enemy uni...'" },
  tcg_1023: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'When this unit enters play, gain 1 armor. Taunt. Attacks deal damage ...'" },
  tcg_1479: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. When this unit enters the battlefield, it deals 2 damage to t...'" },
  tcg_2195: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. At the end of your turn, gain +1/+1 for each enemy unit destr...'" },
  tcg_2690: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired draw rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. When this unit is targeted by an ability, negate that ability a...'" },
  tcg_3038: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit may attack immediately upon summoning. Gain +1/+0 w...'" },
  tcg_385: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. Opponents must attack this unit if able. When it is dealt dama...'" },
  tcg_5778: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. When this unit is targeted, negate the effect and deal 1 damage...'" },
  tcg_1762: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired draw rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. When this unit enters play, draw a card for each Silver Sentine...'" },
  tcg_2341: { ability: "Lifesteal. This unit restores your hero health when it strikes.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live LIFESTEAL keyword. Was: 'Lifesteal. When this unit deals damage, restore that amount of health...'" },
  tcg_3796: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit is dealt damage, gain +1/+0 for each point of d...'" },
  tcg_4147: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +2 Health until the end of y...'" },
  tcg_4837: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +2 HP until end of turn for each Bronze Guardia...'" },
  tcg_5947: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, restore 1 health to a friendly Br...'" },
  tcg_6111: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. Gains +1/+0 for each Silver Sentinel you control, until the end...'" },
  tcg_2154: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. Gain +2/+2 for each Silver Sentinel you control, until the end ...'" },
  tcg_295: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. When summoned, choose an enemy unit. It cannot attack until it ...'" },
  tcg_4728: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. Upon entering the field, gain +1/+1 for each Golden Sovereign...'" },
  tcg_4930: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired draw rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. When this unit is targeted by an ability, negate the effect and...'" },
  tcg_6632: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +1 health for each consecutive turn it remains ...'" },
  tcg_858: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. This unit gains +1/+1 until end of turn when an enemy unit ente...'" },
  tcg_2231: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. This unit may not be targeted until it deals damage to the oppo...'" },
  tcg_5850: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. Enemies must attack this unit if they are able. Gains +2/+2 wh...'" },
  tcg_633: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired debuff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, reduce its attack by 1 until the ...'" },
  tcg_6524: { ability: "Armored. This unit takes reduced combat damage.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live ARMORED keyword. Was: 'Armored. This unit gains +1 defense for each attack it receives durin...'" },
  tcg_815: { ability: "Shield. Absorbs the first instance of damage dealt to this unit.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live SHIELD keyword. Was: 'Shield. This unit gains +2 Health until the end of your turn when it ...'" },
  tcg_2393: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit cannot be targeted by spells or abilities until it de...'" },
  tcg_2768: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. When this unit enters the battlefield, it gains +2/+0 until e...'" },
  tcg_55: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit cannot be targeted by spells or abilities until it de...'" },
  tcg_5689: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. Enemies must attack this unit if able. Gains +1/+0 for each da...'" },
  tcg_807: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. Whenever this unit takes damage, restore 1 health to another a...'" },
  tcg_2217: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +1 defense until the end of ...'" },
  tcg_2359: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired debuff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. While this unit is in play, reduce incoming damage from enemy u...'" },
  tcg_4109: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. Upon entering the battlefield, this unit gains +1/+0 until en...'" },
  tcg_2153: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, restore 2 health to another frien...'" },
  tcg_3102: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit is targeted by an attack, deal 2 damage to the ...'" },
  tcg_313: { ability: "Shield. Absorbs the first instance of damage dealt to this unit.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live SHIELD keyword. Was: 'Shield. This unit gains +2/+2 until the end of your turn when it take...'" },
  tcg_3968: { ability: "Lifesteal. This unit restores your hero health when it strikes.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live LIFESTEAL keyword. Was: 'Lifesteal. When this unit deals damage, restore that much health to y...'" },
  tcg_4085: { ability: "Lifesteal. This unit restores your hero health when it strikes.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live LIFESTEAL keyword. Was: 'Lifesteal. When this unit deals damage, restore that much health to y...'" },
  tcg_4592: { ability: "Lifesteal. This unit restores your hero health when it strikes.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live LIFESTEAL keyword. Was: 'Lifesteal. When this unit deals damage, restore that much health to y...'" },
  tcg_5592: { ability: "Scry. Look at the top card of your deck.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live SCRY keyword. Was: 'When this unit deals damage, scry 1. You may reveal the top card of y...'" },
  tcg_5720: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. This unit cannot be targeted by spells or attacks until it deal...'" },
  tcg_5941: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit cannot be targeted by attacks or spells until it deal...'" },
  tcg_5948: { ability: "Lifesteal. This unit restores your hero health when it strikes.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live LIFESTEAL keyword. Was: 'Lifesteal. When this unit deals damage, restore that much health to y...'" },
  tcg_5998: { ability: "Lifesteal. This unit restores your hero health when it strikes.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live LIFESTEAL keyword. Was: 'Lifesteal. When this unit deals damage, restore that much health to y...'" },
  tcg_6179: { ability: "Lifesteal. This unit restores your hero health when it strikes.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live LIFESTEAL keyword. Was: 'Lifesteal. When this unit deals damage, restore that much health to y...'" },
  tcg_6559: { ability: "Lifesteal. This unit restores your hero health when it strikes.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live LIFESTEAL keyword. Was: 'Lifesteal. When this unit deals damage, restore that much health to y...'" },
  tcg_2476: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. When this unit enters play, gain +3 HP until the end of your ne...'" },
  tcg_314: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit deals damage equal to its attack to a target when s...'" },
  tcg_5064: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +1 Armor until the end of yo...'" },
  tcg_5676: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +2/0 until the end of the turn whenever it is a...'" },
  tcg_6163: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit gains +2/+0 when attacking an enemy that has not ye...'" },
  tcg_1874: { ability: "Shield. Absorbs the first instance of damage dealt to this unit.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live SHIELD keyword. Was: 'Shield. Gains +2 HP when attacked, but loses 1 ATK for each attack re...'" },
  tcg_2668: { ability: "Shield. Absorbs the first instance of damage dealt to this unit.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live SHIELD keyword. Was: 'Shield. This unit gains +2/+2 until the end of the turn when it is at...'" },
  tcg_2698: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired summon rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit is dealt damage, summon a 1/1 stone spirit with...'" },
  tcg_3140: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. When this unit is targeted by an attack, gain +1/+1 until end o...'" },
  tcg_3241: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. When this unit enters the battlefield, gain +2/+0 until end o...'" },
  tcg_3586: { ability: "Armored. This unit takes reduced combat damage.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live ARMORED keyword. Was: 'Armored. This unit gains +2 defense until the end of the turn when at...'" },
  tcg_5603: { ability: "Shield. Absorbs the first instance of damage dealt to this unit.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live SHIELD keyword. Was: 'Shield. This unit gains +2/+2 until the end of your next turn when at...'" },
  tcg_6232: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. Enemy units must attack this unit if able. Gains +1/+1 while d...'" },
  tcg_6533: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit takes no damage from the first instance of damage eac...'" },
  tcg_1377: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired draw rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. When this unit is summoned, draw a card for each allied Stone K...'" },
  tcg_2555: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. This unit gains +2/+2 while untapped. When it attacks, it loses...'" },
  tcg_2825: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. When this unit is targeted by an enemy, gain +1/+1 until end of...'" },
  // NOTE: tcg_3380 (Crypt Keeper) intentionally NOT retexted — the audit flags it
  // as a 'resurrect' mismatch, but its "Any unit dies: place 1/1 Wraith..." text
  // actually compiles to a LIVE SUMMON_ON_ANY_DEATH death-watcher that the marquee
  // regression suite exercises. Retexting it deletes real behavior (the tcg_239 trap).
  tcg_3425: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired return_bounce rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Once per match: return the last card played by either side to owner's...'" },
  tcg_3990: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +1 health for each point suf...'" },
  tcg_5864: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. When this unit enters battle, deal 2 damage to a target enemy...'" },
  tcg_6376: { ability: "Lifesteal. This unit restores your hero health when it strikes.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live LIFESTEAL keyword. Was: 'When this unit takes damage, gain +1 health for each point lost. Life...'" },
  tcg_1293: { ability: "Armored. This unit takes reduced combat damage.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live ARMORED keyword. Was: 'Armored. When this unit is dealt damage, it deals 1 damage to all ene...'" },
  tcg_1904: { ability: "Armored. This unit takes reduced combat damage.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live ARMORED keyword. Was: 'Armored. This unit gains +2 defense until the end of your opponent's ...'" },
  tcg_248: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. Whenever this unit is attacked, restore 2 health to a friendly ...'" },
  tcg_3686: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +2/+2 until the end of your turn if it takes da...'" },
  tcg_5787: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired draw rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit cannot be targeted by spells. When destroyed, draw a ...'" },
  tcg_6434: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit may attack immediately. If it deals damage, gain 2 ...'" },
  tcg_4000: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +3 HP while in formation with other Iron Defend...'" },
  tcg_602: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. This unit cannot be targeted by enemy spells until it deals dam...'" },
  tcg_1117: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. Upon entering the battlefield, gain +2/+0 until the end of turn.'" },
  tcg_2428: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +1 health for each point dealt.'" },
  tcg_3608: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, restore 1 health to a friendly unit.'" },
  tcg_4698: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +1 Armor for each damage taken.'" },
  tcg_4729: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, restore 1 health to a friendly unit.'" },
  tcg_59: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, restore 1 health to a friendly unit.'" },
  tcg_6554: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, restore 1 health to a friendly unit.'" },
  tcg_79: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, restore 3 health to a friendly unit.'" },
  tcg_1822: { ability: "Armored. This unit takes reduced combat damage.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live ARMORED keyword. Was: 'Armored. This unit gains +1 defense for each Iron Defender you control.'" },
  tcg_3144: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +1 Armor until your next turn.'" },
  tcg_3844: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +2 Health for each opposing unit that attacks it.'" },
  tcg_3847: { ability: "Regrow. Restores this unit health over time.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live REGROW keyword. Was: 'When this unit is summoned, restore 1 health to a wounded ally. Regrow.'" },
  tcg_4061: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit deals damage equal to its attack when it enters play.'" },
  tcg_5123: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit is attacked, restore 2 health to a friendly unit.'" },
  tcg_5478: { ability: "Shield. Absorbs the first instance of damage dealt to this unit.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live SHIELD keyword. Was: 'Guard. Other Iron Defenders gain +1 Health while you control this unit.'" },
  tcg_5595: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. When Zeus enters the field, deal 2 damage to target enemy unit.'" },
  tcg_580: { ability: "Armored. This unit takes reduced combat damage.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live ARMORED keyword. Was: 'Armored. This unit gains +1 defense for each Iron Defender you control.'" },
  tcg_6246: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. When this unit takes damage, restore 2 health to a friendly unit.'" },
  tcg_2523: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. When this unit enters the fray, deal 2 damage to target enemy.'" },
  tcg_3286: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. When this unit takes damage, gain +1 health for each point lost.'" },
  tcg_3707: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired draw rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. When this unit is targeted, prevent that damage and draw a card.'" },
  tcg_4497: { ability: "Regrow. Restores this unit health over time.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live REGROW keyword. Was: 'When this unit is attacked, restore 2 health to a target ally. Regrow.'" },
  tcg_6162: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. Enemies must attack this unit if able. Gain +1/+1 when damaged.'" },
  tcg_1017: { ability: "Shield. Absorbs the first instance of damage dealt to this unit.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live SHIELD keyword. Was: 'Shield. This unit gains +2 HP for each Stone Keeper ally you control.'" },
  tcg_1870: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired draw rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. When this unit is targeted, negate that effect and draw a card.'" },
  tcg_1967: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, heal 2 health to a friendly unit.'" },
  tcg_3320: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit is attacked, restore 2 health to a target ally.'" },
  tcg_455: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +1 attack until end of turn.'" },
  tcg_5207: { ability: "Armored. This unit takes reduced combat damage.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live ARMORED keyword. Was: 'Armored. This unit gains +1 Armor for each Iron Defender you control.'" },
  tcg_6150: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +1 health until end of turn.'" },
  tcg_6522: { ability: "Armored. This unit takes reduced combat damage.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live ARMORED keyword. Was: 'Armored. This unit gains +1 armor for each Iron Defender you control.'" },
  tcg_1220: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. When this unit enters battle, deal 2 damage to target enemy.'" },
  tcg_2666: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit is dealt damage, gain +1/+1 until end of turn.'" },
  tcg_3074: { ability: "Shield. Absorbs the first instance of damage dealt to this unit.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live SHIELD keyword. Was: 'Shield. This unit gains +1 armor for each Iron Defender you control.'" },
  tcg_3390: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Stealth. Turn start: deal 2 damage to enemy commander. Untargetable.'" },
  tcg_3622: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit is damaged, restore 2 health to a target ally.'" },
  tcg_2286: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +1/+1 for each turn spent on the battlefield.'" },
  tcg_5419: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. Upon entering the battlefield, deal 2 damage to any target.'" },
  tcg_2203: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. When this unit is attacked, gain +3 HP until your next turn.'" },
  tcg_5616: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +1/+1 for every Silver Sentinel you control.'" },
  tcg_639: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit gains +2 Attack while attacking a wounded enemy.'" },
  tcg_720: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired heal_other rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. At the end of your turn, restore 1 health to a wounded ally.'" },
  tcg_5327: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +1 HP until end of turn.'" },
  tcg_5637: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +1 Defense for each allied Silver Sentinel.'" },
  tcg_203: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +1/+1 for each attack prevented this turn.'" },
  tcg_2735: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. While this unit is on the field, ally units gain +1 Armor.'" },
  tcg_3083: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired debuff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, reduce its next attack by 1.'" },
  tcg_5594: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. Gain +2 health for each other Silver Sentinel you control.'" },
  tcg_6114: { ability: "Armored. This unit takes reduced combat damage.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live ARMORED keyword. Was: 'Armored. Gains +1/+1 for each other Bronze Guardian you control.'" },
  tcg_817: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When attacked, deal 2 damage to the attacking enemy unit.'" },
  tcg_994: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired destroy rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. If this unit destroys an enemy, heal 2 damage to itself.'" },
  tcg_3714: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. When this unit is attacked, gain +2 HP until end of turn.'" },
  tcg_2823: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. This unit gains +2/+0 when attacking without blockers.'" },
  tcg_283: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +1 permanent health.'" },
  tcg_3214: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +2 Defense during your opponent's turn.'" },
  tcg_2637: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +2/+2 while defending against attacks.'" },
  tcg_6360: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +1/+1 for each enemy that attacks it.'" },
  tcg_1653: { ability: "Ward. Cannot be targeted by the first spell or ability each turn.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live WARD keyword. Was: 'Ward. This unit gains +1/+1 for each unit that attacks it.'" },
  tcg_3292: { ability: "Shield. Absorbs the first instance of damage dealt to this unit.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live SHIELD keyword. Was: 'Shield. This unit gains +1/+1 whenever it is dealt damage.'" },
  tcg_5958: { ability: "Armored. This unit takes reduced combat damage.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live ARMORED keyword. Was: 'Armored. Gains +2 Armor until end of turn when attacked.'" },
  tcg_2923: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. Gains +1/+0 for each Silver Sentinel you control.'" },
  tcg_6409: { ability: "Guard. Enemy must attack this unit first.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live GUARD keyword. Was: 'Taunt. When this unit takes damage, gain +2 maximum HP.'" },
  tcg_3340: { ability: "Flying. This unit attacks over ground units.", note: "Honesty retext: dropped unwired destroy rider (compiler emits no active op for the conditional clause); card keeps only its live FLYING keyword. Was: 'Flying, Rush. On attack: destroy any enemy with HP ≤3.'" },
  tcg_827: { ability: "Lifesteal. This unit restores your hero health when it strikes.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live LIFESTEAL keyword. Was: 'When this unit deals damage, gain 1 health. Lifesteal.'" },
  tcg_6247: { ability: "Veil. This unit is hidden and cannot be targeted until it attacks.", note: "Honesty retext: dropped unwired buff rider (compiler emits no active op for the conditional clause); card keeps only its live STEALTH keyword. Was: 'Veil. Gain +1/+1 until the start of your next turn.'" },
  tcg_1635: { ability: "Trample. Excess combat damage carries through.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live CRUSH keyword. Was: 'Trample. When this unit deals damage, gain 2 life.'" },
  tcg_4455: { ability: "Charge. This unit may attack immediately after being summoned.", note: "Honesty retext: dropped unwired deal_damage rider (compiler emits no active op for the conditional clause); card keeps only its live RUSH keyword. Was: 'Charge. Upon entry, deal 2 damage to target enemy.'" },

  // === INERT (note-only): spec-less placeholder artifacts (71 cards, 2026.06.02) ===
  // Ability text is the generic sentinel "Global effect active while in play."
  // (compiles to GLOBAL_UNPARSED — an engine no-op). Per the honesty rule we give
  // them NO invented behavior — the engine already does nothing with the text.
  // IMPORTANT: these 71 are ALL of cardClass "artifact", and they are the ENTIRE
  // artifact pool. Every commander spec (src/design/commanderSpecs.ts) requires
  // minArtifacts >= 1, so soft-banning them would make EVERY curated deck illegal
  // and break deck legality + regression. We therefore DOCUMENT them as inert but
  // leave them deck-legal (no `disabled` flag) — honest inert deck-fillers, not
  // fabricated content. IDs sorted for a stable diff.
  tcg_3399: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_3418: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_3427: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_3492: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_3536: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_3580: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_3609: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_3654: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_3669: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_3719: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_3804: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_3852: { name: "Relic of Verdant Roots", note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers. Authored name (was 'Relic of the Verdant Oath', one of four near-identical 'Verdant Oath' names)." },
  tcg_3895: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4006: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4020: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4098: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4168: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4202: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4240: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4309: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4332: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4349: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4379: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4477: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4495: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4538: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4540: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4584: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4605: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4607: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4631: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4662: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4666: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4713: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_4969: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5211: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5301: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5339: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5400: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5458: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5465: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5539: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5598: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5600: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5659: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5728: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5822: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5853: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5965: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_5970: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6094: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6121: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6129: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6147: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6152: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6176: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6197: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6269: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6271: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6325: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6380: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6414: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6431: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6449: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6493: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6514: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6516: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6581: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6596: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6624: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
  tcg_6660: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },

  // === SOFT-BAN: null/empty ability text (36 cards, 2026.06.02) ===
  // rawTraits.Ability is null/empty — the card has no ability spec at all. Same
  // honesty treatment: stay disabled, never fabricate behavior.
  tcg_152: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  // === COMBAT-DEPTH keyword revival (item #12, 2026.06.01) ===
  // Three previously soft-banned, ability-less units are REVIVED by giving them a
  // real, deck-legal ability built on the new chain-reaction keywords (Deathknell /
  // Deploy). Stats are LEFT UNCHANGED (no balance-report stat shift) and `disabled`
  // is dropped (they now carry a functional ability, so the honesty soft-ban no
  // longer applies). None of these ids appear in any curated/default/owned deck or
  // golden fixture, so reviving them disturbs no existing balance fixture — it only
  // adds three exercisable keyword carriers. See keywordDescriptions.ts for text.
  //
  // tcg_1545 "Bronze 5/3" -> Deathknell 2. A fragile (5/3) trader whose death pings
  // the strongest enemy — modest, no-burn (enemy units only). 5 attack / 3 health
  // is below the 5-drop curve, so the on-death ping is a fair rider, not a buff.
  tcg_1545: {
    keywords: ["DEATHKNELL"],
    ability: "Deathknell 2.",
    note: "Combat-depth revival: was soft-banned (empty ability). Now Deathknell 2 (ON_DEATH DEAL_DAMAGE 2 -> strongest enemy, damageTarget:STRONGEST_ENEMY). Chain primitive. No-burn (enemy units only). Stats unchanged 5/3; deck-legal again.",
  },
  tcg_1636: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_2020: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_2146: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_2316: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_2358: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_2400: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_2647: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_2653: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_2910: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_3386: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_3604: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_3611: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_3944: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_3974: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_4175: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_4187: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  // tcg_4210 "Stone 4/3" -> Deathknell 3. A heavier on-death pinger; 4/3 is a soft
  // 3-drop body, so a 3-damage knell on death is in-line with a 3-cost effect-rider.
  // Pairs with tcg_1545 to demonstrate a Deathknell -> Deathknell CHAIN.
  tcg_4210: {
    keywords: ["DEATHKNELL"],
    ability: "Deathknell 3.",
    note: "Combat-depth revival: was soft-banned (empty ability). Now Deathknell 3 (ON_DEATH DEAL_DAMAGE 3 -> strongest enemy). Chain primitive; a 3-dmg knell can kill another Deathknell unit and chain its ON_DEATH (bounded by DRAIN_ITERATION_CAP). No-burn. Stats unchanged 4/3; deck-legal again.",
  },
  tcg_426: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  // tcg_4371 "Iron 2/4 Armored" -> Deploy 2. A defensive Iron body whose Deploy
  // (battlecry) pings the strongest enemy on play. Low attack (2) keeps it a
  // value/control card, not aggro; Armored is retained (summon-hook, composes
  // cleanly). A Deploy ping can kill a wounded Deathknell unit and start a chain
  // through the SAME ON_SUMMON -> resolveDeaths path.
  tcg_4371: {
    keywords: ["DEPLOY", "ARMORED"],
    ability: "Armored. Deploy 2.",
    note: "Combat-depth revival: was soft-banned (empty ability). Now Armored + Deploy 2 (ON_SUMMON DEAL_DAMAGE 2 -> strongest enemy). Deploy can start a chain by killing a wounded Deathknell unit. No-burn (enemy units only). Stats unchanged 2/4; deck-legal again.",
  },
  tcg_4397: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_4711: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_4924: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_5099: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_5189: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_5394: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_547: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_549: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_5617: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_5884: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_6419: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_6550: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_741: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_772: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_914: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },

  // === SOFT-BAN: ability present but compiles to NO live op AND no functional keyword (2026.05.31) ===
  // Same honesty rule as the 36 blank-ability bans above, applied to the cards
  // whose Ability TEXT exists but yields zero real op when compiled
  // (compileAbility().specs is empty — only UNKNOWN/GLOBAL_UNPARSED/KEYWORD_WIRED
  // classifications) AND that carry no functional keyword in the live engine
  // keyword set (GUARD/RUSH/CRUSH/FLYING/RANGED/WARD/DIVINE_SHIELD/SHIELD/WINDFURY/
  // LIFESTEAL/STEALTH/ARMORED/DEATHRATTLE/REGROW/EXECUTE/SCRY/MYTHIC/COMMAND/
  // QUICKSTEP/RELIC/RITUAL/FEAR/OATH). With the live engine keyword wiring, exactly
  // ONE non-blank unit meets this bar (the other 23 measured dead units are already
  // covered by the null/empty-ability bans above), so the full dead set is inert.
  // tcg_3375 "Darius": "On play: both players reveal top 3. Units ≥5 cost return
  // to deck; others destroyed." — bespoke long-tail text the compiler leaves as
  // UNKNOWN (no live op) with no functional keyword; kept inert, never fabricated.
  tcg_3375: { disabled: true, note: "Soft-ban: ability text present but compiles to no live op (UNKNOWN) and carries no functional keyword — deck-illegal, kept inert per honesty rule." },

  // === EXPANDED-POOL ARCHETYPE SEEDS: Tier-3 keywords on newly-curated units (2026.06.01) ===
  // The curated core set was expanded from ~98 to ~231 cards (buildCuratedCoreSetV2.cjs
  // now surfaces ~36 units/faction). To give the larger pool real deathrattle /
  // battlecry archetypes, five newly-surfaced, on-curve curated units (one per mortal
  // faction) are retext to the Tier-3 chain keywords DEATHKNELL / DEPLOY, replacing a
  // vague placeholder ability ("Deathrattle. Trigger effect when this unit is
  // destroyed." / generic summon/regrow text) with a CONCRETE, wired effect. Each is a
  // 3-cost ~7-8 / ~8-9 body, so a Deathknell 1 / Deploy 1 rider (1 dmg to the strongest
  // enemy) is a fair, on-curve addition — not a stat buff (stats are UNCHANGED). None of
  // these ids appears in any golden/balance fixture, default/owned deck, or the curated
  // ALPHA gate band (all cost 3, so the cost<=2 ratio gate cannot flag them), and the
  // outlier sweep reads the unbounded source JSON (not overrides), so all balance gates
  // are undisturbed. See keywordDescriptions.ts for DEATHKNELL / DEPLOY text.

  // STONE_KEEPERS 7/9 c3 -> Deathknell 1. Was the vague "Deathrattle. Trigger effect..."
  // placeholder; now a concrete on-death ping. Endurance-wall body that trades up on death.
  tcg_5157: {
    keywords: ["DEATHKNELL"],
    ability: "Deathknell 1.",
    note: "Expanded-pool archetype seed: vague placeholder Deathrattle -> Deathknell 1 (ON_DEATH DEAL_DAMAGE 1 -> strongest enemy). Stats unchanged 7/9 c3. No-burn (enemy units only).",
  },
  // SILVER_SENTINELS 8/8 c3 -> Deathknell 1. Tempo body whose death still extracts value.
  tcg_5648: {
    keywords: ["DEATHKNELL"],
    ability: "Deathknell 1.",
    note: "Expanded-pool archetype seed: vague placeholder Deathrattle -> Deathknell 1 (ON_DEATH DEAL_DAMAGE 1 -> strongest enemy). Stats unchanged 8/8 c3. No-burn.",
  },
  // IRON_DEFENDERS 6/7 c3 (Flying) -> Flying + Deathknell 1. Keeps its wired Flying; adds an
  // on-death ping so a fortress trade still chips the strongest attacker.
  tcg_2073: {
    keywords: ["FLYING", "DEATHKNELL"],
    ability: "Flying. Deathknell 1.",
    note: "Expanded-pool archetype seed: Flying retained + Deathknell 1 (ON_DEATH DEAL_DAMAGE 1 -> strongest enemy). Stats unchanged 6/7 c3. No-burn.",
  },
  // BRONZE_GUARDIANS 8/9 c3 -> Deploy 1. Bruiser-midrange battlecry: pings the strongest
  // enemy on play, can soften a blocker or start a Deploy->Deathknell chain.
  tcg_1135: {
    name: "Rootbound Vanguard",
    keywords: ["DEPLOY"],
    ability: "Deploy 1.",
    note: "Expanded-pool archetype seed: generic Regrow text -> Deploy 1 (ON_SUMMON DEAL_DAMAGE 1 -> strongest enemy). Stats unchanged 8/9 c3. No-burn. Authored name (was 'Ledger Keeper of Roots').",
  },
  // GOLDEN_SOVEREIGNS 7/8 c3 -> Deploy 1. Premium-finisher battlecry opener.
  tcg_4277: {
    keywords: ["DEPLOY"],
    ability: "Deploy 1.",
    note: "Expanded-pool archetype seed: generic Summon text -> Deploy 1 (ON_SUMMON DEAL_DAMAGE 1 -> strongest enemy). Stats unchanged 7/8 c3. No-burn.",
  },

  // ==========================================================================
  // SILVER_SENTINELS faction-balance pass (2026.06.02)
  // --------------------------------------------------------------------------
  // WHY: SILVER was the weakest faction in playtest (6.3% non-mirror WR). Root
  // cause is STRUCTURAL, not stats — SILVER's stat efficiency matches every
  // faction (2.21), but its cheap curve is built almost entirely from combat-
  // INERT keywords: WARD (anti-spell only), STEALTH (defensive evasion), SCRY
  // (deck-smoothing). It carries the LOWEST GUARD density of any faction (30 vs
  // STONE 445 / IRON 229 / BRONZE 196), so it can neither wall its own nexus nor
  // trade up — it simply gets ground out. (The faction-identity "Insight/Scry"
  // payoff is dormant in all live play + the harness, so it offers no offset.)
  //
  // FIX: turn the "Sentinels" into actual sentinels. Grant GUARD (real nexus
  // defence — the exact axis SILVER lacks) to its cheap watchers and bump bodies
  // a modest +1/+1, while KEEPING each card's existing evasion keyword
  // (WARD/STEALTH/LIFESTEAL) so the faction's identity reads through. One RUSH
  // skirmisher (tcg_2371, already Rush) is bumped for tempo flavour. SILVER-only,
  // no-burn (GUARD/STEALTH/WARD are static, never touch an enemy nexus), and
  // deterministic. These are the lowest-id cheap units the deck builders field
  // first, so the curve actually changes in play.
  // ==========================================================================

  // Calibration: keyword-only GUARD (original stats) left SILVER at 30.2%; a full
  // +1/+1 on top overshot to 66.7% (top faction, crushed aggro). The shipped buff
  // is the middle ground — GUARD + a MODEST stat bump: cost-1 chumps gain +0/+1
  // (stickier walls, same offence) and cost-2 bodies gain +1/+1. Each card keeps
  // its evasion keyword (WARD/STEALTH/LIFESTEAL) so the identity reads through.

  // -- cost-1 sentinels: add GUARD, +0/+1 (stickier chump walls) --------------
  tcg_1286: { name: "Veilwatcher Initiate", attack: 2, health: 3, keywords: ["WARD", "GUARD"], ability: "Ward. Guard.", note: "SILVER balance: 1/2 Ward -> 2/3 Ward+Guard. Nexus-defence body that trades; Ward kept. Authored name (was 'Watcher of the Veil', a duplicate)." },
  tcg_1499: { health: 2, keywords: ["GUARD"], ability: "Guard.", note: "SILVER balance: 1/1 Scry (combat-inert) -> 1/2 Guard. Chump wall on curve." },
  tcg_1747: { attack: 2, health: 2, keywords: ["WARD", "GUARD"], ability: "Ward. Guard.", note: "SILVER balance: 1/1 Ward -> 2/2 Ward+Guard." },
  tcg_2201: { attack: 2, health: 3, keywords: ["STEALTH", "GUARD"], ability: "Stealth. Guard.", note: "SILVER balance: 1/2 Stealth -> 2/3 Stealth+Guard. Evasive body that trades." },
  tcg_2371: { keywords: ["RUSH"], ability: "Rush.", note: "SILVER balance: 1/2 Rush kept (tempo skirmisher flavour); no stat change." },
  tcg_2793: { health: 2, keywords: ["STEALTH", "GUARD"], ability: "Stealth. Guard.", note: "SILVER balance: 1/1 Stealth -> 1/2 Stealth+Guard." },
  tcg_3145: { health: 2, keywords: ["STEALTH", "GUARD"], ability: "Stealth. Guard.", note: "SILVER balance: 1/1 Stealth -> 1/2 Stealth+Guard." },
  tcg_3282: { health: 2, keywords: ["LIFESTEAL", "GUARD"], ability: "Lifesteal. Guard.", note: "SILVER balance: 1/1 Lifesteal -> 1/2 Lifesteal+Guard. Sustain chump." },
  tcg_3294: { attack: 2, health: 3, keywords: ["WARD", "GUARD"], ability: "Ward. Guard.", note: "SILVER balance: 1/2 Ward -> 2/3 Ward+Guard." },
  tcg_331: { attack: 2, health: 3, keywords: ["WARD", "GUARD"], ability: "Ward. Guard.", note: "SILVER balance: 1/2 Ward -> 2/3 Ward+Guard." },
  tcg_464: { health: 2, keywords: ["GUARD"], ability: "Guard.", note: "SILVER balance: 1/1 vague-Deathrattle -> 1/2 Guard (clean static)." },
  tcg_5557: { health: 2, keywords: ["STEALTH", "GUARD"], ability: "Stealth. Guard.", note: "SILVER balance: 1/1 Stealth -> 1/2 Stealth+Guard." },

  // -- cost-2 sentinels: add GUARD, +1/+1 -------------------------------------
  tcg_1897: { attack: 3, health: 4, keywords: ["WARD", "GUARD"], ability: "Ward. Guard.", note: "SILVER balance: 2/3 Ward -> 3/4 Ward+Guard." },
  tcg_1196: { attack: 3, health: 3, keywords: ["STEALTH", "GUARD"], ability: "Stealth. Guard.", note: "SILVER balance: 2/2 Stealth -> 3/3 Stealth+Guard." },
  tcg_1471: { attack: 3, health: 3, keywords: ["STEALTH", "GUARD"], ability: "Stealth. Guard.", note: "SILVER balance: 2/2 Stealth -> 3/3 Stealth+Guard." },
  tcg_1648: { attack: 3, health: 3, keywords: ["GUARD"], ability: "Guard.", note: "SILVER balance: 2/2 vague-Deathrattle -> 3/3 Guard (clean static)." },
  tcg_1668: { name: "Unblinking Arbiter", attack: 3, health: 3, keywords: ["STEALTH", "GUARD"], ability: "Stealth. Guard.", note: "SILVER balance: 2/2 Stealth -> 3/3 Stealth+Guard. Authored name (was 'Watcher of Unblinking Judgement')." },
  tcg_188: { attack: 3, health: 3, keywords: ["STEALTH", "GUARD"], ability: "Stealth. Guard.", note: "SILVER balance: 2/2 Stealth -> 3/3 Stealth+Guard." },

  // === AUTHORED NAMES (2026.06.02) — the newcomer-facing default deck ===========
  // The 30 cards the curated CORE deck actually surfaces were procedurally named,
  // with collisions (four "Verdant Oath" variants, repeated "Watcher of the Veil")
  // and joke auto-names ("Mr LOL", "D'Vile One", "Octopus of Gilded Woe"). These
  // are NAME-ONLY overrides: purely cosmetic, zero effect on stats / cost /
  // compilation / legality / determinism (the reducer keys off card ids, so match
  // replay + the equivalence golden are byte-identical). Names stay inside each
  // faction's established aesthetic (Stone = geological/time, Iron = forge/martial,
  // Bronze = verdant/oath/growth, Silver = veil/insight/judgment, Gold = gilded/
  // sovereign). Cards already given good distinct names are deliberately left alone
  // (tcg_1676 Unyielding Bastion, tcg_1199 Judge of Shattered Reflections, tcg_1223
  // Scion of the Gilded Dawn, tcg_1243 Herald of the Scorpion Crown, tcg_3492
  // Frostbound Grimoire). Five more cards in this deck are renamed via their
  // existing balance/honesty entries above (tcg_1286, tcg_1668, tcg_101, tcg_1135,
  // tcg_3852). Deeper per-card ability/stat authoring is a separate, balance-gated pass.

  // -- STONE_KEEPERS -----------------------------------------------------------
  tcg_1042: { name: "Warden of the First Stone", note: "Authored name (was 'Echo of the Eternal Stone')." },
  tcg_1461: { name: "Quarried Stonechild", note: "Authored name (was 'Stonechild of Ten Count')." },
  tcg_3710: { name: "Stoneward Brace", note: "Authored name (was 'Stonebound Resilience'); equipment." },
  tcg_3759: { name: "Mantle of Stillness", note: "Authored name (was 'Echo of Stillness'); equipment." },
  tcg_3781: { name: "Cairn of the Silent Stone", note: "Authored name (was 'Echo of the Silent Stone'); equipment." },
  tcg_1854: { name: "Sentinel of the Silent Strata", note: "Authored name (was 'Sentinel of Silent Stones')." },
  tcg_1038: { name: "Colossus of Eroded Time", note: "Authored name (was 'Sentinel of Eroded Time')." },

  // -- IRON_DEFENDERS ----------------------------------------------------------
  tcg_1388: { name: "Aegis of the Unbroken Line", note: "Authored name (was 'Aegis of Relentless Might')." },
  tcg_1457: { name: "The Forgemaster's Aegis", note: "Authored name (was 'The Forged Aegis')." },
  tcg_10: { name: "Warlord of the Last Horn", note: "Authored name (was 'Echo of the Last Horn')." },

  // -- BRONZE_GUARDIANS --------------------------------------------------------
  tcg_1871: { name: "Bronze Oathsworn", note: "Authored name (was 'Sentinel of Verdant Oath', one of four near-identical 'Verdant Oath' names)." },
  tcg_1354: { name: "Grovekeeper of Returning Spring", note: "Authored name (was 'Warden of the Verdant Grove')." },
  tcg_1281: { name: "Evergreen Reclaimer", note: "Authored name (was 'Keeper of Verdant Oaths')." },
  tcg_2026: { name: "Verdant Executioner", note: "Authored name (was 'Mr LOL', a joke auto-name); keeps EXECUTE." },

  // -- SILVER_SENTINELS --------------------------------------------------------
  tcg_1477: { name: "Umbral Arbiter of Shadows", note: "Authored name (was 'Lunar Arbiter of Shadows')." },
  tcg_1306: { name: "Keeper of the Eternal Archive", note: "Authored name (was 'Warden of the Eternal Archive')." },
  tcg_1125: { name: "Paragon of Unveiled Truth", note: "Authored name (was 'Gleaming Paragon of Truth')." },

  // -- GOLDEN_SOVEREIGNS -------------------------------------------------------
  tcg_1198: { name: "Gilded Mourner", note: "Authored name (was 'Octopus of Gilded Woe', a joke auto-name); keeps DEATHRATTLE." },
  tcg_1330: { name: "Sunspear Emissary", note: "Authored name (was 'Emissary of Shifting Sands')." },
  tcg_1495: { name: "Sovereign Heir of Dusk", note: "Authored name (was 'Infernal Heir of Dusk')." },
  tcg_2654: { name: "Gilded Tribute-Bearer", note: "Authored name (was '#2654', a bare token-number placeholder)." },

  // ===========================================================================
  // BALANCE PASS — over-statted commons (dev:grade-outliers, 2026.06.02)
  // ===========================================================================
  // The re-revealed catalog ships an authored on-chain Grade (≈0–100 power). The
  // grade-outlier report (src/dev/runGradeOutlierReport.ts) flags cards whose
  // on-board stat-sum is HIGH relative to that Grade vs their faction×rarity×cost
  // peers: "over-statted" = disagreement (gradeZ − statZ) < 0 with |disagreement|
  // > 2. These 68 COMMON-rarity cards carried no override and were over-statted.
  //
  // Each nerf trims ONLY attack/health (cost/keywords/abilities untouched),
  // pulling the inflated stat toward the class PEER stat line (the Grade-implied
  // target) — never below a 1/1 floor, never overcorrecting past the peer mean.
  // Stats only; conservative + reversible. See per-card `note` for the z-shift.
  //
  // Scope: COMMON over-statted no-override cards only. The report also flags 4
  // non-common over-statted bodies (tcg_3003/tcg_2164/tcg_2207 mythics, tcg_5739
  // epic) and ~27 commons already at/below their peer line (false positives —
  // power lives in ability text / Grade-z, not stat-sum); all are left untouched.
  tcg_3182: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=2.2, dis=-9.82 vs peers); 2/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_6654: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.8, dis=-6.68 vs peers); 2/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.30)." },
  tcg_6082: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.8, dis=-6.68 vs peers); 2/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.30)." },
  tcg_3361: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.8, dis=-6.68 vs peers); 1/4 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.30)." },
  tcg_6637: { attack: 1, health: 1, note: "Balance: over-statted Grade-50 common (stat-sum z=2.0, dis=-6.62 vs peers); 2/3 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_794: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.9, dis=-6.24 vs peers); 2/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_3438: { attack: 3, health: 4, note: "Balance: over-statted Grade-50 common (stat-sum z=0.7, dis=-5.98 vs peers); 3/5 -> 3/4, trimmed inflated stat toward class peer line 8 (stat-z -> 0.22)." },
  tcg_6437: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.0, dis=-5.94 vs peers); 1/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.30)." },
  tcg_6115: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.0, dis=-5.94 vs peers); 1/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.30)." },
  tcg_3429: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.0, dis=-5.94 vs peers); 1/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.30)." },
  tcg_3358: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.0, dis=-5.94 vs peers); 1/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.30)." },
  tcg_1676: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.0, dis=-5.94 vs peers); 1/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.30)." },
  tcg_6644: { attack: 1, health: 1, note: "Balance: over-statted Grade-50 common (stat-sum z=1.2, dis=-5.82 vs peers); 1/3 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_6643: { attack: 1, health: 1, note: "Balance: over-statted Grade-50 common (stat-sum z=1.2, dis=-5.82 vs peers); 1/3 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_6087: { attack: 1, health: 1, note: "Balance: over-statted Grade-50 common (stat-sum z=1.2, dis=-5.82 vs peers); 1/3 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_5621: { attack: 1, health: 1, note: "Balance: over-statted Grade-50 common (stat-sum z=1.2, dis=-5.82 vs peers); 1/3 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_3337: { attack: 1, health: 1, note: "Balance: over-statted Grade-50 common (stat-sum z=1.2, dis=-5.82 vs peers); 1/3 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_2802: { attack: 1, health: 1, note: "Balance: over-statted Grade-50 common (stat-sum z=1.2, dis=-5.82 vs peers); 1/3 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_691: { attack: 1, health: 1, note: "Balance: over-statted Grade-50 common (stat-sum z=1.2, dis=-5.82 vs peers); 1/3 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_6385: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.1, dis=-5.48 vs peers); 1/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_6326: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.1, dis=-5.48 vs peers); 1/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_6234: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.1, dis=-5.48 vs peers); 1/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_6131: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.1, dis=-5.48 vs peers); 1/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_6019: { attack: 1, health: 2, note: "Balance: over-statted Grade-50 common (stat-sum z=1.1, dis=-5.48 vs peers); 1/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_6341: { attack: 3, health: 3, note: "Balance: over-statted Grade-50 common (stat-sum z=1.4, dis=-5.42 vs peers); 4/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.22)." },
  tcg_5831: { attack: 3, health: 3, note: "Balance: over-statted Grade-50 common (stat-sum z=0.7, dis=-5.41 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.21)." },
  tcg_3259: { attack: 3, health: 3, note: "Balance: over-statted Grade-50 common (stat-sum z=0.7, dis=-5.41 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.21)." },
  tcg_5914: { attack: 3, health: 3, note: "Balance: over-statted Grade-50 common (stat-sum z=1.3, dis=-5.08 vs peers); 3/6 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.14)." },
  tcg_3057: { attack: 1, health: 1, note: "Balance: over-statted Grade-50 common (stat-sum z=0.4, dis=-5.03 vs peers); 1/2 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_2807: { attack: 1, health: 1, note: "Balance: over-statted Grade-50 common (stat-sum z=0.4, dis=-5.03 vs peers); 1/2 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_6356: { attack: 3, health: 3, note: "Balance: over-statted Grade-50 common (stat-sum z=0.8, dis=-4.89 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.22)." },
  tcg_3545: { attack: 3, health: 3, note: "Balance: over-statted Grade-50 common (stat-sum z=0.8, dis=-4.89 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.22)." },
  tcg_6621: { attack: 3, health: 3, note: "Balance: over-statted Grade-50 common (stat-sum z=0.8, dis=-4.61 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.14)." },
  tcg_6561: { attack: 3, health: 3, note: "Balance: over-statted Grade-50 common (stat-sum z=0.8, dis=-4.61 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.14)." },
  tcg_2062: { attack: 3, health: 3, note: "Balance: over-statted Grade-50 common (stat-sum z=0.8, dis=-4.61 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.14)." },
  tcg_949: { attack: 3, health: 3, note: "Balance: over-statted Grade-50 common (stat-sum z=0.8, dis=-4.61 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.14)." },
  tcg_909: { attack: 3, health: 3, note: "Balance: over-statted Grade-50 common (stat-sum z=0.8, dis=-4.61 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.14)." },
  tcg_94: { attack: 3, health: 3, note: "Balance: over-statted Grade-50 common (stat-sum z=0.8, dis=-4.61 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.14)." },
  tcg_5986: { attack: 2, health: 4, note: "Balance: over-statted Grade-50 common (stat-sum z=0.3, dis=-4.36 vs peers); 2/5 -> 2/4, trimmed inflated stat toward class peer line 7 (stat-z -> -0.22)." },
  tcg_3378: { attack: 3, health: 3, note: "Balance: over-statted Grade-50 common (stat-sum z=0.3, dis=-4.36 vs peers); 3/4 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.22)." },
  tcg_5629: { attack: 1, health: 1, note: "Balance: over-statted Grade-55 common (stat-sum z=2.0, dis=-4.19 vs peers); 2/3 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_1550: { attack: 2, health: 4, note: "Balance: over-statted Grade-50 common (stat-sum z=0.3, dis=-4.14 vs peers); 2/5 -> 2/4, trimmed inflated stat toward class peer line 7 (stat-z -> -0.14)." },
  tcg_6362: { attack: 1, health: 2, note: "Balance: over-statted Grade-55 common (stat-sum z=1.8, dis=-4.12 vs peers); 2/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.30)." },
  tcg_6373: { attack: 1, health: 1, note: "Balance: over-statted Grade-55 common (stat-sum z=1.2, dis=-3.39 vs peers); 1/3 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_5760: { attack: 1, health: 1, note: "Balance: over-statted Grade-55 common (stat-sum z=1.2, dis=-3.39 vs peers); 1/3 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_2810: { attack: 1, health: 1, note: "Balance: over-statted Grade-55 common (stat-sum z=1.2, dis=-3.39 vs peers); 1/3 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_3349: { attack: 1, health: 2, note: "Balance: over-statted Grade-55 common (stat-sum z=1.0, dis=-3.38 vs peers); 1/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.30)." },
  tcg_6223: { attack: 1, health: 2, note: "Balance: over-statted Grade-55 common (stat-sum z=1.1, dis=-3.19 vs peers); 1/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_3384: { attack: 3, health: 3, note: "Balance: over-statted Grade-55 common (stat-sum z=1.3, dis=-3.03 vs peers); 3/6 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.14)." },
  tcg_3032: { attack: 3, health: 3, note: "Balance: over-statted Grade-55 common (stat-sum z=1.3, dis=-3.03 vs peers); 3/6 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.14)." },
  tcg_5927: { attack: 3, health: 3, note: "Balance: over-statted Grade-55 common (stat-sum z=0.7, dis=-2.95 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.21)." },
  tcg_6420: { attack: 3, health: 3, note: "Balance: over-statted Grade-55 common (stat-sum z=0.8, dis=-2.72 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.22)." },
  tcg_6300: { attack: 3, health: 3, note: "Balance: over-statted Grade-55 common (stat-sum z=0.8, dis=-2.72 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.22)." },
  tcg_762: { attack: 3, health: 3, note: "Balance: over-statted Grade-55 common (stat-sum z=0.8, dis=-2.72 vs peers); 3/5 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.22)." },
  tcg_6530: { attack: 1, health: 1, note: "Balance: over-statted Grade-55 common (stat-sum z=0.4, dis=-2.60 vs peers); 1/2 -> 1/1, trimmed inflated stat toward class peer line 3 (stat-z -> -0.39)." },
  tcg_3769: { attack: 2, health: 4, note: "Balance: over-statted Grade-55 common (stat-sum z=0.3, dis=-2.19 vs peers); 2/5 -> 2/4, trimmed inflated stat toward class peer line 7 (stat-z -> -0.22)." },
  tcg_3339: { attack: 3, health: 3, note: "Balance: over-statted Grade-55 common (stat-sum z=0.3, dis=-2.19 vs peers); 3/4 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.22)." },
  tcg_3304: { attack: 3, health: 3, note: "Balance: over-statted Grade-55 common (stat-sum z=0.3, dis=-2.19 vs peers); 3/4 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.22)." },
  tcg_1690: { attack: 3, health: 3, note: "Balance: over-statted Grade-55 common (stat-sum z=0.3, dis=-2.19 vs peers); 3/4 -> 3/3, trimmed inflated stat toward class peer line 7 (stat-z -> -0.22)." },
  tcg_4334: { attack: 2, health: 4, note: "Balance: over-statted Grade-55 common (stat-sum z=0.3, dis=-2.10 vs peers); 2/5 -> 2/4, trimmed inflated stat toward class peer line 7 (stat-z -> -0.14)." },
  tcg_3111: { attack: 2, health: 4, note: "Balance: over-statted Grade-55 common (stat-sum z=0.3, dis=-2.10 vs peers); 2/5 -> 2/4, trimmed inflated stat toward class peer line 7 (stat-z -> -0.14)." },
  tcg_6311: { attack: 1, health: 2, note: "Balance: over-statted Grade-60 common (stat-sum z=2.2, dis=-2.07 vs peers); 2/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_6096: { attack: 1, health: 2, note: "Balance: over-statted Grade-60 common (stat-sum z=2.2, dis=-2.07 vs peers); 2/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_5774: { attack: 1, health: 2, note: "Balance: over-statted Grade-60 common (stat-sum z=2.2, dis=-2.07 vs peers); 1/4 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_5647: { attack: 1, health: 2, note: "Balance: over-statted Grade-60 common (stat-sum z=2.2, dis=-2.07 vs peers); 2/3 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_5644: { attack: 1, health: 2, note: "Balance: over-statted Grade-60 common (stat-sum z=2.2, dis=-2.07 vs peers); 3/2 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_2662: { attack: 1, health: 2, note: "Balance: over-statted Grade-60 common (stat-sum z=2.2, dis=-2.07 vs peers); 3/2 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
  tcg_391: { attack: 1, health: 2, note: "Balance: over-statted Grade-60 common (stat-sum z=2.2, dis=-2.07 vs peers); 3/2 -> 1/2, trimmed inflated stat toward class peer line 4 (stat-z -> 0.37)." },
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
    name?: string;
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

  if (ov.name !== undefined) (next as { name?: string }).name = ov.name;
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
