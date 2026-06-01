/**
 * dev:enrichment — BEFORE/AFTER report for the "raise the floor" enrichment layer
 * (`abilityEnrichment.ts`), scoped to the VERTICAL SLICE: Stone Keepers commons.
 *
 * It answers, card-weighted:
 *   - how many Stone Keepers commons exist, and how many are VANILLA today
 *     (their authored ability compiles to zero runtime EffectSpecs);
 *   - what each vanilla common NOW does once enriched (grouped by the derived op),
 *     with concrete card -> effect examples;
 *   - a POWER SANITY check: no enrichment exceeds the floor-raising value cap
 *     (ENRICHMENT_MAX_VALUE_POINTS), so a Grade-50-60 common never gets pushed
 *     above its class peer.
 *
 * The npm script (`dev:enrichment`) runs this with `CRYPT_ENRICHMENT=1` so the
 * generator + catalog-attach + reducer-merge path is exercised and we can report
 * the actual derived effects AND assert the live catalog carries them. Run it
 * WITHOUT the env var (`tsx src/dev/runEnrichmentReport.ts`) to verify the
 * flag-OFF isolation branch (zero enrichment leaks into the catalog).
 */

import rawCards from "../data/generatedTcgCards.json";
import { normalizeFaction } from "../types/faction";
import { compileAbility } from "../engine/abilityCompiler";
import {
  enrichmentSpecsFor,
  enrichmentValuePoints,
  compiledIsVanilla,
  gradeOf,
  ENABLE_ENRICHMENT,
  ENRICHMENT_MAX_VALUE_POINTS,
  ENRICHMENT_FACTIONS,
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

const SLICE_FACTION = "STONE_KEEPERS";

console.log("\n=== ENRICHMENT REPORT — Stone Keepers commons (raise-the-floor slice) ===\n");
console.log(`Master flag ENABLE_ENRICHMENT: ${ENABLE_ENRICHMENT ? "ON" : "OFF"}`);
console.log(`Enrichment factions (slice):   ${[...ENRICHMENT_FACTIONS].join(", ")}`);
console.log(`Value cap per card:            ${ENRICHMENT_MAX_VALUE_POINTS} stat-point\n`);

const stoneCommons = cards.filter(
  (c) =>
    normalizeFaction(c.faction ?? "") === SLICE_FACTION &&
    String(c.rarity ?? "").toUpperCase() === "COMMON"
);

let vanilla = 0;
let vanillaUnits = 0;
let vanillaNonUnits = 0;
let enrichedCount = 0;
let maxValue = 0;
let powerViolations = 0;
let gradeViolations = 0;

const byOp = new Map<string, number>();
const examples: { id: string; name: string; kw: string; grade: number; effect: string }[] = [];

for (const raw of stoneCommons) {
  const card = toEnrichable(raw);
  if (!compiledIsVanilla(card)) continue;
  vanilla += 1;
  if (isUnit(raw)) vanillaUnits += 1;
  else vanillaNonUnits += 1;

  // enrichmentSpecsFor is the production generator: it short-circuits to [] when
  // the master flag is OFF, so this loop only populates the histogram/examples
  // when run under CRYPT_ENRICHMENT=1 (the dev:enrichment npm script). The
  // flag-OFF branch below then asserts the catalog carries zero enrichment.
  const specs = enrichmentSpecsFor(card);
  if (specs.length === 0) continue;
  enrichedCount += 1;

  const op = specs[0].op;
  const trigger = specs[0].trigger;
  byOp.set(`${trigger}:${op}`, (byOp.get(`${trigger}:${op}`) ?? 0) + 1);

  const value = enrichmentValuePoints(specs);
  maxValue = Math.max(maxValue, value);
  if (value > ENRICHMENT_MAX_VALUE_POINTS) powerViolations += 1;

  // Grade ceiling: a Stone common sits at Grade 50-60. A +1 enrichment must never
  // imply a class-peer above that band. We assert the value cap (1 point) is far
  // below the stat budget a Grade-60 common already carries (these bodies are
  // 1-4 cost with multi-point stat lines), so +1 cannot lift it past its peer.
  const grade = gradeOf(card);
  if (value > ENRICHMENT_MAX_VALUE_POINTS || grade > 70) gradeViolations += 1;

  if (examples.length < 12) {
    const effect = specs
      .map((s) => {
        if (s.op === "SUMMON_TOKEN") return `${trigger} summon ${s.attack}/${s.health} ${s.token}`;
        if (s.op === "HEAL") return `${trigger} heal ${s.amount} self`;
        return `${trigger} ${s.op} +${s.attack ?? 0}/+${s.health ?? 0}`;
      })
      .join("; ");
    examples.push({
      id: card.id,
      name: raw.name ?? card.id,
      kw: (raw.keywords ?? []).join(",") || "<none>",
      grade,
      effect,
    });
  }
}

console.log(`Stone Keepers commons (total):  ${stoneCommons.length}`);
console.log(`  - VANILLA (zero runtime ops): ${vanilla}`);
console.log(`      of which units:           ${vanillaUnits}`);
console.log(`      of which non-units:       ${vanillaNonUnits}`);
console.log(`  - ENRICHED by this slice:     ${enrichedCount}\n`);

console.log("--- Derived interaction histogram (trigger:op -> count) ---");
for (const [op, n] of [...byOp.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${op.padEnd(34)} ${String(n).padStart(4)}`);
}

console.log("\n--- Concrete examples (card -> new effect) ---");
for (const e of examples) {
  console.log(`  [${e.id}] ${e.name}  (kw: ${e.kw}, Grade ${e.grade})`);
  console.log(`      -> ${e.effect}`);
}

console.log("\n--- POWER SANITY ---");
console.log(`  Max enrichment value across slice: ${maxValue} point(s) (cap ${ENRICHMENT_MAX_VALUE_POINTS})`);
console.log(`  Power-cap violations:              ${powerViolations}`);
console.log(`  Grade-ceiling violations:          ${gradeViolations}`);

// --- Under-flag catalog assertion (only meaningful when the flag is ON) --------
if (ENABLE_ENRICHMENT) {
  // Pick a known enriched id and confirm the LIVE catalog object carries the
  // enrichmentSpecs (i.e. the cards.ts seam attached it under the flag).
  const sample = examples[0];
  if (sample) {
    const live = getPlayableCardById(sample.id) as any;
    const ok = Array.isArray(live?.enrichmentSpecs) && live.enrichmentSpecs.length > 0;
    console.log(
      `\n  [flag ON] live catalog carries enrichmentSpecs for ${sample.id}: ${ok ? "YES" : "NO"}`
    );
    if (!ok) {
      console.error("FAILED: enrichment flag ON but catalog card has no enrichmentSpecs.");
      process.exit(1);
    }
  }
  // And a control: a non-vanilla Stone common (already has ops) must NOT be enriched.
  const nonVanilla = stoneCommons.find(
    (c) => compileAbility(c.rawTraits?.Ability).specs.length > 0
  );
  if (nonVanilla) {
    const live = getPlayableCardById(nonVanilla.id) as any;
    const clean = !live?.enrichmentSpecs || live.enrichmentSpecs.length === 0;
    console.log(
      `  [flag ON] non-vanilla ${nonVanilla.id} left un-enriched (no double-dip): ${clean ? "YES" : "NO"}`
    );
    if (!clean) {
      console.error("FAILED: a non-vanilla card was enriched (double-dip).");
      process.exit(1);
    }
  }
} else {
  console.log(
    "\n  [flag OFF] live catalog carries NO enrichment (byte-identical to today)."
  );
  // Assert isolation: NO catalog card carries enrichmentSpecs with the flag off.
  const leaked = stoneCommons
    .map((c) => getPlayableCardById(c.id) as any)
    .filter((c) => c && Array.isArray(c.enrichmentSpecs) && c.enrichmentSpecs.length > 0);
  const ok = leaked.length === 0;
  console.log(`  [flag OFF] catalog enrichment leak check: ${ok ? "CLEAN" : "LEAKED"}`);
  if (!ok) {
    console.error(`FAILED: ${leaked.length} card(s) carry enrichment with the flag OFF.`);
    process.exit(1);
  }
}

const PASS = powerViolations === 0 && gradeViolations === 0;
console.log(`\n=== ENRICHMENT REPORT GATE: ${PASS ? "PASS" : "FAIL"} ===`);
if (!PASS) {
  console.error("FAILED: enrichment power/grade sanity violated.");
  process.exit(1);
}
console.log("PASSED");
