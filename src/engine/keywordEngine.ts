import { MatchState, PlayerId } from "./state";

type AnyUnit = any;

function getPlayer(match: MatchState, playerId: PlayerId): any {
  return (match as any).players[playerId];
}

function getEnemyPlayerId(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

function getAllUnitsForPlayer(match: MatchState, playerId: PlayerId): AnyUnit[] {
  const player = getPlayer(match, playerId);
  return [...(player.board.front || []), ...(player.board.back || [])];
}

export function mergeKeywords(existing: string[] = [], incoming: string[] = []): string[] {
  return Array.from(new Set([...(existing || []), ...(incoming || [])]));
}

export function unitHasKeyword(unit: AnyUnit, keyword: string): boolean {
  // A unit has a keyword if it is printed on the card OR currently granted by a
  // continuous keyword aura (auraKeywords, re-derived each recomputeAuras pass).
  if (Array.isArray(unit?.keywords) && unit.keywords.includes(keyword)) return true;
  const ak = unit?.auraKeywords;
  return Array.isArray(ak) && ak.includes(keyword);
}

export function unitCanAttack(unit: AnyUnit): boolean {
  if (!unit) return false;
  if (unit.exhausted) return false;
  if (unit.summoningSick && !unitHasKeyword(unit, "RUSH")) return false;
  return true;
}

export function getUnitByInstanceId(
  match: MatchState,
  playerId: PlayerId,
  instanceId: string
): AnyUnit | null {
  const units = getAllUnitsForPlayer(match, playerId);
  return units.find((u) => u.instanceId === instanceId) || null;
}

export function getAttackableEnemyUnits(
  match: MatchState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string
): AnyUnit[] {
  const defenderPlayerId = getEnemyPlayerId(attackerPlayerId);
  const attacker = getUnitByInstanceId(match, attackerPlayerId, attackerInstanceId);

  if (!attacker) {
    throw new Error(`Attacker not found: ${attackerInstanceId}`);
  }

  const defenderUnits = getAllUnitsForPlayer(match, defenderPlayerId);
  const guardUnits = defenderUnits.filter((u) => unitHasKeyword(u, "GUARD"));

  let candidates = guardUnits.length > 0 ? guardUnits : defenderUnits;

  if (unitHasKeyword(attacker, "FLYING")) {
    return candidates;
  }

  const filtered = candidates.filter((target) => {
    if (unitHasKeyword(target, "FLYING")) {
      return unitHasKeyword(attacker, "RANGED") || unitHasKeyword(attacker, "FLYING");
    }
    return true;
  });

  return filtered;
}

export function canAttackEnemyPlayer(
  match: MatchState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string
): boolean {
  const attacker = getUnitByInstanceId(match, attackerPlayerId, attackerInstanceId);

  if (!attacker) return false;
  if (!unitCanAttack(attacker)) return false;

  const defenderPlayerId = getEnemyPlayerId(attackerPlayerId);
  const defenderUnits = getAllUnitsForPlayer(match, defenderPlayerId);
  const guardUnits = defenderUnits.filter((u) => unitHasKeyword(u, "GUARD"));

  return guardUnits.length === 0;
}

export function applyKeywordHooksOnSummon(unit: AnyUnit): AnyUnit {
  const nextUnit = { ...unit };

  nextUnit.keywords = Array.isArray(nextUnit.keywords) ? [...nextUnit.keywords] : [];

  if (unitHasKeyword(nextUnit, "QUICKSTEP")) {
    nextUnit.speed = (nextUnit.speed || 0) + 1;
  }

  if (unitHasKeyword(nextUnit, "MYTHIC")) {
    nextUnit.attack = (nextUnit.attack || 0) + 1;
    nextUnit.health = (nextUnit.health || 0) + 1;
  }

  if (unitHasKeyword(nextUnit, "COMMAND")) {
    nextUnit.armor = (nextUnit.armor || 0) + 1;
  }

  // ARMORED (canonical "Armored") maps cleanly onto the existing armor stat,
  // mirroring COMMAND. Armor reduces incoming damage in effects.ts.
  if (unitHasKeyword(nextUnit, "ARMORED")) {
    nextUnit.armor = (nextUnit.armor || 0) + 1;
  }

  // NOTE on canonical keywords NOT branched on in this summon hook: many are
  // wired elsewhere in the canonical flow rather than here —
  //   DIVINE_SHIELD / SHIELD / WARD  -> one-shot absorb via initShield + absorbDamage
  //   WINDFURY                       -> bonus swing via consumeWindfuryStrike
  //   DEATHRATTLE / REGROW / EXECUTE / SCRY / LIFESTEAL / STEALTH -> reducer helpers below
  //   FEAR                           -> RESTRICT_ATTACK passive (reducer)
  //   OATH                           -> faction OATH_BONUS payoff layer (factionIdentity)
  //   RELIC / RITUAL                 -> intrinsic summon grant (relicOnSummon / ritualOnSummon, reducer)
  //   PATIENT/DECAY/SUMMON/JUDGMENT/RALLY/MARTYR/BLESS/VOW/MIRE/RECALL
  //                                  -> compiled from each card's ability text (abilityCompiler.ts)
  // All canonical keywords are registered in design/keywordRules.ts. unitHasKeyword
  // returns false for unmatched tags, so unknown keywords never throw.

  return nextUnit;
}

/* ------------------------------------------------------------------ *
 * Live reducer keyword mechanics (DEATHRATTLE / WARD / REGROW /        *
 * EXECUTE / SCRY). These are pure helpers the reducer calls directly   *
 * so the behavior is part of the canonical single-source-of-truth      *
 * flow (the older hooks above are not wired into applyAction).         *
 * ------------------------------------------------------------------ */

/** WARD, DIVINE_SHIELD and the canonical SHIELD keyword all grant a one-shot
 *  damage shield (the first instance of combat damage is fully absorbed, then the
 *  shield clears). SHIELD is the most common shield tag in the live corpus (66
 *  cards) and was previously inert; it now arms the same one-shot absorb. */
const SHIELD_KEYWORDS = ["WARD", "DIVINE_SHIELD", "SHIELD"];

export function unitHasShieldKeyword(unit: AnyUnit): boolean {
  return SHIELD_KEYWORDS.some((k) => unitHasKeyword(unit, k));
}

/** At summon, arm the one-shot shield for shield-keyword units (mutates). */
export function initShield(unit: AnyUnit): void {
  if (unitHasShieldKeyword(unit)) unit.shielded = true;
}

/** ARMORED: gains +1 Armor when it enters play. Armor reduces incoming combat
 *  damage in the mitigation path, so this hardens the unit. Mutates. */
export function armorOnSummon(unit: AnyUnit): void {
  if (unitHasKeyword(unit, "ARMORED")) unit.armor = (unit.armor || 0) + 1;
}

/** RELIC: an enduring artifact-grade unit. It enters play hardened, gaining +1
 *  Armor on summon (mirrors ARMORED/COMMAND — armor reduces incoming combat
 *  damage in the mitigation path). Stacks additively with ARMORED/COMMAND if the
 *  unit carries more than one. Mutates. */
export function relicOnSummon(unit: AnyUnit): void {
  if (unitHasKeyword(unit, "RELIC")) unit.armor = (unit.armor || 0) + 1;
}

/** RITUAL: the unit is consecrated by a summoning rite, entering play with a
 *  ward of +1 max health (and current health) on summon. Distinct from MYTHIC's
 *  +1/+1 — RITUAL hardens survivability only. Mutates. */
export function ritualOnSummon(unit: AnyUnit): void {
  if (unitHasKeyword(unit, "RITUAL")) {
    unit.maxHealth = (unit.maxHealth ?? unit.health ?? 0) + 1;
    unit.health = (unit.health || 0) + 1;
  }
}

/** STEALTH: at summon the unit becomes untargetable by enemy attacks until it
 *  acts. Set the flag here; the reducer clears it when the unit attacks. */
export function initStealth(unit: AnyUnit): void {
  if (unitHasKeyword(unit, "STEALTH")) unit.stealthed = true;
}

export function unitIsStealthed(unit: AnyUnit): boolean {
  return !!unit?.stealthed;
}

/** LIFESTEAL: a unit dealing combat damage heals its controller for the amount
 *  dealt. Returns the heal owed (0 if the dealer lacks the keyword or dealt no
 *  damage); the reducer applies it to the controller's nexus (capped). */
export function lifestealHeal(dealer: AnyUnit, damageDealt: number): number {
  if (!unitHasKeyword(dealer, "LIFESTEAL")) return 0;
  return Math.max(0, damageDealt || 0);
}

/** Absorb the first instance of positive damage with the unit's shield.
 *  Returns the damage that actually lands (0 if absorbed) and clears the
 *  shield as a side effect. Unshielded units pass damage through unchanged. */
export function absorbDamage(unit: AnyUnit, damage: number): number {
  if (damage > 0 && unit?.shielded) {
    unit.shielded = false;
    return 0;
  }
  return damage;
}

/** EXECUTE: an attacker with the keyword finishes a defender that survived the
 *  hit but was left at or below half its max health (the "weak" threshold). */
export function executesTarget(attacker: AnyUnit, defender: AnyUnit): boolean {
  if (!unitHasKeyword(attacker, "EXECUTE")) return false;
  const max = defender?.maxHealth ?? defender?.health ?? 0;
  const hp = defender?.health ?? 0;
  return hp > 0 && hp <= Math.ceil(max / 2);
}

/** REGROW: at the start of its controller's turn a surviving unit regenerates
 *  to full health (heals chip damage between turns; still dies if bursted in a
 *  single turn). Mutates the unit. */
export function regrowAtTurnStart(unit: AnyUnit): void {
  if (unitHasKeyword(unit, "REGROW") && (unit?.health ?? 0) > 0) {
    unit.health = unit.maxHealth ?? unit.health;
  }
}

/** WINDFURY: a unit may attack a second time each turn. The reducer leaves the
 *  attacker un-exhausted on its FIRST swing of the turn (recording the bonus via
 *  `windfuryStruck`) and only exhausts it on the second. `windfuryStruck` is
 *  cleared at the start of the controller's turn alongside `exhausted`.
 *
 *  Returns true if this swing should leave the unit ABLE to attack again (i.e. it
 *  has WINDFURY and has not yet used its bonus this turn); the reducer then sets
 *  the flag instead of exhausting. Mutates `windfuryStruck`. */
export function consumeWindfuryStrike(unit: AnyUnit): boolean {
  if (!unitHasKeyword(unit, "WINDFURY")) return false;
  if (unit.windfuryStruck) return false; // bonus already spent this turn
  unit.windfuryStruck = true;
  return true;
}

/** Fixed nexus burst a DEATHRATTLE unit deals to the enemy when it dies. */
export const DEATHRATTLE_NEXUS_DAMAGE = 2;

export function hasDeathrattle(unit: AnyUnit): boolean {
  return unitHasKeyword(unit, "DEATHRATTLE");
}

/** SCRY: deterministic deck-smoothing performed when a SCRY unit is summoned.
 *  Reorders the top `depth` cards of the deck by ascending cost (cheapest on
 *  top) with a stable id tiebreaker, so the next draws are smoother. Pure: no
 *  RNG, fully reproducible from deck contents alone. */
export function scryDeck(
  deck: string[],
  costOf: (id: string) => number,
  depth = 2
): string[] {
  if (!Array.isArray(deck) || deck.length < 2) return deck;
  const n = Math.min(depth, deck.length);
  const top = deck.slice(0, n).sort((a, b) => {
    const d = costOf(a) - costOf(b);
    return d !== 0 ? d : a < b ? -1 : a > b ? 1 : 0;
  });
  return [...top, ...deck.slice(n)];
}

export function applyCrushOverflow(
  attacker: AnyUnit,
  blocker: AnyUnit,
  defendingPlayerHealth: number
): { blockerHealth: number; defendingPlayerHealth: number } {
  const blockerHealth = (blocker.health || 0) - (attacker.attack || 0);

  if (!unitHasKeyword(attacker, "CRUSH")) {
    return {
      blockerHealth,
      defendingPlayerHealth
    };
  }

  const overflow = Math.max(0, (attacker.attack || 0) - (blocker.health || 0));

  return {
    blockerHealth,
    defendingPlayerHealth: defendingPlayerHealth - overflow
  };
}
