const fs = require("fs");
const path = require("path");

function load(rel) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), rel), "utf8"));
}

function unitPower(card) {
  return (card.stats.attack * 1.0) + (card.stats.health * 0.8) + (card.stats.armor * 1.1) + (card.stats.speed * 0.6) + ((card.keywords || []).length * 1.5);
}

function equipmentPower(card) {
  return (card.bonuses.attack * 1.0) + (card.bonuses.health * 0.8) + (card.bonuses.armor * 1.1) + (card.bonuses.speed * 0.6) + ((card.keywords || []).length * 1.25);
}

function artifactPower(card) {
  return ((card.effectTags || []).length * 2.0) + (card.cost * 0.4);
}

/**
 * Pure, deterministic outlier computation. Returns the flagged issues sorted by a
 * stable key (type, then severity, then id) so the list is byte-identical run to
 * run — the baseline gate (src/dev/runCardOutlierSweep.ts) depends on this order.
 * `ratio` is rounded to 4 dp so float jitter never spuriously changes the baseline.
 */
function computeOutliers() {
  const units = load("src/data/generatedPlayableTcgUnits.json");
  const equipment = load("src/data/generatedPlayableTcgEquipment.json");
  const artifacts = load("src/data/generatedPlayableTcgArtifacts.json");

  const issues = [];
  const round4 = (n) => Math.round(n * 10000) / 10000;

  for (const card of units) {
    const score = unitPower(card);
    const ratio = score / Math.max(1, card.cost);
    if (ratio > 6.0) issues.push({ type: "unit", severity: "high", id: card.id, cost: card.cost, score: round4(score), ratio: round4(ratio) });
    if (ratio < 2.0) issues.push({ type: "unit", severity: "low", id: card.id, cost: card.cost, score: round4(score), ratio: round4(ratio) });
  }

  for (const card of equipment) {
    const score = equipmentPower(card);
    const ratio = score / Math.max(1, card.cost);
    if (ratio > 4.5) issues.push({ type: "equipment", severity: "high", id: card.id, cost: card.cost, score: round4(score), ratio: round4(ratio) });
    if (ratio < 1.25) issues.push({ type: "equipment", severity: "low", id: card.id, cost: card.cost, score: round4(score), ratio: round4(ratio) });
  }

  for (const card of artifacts) {
    const score = artifactPower(card);
    const ratio = score / Math.max(1, card.cost);
    if (ratio > 2.5) issues.push({ type: "artifact", severity: "high", id: card.id, cost: card.cost, score: round4(score), ratio: round4(ratio) });
  }

  issues.sort((a, b) =>
    a.type.localeCompare(b.type) ||
    a.severity.localeCompare(b.severity) ||
    String(a.id).localeCompare(String(b.id))
  );

  return issues;
}

module.exports = { computeOutliers, unitPower, equipmentPower, artifactPower };

// Direct-run mode: `node scripts/reportCardOutliers.cjs` still prints the report.
if (require.main === module) {
  const issues = computeOutliers();
  console.log("\n=== CARD OUTLIER REPORT ===");
  console.log(`Total flagged: ${issues.length}`);
  console.log(JSON.stringify(issues.slice(0, 100), null, 2));
}
