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
];
