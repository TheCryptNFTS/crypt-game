import { getAllLoadedUnits } from "../data/loadAllUnits";
import { getAllLoadedEquipment } from "../data/loadAllEquipment";
import { getAllLoadedArtifacts } from "../data/loadAllArtifacts";

const tcgUnits = getAllLoadedUnits().filter((card) => card.id.startsWith("tcg_unit_"));
const tcgEquipment = getAllLoadedEquipment().filter((card) => card.id.startsWith("tcg_eq_"));
const tcgArtifacts = getAllLoadedArtifacts().filter((card) => card.id.startsWith("tcg_art_"));

console.log("\n=== PLAYABLE TCG CATALOG CHECK ===");
console.log(`TCG units loaded: ${tcgUnits.length}`);
console.log(`TCG equipment loaded: ${tcgEquipment.length}`);
console.log(`TCG artifacts loaded: ${tcgArtifacts.length}`);

console.log("\n=== SAMPLE UNIT ===");
console.log(JSON.stringify(tcgUnits[0], null, 2));

console.log("\n=== SAMPLE EQUIPMENT ===");
console.log(JSON.stringify(tcgEquipment[0], null, 2));

console.log("\n=== SAMPLE ARTIFACT ===");
console.log(JSON.stringify(tcgArtifacts[0], null, 2));

console.log("\n=== STATUS ===");
console.log("Playable TCG units, equipment, and artifacts are now separated and loading.");
