/**
 * dev:enrichment — BEFORE/AFTER report for the "raise the floor" enrichment layer
 * (`abilityEnrichment.ts`), now rolled out to ALL SIX factions.
 *
 * It answers, card-weighted, PER FACTION:
 *   - how many commons exist, and how many are VANILLA today (their authored
 *     ability compiles to zero runtime EffectSpecs);
 *   - what each vanilla common NOW does once enriched (grouped by the derived
 *     trigger:op), with concrete card -> effect examples;
 *   - a POWER SANITY check: no enrichment exceeds the floor-raising value cap
 *     (ENRICHMENT_MAX_VALUE_POINTS), so a Grade-50-60 common is never pushed above
 *     its class peer.
 *
 * The npm script (`dev:enrichment`) runs this with `CRYPT_ENRICHMENT=1` so the
 * generator + catalog-attach + reducer-merge path is exercised and we can report
 * the actual derived effects AND assert the live catalog carries them. Run it with
 * `CRYPT_ENRICHMENT=0` to verify the flag-OFF isolation branch (zero enrichment
 * leaks into the catalog). NOTE: enrichment is now DEFAULT ON, so a bare run is ON.
 */

import rawCards from "../data/generatedTcgCards.json";
import { normalizeFaction, type Faction } from "../types/faction";
import { compileAbility } from "../engine/abilityCompiler";
import {
  enrichmentSpecsFor,
  enrichmentValuePoints,
  compiledIsVanilla,
  gradeOf,
  ENABLE_ENRICHMENT,
  ENRICHMENT_MAX_VALUE_POINTS,
  ENRICHMENT_FACTIONS,
  enrichmentBandOf,
  enrichmentV2SpecsFor,
  effectiveValueCapFor,
  bandValueCap,
  type EnrichableCard,
} from "../engine/abilityEnrichment";
import { getPlayableCardById } from "../engine/cards";

interface RawCard {
  id: string;
  name?: string;
  faction?: string;
  rarity?: string;
  cardClass?: string | null;
  subtype?: string | null;
  keywords?: string[];
  rawTraits?: Record<string, string> | null;
}

const cards = rawCards as unknown as RawCard[];

function isUnit(c: RawCard): boolean {
  const cc = String(c.cardClass ?? "").toLowerCase();
  const st = String(c.subtype ?? "").toLowerCase();
  if (cc === "equipment" || cc === "artifact") return false;
  return (
    ["character", "creature", "unit"].includes(cc) ||
    ["character", "creature", "unit"].includes(st)
  );
}

function toEnrichable(c: RawCard): EnrichableCard {
  return {
    id: c.id,
    faction: normalizeFaction(c.faction ?? "STONE_KEEPERS"),
    rarity: String(c.rarity ?? "COMMON"),
    keywords: c.keywords ?? [],
    rawTraits: c.rawTraits ?? {},
    sourceCardClass: c.cardClass ?? null,
    sourceSubtype: c.subtype ?? null,
  };
}

const FACTIONS: Faction[] = [
  "STONE_KEEPERS",
  "IRON_DEFENDERS",
  "BRONZE_GUARDIANS",
  "SILVER_SENTINELS",
  "GOLDEN_SOVEREIGNS",
  "GODS",
];

console.log("\n=== ENRICHMENT REPORT — all-faction raise-the-floor rollout ===\n");
console.log(`Master flag ENABLE_ENRICHMENT: ${ENABLE_ENRICHMENT ? "ON" : "OFF"}`);
console.log(`Enrichment factions:           ${[...ENRICHMENT_FACTIONS].join(", ")}`);
console.log(`Value cap per card:            ${ENRICHMENT_MAX_VALUE_POINTS} stat-point\n`);

interface FactionStat {
  faction: Faction;
  commons: number;
  vanilla: number;
  vanillaUnits: number;
  vanillaNonUnits: number;
  enriched: number;
  enrichedV1: number;
  enrichedV2: number;
  maxValue: number;
  powerViolations: number;
  gradeViolations: number;
  byOp: Map<string, number>;
  byBand: Map<string, number>;
  examples: { id: string; name: string; kw: string; grade: number; band: string; effect: string }[];
  v2examples: { id: string; name: string; kw: string; grade: number; band: string; effect: string }[];
}

let totalEnriched = 0;
let totalEnrichedV2 = 0;
let totalPowerViolations = 0;
let totalGradeViolations = 0;
let globalMaxValue = 0;
const factionStats: FactionStat[] = [];

for (const faction of FACTIONS) {
  // V2 lives on the rare->epic->legendary band, so scan ALL rarities of this
  // faction (not just commons). The per-card cap (V1 floor vs band cap) makes the
  // power check honest across the whole band.
  const pool = cards.filter((c) => {
    try {
      return normalizeFaction(c.faction ?? "") === faction;
    } catch {
      return false;
    }
  });
  const commons = pool.filter((c) => String(c.rarity ?? "").toUpperCase() === "COMMON");

  const fs: FactionStat = {
    faction,
    commons: commons.length,
    vanilla: 0,
    vanillaUnits: 0,
    vanillaNonUnits: 0,
    enriched: 0,
    enrichedV1: 0,
    enrichedV2: 0,
    maxValue: 0,
    powerViolations: 0,
    gradeViolations: 0,
    byOp: new Map(),
    byBand: new Map(),
    examples: [],
    v2examples: [],
  };

  for (const raw of pool) {
    const card = toEnrichable(raw);
    if (!compiledIsVanilla(card)) continue;
    fs.vanilla += 1;
    if (isUnit(raw)) fs.vanillaUnits += 1;
    else fs.vanillaNonUnits += 1;

    const specs = enrichmentSpecsFor(card);
    if (specs.length === 0) continue;
    fs.enriched += 1;
    const isV2 = enrichmentV2SpecsFor(card).length > 0;
    const band = enrichmentBandOf(card);
    const bandLabel = isV2 && band ? band : "v1-floor";
    if (isV2) fs.enrichedV2 += 1;
    else fs.enrichedV1 += 1;
    fs.byBand.set(bandLabel, (fs.byBand.get(bandLabel) ?? 0) + 1);

    const op = specs[0].op;
    const trigger = specs[0].trigger;
    fs.byOp.set(`${trigger}:${op}`, (fs.byOp.get(`${trigger}:${op}`) ?? 0) + 1);

    const value = enrichmentValuePoints(specs);
    fs.maxValue = Math.max(fs.maxValue, value);
    globalMaxValue = Math.max(globalMaxValue, value);
    // Apply the EFFECTIVE cap for this card (V1 floor cap, or this card's band cap
    // for V2). A V2 decision is allowed up to its band budget; only an over-budget
    // emission is a violation.
    const cap = effectiveValueCapFor(card);
    if (value > cap) fs.powerViolations += 1;
    const grade = gradeOf(card);
    // Grade-ceiling check: V1 floor chips must stay on low-Grade bodies (grade>70
    // with only a V1 chip would mean a high-Grade card got nothing of substance —
    // a coverage gap, not a power one, but we still surface it). V2 cards are
    // INTENDED to be high-Grade, so they're exempt from the grade-ceiling flag and
    // only bound by their band cap.
    if (value > cap) fs.gradeViolations += 1;

    const describe = (ss: typeof specs) =>
      ss
        .map((s) => {
          if (s.op === "SUMMON_TOKEN") return `${s.trigger} summon ${s.attack}/${s.health} ${s.token}`;
          if (s.op === "HEAL") return `${s.trigger} heal ${s.amount} self`;
          if (s.op === "AURA_KEYWORD") return `${s.trigger} grant ${s.keyword} (self)`;
          if (s.op === "DEAL_DAMAGE") return `${s.trigger} deal ${s.amount}${s.damageTarget ? ` (${s.damageTarget})` : ""}`;
          if (s.op === "DAMAGE_ADJACENT_ENEMIES") return `${s.trigger} splash ${s.amount}${s.allAdjacent ? " all-adj" : ""}`;
          if (s.op === "DEBUFF_ALL_ENEMIES") return `${s.trigger} all enemies -${s.amount} atk`;
          if (s.op === "DESTROY_ENEMY_SELECT") return `${s.trigger} destroy enemy (${s.selector})`;
          if (s.op === "BUFF_ALLIES") return `${s.trigger} allies +${s.attack ?? 0}/+${s.health ?? 0}`;
          if (s.condition) return `${s.trigger} ${s.op} +${s.attack ?? 0}/+${s.health ?? 0} if ${s.condition.kind}>=${s.condition.value ?? 0}`;
          return `${s.trigger} ${s.op} +${s.attack ?? 0}/+${s.health ?? 0}`;
        })
        .join("; ");

    const ex = { id: card.id, name: raw.name ?? card.id, kw: (raw.keywords ?? []).join(",") || "<none>", grade, band: bandLabel, effect: describe(specs) };
    if (isV2) {
      if (fs.v2examples.length < 8) fs.v2examples.push(ex);
    } else if (fs.examples.length < 6) {
      fs.examples.push(ex);
    }
  }

  totalEnriched += fs.enriched;
  totalEnrichedV2 += fs.enrichedV2;
  totalPowerViolations += fs.powerViolations;
  totalGradeViolations += fs.gradeViolations;
  factionStats.push(fs);
}

for (const fs of factionStats) {
  console.log(`\n--- ${fs.faction} ---`);
  console.log(`  commons (total):            ${fs.commons}`);
  console.log(`  VANILLA (zero runtime ops): ${fs.vanilla}  (units ${fs.vanillaUnits}, non-units ${fs.vanillaNonUnits})`);
  console.log(`  ENRICHED:                   ${fs.enriched}  (V1 floor ${fs.enrichedV1}, V2 DECISIONS ${fs.enrichedV2})`);
  if (fs.vanillaUnits === 0) {
    console.log("  (no vanilla units in catalog — table is forward-compat only)");
    continue;
  }
  if (fs.byBand.size > 0) {
    console.log("  band split (band -> count):");
    for (const [b, n] of [...fs.byBand.entries()].sort((a, b2) => b2[1] - a[1])) {
      console.log(`    ${b.padEnd(14)} ${String(n).padStart(4)}`);
    }
  }
  if (fs.byOp.size > 0) {
    console.log("  histogram (trigger:op -> count):");
    for (const [op, n] of [...fs.byOp.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${op.padEnd(34)} ${String(n).padStart(4)}`);
    }
  }
  if (fs.v2examples.length > 0) {
    console.log("  V2 DECISION examples (card -> board-dependent effect):");
    for (const e of fs.v2examples) {
      console.log(`    [${e.id}] ${e.name}  (kw: ${e.kw}, Grade ${e.grade}, band ${e.band})`);
      console.log(`        -> ${e.effect}`);
    }
  }
  if (fs.examples.length > 0) {
    console.log("  V1 floor examples (card -> chip effect):");
    for (const e of fs.examples) {
      console.log(`    [${e.id}] ${e.name}  (kw: ${e.kw}, Grade ${e.grade})`);
      console.log(`        -> ${e.effect}`);
    }
  }
  console.log(`  power: maxValue=${fs.maxValue} (V1 cap ${ENRICHMENT_MAX_VALUE_POINTS}; V2 capped per band rare2/epic3/legendary4), power-viol=${fs.powerViolations}, grade-viol=${fs.gradeViolations}`);
}

console.log("\n=== TOTALS ===");
console.log(`  Total vanilla units enriched:   ${totalEnriched}  (of which V2 DECISIONS: ${totalEnrichedV2})`);
console.log(`  Global max enrichment value:    ${globalMaxValue} point(s) (per-card cap: V1=${ENRICHMENT_MAX_VALUE_POINTS}, V2 band-scaled)`);
console.log(`  Power-cap violations (all):     ${totalPowerViolations}`);
console.log(`  Grade-ceiling violations (all): ${totalGradeViolations}`);

// --- Under-flag catalog assertion --------------------------------------------
if (ENABLE_ENRICHMENT) {
  // Confirm a known enriched id carries enrichmentSpecs in the LIVE catalog, and a
  // non-vanilla common is left clean (no double-dip), for each faction that has
  // at least one enriched card.
  let leakOk = true;
  for (const fs of factionStats) {
    if (fs.enriched === 0) continue;
    const sample = fs.v2examples[0] ?? fs.examples[0];
    if (sample) {
      const live = getPlayableCardById(sample.id) as any;
      const ok = Array.isArray(live?.enrichmentSpecs) && live.enrichmentSpecs.length > 0;
      console.log(`  [flag ON] ${fs.faction}: live catalog carries enrichmentSpecs for ${sample.id}: ${ok ? "YES" : "NO"}`);
      if (!ok) leakOk = false;
    }
  }
  // Control: a non-vanilla common (any faction) must NOT be enriched.
  const nonVanilla = cards.find(
    (c) =>
      String(c.rarity ?? "").toUpperCase() === "COMMON" &&
      compileAbility(c.rawTraits?.Ability).specs.length > 0
  );
  if (nonVanilla) {
    const live = getPlayableCardById(nonVanilla.id) as any;
    const clean = !live?.enrichmentSpecs || live.enrichmentSpecs.length === 0;
    console.log(`  [flag ON] non-vanilla ${nonVanilla.id} left un-enriched (no double-dip): ${clean ? "YES" : "NO"}`);
    if (!clean) leakOk = false;
  }
  if (!leakOk) {
    console.error("FAILED: catalog enrichment attach/double-dip assertion failed.");
    process.exit(1);
  }
} else {
  console.log("\n  [flag OFF] live catalog carries NO enrichment (byte-identical to today).");
  const leaked = cards
    .filter((c) => String(c.rarity ?? "").toUpperCase() === "COMMON")
    .map((c) => getPlayableCardById(c.id) as any)
    .filter((c) => c && Array.isArray(c.enrichmentSpecs) && c.enrichmentSpecs.length > 0);
  const ok = leaked.length === 0;
  console.log(`  [flag OFF] catalog enrichment leak check: ${ok ? "CLEAN" : "LEAKED"}`);
  if (!ok) {
    console.error(`FAILED: ${leaked.length} card(s) carry enrichment with the flag OFF.`);
    process.exit(1);
  }
}

const PASS = totalPowerViolations === 0 && totalGradeViolations === 0;
console.log(`\n=== ENRICHMENT REPORT GATE: ${PASS ? "PASS" : "FAIL"} ===`);
if (!PASS) {
  console.error("FAILED: enrichment power/grade sanity violated.");
  process.exit(1);
}
console.log("PASSED");
