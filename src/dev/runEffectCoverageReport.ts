/**
 * dev:effect-coverage — Phase A coverage report for the ability compiler.
 *
 * Runs the PURE `compileAbility()` over every card's real mechanical text
 * (`generatedTcgCards.json` -> `rawTraits.Ability`) and reports, card-weighted:
 *   - % recognized (every clause classified, nothing UNKNOWN)
 *   - split of recognized into real-op vs no-op (static / keyword-wired) cards
 *   - op histogram (which runtime effects the live corpus actually needs)
 *   - the unrecognized long-tail (so we can see what's left to template)
 *
 * NOTHING here touches match state. It only measures parser reach so we can
 * gate Phase B/C work on a known coverage number. The gate is generous: it
 * fails only if recognition regresses below 95% (we already sit ~98-99%).
 */

import { compileAbility } from "../engine/abilityCompiler";
import rawCards from "../data/generatedTcgCards.json";

interface RawCard {
  id?: string;
  name?: string;
  rawTraits?: { Ability?: string | null };
}

const cards = rawCards as unknown as RawCard[];

let total = 0; // cards with non-empty ability text
let recognized = 0; // classified with no UNKNOWN op
let realOp = 0; // recognized AND emits at least one runtime spec
let noOp = 0; // recognized but purely static / keyword-wired
const opCounts = new Map<string, number>();
const unrecognized: { id: string; ability: string }[] = [];
const realOpExamples = new Map<string, string>();

for (const card of cards) {
  const ability = card.rawTraits?.Ability?.trim();
  if (!ability) continue;
  total += 1;

  const compiled = compileAbility(ability);

  if (compiled.recognized) {
    recognized += 1;
    if (compiled.specs.length > 0) realOp += 1;
    else noOp += 1;
  } else {
    if (unrecognized.length < 40) {
      unrecognized.push({ id: card.id ?? card.name ?? "?", ability });
    }
  }

  for (const spec of compiled.classified) {
    opCounts.set(spec.op, (opCounts.get(spec.op) ?? 0) + 1);
    if (!realOpExamples.has(spec.op) && spec.op !== "UNKNOWN") {
      realOpExamples.set(spec.op, ability);
    }
  }
}

const pct = (n: number) => ((n / total) * 100).toFixed(2);

console.log("\n=== ABILITY COMPILER COVERAGE (Phase A) ===\n");
console.log(`Cards with ability text:   ${total}`);
console.log(`Recognized (no UNKNOWN):   ${recognized}  (${pct(recognized)}%)`);
console.log(`  - emits a runtime op:    ${realOp}  (${pct(realOp)}%)`);
console.log(`  - no-op (static/wired):  ${noOp}  (${pct(noOp)}%)`);
console.log(`Unrecognized long-tail:    ${total - recognized}  (${pct(total - recognized)}%)`);

console.log("\n--- Op histogram (card-weighted, includes no-op classes) ---");
for (const [op, n] of [...opCounts.entries()].sort((a, b) => b[1] - a[1])) {
  const ex = realOpExamples.get(op);
  console.log(`  ${op.padEnd(16)} ${String(n).padStart(5)}${ex ? `   e.g. "${ex.slice(0, 60)}"` : ""}`);
}

if (unrecognized.length > 0) {
  console.log(`\n--- Unrecognized sample (first ${unrecognized.length}) ---`);
  for (const u of unrecognized) {
    console.log(`  [${u.id}] ${u.ability.slice(0, 80)}`);
  }
}

const recognizedPct = (recognized / total) * 100;
console.log(`\n=== COVERAGE GATE: ${recognizedPct.toFixed(2)}% recognized (floor 95%) ===`);
if (recognizedPct < 95) {
  console.error("FAILED: ability recognition regressed below 95%.");
  process.exit(1);
}
console.log("PASSED");
