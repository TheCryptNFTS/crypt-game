/**
 * Faction identities (#8) — give each of the five curated factions a DISTINCT,
 * mechanically meaningful identity, so deck / faction choice actually matters
 * instead of being a cosmetic color-swap.
 *
 *   STONE  (Keepers)   Bedrock   summoned same-faction units enter with +1 ARMOR
 *   SILVER (Sentinels) Insight   summoned same-faction units costing <=2 enter +1 ATK
 *   BRONZE (Guardians) Onslaught summoned same-faction units costing <=2 gain RUSH
 *   IRON   (Defenders) Tempered  each equip ALSO grants the geared unit +1 ATK / +1 ARMOR
 *   GOLD   (Sovereigns)Largesse  summoned same-faction units costing >=5 enter +0/+1
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
 *
 * ARCHETYPE DEPTH (#8b) — on top of the single-trigger base identities above, each
 * faction earns a THRESHOLD payoff once the controller commands N+ of their OWN
 * faction's live units on board. This is what turns a color-swap into a real
 * archetype: a mono-faction commitment snowballs into a stronger identity.
 *
 *   STONE  3+ Stone units  -> Bedrock armor on summon deepens to +2 (a thicker wall)
 *   SILVER 3+ Silver units -> Insight +1 ATK band widens to cost<=3 (sharper tempo)
 *   BRONZE 3+ Bronze units -> Onslaught Rush extends to cost<=3 (aggro snowball)
 *   IRON   3+ Iron units   -> equips grant a SECOND +1 Attack on top of the baseline +1 ATK/+1 Armor
 *   GOLD   4+ Gold units   -> Largesse cost>=5 bonus deepens to +0/+2 (top-end payoff)
 *
 * The thresholds are RECOMPUTED from the live board at every trigger moment (never a
 * cached counter that could desync replay), ride a SECOND `rules.factionArchetypes`
 * gate ON TOP of `factionIdentities` (so the shipped CORE ruleset plays FLAT — base
 * identities only — and vanilla stays byte-identical), and remain NO-BURN:
 * every payoff only adds armor / attack / health / a keyword / deck smoothing to the
 * controller's OWN side, never touching the enemy nexus.
 */

import { MatchState, PlayerId, UnitInPlay } from "./state";

/** Canonical faction enum (mirrors design/factionIdentity FactionCode), kept
 *  local so this engine module carries no design-layer dependency.
 *
 *  GODS (#4) are DELIBERATELY absent from this enum: the 8 god units are
 *  "vanilla bombs" BY DESIGN — premium, oversized, keyword-light top-end whose
 *  whole identity is raw stats on a body, and who never enter the 5-mortal-faction
 *  curated matchup sim (they are not draftable into a faction deck). Giving them a
 *  passive summon/turn/equip hook would (a) add a sixth identity axis to a system
 *  Billy wants kept legible, and (b) compound onto statlines that are already the
 *  set's strongest. So Gods intentionally have NO faction identity — their power
 *  budget is the statline itself. This is a documented choice, not an oversight. */
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

/**
 * Archetype thresholds: how many live OWN-faction units the controller must command
 * for the deepened payoff to activate. STONE/SILVER/BRONZE/IRON snowball at 3; GOLD
 * (a premium top-end deck that fields fewer, bigger bodies) at 4.
 */
const ARCHETYPE_THRESHOLD: Record<IdentityFaction, number> = {
  STONE_KEEPERS: 3,
  SILVER_SENTINELS: 3,
  BRONZE_GUARDIANS: 3,
  IRON_DEFENDERS: 3,
  GOLDEN_SOVEREIGNS: 4,
};

/** Player-facing one-liners for the UI (mechanics-of-record live below). */
export const FACTION_IDENTITY_TEXT: Record<IdentityFaction, string> = {
  STONE_KEEPERS:
    "Bedrock — units you summon of your faction enter play with +1 Armor.",
  SILVER_SENTINELS:
    "Insight — units you summon of your faction that cost 2 or less enter with +1 Attack.",
  BRONZE_GUARDIANS:
    "Onslaught — units you summon of your faction that cost 2 or less gain Rush.",
  IRON_DEFENDERS:
    "Tempered — whenever you equip a unit, it also gains +1 Attack and +1 Armor.",
  GOLDEN_SOVEREIGNS:
    "Largesse — units you summon of your faction that cost 5 or more enter with +0/+1.",
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

/** Add attack to a live unit (mirrors effectResolver / commanderPassives buffUnit:
 *  a flat +attack with no health side effect). */
function buffAttack(unit: UnitInPlay, attack: number): void {
  if (!attack) return;
  unit.attack += attack;
}

/**
 * Count the controller's LIVE units (front + back lanes) whose OWN faction matches
 * `faction`. Recomputed from the board at the call site EVERY trigger — no cached
 * counter — so replay/determinism is exact. Defensive against a missing `board`
 * (some isolated unit-proof states omit it): a board-less state counts as 0, which
 * keeps the deepened payoff off and the base identity intact.
 */
function countFactionUnits(
  state: MatchState,
  controller: PlayerId,
  faction: IdentityFaction,
  factionOf: (cardId: string) => string | null | undefined
): number {
  const board = state.players[controller]?.board;
  if (!board) return 0;
  let n = 0;
  for (const lane of [board.front, board.back]) {
    if (!Array.isArray(lane)) continue;
    for (const u of lane) {
      if (factionOf(u.cardId) === faction) n += 1;
    }
  }
  return n;
}

/** True only when a match has explicitly opted into the deepened archetype layer.
 *  The shipped CORE ruleset leaves this OFF, so identities play FLAT (base only). */
function archetypesEnabled(state: MatchState): boolean {
  return state.rules?.factionArchetypes === true;
}

/** True when the deep archetype layer is enabled AND the controller commands enough
 *  OWN-faction units for the deepened payoff to fire (live board count >= the
 *  faction's threshold). With `factionArchetypes` absent (CORE default) this is
 *  always false, so every deepened branch falls back to the flat base identity. */
function archetypeActive(
  state: MatchState,
  controller: PlayerId,
  faction: IdentityFaction,
  factionOf: (cardId: string) => string | null | undefined
): boolean {
  if (!archetypesEnabled(state)) return false;
  return countFactionUnits(state, controller, faction, factionOf) >= ARCHETYPE_THRESHOLD[faction];
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
    case "STONE_KEEPERS": {
      // Bedrock: the keepers' fortress plan — every body you raise is sturdier.
      // Archetype (3+ Stone live): the wall thickens to +2 Armor per summon.
      const deep = archetypeActive(state, controller, faction, factionOf);
      addArmor(unit, deep ? 2 : 1);
      break;
    }
    case "SILVER_SENTINELS": {
      // Insight: the sentinels read the fight a beat ahead — their cheap tempo
      // bodies hit harder (+1 Attack) the turn they arrive, a board-relevant edge
      // in a combat race (the old "Scry 1" was pure card-selection with ZERO board
      // impact, so Silver brought nothing to the fight). Pressure is THROUGH COMBAT
      // only — never direct nexus burn. Archetype (3+ Silver live): the +1 Attack
      // band widens to cost<=3 as the tempo plan snowballs.
      const deep = archetypeActive(state, controller, faction, factionOf);
      const atkCap = deep ? 3 : 2;
      if (costOf(unit.cardId) <= atkCap) buffAttack(unit, 1);
      break;
    }
    case "BRONZE_GUARDIANS": {
      // Onslaught: your cheapest skirmishers strike the turn they arrive (Rush),
      // pressuring THROUGH COMBAT only — never direct nexus burn. Archetype (3+
      // Bronze live): the Rush band widens to cost<=3 as the swarm snowballs.
      const deep = archetypeActive(state, controller, faction, factionOf);
      const rushCap = deep ? 3 : 2;
      if (costOf(unit.cardId) <= rushCap) {
        grantKeyword(unit, "RUSH");
        // Runtime-granted RUSH must also clear summoning sickness — the flag was
        // already seeded `true` at setup.ts (printed-keyword check) before this
        // identity hook ran, so without this the unit has the RUSH keyword but
        // still can't swing the turn it lands. Mirrors setup.ts:367 for printed RUSH.
        unit.summoningSick = false;
      }
      break;
    }
    case "GOLDEN_SOVEREIGNS": {
      // Largesse: the sovereigns' premium top-end comes down with extra staying
      // power (a durability axis, distinct from Opulence's +1/+1).
      // GOLD SHAVE (2026.06.06 faction-compression pass): GOLD sits at the TOP of the
      // matchup-sim ladder (~66% asA vs IRON's ~53%). A SELECTION-side shave (a GOLD
      // draft ceiling) was tried and rejected — it backfired and cratered GOLD (see
      // buildCuratedCoreSetV2.cjs). So GOLD is shaved on the IDENTITY axis instead,
      // symmetric with the IRON identity BUFF: Largesse's premium payoff is trimmed
      // from +0/+2 to +0/+1 (baseline) and from +1/+3 to +0/+2 (archetype) — Gold's
      // top-end still enters sturdier, just less oppressively so. NO-BURN unchanged.
      if (costOf(unit.cardId) >= 5) {
        const deep = archetypeActive(state, controller, faction, factionOf);
        if (deep) {
          buffHealth(unit, 2);
        } else {
          buffHealth(unit, 1);
        }
      }
      break;
    }
    default:
      // IRON's identity triggers on the equip hook (factionOnEquip), not on summon.
      break;
  }
}

/**
 * Fires when the controller equips one of their units. IRON's identity hardens
 * the geared unit (+1 Armor), rewarding the weapon/equipment plan with durability
 * that trades up in combat. No-burn.
 *
 * Archetype (3+ Iron live units): gear ALSO scales the unit's attack (+1/+0 on top
 * of the +1 Armor) — the defenders' arsenal starts paying offence as well as
 * durability. `factionOf` is passed in to recompute the live Iron count.
 */
export function factionOnEquip(
  state: MatchState,
  controller: PlayerId,
  unit: UnitInPlay,
  factionOf?: (cardId: string) => string | null | undefined
): void {
  if (!identitiesEnabled(state)) return;
  if (factionOfCommander(state, controller) === "IRON_DEFENDERS") {
    // IRON BUFF (2026.06.06 faction-compression pass): Iron sat at the BOTTOM of the
    // faction ladder (lose/coinflip every matchup). Its Tempered identity used to be
    // pure durability (+1 Armor) at baseline, with the +1 Attack gated behind the 3+
    // Iron archetype threshold — so a fair-but-passive deck brought nothing to the
    // combat race until it had snowballed. Promote the +1 Attack to BASELINE: every
    // equip now hardens AND sharpens the geared unit (+1/+0/+1-armor), giving Iron a
    // real combat identity from the first weapon. Still NO-BURN (own-side stats only).
    addArmor(unit, 1);
    buffAttack(unit, 1);
    // The 3+ Iron archetype payoff stacks a SECOND +1 Attack on top — the arsenal
    // pays off harder once the defenders' line is fully manned.
    if (factionOf && archetypeActive(state, controller, "IRON_DEFENDERS", factionOf)) {
      buffAttack(unit, 1);
    }
  }
}

/**
 * Fires at the start of the given player's turn. NO faction identity currently keys
 * off turn-start: SILVER's Insight moved from a board-irrelevant "Scry 1" (pure
 * deck-smoothing that brought nothing to a combat race) to a tempo board edge on the
 * SUMMON hook (cheap Silver bodies enter with +1 Attack). This hook is retained as a
 * documented, intentional no-op so the reducer's existing call site stays valid and
 * a future turn-start identity has a wired seam — exactly like the other hooks, it is
 * inert unless `rules.factionIdentities` is set. `costOf` / `factionOf` are kept in
 * the signature so the reducer call site and any future turn-start payoff need no
 * re-plumbing. NO-BURN by construction (it does nothing).
 */
export function factionOnTurnStart(
  state: MatchState,
  playerId: PlayerId,
  costOf: (cardId: string) => number,
  factionOf?: (cardId: string) => string | null | undefined
): void {
  if (!identitiesEnabled(state)) return;
  void costOf;
  void factionOf;
  // Intentionally empty: no faction's identity triggers at turn-start under the
  // current ruleset (Silver's Insight is a summon-time +1 Attack, see
  // factionOnUnitSummon). Left as a wired, inert seam.
}

/**
 * FACTION-EXCLUSIVE "OATH" PAYOFF LAYER (#8c) — the read-model that turns the five
 * deck-legal "Oath of <Metal>" spells (spellCards.ts) into a true mono-faction
 * REWARD. Each Oath spell is fair, honest value on its own (a Bless / Resurrect /
 * Draw / Summon / Nexus-heal that compiles exactly as printed). This layer reports
 * the EXTRA, threshold-gated payoff a player has EARNED by committing to that
 * faction — "Oath of Stone: if you control 4+ Stone, your anthem rings louder".
 *
 * This is a PURE QUERY (no state mutation, no reducer call site added): it answers
 * "is this controller's Oath payoff online right now?" so the UI / a future buff
 * hook can read it. It deliberately rides the SAME invariants as the rest of this
 * module:
 *   - GATED: returns an inert (active:false, bonus 0/0) result unless
 *     `state.rules.factionIdentities` is true — so vanilla / golden matches see
 *     nothing and stay byte-identical.
 *   - THRESHOLD-DRIVEN: the payoff only goes `active` once the controller commands
 *     `ARCHETYPE_THRESHOLD[faction]`+ of their OWN faction's live units (recomputed
 *     from the board every call — never a cached counter).
 *   - MONO-FACTION ONLY: a controller whose commander isn't one of the five curated
 *     faction commanders maps to NO faction -> inert. Off-faction splashes don't
 *     count toward the threshold (countFactionUnits matches the unit's OWN faction).
 *   - NO-BURN / DETERMINISTIC: every reported bonus is own-side stat/value only; the
 *     query reads board counts and never touches an enemy nexus or any RNG.
 */
export interface OathPayoff {
  /** The controller's faction, or null if their commander has no identity. */
  faction: IdentityFaction | null;
  /** True only when identities are enabled AND the faction threshold is met. */
  active: boolean;
  /** Live OWN-faction unit count (0 when board-less / off-faction). */
  factionUnits: number;
  /** The threshold this faction must reach for the Oath payoff to fire. */
  threshold: number;
  /** The earned bonus stat line (own-side, additive). Zeroed when inactive. */
  bonus: { attack: number; health: number };
}

/**
 * Per-faction Oath payoff stat line, mirroring each faction's identity axis:
 *   STONE  durability   +0/+2   (a thicker wall)
 *   SILVER tempo        +1/+0   (a sharper edge from insight)
 *   BRONZE aggro        +1/+1   (the swarm hits harder)
 *   IRON   arsenal      +1/+1   (geared offence + body)
 *   GOLD   top-end      +0/+3   (premium staying power)
 * These are REPORTED, additive, own-side numbers — no burn, no enemy interaction.
 */
const OATH_BONUS: Record<IdentityFaction, { attack: number; health: number }> = {
  STONE_KEEPERS: { attack: 0, health: 2 },
  SILVER_SENTINELS: { attack: 1, health: 0 },
  BRONZE_GUARDIANS: { attack: 1, health: 1 },
  IRON_DEFENDERS: { attack: 1, health: 1 },
  GOLDEN_SOVEREIGNS: { attack: 0, health: 3 },
};

/**
 * Compute the controller's current Oath payoff state. Pure, deterministic, no-burn.
 * `factionOf` is the reducer's catalog lookup (cardId -> faction enum string), used
 * to count the controller's live OWN-faction units. When identities are disabled,
 * or the commander has no faction, the payoff is inert (active:false, bonus 0/0).
 */
export function oathPayoffFor(
  state: MatchState,
  controller: PlayerId,
  factionOf: (cardId: string) => string | null | undefined
): OathPayoff {
  const faction = factionOfCommander(state, controller);
  if (faction === null) {
    return { faction: null, active: false, factionUnits: 0, threshold: 0, bonus: { attack: 0, health: 0 } };
  }
  const threshold = ARCHETYPE_THRESHOLD[faction];
  if (!identitiesEnabled(state)) {
    // Flag off -> always inert (vanilla byte-identical). Still report the faction +
    // threshold so a UI can show "Oath dormant (identities off)".
    return { faction, active: false, factionUnits: 0, threshold, bonus: { attack: 0, health: 0 } };
  }
  // CORE default plays flat: the Oath payoff only comes online when the deep
  // archetype layer is explicitly enabled (mirrors archetypeActive's gate).
  const factionUnits = countFactionUnits(state, controller, faction, factionOf);
  const active = archetypesEnabled(state) && factionUnits >= threshold;
  return {
    faction,
    active,
    factionUnits,
    threshold,
    bonus: active ? { ...OATH_BONUS[faction] } : { attack: 0, health: 0 },
  };
}
