/**
 * Faction identities (#8) — give each of the five curated factions a DISTINCT,
 * mechanically meaningful identity, so deck / faction choice actually matters
 * instead of being a cosmetic color-swap.
 *
 *   STONE  (Keepers)   Bedrock   summoned same-faction units enter with +1 ARMOR
 *   SILVER (Sentinels) Insight   start of your turn: Scry 1 (deterministic smooth)
 *   BRONZE (Guardians) Onslaught summoned same-faction units costing <=2 gain RUSH
 *   IRON   (Defenders) Tempered  each equip ALSO grants the geared unit +1 ARMOR
 *   GOLD   (Sovereigns)Largesse  summoned same-faction units costing >=5 enter +0/+2
 *
 * DESIGN INVARIANTS (locked):
 *   - NO BURN. Nothing here touches an enemy nexus / commander / face. Every hook
 *     only adds armor / health / a RUSH keyword / smooths the controller's OWN
 *     deck. The cross-cutting proof asserts the enemy nexus is never lowered.
 *   - ADDITIVE + GATED. The whole system is inert unless `state.rules.factionIdentities`
 *     is true. Absent (the default) -> every hook is a clean no-op, so vanilla /
 *     golden matches are byte-identical (the flag is undefined and survives
 *     structuredClone, mirroring the alt-win meter / secrets de-risking pattern).
 *   - DISTINCT FROM COMMANDER PASSIVES. A faction identity keys off the unit's OWN
 *     faction matching the controller's faction; commander passives key off keyword
 *     / cost only. They stack cleanly on a different axis (e.g. Stone Warden gives a
 *     Guard +0/+2 HEALTH; STONE faction adds +1 ARMOR — orthogonal durability).
 *   - PURE-IN-PLACE. These mutate the already-cloned state the reducer hands them,
 *     exactly like effectResolver / commanderPassives.
 *
 * A controller whose commander is not one of the five curated commanders (every
 * generated NFT commander, the demo opponent) maps to NO faction -> clean no-op,
 * so identities only ever fire for an intentionally factioned deck.
 */

import { MatchState, PlayerId, UnitInPlay } from "./state";
import { scryDeck } from "./keywordEngine";

/** Canonical faction enum (mirrors design/factionIdentity FactionCode), kept
 *  local so this engine module carries no design-layer dependency. */
export type IdentityFaction =
  | "STONE_KEEPERS"
  | "IRON_DEFENDERS"
  | "BRONZE_GUARDIANS"
  | "SILVER_SENTINELS"
  | "GOLDEN_SOVEREIGNS";

/**
 * The five curated commanders -> their faction. ONLY these ids gain an identity;
 * any other commander id (generated `cmd_6xxx`, demo) returns null and no-ops.
 */
const COMMANDER_FACTION: Record<string, IdentityFaction> = {
  cmd_stone_warden: "STONE_KEEPERS",
  cmd_iron_warlord: "IRON_DEFENDERS",
  cmd_bronze_raider: "BRONZE_GUARDIANS",
  cmd_silver_oracle: "SILVER_SENTINELS",
  cmd_golden_emperor: "GOLDEN_SOVEREIGNS",
};

/** Player-facing one-liners for the UI (mechanics-of-record live below). */
export const FACTION_IDENTITY_TEXT: Record<IdentityFaction, string> = {
  STONE_KEEPERS:
    "Bedrock — units you summon of your faction enter play with +1 Armor.",
  SILVER_SENTINELS:
    "Insight — at the start of your turn, Scry 1 (smooth your top card by cost).",
  BRONZE_GUARDIANS:
    "Onslaught — units you summon of your faction that cost 2 or less gain Rush.",
  IRON_DEFENDERS:
    "Tempered — whenever you equip a unit, it also gains +1 Armor.",
  GOLDEN_SOVEREIGNS:
    "Largesse — units you summon of your faction that cost 5 or more enter with +0/+2.",
};

/** True only when a match has explicitly opted into faction identities. */
function identitiesEnabled(state: MatchState): boolean {
  return state.rules?.factionIdentities === true;
}

function factionOfCommander(state: MatchState, controller: PlayerId): IdentityFaction | null {
  const id = state.players[controller]?.commanderId ?? "";
  return COMMANDER_FACTION[id] ?? null;
}

/** Flat health buff (matches effectResolver / commanderPassives buffUnit: a
 *  +health buff raises both maxHealth and current health). */
function buffHealth(unit: UnitInPlay, health: number): void {
  if (!health) return;
  unit.maxHealth = (unit.maxHealth ?? unit.health) + health;
  unit.health += health;
}

/** Add armor to a live unit (armor mitigates combat damage; never face burn). */
function addArmor(unit: UnitInPlay, amount: number): void {
  if (!amount) return;
  unit.armor = (unit.armor ?? 0) + amount;
}

/** Grant a printed keyword to a live unit (idempotent), mirroring commanderPassives. */
function grantKeyword(unit: UnitInPlay, keyword: string): void {
  if (!Array.isArray(unit.keywords)) unit.keywords = [];
  if (!unit.keywords.includes(keyword)) unit.keywords.push(keyword);
}

/**
 * Fires for the controller's own faction identity when a unit they played resolves
 * onto the board (after the unit's own battlecry AND any commander summon passive,
 * so identities stack on top). `factionOf` is the reducer's catalog lookup
 * (cardId -> faction enum string); `costOf` is the catalog cost lookup. Both are
 * passed in so this module needs no card-catalog import of its own.
 *
 * A summon identity ONLY applies to a unit whose OWN faction matches the
 * controller's faction — off-faction splashes are untouched, which is what makes
 * a mono-faction deck mechanically rewarded.
 */
export function factionOnUnitSummon(
  state: MatchState,
  controller: PlayerId,
  unit: UnitInPlay,
  factionOf: (cardId: string) => string | null | undefined,
  costOf: (cardId: string) => number
): void {
  if (!identitiesEnabled(state)) return;
  const faction = factionOfCommander(state, controller);
  if (!faction) return;
  // Off-faction units gain nothing — identities reward faction commitment.
  if (factionOf(unit.cardId) !== faction) return;

  switch (faction) {
    case "STONE_KEEPERS":
      // Bedrock: the keepers' fortress plan — every body you raise is sturdier.
      addArmor(unit, 1);
      break;
    case "BRONZE_GUARDIANS":
      // Onslaught: your cheapest skirmishers strike the turn they arrive (Rush),
      // pressuring THROUGH COMBAT only — never direct nexus burn.
      if (costOf(unit.cardId) <= 2) grantKeyword(unit, "RUSH");
      break;
    case "GOLDEN_SOVEREIGNS":
      // Largesse: the sovereigns' premium top-end comes down with extra staying
      // power (+0/+2 health — a durability axis, distinct from Opulence's +1/+1).
      if (costOf(unit.cardId) >= 5) buffHealth(unit, 2);
      break;
    default:
      // SILVER / IRON identities trigger on other hooks (turn-start / equip).
      break;
  }
}

/**
 * Fires when the controller equips one of their units. IRON's identity hardens
 * the geared unit (+1 Armor), rewarding the weapon/equipment plan with durability
 * that trades up in combat. No-burn.
 */
export function factionOnEquip(state: MatchState, controller: PlayerId, unit: UnitInPlay): void {
  if (!identitiesEnabled(state)) return;
  if (factionOfCommander(state, controller) === "IRON_DEFENDERS") {
    addArmor(unit, 1);
  }
}

/**
 * Fires at the start of the given player's turn. SILVER's identity smooths the
 * top of their own deck (Scry 1) — pure card-quality, deterministic, NO draw and
 * NO card advantage (mirrors the SCRY keyword exactly). `costOf` is the reducer's
 * catalog cost lookup so the smoothing is identical to SCRY's.
 */
export function factionOnTurnStart(
  state: MatchState,
  playerId: PlayerId,
  costOf: (cardId: string) => number
): void {
  if (!identitiesEnabled(state)) return;
  if (factionOfCommander(state, playerId) === "SILVER_SENTINELS") {
    const player = state.players[playerId];
    if (Array.isArray(player.deck)) player.deck = scryDeck(player.deck, costOf, 1);
  }
}
