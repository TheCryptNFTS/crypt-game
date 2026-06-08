const fs = require("fs");
const path = require("path");

const setPath = path.resolve(process.cwd(), "src/data/curatedCoreSetV2.json");
const data = JSON.parse(fs.readFileSync(setPath, "utf8"));

// RECONCILED with scripts/reportCardOutliers.cjs (2026.06.06).
//
// BEFORE: this gate used a WEAKER power formula (armor 0.7, speed 0.5, keyword 1.2)
// AND a softer net (cost<=2 && ratio>6.5), so it flagged ZERO while reportCardOutliers
// — the human-facing report — flagged ~31% of curated units (all undercosted cost-2
// bodies) with armor 1.1 / speed 0.6 / keyword 1.5 at ratio > 6.0, ANY cost. That
// mismatch made the "alpha balance PASS" signal hollow.
//
// NOW: the gate mirrors the report's EXACT unit-power weights and its > 6.0 ratio
// threshold across ALL costs, so it catches precisely the bodies the report sees.
// The matching balance patch (scripts/buildCuratedCoreSetV2.cjs `recostUndercosted-
// TwoDrops`) re-costs the durable undercosted cost-2 walls/beaters to 3, which clears
// every flag EXCEPT one DELIBERATE, documented class:
//
//   RUSH cost-2 skirmishers — the aggro factions' intended cheap tempo. They sit
//   just over the 6.0 stat-ratio line but are balanced by fragility and the fact
//   they must commit to the board to matter; re-costing them to 3 craters BRONZE /
//   SILVER in the matchup sim and re-opens blowouts. They are an INTENDED archetype
//   tool, not a slop outlier, so the gate exempts the cost-2 RUSH class. Everything
//   else over 6.0 is a real failure the gate will (and should) catch.
function unitScore(card) {
  const stats = card.stats || {};
  const attack = stats.attack || 0;
  const health = stats.health || 0;
  const armor = stats.armor || 0;
  const speed = stats.speed || 0;
  const keywordCount = (card.keywords || []).length;

  return attack + (health * 0.8) + (armor * 1.1) + (speed * 0.6) + (keywordCount * 1.5);
}

const OUTLIER_RATIO = 6.0;

// Intended cheap-tempo archetype: cost-2 RUSH skirmishers (see header). Exempt so the
// gate's PASS is meaningful — it still fails on every other over-line body.
function isIntendedAggroTempo(card) {
  return card.cost === 2 && (card.keywords || []).includes("RUSH");
}

const issues = [];

for (const card of data.units || []) {
  if (isIntendedAggroTempo(card)) continue;

  const score = unitScore(card);
  const ratio = score / Math.max(card.cost || 1, 1);

  if (ratio > OUTLIER_RATIO) {
    issues.push({
      id: card.id,
      faction: card.faction,
      cost: card.cost,
      score: Number(score.toFixed(2)),
      ratio: Number(ratio.toFixed(2))
    });
  }
}

console.log("\n=== CURATED ALPHA BALANCE GATE ===");
console.log(`Flagged: ${issues.length}`);
if (issues.length) {
  console.log(JSON.stringify(issues.slice(0, 50), null, 2));
  process.exit(1);
}
console.log("PASS");
