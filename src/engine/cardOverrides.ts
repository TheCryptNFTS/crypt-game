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
  tcg_3852: { note: "Inert artifact: spec-less placeholder ability (\"Global effect active while in play.\") compiles to GLOBAL_UNPARSED (engine no-op — no fabricated behavior). NOT disabled: these 71 are the game’s ONLY artifacts and commander specs require minArtifacts>=1, so they stay legal inert deck-fillers." },
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
  tcg_1545: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
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
  tcg_4210: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_426: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
  tcg_4371: { disabled: true, note: "Soft-ban: null/empty ability text — no spec to compile; kept inert per honesty rule." },
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
