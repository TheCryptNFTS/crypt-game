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
 * VERTICAL SLICE (this drop): the generator is GENERAL, but the catalog seam in
 * cards.ts applies it ONLY to STONE KEEPERS vanilla commons — the largest faction
 * — as a demonstrable slice. Other factions are intentionally left un-enriched
 * for human review before the flag is widened.
 */

import type { EffectSpec } from "./abilityCompiler";
import { compileAbility } from "./abilityCompiler";
import type { Faction } from "../types/faction";

/**
 * MASTER FLAG. Default OFF so live play is unchanged. A report/proof run may flip
 * it via `CRYPT_ENRICHMENT=1` in the environment (read once at module load — the
 * catalog is built once, so this is a build-time switch, not a per-action one).
 */
export const ENABLE_ENRICHMENT: boolean =
  String(process.env.CRYPT_ENRICHMENT ?? "").trim() === "1";

/** The factions this slice is allowed to enrich. Stone Keepers only, for now. */
export const ENRICHMENT_FACTIONS: ReadonlySet<Faction> = new Set<Faction>([
  "STONE_KEEPERS",
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
 * DESIGN MAPPING — Stone Keepers' identity is BEDROCK / ENDURANCE / "we outlast".
 * Each vanilla common earns exactly ONE minor, on-theme interaction, chosen by a
 * fixed keyword PRIORITY so the derivation is deterministic and every card gets a
 * single enrichment (no stacking). Power is deliberately tiny (one +1 / a 0/1
 * token), well under the Grade-50-60 class peer.
 *
 * priority  keyword present   theme                         enrichment
 * --------  ----------------  ----------------------------  ----------------------------------
 *    1      DEATHRATTLE       "rubble remains"              ON_DEATH  SUMMON_TOKEN 0/1 "Rubble"
 *    2      WARD / PATIENT    "eroded but enduring"         ON_TURN_START BUFF_IF_UNDAMAGED +0/+1
 *    3      REGROW            "the stone reknits"           ON_TURN_END  HEAL self +1
 *    4      LIFESTEAL         "drains the quarry"           ON_SUMMON  BUFF_SELF +1/+0
 *    5      GUARD / ARMORED   "the wall holds"              ON_SUMMON  BUFF_SELF +0/+1
 *    6      (any other kw)    "sturdy footing"              ON_SUMMON  BUFF_SELF +0/+1
 *
 * Notes:
 *  - DEATHRATTLE cards already fire ON_DEATH in the reducer; adding a 0/1 token
 *    body is the smallest possible "death leaves something behind" — pure board
 *    presence, no burn.
 *  - WARD/PATIENT (already a durability identity) grows ONLY on undamaged turns:
 *    a slow, conditional +0/+1 that rewards keeping the wall intact.
 *  - All BUFF_SELF / HEAL are own-side and never touch an enemy nexus (no-burn).
 */
const RUBBLE_TOKEN = "Rubble";

/**
 * Derive the enrichment EffectSpec set for a single card. Returns [] when:
 *   - the master flag is OFF, OR
 *   - the card's faction is not in the enrichment slice, OR
 *   - the card is not a vanilla body (its authored ability already does something).
 * Otherwise returns exactly ONE spec (the highest-priority keyword match). Pure
 * and deterministic — a function of the card's static fields only.
 */
export function enrichmentSpecsFor(card: EnrichableCard): EffectSpec[] {
  if (!ENABLE_ENRICHMENT) return [];
  if (!ENRICHMENT_FACTIONS.has(card.faction)) return [];
  // UNITS ONLY: equipment/artifacts never fire the unit triggers we emit, so an
  // enrichment on them would be inert. Keep the slice precise (and honest).
  if (!isUnitCard(card)) return [];
  if (!compiledIsVanilla(card)) return [];

  const kw = keywordSet(card);
  const tag = (raw: string): string => `[enrich:${card.id}] ${raw}`;

  // Priority 1 — DEATHRATTLE: leave a 0/1 Rubble token behind on death.
  if (kw.has("DEATHRATTLE")) {
    return [
      {
        trigger: "ON_DEATH",
        op: "SUMMON_TOKEN",
        attack: 0,
        health: 1,
        token: RUBBLE_TOKEN,
        count: 1,
        raw: tag("Bedrock: rubble remains — summon a 0/1 Rubble on death."),
      },
    ];
  }

  // Priority 2 — WARD / PATIENT: +0/+1 each turn it goes undamaged (endurance).
  if (kw.has("WARD") || kw.has("PATIENT")) {
    return [
      {
        trigger: "ON_TURN_START",
        op: "BUFF_IF_UNDAMAGED",
        attack: 0,
        health: 1,
        raw: tag("Bedrock: eroded but enduring — +0/+1 each turn it takes no damage."),
      },
    ];
  }

  // Priority 3 — REGROW: heal 1 to itself at end of turn (the stone reknits).
  if (kw.has("REGROW")) {
    return [
      {
        trigger: "ON_TURN_END",
        op: "HEAL",
        amount: 1,
        self: true,
        raw: tag("Bedrock: the stone reknits — heal 1 to itself at turn end."),
      },
    ];
  }

  // Priority 4 — LIFESTEAL: a touch of bite on arrival (+1/+0).
  if (kw.has("LIFESTEAL")) {
    return [
      {
        trigger: "ON_SUMMON",
        op: "BUFF_SELF",
        attack: 1,
        health: 0,
        raw: tag("Bedrock: drains the quarry — enters with +1/+0."),
      },
    ];
  }

  // Priority 5/6 — GUARD / ARMORED, or any remaining keyword: a sturdier body.
  return [
    {
      trigger: "ON_SUMMON",
      op: "BUFF_SELF",
      attack: 0,
      health: 1,
      raw: tag("Bedrock: the wall holds — enters with +0/+1."),
    },
  ];
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
      default:
        // Any other op would be off-design for this floor-raising layer; count it
        // generously so the power check would catch it.
        pts += 2;
        break;
    }
  }
  return pts;
}
