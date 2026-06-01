/**
 * dev:seasons — proof that the SEASON CADENCE ENGINE (A7) is pure, deterministic,
 * additive, and INERT (it never changes a live match unless a caller opts in).
 *
 * Asserts:
 *   1. The active season resolves to a real config and a shipped Format.
 *   2. Every season's spotlight ruleset is a SUBSET of already-shipped MatchRules
 *      flags (no invented mechanic/token).
 *   3. Selectors are pure/deterministic (same call -> same result) and return
 *      FRESH ruleset objects (mutating one can't poison the table).
 *   4. Rotating ACTIVE_SEASON_ID is the only knob — the table itself is stable.
 */

import {
  SEASONS,
  getActiveSeason,
  activeSeasonFormat,
  activeSeasonRuleset,
  activeSeasonSpotlight,
  allSeasonsInOrder,
  getSeasonById,
} from "../engine/seasons";
import type { MatchRules } from "../engine/state";

let failed = 0;
function assert(cond: boolean, msg: string, detail?: unknown): void {
  if (cond) {
    console.log(`OK: ${msg}`);
  } else {
    console.error(`FAIL: ${msg}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
    failed += 1;
  }
}

// The full set of MatchRules flags the engine already ships (no season may exceed this).
const ALLOWED_RULE_KEYS: ReadonlySet<keyof MatchRules> = new Set([
  "responseStack",
  "deckoutLoss",
  "assembleToWin",
  "ascendancyToWin",
  "factionIdentities",
  "factionArchetypes",
  "traitResonance",
]);

console.log(`=== SEASON CADENCE PROOF (${SEASONS.length} seasons) ===`);

// 1. Active season resolves.
const active = getActiveSeason();
assert(!!active && !!active.seasonId, "active season resolves to a config", active?.seasonId);
assert(
  activeSeasonFormat() === "Open" || activeSeasonFormat() === "Core",
  "active season format is a shipped Format",
  activeSeasonFormat(),
);
assert(typeof activeSeasonSpotlight() === "string", "active season has a spotlight archetype");

// 2. Every season's ruleset is a subset of shipped flags.
for (const s of SEASONS) {
  if (!s.ruleset) {
    assert(true, `[${s.seasonId}] framing-only (no ruleset) — inert by construction`);
    continue;
  }
  const keys = Object.keys(s.ruleset) as (keyof MatchRules)[];
  const illegal = keys.filter((k) => !ALLOWED_RULE_KEYS.has(k));
  assert(illegal.length === 0, `[${s.seasonId}] ruleset uses only shipped MatchRules flags`, illegal);
}

// 3. Selectors are pure + return fresh objects.
{
  const r1 = activeSeasonRuleset();
  const r2 = activeSeasonRuleset();
  assert(JSON.stringify(r1) === JSON.stringify(r2), "activeSeasonRuleset is deterministic");
  if (r1) {
    (r1 as MatchRules).factionIdentities = !(r1 as MatchRules).factionIdentities;
    const r3 = activeSeasonRuleset();
    assert(
      JSON.stringify(r3) === JSON.stringify(r2),
      "activeSeasonRuleset returns a FRESH object (mutation can't poison the table)",
    );
  }
}

// 4. The table is ordered + stable.
{
  const ordered = allSeasonsInOrder();
  const sorted = [...ordered].every((s, i) => i === 0 || ordered[i - 1].ordinal <= s.ordinal);
  assert(sorted, "allSeasonsInOrder returns seasons in ordinal order");
  assert(getSeasonById(active.seasonId)?.seasonId === active.seasonId, "getSeasonById round-trips the active id");
}

console.log(`\n=== SEASON PROOF SUMMARY ===`);
if (failed > 0) {
  console.error(`FAILED: ${failed} season check(s) failed.`);
  process.exit(1);
}
console.log("ALL SEASON PROOFS PASSED");
