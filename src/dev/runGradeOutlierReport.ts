/**
 * dev:grade-outliers — READ-ONLY mis-tune finder for the re-revealed collection.
 *
 * The 4129-card pool now ships with an AUTHORED on-chain "Grade" (≈0–100 power
 * score) in `rawTraits`. This report cross-checks that authored Grade against the
 * card's actual cost/stats to surface cards that are likely MIS-TUNED — either
 * over-graded vs their peers (cheap/weak but stamped powerful) or under-graded
 * (expensive/beefy but stamped weak), and cards whose Grade and on-board stat-sum
 * simply disagree.
 *
 * Method (all pure, no state, no writes):
 *   1. Parse Grade / Cost / Attack / Health (strings → numbers) from
 *      generatedTcgCards.json. Skip cards with no parseable Grade.
 *   2. statSum = attack + health + a small keyword bonus (keywords carry power
 *      the raw stat line doesn't show).
 *   3. Group into equivalence classes = faction × rarity × cost-band
 *      (cost-band: 1-2 / 3-4 / 5-6 / 7+). Per class compute mean+stddev of Grade
 *      and of statSum.
 *   4. Flag OUTLIERS: |Grade z-score within class| > 2 (over/under-graded vs
 *      peers) AND a "disagreement" flag where Grade z and statSum z point opposite
 *      ways (high Grade / low stats = under-statted for its tier, or vice versa).
 *   5. Cross-check the LIVE engine catalog: join by id to `allPlayableCards` so the
 *      report shows the ACTUAL post-override playable cost/stats, and flag whether
 *      a `cardOverrides` entry already exists for that id.
 *   6. Print a per-class summary table, then the worst over-statted and worst
 *      under-statted cards, sorted by |z|.
 *
 *   npx tsx src/dev/runGradeOutlierReport.ts
 *
 * READ-ONLY: imports the engine catalog + override map; mutates nothing.
 */

import rawCards from "../data/generatedTcgCards.json";
import { allPlayableCards } from "../engine/cards";
import { cardOverrides } from "../engine/cardOverrides";

// ---------------------------------------------------------------------------
// Config.
// ---------------------------------------------------------------------------
const Z_FLAG = 2; // |z| beyond this within a class => outlier
const MIN_CLASS_N = 4; // need this many peers before a z-score is meaningful
const KEYWORD_BONUS = 1; // small statSum weight per keyword
const TOP_N = 30; // worst N over- and under-statted to print

// ---------------------------------------------------------------------------
// Raw shape (rawTraits values are STRINGS).
// ---------------------------------------------------------------------------
interface RawCard {
  id?: string;
  name?: string;
  faction?: string;
  rarity?: string;
  cardClass?: string;
  keywords?: string[];
  rawTraits?: Record<string, string | null | undefined>;
}

const cards = rawCards as unknown as RawCard[];

/** Parse a string trait to a finite number, or null. */
function num(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number.parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

/** Bucket a cost into a readable band. */
function costBand(cost: number): string {
  if (cost <= 2) return "1-2";
  if (cost <= 4) return "3-4";
  if (cost <= 6) return "5-6";
  return "7+";
}

// ---------------------------------------------------------------------------
// Live catalog join (post-override actual playable cost/stats).
// ---------------------------------------------------------------------------
const liveById = new Map(allPlayableCards.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// 1-2. Build the parsed working set.
// ---------------------------------------------------------------------------
interface Parsed {
  id: string;
  name: string;
  faction: string;
  rarity: string;
  cost: number;
  attack: number;
  health: number;
  grade: number;
  keywordCount: number;
  statSum: number;
  className: string;
  // live join (post-override) — may be absent if the card isn't playable
  liveCost: number | null;
  liveAttack: number | null;
  liveHealth: number | null;
  hasOverride: boolean;
  // class-relative (filled after grouping)
  gradeZ: number;
  statZ: number;
  disagreement: number; // gradeZ - statZ : +ve => over-graded/under-statted
}

const parsed: Parsed[] = [];
let skippedNoGrade = 0;

for (const c of cards) {
  const grade = num(c.rawTraits?.Grade);
  if (grade == null) {
    skippedNoGrade += 1;
    continue;
  }
  const cost = num(c.rawTraits?.Cost) ?? 0;
  const attack = num(c.rawTraits?.Attack) ?? 0;
  const health = num(c.rawTraits?.Health) ?? 0;
  const keywordCount = Array.isArray(c.keywords) ? c.keywords.length : 0;
  const statSum = attack + health + keywordCount * KEYWORD_BONUS;

  const id = c.id ?? c.name ?? "?";
  const faction = c.faction ?? "?";
  const rarity = c.rarity ?? "?";
  const live = liveById.get(id);

  parsed.push({
    id,
    name: c.name ?? id,
    faction,
    rarity,
    cost,
    attack,
    health,
    grade,
    keywordCount,
    statSum,
    className: `${faction} | ${rarity} | ${costBand(cost)}`,
    liveCost: live ? live.cost : null,
    liveAttack: live ? live.stats.attack : null,
    liveHealth: live ? live.stats.health : null,
    hasOverride: id in cardOverrides,
    gradeZ: 0,
    statZ: 0,
    disagreement: 0,
  });
}

// ---------------------------------------------------------------------------
// 3. Group into equivalence classes; compute per-class mean/stddev.
// ---------------------------------------------------------------------------
interface ClassStat {
  className: string;
  n: number;
  gradeMean: number;
  gradeStd: number;
  statMean: number;
  statStd: number;
}

function meanStd(xs: number[]): { mean: number; std: number } {
  const n = xs.length;
  if (n === 0) return { mean: 0, std: 0 };
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  return { mean, std: Math.sqrt(variance) };
}

const byClass = new Map<string, Parsed[]>();
for (const p of parsed) {
  const arr = byClass.get(p.className) ?? [];
  arr.push(p);
  byClass.set(p.className, arr);
}

const classStats = new Map<string, ClassStat>();
for (const [className, members] of byClass) {
  const g = meanStd(members.map((m) => m.grade));
  const s = meanStd(members.map((m) => m.statSum));
  classStats.set(className, {
    className,
    n: members.length,
    gradeMean: g.mean,
    gradeStd: g.std,
    statMean: s.mean,
    statStd: s.std,
  });

  // Fill per-card z-scores (only meaningful when the class has enough peers and
  // non-zero spread; otherwise z stays 0 so the card simply won't flag).
  for (const m of members) {
    m.gradeZ = g.std > 0 && members.length >= MIN_CLASS_N ? (m.grade - g.mean) / g.std : 0;
    m.statZ = s.std > 0 && members.length >= MIN_CLASS_N ? (m.statSum - s.mean) / s.std : 0;
    // disagreement: high Grade but low stats (+ve) or low Grade but high stats (-ve).
    m.disagreement = m.gradeZ - m.statZ;
  }
}

// ---------------------------------------------------------------------------
// 4. Flag outliers.
// ---------------------------------------------------------------------------
const gradeOutliers = parsed.filter((p) => Math.abs(p.gradeZ) > Z_FLAG);
const disagreers = parsed.filter((p) => Math.abs(p.disagreement) > Z_FLAG);
const flaggedIds = new Set<string>([...gradeOutliers, ...disagreers].map((p) => p.id));
const flaggedWithOverride = [...flaggedIds].filter((id) => id in cardOverrides).length;

// "Over-statted" = the card looks STRONGER than its authored Grade implies vs
// peers: stats high relative to Grade => disagreement is NEGATIVE (statZ > gradeZ).
// "Under-statted" = stats LOW relative to Grade => disagreement POSITIVE.
// We surface by the disagreement magnitude (Grade vs actual power mismatch), which
// is the lever Billy retunes via cardOverrides.
const overStatted = [...parsed]
  .filter((p) => p.disagreement < 0 && Math.abs(p.disagreement) > Z_FLAG)
  .sort((a, b) => Math.abs(b.disagreement) - Math.abs(a.disagreement))
  .slice(0, TOP_N);

const underStatted = [...parsed]
  .filter((p) => p.disagreement > 0 && Math.abs(p.disagreement) > Z_FLAG)
  .sort((a, b) => Math.abs(b.disagreement) - Math.abs(a.disagreement))
  .slice(0, TOP_N);

// ---------------------------------------------------------------------------
// Print helpers.
// ---------------------------------------------------------------------------
function pad(v: unknown, w: number): string {
  return String(v).padEnd(w).slice(0, w);
}
function padR(v: unknown, w: number): string {
  return String(v).padStart(w);
}
function f2(n: number): string {
  return n.toFixed(2);
}

function printCardTable(title: string, rows: Parsed[]): void {
  console.log(`\n${title}  (n=${rows.length}, sorted by |Grade-vs-stats disagreement|)`);
  console.log(
    `  ${pad("id", 10)} ${pad("name", 26)} ${pad("faction", 16)} ${pad("rarity", 9)} ` +
      `${padR("cost", 4)} ${padR("a/h", 7)} ${padR("Grade", 6)} ${padR("gZ", 6)} ${padR("sZ", 6)} ${padR("dis", 6)} ${pad("ovr", 4)} ${pad("live a/h@cost", 14)}`
  );
  for (const r of rows) {
    const live =
      r.liveAttack == null ? "(not playable)" : `${r.liveAttack}/${r.liveHealth}@${r.liveCost}`;
    console.log(
      `  ${pad(r.id, 10)} ${pad(r.name, 26)} ${pad(r.faction, 16)} ${pad(r.rarity, 9)} ` +
        `${padR(r.cost, 4)} ${padR(`${r.attack}/${r.health}`, 7)} ${padR(r.grade, 6)} ` +
        `${padR(f2(r.gradeZ), 6)} ${padR(f2(r.statZ), 6)} ${padR(f2(r.disagreement), 6)} ` +
        `${pad(r.hasOverride ? "yes" : "no", 4)} ${pad(live, 14)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------
console.log("\n=== CRYPT TCG — GRADE OUTLIER / MIS-TUNE REPORT (read-only) ===");
console.log(
  `cards=${cards.length}  withGrade=${parsed.length}  skipped(noGrade)=${skippedNoGrade}  ` +
    `classes=${classStats.size}  |z|>${Z_FLAG} flag threshold`
);
console.log(
  `live-catalog join: ${parsed.filter((p) => p.liveCost != null).length}/${parsed.length} parsed cards are playable; ` +
    `${Object.keys(cardOverrides).length} total overrides exist.`
);

// ---- Per-class summary table (sorted by class size desc) ----
console.log("\n--- PER-CLASS SUMMARY (faction × rarity × cost-band) ---");
console.log(
  `  ${pad("class (faction | rarity | band)", 44)} ${padR("n", 4)} ${padR("gradeMean", 10)} ${padR("gradeStd", 9)} ${padR("statMean", 9)} ${padR("statStd", 8)}`
);
const sortedClasses = [...classStats.values()].sort((a, b) => b.n - a.n);
for (const cs of sortedClasses) {
  console.log(
    `  ${pad(cs.className, 44)} ${padR(cs.n, 4)} ${padR(f2(cs.gradeMean), 10)} ${padR(f2(cs.gradeStd), 9)} ` +
      `${padR(f2(cs.statMean), 9)} ${padR(f2(cs.statStd), 8)}`
  );
}

// ---- Headline flag counts ----
console.log("\n--- FLAG SUMMARY ---");
console.log(`  Grade z-score outliers (|gradeZ|>${Z_FLAG}):        ${gradeOutliers.length}`);
console.log(`  Grade-vs-stats disagreements (|dis|>${Z_FLAG}):     ${disagreers.length}`);
console.log(`  Distinct cards flagged (union):                 ${flaggedIds.size}`);
console.log(`  ...of which already have a cardOverride:        ${flaggedWithOverride}`);
console.log(`  ...still un-tuned (no override):                ${flaggedIds.size - flaggedWithOverride}`);

// ---- Worst over- / under-statted ----
printCardTable(
  `TOP ${TOP_N} OVER-STATTED  (stats HIGHER than authored Grade vs peers → candidate NERF)`,
  overStatted
);
printCardTable(
  `TOP ${TOP_N} UNDER-STATTED (stats LOWER than authored Grade vs peers → candidate BUFF)`,
  underStatted
);

console.log(
  "\nLegend: gZ=Grade z within class, sZ=statSum z within class, dis=gZ−sZ (disagreement). " +
    "dis<0 ⇒ over-statted for its Grade (nerf candidate); dis>0 ⇒ under-statted (buff candidate). " +
    "ovr=cardOverride already exists. Retune via src/engine/cardOverrides.ts."
);
console.log("\nDONE (read-only; nothing written).");
