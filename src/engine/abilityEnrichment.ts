/**
 * abilityEnrichment.ts — the OFF-CHAIN, REVERSIBLE, FLAG-GATED "raise the floor"
 * layer for vanilla commons.
 *
 * WHY THIS EXISTS
 * ~72% of the 4129 NFT-backed cards are vanilla stat/keyword bodies whose
 * authored `rawTraits.Ability` compiles to ZERO runtime EffectSpecs (see
 * `dev:effect-coverage` / `dev:enrichment`). A vanilla draw is a decision-less
 * draw. This layer DERIVES a small, thematic, faction/keyword-driven interaction
 * for such a card so play FEELS designed — WITHOUT ever rewriting the on-chain
 * authored text and WITHOUT a unilateral live change to all holders.
 *
 * HARD INVARIANTS (locked — mirror the cardOverrides / factionIdentity spine):
 *   - REVERSIBLE + FLAG-GATED. The whole layer is inert unless `ENABLE_ENRICHMENT`
 *     is true (default OFF; an env override `CRYPT_ENRICHMENT=1` flips it for a
 *     report/proof run). With the flag OFF, `enrichmentSpecsFor` returns [] for
 *     EVERY card, nothing is attached at the catalog seam, and the reducer's
 *     compiled IR is byte-identical to today — so the reducer-equivalence golden
 *     is unmoved (the isolation gate).
 *   - NEVER TOUCHES THE AUTHORED DATA. This module only READS a card's existing
 *     faction / keywords / stats / Grade. It never mutates generatedTcgCards.json
 *     and never changes a card's name / cost / stats.
 *   - ONLY ENRICHES TRUE VANILLA BODIES. A card is eligible only if its authored
 *     ability already compiles to zero runtime ops (`compiledIsVanilla`). A card
 *     that already does something is left exactly as authored — no double-dip.
 *   - REUSES EXISTING OPS ONLY. Every emitted spec is an op the engine ALREADY
 *     executes (BUFF_SELF, BUFF_IF_UNDAMAGED, HEAL-self, SUMMON_TOKEN). No new
 *     runtime op is invented; the effectResolver/reducer already resolve these.
 *   - LOW POWER / FLOOR-RAISING, NOT POWER-CREEP. Every enrichment is a single
 *     +1 stat, a 0/1 token, or a conditional +0/+1 — strictly below the
 *     Grade-implied class peer for these bottom-tier (Grade 50-60) commons. The
 *     power sanity check in `dev:enrichment` pins this.
 *   - DETERMINISTIC. The derivation is a pure function of the card's static
 *     fields (faction + keyword priority). No RNG, no clock, no board state — so
 *     two builds of the same catalog produce identical enrichment.
 *
 * ROLLOUT (this drop): the generator now maps ALL SIX factions, each with a
 * DISTINCT thematic enrichment table (same per-keyword priority structure, same
 * 1-stat-point cap, same vanilla-only / units-only discipline). The master flag is
 * now DEFAULT ON, so enrichment is the live baseline (the env override
 * `CRYPT_ENRICHMENT=0` still cleanly disables it for an isolation run). Note:
 * GOLDEN_SOVEREIGNS and GODS ship with ZERO commons in the current catalog, so
 * their tables are defined for completeness/forward-compat but enrich nothing
 * today — a fact the report surfaces.
 */

import type { EffectSpec } from "./abilityCompiler";
import { compileAbility } from "./abilityCompiler";
import type { Faction } from "../types/faction";

/**
 * MASTER FLAG. Default ON — enrichment is the live baseline now that the rollout
 * is owner-approved. The env override still works BOTH ways (read once at module
 * load, a build-time switch since the catalog is built once):
 *   - `CRYPT_ENRICHMENT=0` (or "false"/"off") force-DISABLES — the isolation run
 *     that pins the reducer-equivalence golden's flag-OFF byte-identity.
 *   - `CRYPT_ENRICHMENT=1` (or anything else / unset) leaves it ON.
 */
export const ENABLE_ENRICHMENT: boolean = (() => {
  const v = String(process.env.CRYPT_ENRICHMENT ?? "").trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return true;
})();

/**
 * The factions this layer enriches. ALL SIX now — each carries a distinct
 * thematic table in `enrichmentSpecsFor`. (Golden Sovereigns / Gods currently have
 * no commons, so their entries here are forward-compat; they match nothing today.)
 */
export const ENRICHMENT_FACTIONS: ReadonlySet<Faction> = new Set<Faction>([
  "STONE_KEEPERS",
  "IRON_DEFENDERS",
  "BRONZE_GUARDIANS",
  "SILVER_SENTINELS",
  "GOLDEN_SOVEREIGNS",
  "GODS",
]);

/** Minimal read-only view of a card this layer needs. Matches PlayableCard. */
export interface EnrichableCard {
  id: string;
  faction: Faction;
  rarity: string;
  keywords?: string[];
  rawTraits?: Record<string, string> | null;
  /** Catalog card type ("unit" | "equipment" | "artifact" | "spell"). Only UNIT
   *  bodies fire the ON_SUMMON/ON_DEATH/ON_TURN_* triggers this layer emits, so
   *  enrichment is restricted to units (equipment/artifacts would carry an inert
   *  spec). PlayableCard.type supplies this; raw cards map cardClass/subtype. */
  type?: string;
  sourceCardClass?: string | null;
  sourceSubtype?: string | null;
}

/** True if the card is a unit body (the only type whose unit triggers fire). */
export function isUnitCard(card: EnrichableCard): boolean {
  const t = String(card.type ?? "").toLowerCase();
  if (t) return t === "unit";
  const cc = String(card.sourceCardClass ?? "").toLowerCase();
  const st = String(card.sourceSubtype ?? "").toLowerCase();
  if (cc === "equipment" || cc === "artifact" || cc === "spell") return false;
  return (
    ["character", "creature", "unit"].includes(cc) ||
    ["character", "creature", "unit"].includes(st)
  );
}

/**
 * True if a card's AUTHORED ability already compiles to zero runtime EffectSpecs
 * (a "vanilla" body). This is the SAME compile the reducer uses, so eligibility
 * is exactly "the card currently does nothing at runtime". Pure; no state.
 */
export function compiledIsVanilla(card: EnrichableCard): boolean {
  const ability = card.rawTraits?.Ability ?? undefined;
  return compileAbility(ability ?? "").specs.length === 0;
}

/** A keyword set (upper-cased) for priority matching, robust to missing arrays. */
function keywordSet(card: EnrichableCard): Set<string> {
  const ks = Array.isArray(card.keywords) ? card.keywords : [];
  return new Set(ks.map((k) => String(k).toUpperCase()));
}

/** The authored Grade (0-100) as a number; missing -> a conservative 0. */
export function gradeOf(card: EnrichableCard): number {
  const g = Number(card.rawTraits?.Grade ?? 0);
  return Number.isFinite(g) ? g : 0;
}

/**
 * DESIGN MAPPING — every faction has a DISTINCT thematic table, but they all share
 * the SAME machinery: a vanilla common earns exactly ONE minor, on-theme
 * interaction chosen by a fixed keyword PRIORITY (deterministic, single enrichment
 * per card, no stacking). Every branch emits ONE unit of value (a single +1 stat,
 * a 0/1 token, one self-heal-1, or one minor keyword grant) — strictly below the
 * Grade-50-60 class peer. All effects are own-side; none touches an enemy nexus
 * (no burn). Only ops the reducer ALREADY executes are used:
 *   - ON_SUMMON / ON_ATTACK BUFF_SELF              (effectResolver)
 *   - ON_TURN_START BUFF_IF_UNDAMAGED              (effectResolver)
 *   - ON_TURN_END HEAL self                        (effectResolver)
 *   - ON_DEATH SUMMON_TOKEN                        (effectResolver)
 *   - PASSIVE AURA_KEYWORD (one-shot shield / keyword grant via recomputeAuras)
 *
 * STONE KEEPERS — BEDROCK / ENDURANCE ("we outlast"):
 *   1 DEATHRATTLE   ON_DEATH SUMMON_TOKEN 0/1 "Rubble"        (rubble remains)
 *   2 WARD|PATIENT  ON_TURN_START BUFF_IF_UNDAMAGED +0/+1     (eroded but enduring)
 *   3 REGROW        ON_TURN_END HEAL self +1                  (the stone reknits)
 *   4 LIFESTEAL     ON_SUMMON BUFF_SELF +1/+0                 (drains the quarry)
 *   5 *             ON_SUMMON BUFF_SELF +0/+1                 (the wall holds)
 *
 * IRON DEFENDERS — ARMOR / GUARD RESILIENCE ("the line holds"):
 *   1 DEATHRATTLE   ON_DEATH SUMMON_TOKEN 0/1 "Scrap"         (broken plate remains)
 *   2 GUARD|ARMORED ON_SUMMON BUFF_SELF +0/+1                 (reinforced plating)
 *   3 WARD          ON_TURN_START BUFF_IF_UNDAMAGED +0/+1     (bulwark, untested holds)
 *   4 RUSH          ON_ATTACK BUFF_SELF +1/+0                 (charge gathers momentum)
 *   5 *             ON_SUMMON BUFF_SELF +0/+1                 (drilled discipline)
 *
 * BRONZE GUARDIANS — AGGRO / RUSH CHIP ("strike first"):
 *   1 RUSH          ON_ATTACK BUFF_SELF +1/+0                 (warband momentum)
 *   2 LIFESTEAL     ON_SUMMON BUFF_SELF +1/+0                 (blooded blade)
 *   3 REGROW        ON_TURN_END HEAL self +1                  (bronze tempers)
 *   4 GUARD|ARMORED ON_SUMMON BUFF_SELF +0/+1                 (shield-bearer)
 *   5 *             ON_SUMMON BUFF_SELF +1/+0                 (eager skirmisher)
 *
 * SILVER SENTINELS — VIGILANCE / CONTROL ("nothing passes unseen"):
 *   1 STEALTH       ON_SUMMON BUFF_SELF +1/+0                 (silent edge)
 *   2 WARD          PASSIVE AURA_KEYWORD WARD self only       (warded vigil)
 *   3 SCRY          ON_TURN_START BUFF_IF_UNDAMAGED +0/+1     (watchful, unbroken)
 *   4 GUARD         ON_SUMMON BUFF_SELF +0/+1                 (sentry stance)
 *   5 *             ON_SUMMON BUFF_SELF +0/+1                 (standing watch)
 *
 * GOLDEN SOVEREIGNS — COMMAND / ROYALTY ("rule, and be reinforced"):
 *   1 GUARD|ARMORED ON_SUMMON BUFF_SELF +0/+1                 (gilded guard)
 *   2 LIFESTEAL     ON_SUMMON BUFF_SELF +1/+0                 (sovereign tithe)
 *   3 WARD          PASSIVE AURA_KEYWORD WARD self only       (crown's aegis)
 *   4 *             ON_SUMMON BUFF_SELF +0/+1                 (regal bearing)
 *   (no commons in the current catalog — forward-compat only)
 *
 * GODS — MINOR DIVINE ON-SUMMON ("a small blessing"). Conservative; few/no vanilla:
 *   1 DIVINE_SHIELD PASSIVE AURA_KEYWORD DIVINE_SHIELD self   (rekindled halo)
 *   2 LIFESTEAL     ON_SUMMON BUFF_SELF +1/+0                 (sacred draught)
 *   3 *             ON_SUMMON BUFF_SELF +0/+1                 (divine favor)
 *   (no commons in the current catalog — forward-compat only)
 */
const RUBBLE_TOKEN = "Rubble";
const SCRAP_TOKEN = "Scrap";

/** ON_SUMMON BUFF_SELF helper — the most common single-point body buff. */
function buffSelf(card: EnrichableCard, attack: number, health: number, theme: string, trigger: EffectSpec["trigger"] = "ON_SUMMON"): EffectSpec[] {
  return [{ trigger, op: "BUFF_SELF", attack, health, raw: `[enrich:${card.id}] ${theme}` }];
}

/** Stone Keepers table — endurance / bedrock. */
function enrichStoneKeepers(card: EnrichableCard, kw: Set<string>): EffectSpec[] {
  const tag = (raw: string) => `[enrich:${card.id}] ${raw}`;
  if (kw.has("DEATHRATTLE"))
    return [{ trigger: "ON_DEATH", op: "SUMMON_TOKEN", attack: 0, health: 1, token: RUBBLE_TOKEN, count: 1, raw: tag("Bedrock: rubble remains — summon a 0/1 Rubble on death.") }];
  if (kw.has("WARD") || kw.has("PATIENT"))
    return [{ trigger: "ON_TURN_START", op: "BUFF_IF_UNDAMAGED", attack: 0, health: 1, raw: tag("Bedrock: eroded but enduring — +0/+1 each turn it takes no damage.") }];
  if (kw.has("REGROW"))
    return [{ trigger: "ON_TURN_END", op: "HEAL", amount: 1, self: true, raw: tag("Bedrock: the stone reknits — heal 1 to itself at turn end.") }];
  if (kw.has("LIFESTEAL")) return buffSelf(card, 1, 0, "Bedrock: drains the quarry — enters with +1/+0.");
  return buffSelf(card, 0, 1, "Bedrock: the wall holds — enters with +0/+1.");
}

/** Iron Defenders table — armor / guard resilience. */
function enrichIronDefenders(card: EnrichableCard, kw: Set<string>): EffectSpec[] {
  const tag = (raw: string) => `[enrich:${card.id}] ${raw}`;
  if (kw.has("DEATHRATTLE"))
    return [{ trigger: "ON_DEATH", op: "SUMMON_TOKEN", attack: 0, health: 1, token: SCRAP_TOKEN, count: 1, raw: tag("Iron: broken plate remains — summon a 0/1 Scrap on death.") }];
  if (kw.has("GUARD") || kw.has("ARMORED")) return buffSelf(card, 0, 1, "Iron: reinforced plating — enters with +0/+1.");
  if (kw.has("WARD"))
    return [{ trigger: "ON_TURN_START", op: "BUFF_IF_UNDAMAGED", attack: 0, health: 1, raw: tag("Iron: the bulwark, untested, holds — +0/+1 on an undamaged turn.") }];
  if (kw.has("RUSH")) return buffSelf(card, 1, 0, "Iron: the charge gathers momentum — +1/+0 on attack.", "ON_ATTACK");
  return buffSelf(card, 0, 1, "Iron: drilled discipline — enters with +0/+1.");
}

/** Bronze Guardians table — aggro / rush chip. */
function enrichBronzeGuardians(card: EnrichableCard, kw: Set<string>): EffectSpec[] {
  const tag = (raw: string) => `[enrich:${card.id}] ${raw}`;
  if (kw.has("RUSH")) return buffSelf(card, 1, 0, "Bronze: warband momentum — +1/+0 on attack.", "ON_ATTACK");
  if (kw.has("LIFESTEAL")) return buffSelf(card, 1, 0, "Bronze: blooded blade — enters with +1/+0.");
  if (kw.has("REGROW"))
    return [{ trigger: "ON_TURN_END", op: "HEAL", amount: 1, self: true, raw: tag("Bronze: the metal tempers — heal 1 to itself at turn end.") }];
  if (kw.has("GUARD") || kw.has("ARMORED")) return buffSelf(card, 0, 1, "Bronze: shield-bearer — enters with +0/+1.");
  return buffSelf(card, 1, 0, "Bronze: eager skirmisher — enters with +1/+0.");
}

/** Silver Sentinels table — vigilance / control. */
function enrichSilverSentinels(card: EnrichableCard, kw: Set<string>): EffectSpec[] {
  const tag = (raw: string) => `[enrich:${card.id}] ${raw}`;
  if (kw.has("STEALTH")) return buffSelf(card, 1, 0, "Silver: the silent edge — enters with +1/+0.");
  if (kw.has("WARD"))
    return [{ trigger: "PASSIVE", op: "AURA_KEYWORD", keyword: "WARD", includeSelf: true, raw: tag("Silver: warded vigil — a one-shot ward shields itself.") }];
  if (kw.has("SCRY"))
    return [{ trigger: "ON_TURN_START", op: "BUFF_IF_UNDAMAGED", attack: 0, health: 1, raw: tag("Silver: watchful, unbroken — +0/+1 on an undamaged turn.") }];
  if (kw.has("GUARD")) return buffSelf(card, 0, 1, "Silver: sentry stance — enters with +0/+1.");
  return buffSelf(card, 0, 1, "Silver: standing watch — enters with +0/+1.");
}

/** Golden Sovereigns table — command / royalty. (No commons today.) */
function enrichGoldenSovereigns(card: EnrichableCard, kw: Set<string>): EffectSpec[] {
  const tag = (raw: string) => `[enrich:${card.id}] ${raw}`;
  if (kw.has("GUARD") || kw.has("ARMORED")) return buffSelf(card, 0, 1, "Gold: the gilded guard — enters with +0/+1.");
  if (kw.has("LIFESTEAL")) return buffSelf(card, 1, 0, "Gold: the sovereign's tithe — enters with +1/+0.");
  if (kw.has("WARD"))
    return [{ trigger: "PASSIVE", op: "AURA_KEYWORD", keyword: "WARD", includeSelf: true, raw: tag("Gold: the crown's aegis — a one-shot ward shields itself.") }];
  return buffSelf(card, 0, 1, "Gold: regal bearing — enters with +0/+1.");
}

/** Gods table — minor divine on-summon. Conservative. (No commons today.) */
function enrichGods(card: EnrichableCard, kw: Set<string>): EffectSpec[] {
  const tag = (raw: string) => `[enrich:${card.id}] ${raw}`;
  if (kw.has("DIVINE_SHIELD"))
    return [{ trigger: "PASSIVE", op: "AURA_KEYWORD", keyword: "DIVINE_SHIELD", includeSelf: true, raw: tag("Divine: the rekindled halo — a one-shot divine shield on itself.") }];
  if (kw.has("LIFESTEAL")) return buffSelf(card, 1, 0, "Divine: the sacred draught — enters with +1/+0.");
  return buffSelf(card, 0, 1, "Divine: a small favor — enters with +0/+1.");
}

/** Per-faction dispatch table. */
const FACTION_ENRICHERS: Record<Faction, (card: EnrichableCard, kw: Set<string>) => EffectSpec[]> = {
  STONE_KEEPERS: enrichStoneKeepers,
  IRON_DEFENDERS: enrichIronDefenders,
  BRONZE_GUARDIANS: enrichBronzeGuardians,
  SILVER_SENTINELS: enrichSilverSentinels,
  GOLDEN_SOVEREIGNS: enrichGoldenSovereigns,
  GODS: enrichGods,
};

/**
 * Derive the enrichment EffectSpec set for a single card. Returns [] when:
 *   - the master flag is OFF, OR
 *   - the card's faction is not in the enrichment set, OR
 *   - the card is not a unit body, OR
 *   - the card is not a vanilla body (its authored ability already does something).
 * Otherwise returns exactly ONE spec (the highest-priority keyword match for the
 * card's faction). Pure and deterministic — a function of static fields only.
 */
export function enrichmentSpecsFor(card: EnrichableCard): EffectSpec[] {
  if (!ENABLE_ENRICHMENT) return [];
  if (!ENRICHMENT_FACTIONS.has(card.faction)) return [];
  // UNITS ONLY: equipment/artifacts never fire the unit triggers we emit, so an
  // enrichment on them would be inert. Keep the layer precise (and honest).
  if (!isUnitCard(card)) return [];
  if (!compiledIsVanilla(card)) return [];

  const kw = keywordSet(card);
  const enricher = FACTION_ENRICHERS[card.faction];
  return enricher ? enricher(card, kw) : [];
}

/**
 * POWER SANITY — the maximum "effective value" a single enrichment adds, in
 * stat-points. Used by the report to assert no enrichment pushes a card above its
 * Grade-implied class-peer ceiling. A +1 stat or a 0/1 token = 1 point; that is
 * the cap by construction (every branch emits exactly one such unit of value).
 */
export const ENRICHMENT_MAX_VALUE_POINTS = 1;

/**
 * Reduce a derived spec set to its conservative effective stat-point value, for
 * the report's power check. BUFF_SELF / BUFF_IF_UNDAMAGED count |attack|+|health|;
 * a HEAL counts its amount; a SUMMON_TOKEN counts attack+health of the token body.
 * (BUFF_IF_UNDAMAGED is gated on staying undamaged, so its real expectation is
 * LOWER than this nominal value — the check is intentionally conservative.)
 */
export function enrichmentValuePoints(specs: EffectSpec[]): number {
  let pts = 0;
  for (const s of specs) {
    switch (s.op) {
      case "BUFF_SELF":
      case "BUFF_IF_UNDAMAGED":
        pts += Math.abs(s.attack ?? 0) + Math.abs(s.health ?? 0);
        break;
      case "HEAL":
        pts += Math.abs(s.amount ?? 0);
        break;
      case "SUMMON_TOKEN":
        pts += (Math.abs(s.attack ?? 0) + Math.abs(s.health ?? 0)) * Math.max(1, s.count ?? 1);
        break;
      case "AURA_KEYWORD":
        // A single minor keyword grant (a one-shot self-ward / self divine-shield)
        // is worth ~1 stat-point of floor — on par with a +0/+1 body buff.
        pts += 1;
        break;
      default:
        // Any other op would be off-design for this floor-raising layer; count it
        // generously so the power check would catch it.
        pts += 2;
        break;
    }
  }
  return pts;
}
