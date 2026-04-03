import { loadCommanders } from "./data/loadCommanders";
import { loadUnits } from "./data/loadUnits";
import { loadSpells } from "./data/loadSpells";
import { loadEquipment } from "./data/loadEquipment";
import {
  getCommanderPassiveSummary,
  getCommanderStartOfGameBonus
} from "./engine/commanderAbilities";

const commanders = loadCommanders();
const units = loadUnits();
const spells = loadSpells();
const equipment = loadEquipment();

console.log("\n=== ALL LOADED COMMANDERS ===");
console.log(JSON.stringify(commanders, null, 2));

console.log("\n=== TOP COMMANDERS BY RARITY SCORE ===");
console.log(
  JSON.stringify(
    [...commanders]
      .sort((a, b) => b.rarityScore - a.rarityScore)
      .map((c) => ({
        id: c.id,
        name: c.name,
        rarityScore: c.rarityScore,
        powerBand: c.powerBand
      })),
    null,
    2
  )
);

console.log("\n=== COMMANDER PASSIVE SUMMARIES ===");
console.log(
  JSON.stringify(
    {
      stone_warden: getCommanderPassiveSummary("cmd_stone_warden"),
      bronze_raider: getCommanderPassiveSummary("cmd_bronze_raider"),
      hell_judge: getCommanderPassiveSummary("cmd_hell_judge"),
      skull_emperor: getCommanderPassiveSummary("cmd_skull_emperor"),
      lucifer_one: getCommanderPassiveSummary("cmd_lucifer_one"),
      satoshi_one: getCommanderPassiveSummary("cmd_satoshi_one")
    },
    null,
    2
  )
);

console.log("\n=== COMMANDER START OF GAME BONUSES ===");
console.log(
  JSON.stringify(
    {
      stone_warden: getCommanderStartOfGameBonus(
        commanders.find((c) => c.id === "cmd_stone_warden")!
      ),
      bronze_raider: getCommanderStartOfGameBonus(
        commanders.find((c) => c.id === "cmd_bronze_raider")!
      ),
      hell_judge: getCommanderStartOfGameBonus(
        commanders.find((c) => c.id === "cmd_hell_judge")!
      ),
      skull_emperor: getCommanderStartOfGameBonus(
        commanders.find((c) => c.id === "cmd_skull_emperor")!
      ),
      lucifer_one: getCommanderStartOfGameBonus(
        commanders.find((c) => c.id === "cmd_lucifer_one")!
      ),
      satoshi_one: getCommanderStartOfGameBonus(
        commanders.find((c) => c.id === "cmd_satoshi_one")!
      )
    },
    null,
    2
  )
);

console.log("\n=== ALL GENERATED UNITS ===");
console.log(JSON.stringify(units, null, 2));

console.log("\n=== ALL GENERATED SPELLS ===");
console.log(JSON.stringify(spells, null, 2));

console.log("\n=== ALL GENERATED EQUIPMENT ===");
console.log(JSON.stringify(equipment, null, 2));

console.log("\n=== SAMPLE UNIT CHECKS ===");
console.log(
  JSON.stringify(
    {
      stone_guard: units.find((u) => u.id === "unit_stone_guard"),
      bronze_scout: units.find((u) => u.id === "unit_bronze_scout"),
      bomb_skull: units.find((u) => u.id === "unit_bomb_skull")
    },
    null,
    2
  )
);