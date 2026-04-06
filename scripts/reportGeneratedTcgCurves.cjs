const fs = require("fs");
const path = require("path");

const unitsPath = path.resolve(process.cwd(), "src/data/generatedPlayableTcgUnits.json");
const equipmentPath = path.resolve(process.cwd(), "src/data/generatedPlayableTcgEquipment.json");
const artifactsPath = path.resolve(process.cwd(), "src/data/generatedPlayableTcgArtifacts.json");

const units = JSON.parse(fs.readFileSync(unitsPath, "utf8"));
const equipment = JSON.parse(fs.readFileSync(equipmentPath, "utf8"));
const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));

const all = [...units, ...equipment, ...artifacts];
const byFaction = {};
const byCost = {};
const byType = {};
const byKeyword = {};

for (const card of all) {
  byFaction[card.faction] = (byFaction[card.faction] || 0) + 1;
  byCost[card.cost] = (byCost[card.cost] || 0) + 1;
  byType[card.type] = (byType[card.type] || 0) + 1;

  for (const keyword of card.keywords || card.effectTags || []) {
    byKeyword[keyword] = (byKeyword[keyword] || 0) + 1;
  }
}

console.log("\n=== GENERATED TCG CURVE REPORT ===");
console.log("\n=== BY FACTION ===");
console.log(JSON.stringify(byFaction, null, 2));

console.log("\n=== BY COST ===");
console.log(JSON.stringify(byCost, null, 2));

console.log("\n=== BY TYPE ===");
console.log(JSON.stringify(byType, null, 2));

console.log("\n=== BY KEYWORD / EFFECT TAG ===");
console.log(JSON.stringify(byKeyword, null, 2));
