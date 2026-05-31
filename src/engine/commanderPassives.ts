/**
 * Commander passives — mechanical identity for the five curated commanders.
 *
 * Previously the curated commanders carried a descriptive `passive` STRING in
 * design/commanderSpecs.ts that nothing ever read, so a commander only shaped a
 * deck's construction rules and had zero in-match effect. This module gives each
 * curated commander ONE clean, deterministic, low-blast-radius passive, hooked at
 * a single point in the reducer:
 *
 *   cmd_stone_warden  (Bulwark)   summoned GUARD units enter with +0/+2  [onUnitSummon]
 *   cmd_iron_warlord  (Warmonger) each equip grants the unit +1 Attack   [onEquip]
 *   cmd_bronze_raider (Raid)      summoning a unit deals 1 to enemy nexus[onUnitSummon]
 *   cmd_silver_oracle (Foresight) start of turn: Scry 2 (smooth top 2)   [onTurnStart]
 *   cmd_golden_emperor(Opulence)  summoned cost-5+ units enter with +1/+1[onUnitSummon]
 *
 * All hooks are PURE-IN-PLACE: they mutate the already-cloned state the reducer
 * hands them (mirroring effectResolver). A commander id with no entry here — every
 * generated `cmd_6xxx` NFT commander, and the demo opponent's commander — is a
 * clean no-op, so passives only ever fire for the five hand-authored commanders.
 */

import { MatchState, PlayerId, UnitInPlay, STARTING_NEXUS_HEALTH } from "./state";
import { allPlayableCards } from "./cards";
import { scryDeck } from "./keywordEngine";

/** Player-facing one-liners, surfaced in the UI and kept in sync with the
 *  mechanical hooks below (commanderSpecs.ts `passive` text mirrors these). */
export const COMMANDER_PASSIVE_TEXT: Record<string, string> = {
  cmd_stone_warden: "Bulwark — units you summon with Guard enter play with +0/+2.",
  cmd_iron_warlord: "Warmonger — whenever you equip a unit, it gains +1 Attack.",
  cmd_bronze_raider: "Raid — whenever you summon a unit, deal 1 damage to the enemy nexus.",
  cmd_silver_oracle: "Foresight — at the start of your turn, Scry 2 (reorder your top 2 cards by cost).",
  cmd_golden_emperor: "Opulence — units you summon that cost 5 or more enter play with +1/+1.",
};

const COST_BY_ID = new Map<string, number>(
  (allPlayableCards as Array<{ id: string; cost?: number }>).map((c) => [c.id, c.cost ?? 0])
);
function cardCost(cardId: string): number {
  return COST_BY_ID.get(cardId) ?? 0;
}

function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

/** Printed OR aura-granted keyword (mirrors keywordEngine.unitHasKeyword without
 *  importing it to keep this module's dependency surface minimal). */
function unitHasKeyword(unit: UnitInPlay, keyword: string): boolean {
  if (Array.isArray(unit.keywords) && unit.keywords.includes(keyword)) return true;
  const ak = unit.auraKeywords;
  return Array.isArray(ak) && ak.includes(keyword);
}

/** Apply a flat stat buff to a live unit (matches effectResolver.buffUnit: a
 *  +health buff raises both maxHealth and current health). */
function buffUnit(unit: UnitInPlay, attack: number, health: number): void {
  unit.attack += attack;
  if (health) {
    unit.maxHealth = (unit.maxHealth ?? unit.health) + health;
    unit.health += health;
  }
}

function commanderIdOf(state: MatchState, controller: PlayerId): string {
  return state.players[controller]?.commanderId ?? "";
}

/**
 * Fires for the controller's own commander when a unit they played resolves onto
 * the board (after the unit's own battlecry). The reducer reaps and re-checks the
 * win after this, so Bronze Raider's nexus pressure can close out a game.
 */
export function commanderOnUnitSummon(state: MatchState, controller: PlayerId, unit: UnitInPlay): void {
  switch (commanderIdOf(state, controller)) {
    case "cmd_stone_warden":
      // Bulwark: reward the fortress plan — summoned Guards are stickier.
      if (unitHasKeyword(unit, "GUARD")) buffUnit(unit, 0, 2);
      break;
    case "cmd_golden_emperor":
      // Opulence: top-end units come down even bigger.
      if (cardCost(unit.cardId) >= 5) buffUnit(unit, 1, 1);
      break;
    case "cmd_bronze_raider": {
      // Raid: every body that hits the board pings the enemy nexus for reach.
      const enemy = opponentOf(controller);
      state.players[enemy].nexusHealth =
        (state.players[enemy].nexusHealth ?? STARTING_NEXUS_HEALTH) - 1;
      break;
    }
    default:
      break;
  }
}

/** Fires when the controller equips one of their units. */
export function commanderOnEquip(state: MatchState, controller: PlayerId, unit: UnitInPlay): void {
  if (commanderIdOf(state, controller) === "cmd_iron_warlord") {
    // Warmonger: gear bites harder.
    buffUnit(unit, 1, 0);
  }
}

/** Fires at the start of the given player's turn (after units refresh, before
 *  they draw). `costOf` is the reducer's catalog cost lookup, reused so the Scry
 *  smoothing is identical to the SCRY keyword's. */
export function commanderOnTurnStart(
  state: MatchState,
  playerId: PlayerId,
  costOf: (cardId: string) => number
): void {
  if (commanderIdOf(state, playerId) === "cmd_silver_oracle") {
    // Foresight: deterministically smooth the top of the deck (cheapest first),
    // exactly like SCRY. Pure, no RNG, no card advantage.
    const player = state.players[playerId];
    if (Array.isArray(player.deck)) player.deck = scryDeck(player.deck, costOf, 2);
  }
}
