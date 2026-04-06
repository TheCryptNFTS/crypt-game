const fs = require("fs");
const path = require("path");

const units = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgUnits.json"), "utf8"));
const equipment = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgEquipment.json"), "utf8"));
const artifacts = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgArtifacts.json"), "utf8"));

function unitPower(card) {
  return (card.stats.attack * 1.0) + (card.stats.health * 0.8) + (card.stats.armor * 1.1) + (card.stats.speed * 0.6) + ((card.keywords || []).length * 1.5);
}

function equipmentPower(card) {
  return (card.bonuses.attack * 1.0) + (card.bonuses.health * 0.8) + (card.bonuses.armor * 1.1) + (card.bonuses.speed * 0.6) + ((card.keywords || []).length * 1.25);
}

function artifactPower(card) {
  return ((card.effectTags || []).length * 2.0) + (card.cost * 0.4);
}

const issues = [];

for (const card of units) {
  const score = unitPower(card);
  const ratio = score / Math.max(1, card.cost);
  if (ratio > 6.0) issues.push({ type: "unit", severity: "high", id: card.id, cost: card.cost, score, ratio });
  if (ratio < 2.0) issues.push({ type: "unit", severity: "low", id: card.id, cost: card.cost, score, ratio });
}

for (const card of equipment) {
  const score = equipmentPower(card);
  const ratio = score / Math.max(1, card.cost);
  if (ratio > 4.5) issues.push({ type: "equipment", severity: "high", id: card.id, cost: card.cost, score, ratio });
  if (ratio < 1.25) issues.push({ type: "equipment", severity: "low", id: card.id, cost: card.cost, score, ratio });
}

for (const card of artifacts) {
  const score = artifactPower(card);
  const ratio = score / Math.max(1, card.cost);
  if (ratio > 2.5) issues.push({ type: "artifact", severity: "high", id: card.id, cost: card.cost, score, ratio });
}

console.log("\n=== CARD OUTLIER REPORT ===");
console.log(`Total flagged: ${issues.length}`);
console.log(JSON.stringify(issues.slice(0, 100), null, 2));
