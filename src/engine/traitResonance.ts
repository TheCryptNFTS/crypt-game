/**
 * TRAIT RESONANCE (#1 — the signature hook). The one-line pitch a newcomer can
 * hold in their head: "units that share a Keyword RESONATE — build around a
 * theme and your board strengthens itself." It's the mechanic that turns a pile
 * of owned cards into a deck with emergent synergy, on an axis distinct from the
 * five faction identities (which key off the unit's FACTION, not its keywords).
 *
 * THE RULE (legible on purpose — Billy's #1 ask is "less to understand"):
 *   When you summon a unit that shares at least one Keyword with ANOTHER unit you
 *   already control, the summoned unit enters RESONANT: +1 / +1.
 * Binary, not per-keyword-stacking — one clear trigger, one clear payoff. A turn-2
 * Guard next to a turn-1 Guard is +1/+1; a lone keyword does nothing.
 *
 * WHY KEYWORD (the pivot): the original pitch was COSMETIC-trait resonance
 * (Eye / Armor / Creature). Those traits exist ONLY in curatedCoreSetV2.json's
 * `.all` array — the in-engine catalog (`allPlayableCards.rawTraits`, surfaced as
 * `cardMetaById`) carries GAMEPLAY traits only. Keyword is the most legible axis
 * that is reliably present in BOTH the catalog AND the live `UnitInPlay.keywords`
 * array, so resonance reads straight off the board with no catalog lookup and is
 * exact under replay. Same payoff ("owned cards create synergy"), engine-feasible.
 *
 * DESIGN INVARIANTS (locked — identical to factionIdentity.ts so the two stack
 * cleanly and de-risk the same way):
 *   - NO BURN. The hook only adds +attack / +health to the CONTROLLER's own freshly
 *     summoned unit. It never touches an enemy nexus / commander / face. The proof
 *     asserts the enemy nexus is never lowered.
 *   - ADDITIVE + GATED. Inert unless `state.rules.traitResonance` is true. Absent ->
 *     a clean no-op, so vanilla / golden matches without the flag are byte-identical
 *     (undefined survives structuredClone, mirroring the identity / alt-win pattern).
 *   - DISTINCT AXIS. Faction identities key off the unit's FACTION matching the
 *     controller's; resonance keys off KEYWORD overlap with the live board. They
 *     stack orthogonally (a Stone Guard summoned beside another Guard can take BOTH
 *     the Bedrock +1 Armor AND the resonant +1/+1).
 *   - PURE-IN-PLACE. Mutates the already-cloned state the reducer hands it, exactly
 *     like factionIdentity / commanderPassives.
 *   - SELF-EXCLUDING. The summoned unit is already on its lane when the hook fires,
 *     so the "another unit" search skips its own instanceId — a unit never resonates
 *     with itself, and a first-of-its-keyword summon is correctly inert.
 */

import { MatchState, PlayerId, UnitInPlay } from "./state";

/** Player-facing one-liner for the UI (mechanics-of-record live below). */
export const TRAIT_RESONANCE_TEXT =
  "Resonance — a unit you summon that shares a Keyword with another unit you control enters with +1/+1.";

/** The resonant payoff. Small and symmetric (+1/+1) so the synergy is felt without
 *  swinging a board; one-directional (only the new unit) so it's trivial to read. */
const RESONANCE_ATTACK = 1;
const RESONANCE_HEALTH = 1;

/** True only when a match has explicitly opted into trait resonance. */
function resonanceEnabled(state: MatchState): boolean {
  return state.rules?.traitResonance === true;
}

/** Flat health buff (matches factionIdentity / effectResolver buffUnit: a +health
 *  buff raises both maxHealth and current health). */
function buffHealth(unit: UnitInPlay, health: number): void {
  if (!health) return;
  unit.maxHealth = (unit.maxHealth ?? unit.health) + health;
  unit.health += health;
}

/** Flat attack buff (mirrors factionIdentity / effectResolver buffUnit). */
function buffAttack(unit: UnitInPlay, attack: number): void {
  if (!attack) return;
  unit.attack += attack;
}

/**
 * True when the controller already commands ANOTHER live unit (front or back lane)
 * sharing at least one of `keywords`. Recomputed from the live board every call —
 * no cached counter — so replay/determinism is exact. The summoned unit (already on
 * its lane when this fires) is excluded by instanceId so it can't resonate with
 * itself. Compares PRINTED keywords only (the same normalized uppercase strings on
 * both sides, e.g. "GUARD"/"RUSH"), keeping the read deterministic and lookup-free.
 * Defensive against a missing `board` (some isolated unit-proof states omit it).
 */
function sharesKeywordWithBoard(
  state: MatchState,
  controller: PlayerId,
  unit: UnitInPlay,
): boolean {
  const keywords = unit.keywords;
  if (!Array.isArray(keywords) || keywords.length === 0) return false;
  const board = state.players[controller]?.board;
  if (!board) return false;
  for (const lane of [board.front, board.back]) {
    if (!Array.isArray(lane)) continue;
    for (const other of lane) {
      if (other.instanceId === unit.instanceId) continue;
      if (!Array.isArray(other.keywords)) continue;
      if (other.keywords.some((k) => keywords.includes(k))) return true;
    }
  }
  return false;
}

/**
 * Fires when a unit the controller played resolves onto the board (called from the
 * reducer's PLAY_UNIT summon site, AFTER the unit's own battlecry, the commander
 * summon passive, and the faction identity hook — so resonance stacks on top of all
 * three). Gated by `rules.traitResonance`; a clean no-op otherwise.
 *
 * If the summoned unit shares a Keyword with another unit the controller already
 * commands, it enters RESONANT (+1/+1). No-burn, deterministic, self-excluding.
 */
export function resonanceOnUnitSummon(
  state: MatchState,
  controller: PlayerId,
  unit: UnitInPlay,
): void {
  if (!resonanceEnabled(state)) return;
  if (!sharesKeywordWithBoard(state, controller, unit)) return;
  buffAttack(unit, RESONANCE_ATTACK);
  buffHealth(unit, RESONANCE_HEALTH);
}
