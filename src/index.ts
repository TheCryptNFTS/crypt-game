import { LOADED_COMMANDERS, getLoadedCommanderById } from "./data/loadCommanders";

console.log("=== ALL LOADED COMMANDERS ===");
console.log(JSON.stringify(LOADED_COMMANDERS, null, 2));

console.log("\n=== SINGLE COMMANDER TEST ===");
console.log(JSON.stringify(getLoadedCommanderById("cmd_stone_warden"), null, 2));;