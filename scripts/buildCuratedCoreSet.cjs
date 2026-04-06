const fs = require("fs");
const path = require("path");

const units = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgUnits.json"), "utf8")
);
const equipment = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgEquipment.json"), "utf8")
);
const artifacts = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/data/generatedPlayableTcgArtifacts.json"), "utf8")
);

const FACTIONS = ["STONE", "IRON", "BRONZE", "SILVER", "GOLD", "GOD"];

function byFaction(cards, faction) {
  return cards.filter((card) => card.faction === faction);
}

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    if ((a.cost || 0) !== (b.cost || 0)) return (a.cost || 0) - (b.cost || 0);
    if ((a.rarity || "") !== (b.rarity || "")) return String(a.rarity || "").localeCompare(String(b.rarity || ""));
    return String(a.id).localeCompare(String(b.id));
  });
}

const chosenUnits = [];
const chosenEquipment = [];
const chosenArtifacts = [];

for (const faction of FACTIONS) {
  chosenUnits.push(...sortCards(byFaction(units, faction)).slice(0, faction === "GOD" ? 4 : 16));
  chosenEquipment.push(...sortCards(byFaction(equipment, faction)).slice(0, faction === "GOD" ? 2 : 3));
  chosenArtifacts.push(...sortCards(byFaction(artifacts, faction)).slice(0, faction === "GOD" ? 1 : 2));
}

const out = {
  units: chosenUnits,
  equipment: chosenEquipment,
  artifacts: chosenArtifacts,
  all: [...chosenUnits, ...chosenEquipment, ...chosenArtifacts]
};

const outPath = path.resolve(process.cwd(), "src/data/curatedCoreSet.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

console.log("=== CURATED CORE SET BUILT ===");
console.log(`Units: ${out.units.length}`);
console.log(`Equipment: ${out.equipment.length}`);
console.log(`Artifacts: ${out.artifacts.length}`);
console.log(`Total: ${out.all.length}`);
console.log(`Saved: ${outPath}`);
