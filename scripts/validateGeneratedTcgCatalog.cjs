const fs = require("fs");
const path = require("path");

const files = [
  "src/data/generatedPlayableTcgUnits.json",
  "src/data/generatedPlayableTcgEquipment.json",
  "src/data/generatedPlayableTcgArtifacts.json"
].map((p) => path.resolve(process.cwd(), p));

for (const file of files) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing file: ${file}`);
  }
}

const units = JSON.parse(fs.readFileSync(files[0], "utf8"));
const equipment = JSON.parse(fs.readFileSync(files[1], "utf8"));
const artifacts = JSON.parse(fs.readFileSync(files[2], "utf8"));

const all = [...units, ...equipment, ...artifacts];
const idMap = {};
const issues = [];

for (const card of all) {
  idMap[card.id] = (idMap[card.id] || 0) + 1;

  if (!card.id) issues.push(`Missing id on ${JSON.stringify(card).slice(0, 100)}`);
  if (!card.name) issues.push(`Missing name on ${card.id}`);
  if (!card.faction) issues.push(`Missing faction on ${card.id}`);
  if (card.cost == null) issues.push(`Missing cost on ${card.id}`);

  if (card.type === "unit") {
    if (!card.stats) issues.push(`Unit missing stats: ${card.id}`);
  }

  if (card.type === "equipment") {
    if (!card.bonuses) issues.push(`Equipment missing bonuses: ${card.id}`);
  }

  if (card.type === "artifact") {
    if (!Array.isArray(card.effectTags)) issues.push(`Artifact missing effectTags: ${card.id}`);
  }
}

const duplicateIds = Object.entries(idMap).filter(([, count]) => count > 1);

console.log("\n=== GENERATED TCG CATALOG VALIDATION ===");
console.log(`Units: ${units.length}`);
console.log(`Equipment: ${equipment.length}`);
console.log(`Artifacts: ${artifacts.length}`);
console.log(`Total: ${all.length}`);
console.log(`Duplicate IDs: ${duplicateIds.length}`);
console.log(`Issues: ${issues.length}`);

if (duplicateIds.length > 0) {
  console.log("\n=== DUPLICATE IDS ===");
  console.log(JSON.stringify(duplicateIds.slice(0, 50), null, 2));
}

if (issues.length > 0) {
  console.log("\n=== ISSUES ===");
  console.log(JSON.stringify(issues.slice(0, 100), null, 2));
}
