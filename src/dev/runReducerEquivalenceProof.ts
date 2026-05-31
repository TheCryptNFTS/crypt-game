/**
 * dev:reducer-equivalence — the KEY record/replay guarantee.
 *
 * For each scripted scenario we replay `(build(), actions)` through the single
 * `applyAction` reducer and compare the final state + event stream to a
 * committed JSON fixture. The fixtures are the golden snapshot of the game's
 * LIVED rules; any deviation across future refactors is a BUG, not an update.
 *
 * Recording: run with `RECORD=1 npm run dev:reducer-equivalence` to (re)write
 * the fixture. Without it the script asserts equality and fails on any drift.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildScenarios } from "./reducerScenarios";
import { replay } from "./reducerHarness";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "fixtures", "reducerEquivalence.json");

const RECORD = process.env.RECORD === "1";

function stable(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

function run() {
  const scenarios = buildScenarios();
  const current: Record<string, { finalState: unknown; events: unknown }> = {};

  for (const sc of scenarios) {
    const res = replay(sc.build(), sc.actions);
    current[sc.name] = { finalState: res.finalState, events: res.events };
  }

  if (RECORD || !existsSync(FIXTURE)) {
    mkdirSync(dirname(FIXTURE), { recursive: true });
    writeFileSync(FIXTURE, stable(current) + "\n");
    console.log(`RECORDED ${scenarios.length} scenarios -> ${FIXTURE}`);
    if (!RECORD) {
      console.log("(fixture was missing; recorded baseline. Re-run to verify.)");
    }
    return;
  }

  const golden = JSON.parse(readFileSync(FIXTURE, "utf8"));
  let failed = 0;

  for (const sc of scenarios) {
    const got = current[sc.name];
    const want = golden[sc.name];
    if (!want) {
      console.error(`MISSING FIXTURE: ${sc.name} (re-record with RECORD=1)`);
      failed += 1;
      continue;
    }
    const gotStr = stable(got);
    const wantStr = stable(want);
    if (gotStr !== wantStr) {
      console.error(`DRIFT: ${sc.name}`);
      // Show a compact first-diff hint.
      const gl = gotStr.split("\n");
      const wl = wantStr.split("\n");
      for (let i = 0; i < Math.max(gl.length, wl.length); i += 1) {
        if (gl[i] !== wl[i]) {
          console.error(`  @${i} want: ${wl[i]}`);
          console.error(`  @${i}  got: ${gl[i]}`);
          break;
        }
      }
      failed += 1;
    } else {
      console.log(`OK: ${sc.name}`);
    }
  }

  // Detect stale fixtures (golden has scenarios no longer produced).
  for (const name of Object.keys(golden)) {
    if (!current[name]) {
      console.error(`STALE FIXTURE: ${name} (no longer generated)`);
      failed += 1;
    }
  }

  if (failed > 0) {
    console.error(`\nREDUCER EQUIVALENCE FAILED: ${failed} scenario(s) drifted.`);
    process.exit(1);
  }
  console.log(`\nALL ${scenarios.length} REDUCER EQUIVALENCE SCENARIOS PASSED`);
}

run();
