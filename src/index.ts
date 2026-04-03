import { LOADED_UNITS, getLoadedUnitById } from "./data/loadUnits";

console.log("=== ALL LOADED UNITS ===");
console.log(JSON.stringify(LOADED_UNITS, null, 2));

console.log("\n=== SINGLE UNIT TEST ===");
console.log(JSON.stringify(getLoadedUnitById("unit_stone_guard"), null, 2));