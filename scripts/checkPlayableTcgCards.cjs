const fs = require("fs");
const path = require("path");

const units = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgUnits.json"), "utf8"));
const equipment = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgEquipment.json"), "utf8"));
const artifacts = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgArtifacts.json"), "utf8"));

console.log("\n=== PLAYABLE TCG CARD CHECK ===");
console.log(`Units: ${units.length}`);
console.log(`Equipment: ${equipment.length}`);
console.log(`Artifacts: ${artifacts.length}`);

console.log("\n=== FIRST 3 UNITS ===");
console.log(JSON.stringify(units.slice(0, 3), null, 2));

console.log("\n=== FIRST 3 EQUIPMENT ===");
console.log(JSON.stringify(equipment.slice(0, 3), null, 2));

console.log("\n=== FIRST 3 ARTIFACTS ===");
console.log(JSON.stringify(artifacts.slice(0, 3), null, 2));
