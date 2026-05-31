/**
 * dev:card-outliers — the BALANCE-OUTLIER gate (gap #12).
 *
 * scripts/reportCardOutliers.cjs flags every card whose crude power/cost ratio
 * falls outside a sane band (over-statted cheap units, runaway equipment, etc.).
 * On its own it's just a printout. This file turns it into a GATE: it recomputes
 * the outlier set and asserts that NO NEW outlier id has appeared beyond a
 * checked-in baseline (src/data/cardOutlierBaseline.json).
 *
 * Why a baseline (not "zero outliers")? The shipped on-chain corpus already
 * contains ~1.5k cards outside the band — those are pre-existing and not this
 * pass's job to re-stat. The gate's value is REGRESSION protection: if a future
 * cardOverrides.ts stat patch (or a data regen) pushes a NEW card out of band,
 * this fails loudly. Shrinking the set (an override that TIGHTENS a card back
 * into band) is always allowed and reported.
 *
 * Deterministic: computeOutliers() reads static JSON, rounds ratios to 4dp, and
 * sorts by a stable key. No RNG, no clock. To intentionally accept a new outlier,
 * re-stamp the baseline: `node -e` regenerate (see header of the baseline file).
 */

import { createRequire } from "node:module";
import baseline from "../data/cardOutlierBaseline.json";

const require = createRequire(import.meta.url);
// The outlier logic lives in the .cjs report so the runnable report and this gate
// share ONE source of truth for the thresholds.
const { computeOutliers } = require("../../scripts/reportCardOutliers.cjs") as {
  computeOutliers: () => Array<{ type: string; severity: string; id: string; cost: number; score: number; ratio: number }>;
};

const baselineIds = new Set<string>((baseline as { ids: string[] }).ids);

const issues = computeOutliers();
const currentIds = issues.map((i) => i.id);
const currentSet = new Set(currentIds);

// NEW outliers = flagged now but NOT in the baseline. This is the gate.
const newOutliers = issues.filter((i) => !baselineIds.has(i.id));
// Resolved = were in baseline, no longer flagged. Informational (allowed/good).
const resolved = [...baselineIds].filter((id) => !currentSet.has(id)).sort();

console.log("\n=== CARD OUTLIER SWEEP (balance regression gate) ===");
console.log(`Baseline outliers:   ${baselineIds.size}`);
console.log(`Current outliers:    ${currentSet.size}`);
console.log(`New (regressions):   ${newOutliers.length}`);
console.log(`Resolved (tightened):${resolved.length}`);

if (resolved.length > 0) {
  console.log("\n--- Resolved outliers (now in band — fine to re-baseline) ---");
  console.log("  " + resolved.slice(0, 50).join(", ") + (resolved.length > 50 ? " ..." : ""));
}

if (newOutliers.length > 0) {
  console.error("\n--- NEW outliers beyond baseline (FAIL) ---");
  for (const o of newOutliers.slice(0, 50)) {
    console.error(`  ${String(o.id).padEnd(12)} ${o.type}/${o.severity}  cost=${o.cost} score=${o.score} ratio=${o.ratio}`);
  }
  console.error(
    `\nFAILED: ${newOutliers.length} NEW balance outlier(s) appeared beyond the checked-in baseline. ` +
      `Either re-stat the offending card(s) in cardOverrides.ts, or (if intentional) re-stamp src/data/cardOutlierBaseline.json.`
  );
  process.exit(1);
}

console.log("\nPASSED: no new balance outliers beyond the checked-in baseline.");
process.exit(0);
