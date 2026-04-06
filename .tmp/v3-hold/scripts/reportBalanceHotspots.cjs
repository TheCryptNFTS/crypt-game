const fs = require("fs");
const path = require("path");

const profile = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "config/balanceProfile.json"), "utf8")
);

const units = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgUnits.json"), "utf8")
);
const equipment = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgEquipment.json"), "utf8")
);
const artifacts = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgArtifacts.json"), "utf8")
);

function kwScore(keywords = []) {
  return keywords.reduce((sum, k) => sum + (profile.keywordWeights[k] || 0), 0);
}

function unitScore(card) {
  const s = card.stats || {};
  return (
    (s.attack || 0) * profile.unitStatWeights.attack +
    (s.health || 0) * profile.unitStatWeights.health +
    (s.armor || 0) * profile.unitStatWeights.armor +
    (s.speed || 0) * profile.unitStatWeights.speed +
    kwScore(card.keywords || [])
  );
}

function equipmentScore(card) {
  const s = card.bonuses || {};
  return (
    (s.attack || 0) * profile.equipmentStatWeights.attack +
    (s.health || 0) * profile.equipmentStatWeights.health +
    (s.armor || 0) * profile.equipmentStatWeights.armor +
    (s.speed || 0) * profile.equipmentStatWeights.speed +
    kwScore(card.keywords || [])
  );
}

function artifactScore(card) {
  return (card.effectTags || []).length;
}

const outliers = [];

for (const card of units) {
  const budget = profile.unitBudgetByCost[String(card.cost)] || 999;
  const score = unitScore(card);
  const ratio = score / budget;
  if (ratio > profile.maxUnitRatioOverBudget) {
    outliers.push({ type: "unit", id: card.id, faction: card.faction, cost: card.cost, score, budget, ratio: Number(ratio.toFixed(3)) });
  }
}

for (const card of equipment) {
  const budget = profile.equipmentBudgetByCost[String(card.cost)] || 999;
  const score = equipmentScore(card);
  const ratio = score / budget;
  if (ratio > profile.maxEquipmentRatioOverBudget) {
    outliers.push({ type: "equipment", id: card.id, faction: card.faction, cost: card.cost, score, budget, ratio: Number(ratio.toFixed(3)) });
  }
}

for (const card of artifacts) {
  const budget = profile.artifactBudgetByCost[String(card.cost)] || 999;
  const score = artifactScore(card);
  const ratio = score / budget;
  if (ratio > profile.maxArtifactRatioOverBudget) {
    outliers.push({ type: "artifact", id: card.id, faction: card.faction, cost: card.cost, score, budget, ratio: Number(ratio.toFixed(3)) });
  }
}

outliers.sort((a, b) => b.ratio - a.ratio);

console.log("\n=== BALANCE HOTSPOTS ===");
console.log(`Flagged: ${outliers.length}`);
console.log(JSON.stringify(outliers.slice(0, 200), null, 2));
