import { PlayableCard } from "./cards";
import { normalizeFaction } from "../types/faction";

/**
 * Curated "golden" SPELL fixtures.
 *
 * These are deliberately NOT part of `allPlayableCards`. Keeping them out of the
 * shipped catalog means they never touch deck legality, coreset balance, or the
 * card-count audits — adding a brand-new card category to the live pool is a
 * balance decision that hasn't been made yet. The reducer merges them into its
 * `cardMetaById` lookup so `PLAY_SPELL` can resolve them, and the `dev:spells`
 * proof drives them end-to-end. They also serve as the seed set for real,
 * balance-gated spell content later.
 *
 * Tiers:
 *   - `safe`: pure value (heal an ally, draw, buff an ally). No removal, no face
 *     damage. These mirror the conservative starter templates and are the only
 *     ones suitable to make deck-legal first.
 *   - `restricted`: single-target removal / tempo (deal damage, weaken). Cheap
 *     armor-bypassing removal is the most balance-sensitive effect in the game,
 *     so these stay fixture-only until a matchup-sim balance gate exists.
 */
export type SpellTier = "safe" | "restricted";

export interface SpellCard extends PlayableCard {
  tier: SpellTier;
}

function spell(
  id: string,
  name: string,
  faction: string,
  cost: number,
  ability: string,
  tier: SpellTier
): SpellCard {
  return {
    id,
    name,
    type: "spell",
    faction: normalizeFaction(faction),
    rarity: "COMMON",
    cost,
    stats: { attack: 0, health: 0, speed: 0, armor: 0 },
    keywords: [],
    rawTraits: { Ability: ability },
    effectTags: [],
    sourceCardClass: "spell",
    sourceSubtype: null,
    tier,
  };
}

export const spellCards: SpellCard[] = [
  // --- safe (pure value) ---
  spell("spell_mend", "Mend", "BRONZE_GUARDIANS", 1, "On play: heal 3 health.", "safe"),
  spell("spell_insight", "Insight", "SILVER_SENTINELS", 2, "On play: draw 2 cards.", "safe"),
  spell("spell_embolden", "Embolden", "STONE_KEEPERS", 2, "On play: gain +2/+2.", "safe"),
  // --- restricted (removal / tempo; fixture-only until balance-gated) ---
  spell("spell_strike", "Strike", "IRON_DEFENDERS", 1, "On play: deal 3 damage.", "restricted"),
  spell("spell_sap", "Sap", "GOLDEN_SOVEREIGNS", 1, "On play: enemy loses 2 attack.", "restricted"),
  // Lane sweep (#11): punishes clustering. Hits every enemy unit in the densest
  // enemy lane — an AoE removal class effect, so it stays fixture-only/restricted
  // until a matchup-sim balance gate exists. Never touches the nexus (no-burn).
  spell("spell_lanebreak", "Lanebreak", "IRON_DEFENDERS", 3, "On play: deal 2 damage to every enemy unit in a lane.", "restricted"),
  // --- advanced ops (DESTROY / HEAL_NEXUS / RETURN_TO_HAND) ---
  spell("spell_annihilate", "Annihilate", "GODS", 4, "On play: destroy an enemy unit.", "restricted"),
  spell("spell_recall", "Recall", "SILVER_SENTINELS", 2, "On play: return an enemy unit to its owner's hand.", "restricted"),
  spell("spell_renew", "Renew", "BRONZE_GUARDIANS", 2, "On play: restore 4 to your nexus.", "safe"),
];

/**
 * LIVE spell archetype — the first SPELL cards promoted into the shipped catalog
 * (`allPlayableCards`, via cards.ts). Unlike the fixtures above (held OUT of the
 * catalog), these are merged into `allPlayableCards` so they flow through the
 * exact reducer path real cards use: `cardMetaById` / `costOf` / `cardTypeOf` /
 * `compileAbility`, AURA_SPELL_COST cost-reduction, deck legality, and the
 * behavioral-coverage report. They are deliberately CONSERVATIVE:
 *   - the one damage spell hits an ENEMY UNIT only (never the nexus/face — burn
 *     is a hard-locked constraint), the rest are pure own-value / deck shaping.
 *   - every ability compiles to a recognized EffectSpec (no UNKNOWN ops).
 *
 * They are NOT added to the curated/unit deck builders (those read cardMaster.json
 * and filter to unit/equipment/artifact), so deck legality + count audits are
 * unaffected. Ids are distinct from the fixtures to avoid any cardMetaById clash.
 */
export const liveSpells: SpellCard[] = [
  // value
  spell("spell_bolt", "Signal Bolt", "IRON_DEFENDERS", 3, "On play: deal 4 damage.", "safe"),
  spell("spell_mendwave", "Mend Wave", "BRONZE_GUARDIANS", 2, "On play: heal 4 health.", "safe"),
  spell("spell_foresight", "Foresight", "SILVER_SENTINELS", 2, "On play: draw 2 cards.", "safe"),
  spell("spell_rally_cry", "Rally Cry", "STONE_KEEPERS", 2, "On play: gain +2/+2.", "safe"),
  // deck manipulation (own deck; deterministic)
  spell("spell_seek", "Seek", "SILVER_SENTINELS", 2, "On play: search your deck for the lowest-cost unit.", "safe"),
  spell("spell_reclaim", "Reclaim", "BRONZE_GUARDIANS", 3, "On play: resurrect a friendly unit from your graveyard to play.", "safe"),
  // --- DISCOVER (mid-resolution player CHOICE; pause/resume via pendingChoice) ---
  // Each generates K seeded options from the controller's OWN deck (filtered by
  // the requested type), PAUSES via state.pendingChoice, and on RESOLVE_CHOICE
  // moves the single picked card deck->hand. Pure value / card-advantage: NO face
  // or nexus burn, no runtime stat buff. Option generation is deterministic
  // (seeded rngCursor stream, same seededDistinctPick the DISCOVER op already uses),
  // and an empty pool is a clean no-op (never opens an unresolvable pause). The
  // ability text matches the honest DISCOVER_RE / parseDiscover verb so each
  // compiles to a single DISCOVER spec — the FIRST shipped cards to do so.
  spell("spell_scout", "Scout", "SILVER_SENTINELS", 2, "On play: discover a unit.", "safe"),
  spell("spell_archive", "Archive", "SILVER_SENTINELS", 2, "On play: discover a spell.", "safe"),
  spell("spell_salvage", "Salvage", "BRONZE_GUARDIANS", 1, "On play: discover a card.", "safe"),
  spell("spell_grand_survey", "Grand Survey", "STONE_KEEPERS", 3, "On play: discover one of 4 units.", "safe"),

  // ==========================================================================
  // CONTENT EXPANSION (2026.05.31) — roughly doubles the deck-legal spell pool
  // with VARIED archetypes, all on the EXISTING resolver vocabulary. Every entry
  // obeys the locked constraints:
  //   - NO-BURN: no direct damage to an enemy nexus/face. Damage spells hit enemy
  //     UNITS only; nexus heals only ever restore the CASTER's own nexus.
  //   - "+X/+Y" buff lines are runtime BUFF effects (compiled BUFF_SELF on a
  //     chosen ally / the caster's source), never a static stat line.
  // Tiering mirrors the existing pool: pure own-value / deck-shaping = "safe"
  // (auto-draftable by buildCuratedDeck); single-target removal / bounce /
  // board-wide enemy-unit AoE = "restricted" (engine-legal + deck-legal via
  // allPlayableCards, but never AUTO-drafted until a matchup-sim balance gate
  // exists — same policy as spell_strike / spell_annihilate).
  // ==========================================================================

  // --- safe: pure value / tempo (own board, own deck, own nexus) ---
  spell("spell_meditate", "Meditate", "SILVER_SENTINELS", 3, "On play: draw 3 cards.", "safe"),
  spell("spell_fortify", "Fortify", "BRONZE_GUARDIANS", 3, "On play: heal 5 health.", "safe"),
  spell("spell_swell", "Swell", "STONE_KEEPERS", 3, "On play: gain +3/+3.", "safe"),
  spell("spell_warhorn", "War Horn", "STONE_KEEPERS", 2, "On play: gain +1/+2.", "safe"),
  spell("spell_bulwark", "Bulwark", "BRONZE_GUARDIANS", 2, "On play: restore 3 to your nexus.", "safe"),
  // graveyard value (own grave): reclaim a card OR re-deploy a body.
  spell("spell_exhume", "Exhume", "BRONZE_GUARDIANS", 2, "On play: recover a friendly unit from your graveyard to your hand.", "safe"),
  spell("spell_revenant_call", "Revenant Call", "BRONZE_GUARDIANS", 4, "On play: resurrect a friendly unit from your graveyard to play.", "safe"),
  // SEEDED-RANDOM graveyard re-deploy (the new RESURRECT_RANDOM op as content):
  // honest "random" — pick is drawn from the match's seeded stream, replay-stable.
  spell("spell_necrocall", "Necrocall", "BRONZE_GUARDIANS", 3, "On play: resurrect a random friendly unit from your graveyard to play.", "safe"),
  // tokens (own board presence)
  spell("spell_reinforce", "Reinforce", "IRON_DEFENDERS", 2, "On play: summon a 2/2 Wraith.", "safe"),
  spell("spell_twin_rites", "Twin Rites", "IRON_DEFENDERS", 3, "On play: summon two 1/1 Wraiths.", "safe"),
  // deck-shaping (own deck; deterministic)
  spell("spell_divine", "Divine", "SILVER_SENTINELS", 2, "On play: search your deck for the lowest-cost spell.", "safe"),

  // --- restricted: removal / tempo (enemy UNITS only; never the nexus) ---
  spell("spell_cull", "Cull", "GODS", 4, "On play: destroy an enemy unit.", "restricted"),
  spell("spell_scour", "Scour", "GOLDEN_SOVEREIGNS", 2, "On play: an enemy loses 3 attack.", "restricted"),
  spell("spell_banish", "Banish", "SILVER_SENTINELS", 3, "On play: return an enemy unit to its owner's hand.", "restricted"),

  // ==========================================================================
  // CONTENT EXPANSION WAVE 2 (2026.05.31) — roughly DOUBLES the deck-legal pool
  // AGAIN (24 -> 46) toward Hearthstone/LoR depth, with clear ARCHETYPES, all on
  // the EXISTING resolver vocabulary (no new ops). Same locked constraints:
  //   - NO-BURN: damage spells hit enemy UNITS only; every nexus op is HEAL_NEXUS
  //     on the CASTER's OWN face. No spell can lower an enemy nexus.
  //   - Determinism: graveyard/random ops ride the match's seeded stream; deck
  //     ops are deterministic; nothing reads wall-clock or unseeded RNG.
  //   - "+X/+Y" lines compile to runtime BUFF effects, never a static stat line.
  // Tiering mirrors the pool: pure own-value / deck-shaping / go-wide own-buff =
  // "safe" (auto-draftable); single-target removal, board-wide enemy AoE, bounce,
  // hard destroy, and stat-swap tech = "restricted" (deck-legal but never
  // auto-drafted until a matchup-sim balance gate exists).
  //
  // RESOLVER NOTE (verified against reducer PLAY_SPELL + effectResolver):
  //   - BUFF_ALLIES / DEBUFF_ALL_ENEMIES / DAMAGE_LANE / SWAP_STATS_ALL_ENEMIES /
  //     DESTROY_ENEMY_SELECT(HIGHEST_COST) / all graveyard + deck ops resolve
  //     source-free off the CONTROLLER, so they cast WITHOUT a target.
  //   - DEAL_DAMAGE / DEBUFF_ENEMY / DESTROY_UNIT / RETURN_TO_HAND require an
  //     enemy target; HEAL / BUFF_SELF require an ally target (reducer ENEMY_OPS /
  //     ALLY_OPS gate). Worded accordingly so each is honestly castable.
  // ==========================================================================

  // --- ARCHETYPE: card-draw / dig (safe; own deck only) ---
  spell("spell_epiphany", "Epiphany", "SILVER_SENTINELS", 4, "On play: draw 4 cards.", "safe"),
  // filtered dig — pull only the card TYPE you need from the top of your deck.
  spell("spell_muster_call", "Muster Call", "STONE_KEEPERS", 3, "On play: draw 2 units.", "safe"),
  spell("spell_grimoire", "Grimoire", "SILVER_SENTINELS", 3, "On play: draw 2 spells.", "safe"),
  // scry/smooth (card quality, NO advantage) + mill (own-deck graveyard fuel).
  spell("spell_farsight", "Farsight", "SILVER_SENTINELS", 1, "On play: scry 2.", "safe"),
  spell("spell_grave_dig", "Grave Dig", "BRONZE_GUARDIANS", 1, "On play: mill 2.", "safe"),

  // --- ARCHETYPE: tutor / toolbox (safe; deterministic own-deck search) ---
  spell("spell_call_arms", "Call to Arms", "STONE_KEEPERS", 2, "On play: search your deck for the highest-cost unit.", "safe"),
  spell("spell_spellseek", "Spellseek", "SILVER_SENTINELS", 1, "On play: search your deck for the lowest-cost spell.", "safe"),

  // --- ARCHETYPE: discover / toolbox value (safe; pausing CHOICE) ---
  spell("spell_requisition", "Requisition", "STONE_KEEPERS", 2, "On play: discover one of 4 cards.", "safe"),

  // --- ARCHETYPE: go-wide / board buff (safe; BUFF_ALLIES on YOUR board) ---
  // Leading "Bless" keyword compiles to BUFF_ALLIES — buffs every OTHER allied
  // unit (the caster has no source body), the canonical anthem payoff. NOTE: the
  // bless parser reads the "+N attack [and] +M health" WORD form (not "+N/+M"
  // shorthand), so the text is written that way to print exactly what it does.
  spell("spell_war_banner", "War Banner", "STONE_KEEPERS", 3, "Bless: allies gain +1 attack and +1 health.", "safe"),
  spell("spell_battle_anthem", "Battle Anthem", "BRONZE_GUARDIANS", 4, "Bless: allies gain +2 attack and +1 health.", "safe"),
  spell("spell_iron_drill", "Iron Drill", "IRON_DEFENDERS", 3, "Bless: allies gain +1 attack and +2 health.", "safe"),

  // --- ARCHETYPE: tempo / single-ally pump (safe; BUFF_SELF on chosen ally) ---
  spell("spell_temper", "Temper", "IRON_DEFENDERS", 1, "On play: gain +2/+1.", "safe"),

  // --- ARCHETYPE: token / go-wide bodies (safe; SUMMON_TOKEN on YOUR board) ---
  spell("spell_levy", "Levy", "STONE_KEEPERS", 3, "On play: summon two 2/2 Wraiths.", "safe"),

  // --- ARCHETYPE: graveyard / recursion (safe; own grave, controller-based) ---
  // RETURN_FROM_GRAVE pulls a fallen card back to HAND (regrow value); the
  // RESURRECT family re-deploys a BODY straight to the board (LIFO or seeded
  // random). All no-op cleanly on an empty grave.
  // "When summoned," (not "On play:") so ONLY RETURN_FROM_GRAVE (graveyard->hand,
  // controller-based, no target) fires; "On play: ... to your hand" would also emit
  // a target-required RETURN_TO_HAND (enemy bounce) and mis-bind the spell.
  spell("spell_regrow", "Regrow", "BRONZE_GUARDIANS", 1, "When summoned, return a card from your graveyard to your hand.", "safe"),
  spell("spell_mass_raise", "Mass Raise", "BRONZE_GUARDIANS", 5, "On play: resurrect a random friendly unit from your graveyard to play.", "safe"),

  // --- ARCHETYPE: board-wide control (restricted; enemy UNITS only) ---
  // DEBUFF_ALL_ENEMIES: -N attack to EVERY enemy unit, THIS TURN ONLY (temp,
  // restored at turn end) — a defensive blunting sweep, never the nexus.
  spell("spell_intimidate", "Intimidate", "GOLDEN_SOVEREIGNS", 2, "On play: enemy units -1 attack this turn.", "restricted"),
  // NOTE: a board-wide DAMAGE op (DAMAGE_LANE) is intentionally NOT shipped as a
  // live spell. DAMAGE_LANE resolves correctly in effectResolver, but the
  // behavioral-coverage honesty audit's ACTIVE_OPS allow-list (owned by another
  // module) does not yet recognize it, so a live DAMAGE_LANE spell would register
  // as a text/behavior mismatch. Board-wide CONTROL is instead covered by the
  // recognized DEBUFF_ALL_ENEMIES (spell_intimidate) and SWAP_STATS_ALL_ENEMIES
  // (spell_upheaval) ops below; single-target burst stays on DEAL_DAMAGE
  // (spell_smite). [Reported to the resolver-owning agent for an allow-list add.]
  // SWAP_STATS_ALL_ENEMIES: flip attack<->health on every enemy unit — a tech
  // answer to wide glass-cannon boards (controller-based, source-free).
  spell("spell_upheaval", "Upheaval", "GODS", 4, "On play: swap attack and health of all enemy units.", "restricted"),

  // --- ARCHETYPE: premium removal (restricted; single enemy unit) ---
  spell("spell_smite", "Smite", "IRON_DEFENDERS", 2, "On play: deal 5 damage.", "restricted"),
  // "When summoned," (not "On play:") so ONLY the DESTROY_ENEMY_SELECT(HIGHEST_COST)
  // auto-pick fires; "On play: destroy ..." would also emit a target-required
  // DESTROY_UNIT, double-binding the removal. This auto-selects (no manual target).
  spell("spell_execute", "Execute", "GODS", 3, "When summoned, destroy the highest-cost enemy unit.", "restricted"),
  spell("spell_disarm", "Disarm", "GOLDEN_SOVEREIGNS", 1, "On play: an enemy loses 2 attack.", "restricted"),

  // ==========================================================================
  // FACTION-EXCLUSIVE PAYOFF SPELLS (2026.05.31) — "Oath" cards that reward
  // MONO-FACTION commitment. Each is a faction anthem whose CARD itself is fair
  // value (so it stays deck-legal + honest), and whose printed faction makes it a
  // natural fit only for a deck already committed to that faction. The DEEPER
  // archetype payoff (the "if you control N+ of your faction" snowball) lives in
  // factionIdentity.ts behind rules.factionIdentities; these spells are the
  // castable, always-honest face of that identity. NO-BURN, deterministic.
  //
  // Honesty: each compiles to exactly the active op its text claims —
  //   Oath of Stone   -> Bless / BUFF_ALLIES (rally the Keepers' wall)
  //   Oath of Bronze  -> RESURRECT (the Guardians' grave never stays quiet)
  //   Oath of Silver  -> DRAW (the Sentinels' insight engine)
  //   Oath of Iron    -> SUMMON_TOKEN (the Defenders field another body)
  //   Oath of Gold    -> HEAL_NEXUS (the Sovereigns' treasury shores the throne)
  // ==========================================================================
  spell("spell_oath_stone", "Oath of Stone", "STONE_KEEPERS", 4, "Bless: allies gain +2 attack and +2 health.", "safe"),
  spell("spell_oath_bronze", "Oath of Bronze", "BRONZE_GUARDIANS", 4, "On play: resurrect a friendly unit from your graveyard to play.", "safe"),
  spell("spell_oath_silver", "Oath of Silver", "SILVER_SENTINELS", 3, "On play: draw 3 cards.", "safe"),
  spell("spell_oath_iron", "Oath of Iron", "IRON_DEFENDERS", 3, "On play: summon a 3/3 Wraith.", "safe"),
  spell("spell_oath_gold", "Oath of Gold", "GOLDEN_SOVEREIGNS", 3, "On play: restore 6 to your nexus.", "safe"),

  // ==========================================================================
  // PER-FACTION SPELL SUITE (2026.06.01) — give EVERY faction a complete kit
  // across the four pillars (removal, draw, tempo, combat trick) and a sensible
  // cost curve, so a mono-faction deck has real spell CHOICES at each point of
  // the game (not just whatever archetype happened to be over-represented). All
  // entries reuse the EXISTING resolver vocabulary (no new ops) and obey the
  // locked constraints: NO-BURN (damage hits enemy UNITS only; nexus heals are the
  // caster's OWN face), determinism, and "+X/+Y" lines compile to runtime BUFF.
  //
  // TIERING (mirrors the pool): pure own value / draw / tempo / single-ally trick
  // = "safe" (auto-draftable into live decks); single-target removal / debuff /
  // bounce = "restricted" (deck-legal but never auto-drafted until a matchup-sim
  // balance gate exists). A "combat trick" is a cheap own-board pump (BUFF_SELF on
  // a chosen ally) or an enemy attack-shave — the instant-speed tempo lever.
  //
  // COVERAGE FILLED (per the pre-suite audit):
  //   STONE_KEEPERS    + draw, + combat trick, + curve-topping anthem, + removal
  //   IRON_DEFENDERS   + draw, + combat trick, + a 4-5 top-end body/sweep
  //   BRONZE_GUARDIANS + removal, + combat trick, + a real draw spell
  //   SILVER_SENTINELS + combat trick, + tempo bounce, + a finisher-tier draw
  //   GOLDEN_SOVEREIGNS+ draw, + tempo token, + combat trick, + a heal/value line
  //   GODS             + draw, + a heal line, + tempo token, + combat trick
  // ==========================================================================

  // --- STONE KEEPERS: the wall that also thinks (draw + trick + top-end) ---
  spell("spell_stone_study", "Quarry Study", "STONE_KEEPERS", 2, "On play: draw 2 cards.", "safe"),
  spell("spell_stone_brace", "Brace", "STONE_KEEPERS", 1, "On play: gain +1/+3.", "safe"),
  spell("spell_stone_resolve", "Stoneblood Resolve", "STONE_KEEPERS", 5, "Bless: allies gain +2 attack and +3 health.", "safe"),
  spell("spell_stone_grind", "Grind Down", "STONE_KEEPERS", 2, "On play: an enemy loses 2 attack.", "restricted"),

  // --- IRON DEFENDERS: the line holds, then advances (draw + trick + top) ---
  spell("spell_iron_recon", "Recon Sweep", "IRON_DEFENDERS", 3, "On play: draw 2 cards.", "safe"),
  spell("spell_iron_brace", "Set Shields", "IRON_DEFENDERS", 1, "On play: gain +1/+2.", "safe"),
  spell("spell_iron_muster", "Muster the Wall", "IRON_DEFENDERS", 5, "On play: summon two 2/2 Wraiths.", "safe"),
  spell("spell_iron_volley", "Volley", "IRON_DEFENDERS", 4, "On play: deal 6 damage.", "restricted"),

  // --- BRONZE GUARDIANS: aggro that finally has answers (removal + draw + trick) ---
  spell("spell_bronze_draw", "Plunder", "BRONZE_GUARDIANS", 2, "On play: draw 2 cards.", "safe"),
  spell("spell_bronze_rage", "Bloodrage", "BRONZE_GUARDIANS", 1, "On play: gain +2/+1.", "safe"),
  spell("spell_bronze_cutdown", "Cut Down", "BRONZE_GUARDIANS", 3, "On play: deal 4 damage.", "restricted"),
  spell("spell_bronze_finish", "Finisher", "BRONZE_GUARDIANS", 4, "On play: destroy an enemy unit.", "restricted"),

  // --- SILVER SENTINELS: vigilance + a tempo hand (trick + bounce + finisher draw) ---
  spell("spell_silver_ploy", "Vanishing Ploy", "SILVER_SENTINELS", 1, "On play: gain +1/+1.", "safe"),
  spell("spell_silver_overdraw", "Grand Vision", "SILVER_SENTINELS", 5, "On play: draw 4 cards.", "safe"),
  spell("spell_silver_displace", "Displace", "SILVER_SENTINELS", 2, "On play: return an enemy unit to its owner's hand.", "restricted"),
  spell("spell_silver_blind", "Blinding Watch", "SILVER_SENTINELS", 2, "On play: an enemy loses 3 attack.", "restricted"),

  // --- GOLDEN SOVEREIGNS: the throne with a real economy (draw + token + trick) ---
  spell("spell_gold_levy", "Royal Levy", "GOLDEN_SOVEREIGNS", 2, "On play: draw 2 cards.", "safe"),
  spell("spell_gold_retinue", "Gilded Retinue", "GOLDEN_SOVEREIGNS", 3, "On play: summon two 2/2 Wraiths.", "safe"),
  spell("spell_gold_decree", "Regal Decree", "GOLDEN_SOVEREIGNS", 1, "On play: gain +2/+2.", "safe"),
  spell("spell_gold_treasury", "Treasury", "GOLDEN_SOVEREIGNS", 2, "On play: restore 5 to your nexus.", "safe"),
  spell("spell_gold_dethrone", "Dethrone", "GOLDEN_SOVEREIGNS", 4, "On play: destroy an enemy unit.", "restricted"),

  // --- GODS: divine kit beyond pure removal (draw + heal + token + trick) ---
  spell("spell_god_revelation", "Revelation", "GODS", 3, "On play: draw 3 cards.", "safe"),
  spell("spell_god_blessing", "Blessing", "GODS", 2, "On play: heal 5 health.", "safe"),
  spell("spell_god_herald", "Herald", "GODS", 3, "On play: summon a 3/3 Wraith.", "safe"),
  spell("spell_god_smite", "Divine Smite", "GODS", 2, "On play: gain +3/+1.", "safe"),
];
