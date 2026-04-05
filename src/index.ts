import { loadedCommanders } from "./data/loadCommanders";
import { loadUnits } from "./data/loadUnits";
import { loadSpells } from "./data/loadSpells";
import { loadEquipment } from "./data/loadEquipment";
import {
  getCommanderPassiveSummary,
  getCommanderStartOfGameBonus
} from "./engine/commanderAbilities";

const commanders = loadedCommanders;
const units = loadUnits();
const spells = loadSpells();
const equipment = loadEquipment();

function print(title: string, value: unknown) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(value, null, 2));
}

print(
  "ALL LOADED COMMANDERS",
  commanders.map((c) => ({
    id: c.id,
    name: c.name,
    skin: c.skin,
    eyes: c.eyes,
    headwear: c.headwear,
    mouth: c.mouth,
    isLegendary: c.isLegendary,
    oneOfOne: c.oneOfOne,
    profile: c.profile,
    attack: c.attack,
    health: c.health,
    armor: c.armor,
    abilityText: c.abilityText,
    tags: c.tags,
    rarityScore: c.rarityScore,
    powerBand: c.powerBand
  }))
);

print(
  "STONE WARDEN",
  commanders.find((c) => c.id === "cmd_stone_warden") ?? null
);

print(
  "BRONZE RAIDER",
  commanders.find((c) => c.id === "cmd_bronze_raider") ?? null
);

print(
  "HELL JUDGE",
  commanders.find((c) => c.id === "cmd_hell_judge") ?? null
);

print(
  "SKULL EMPEROR",
  commanders.find((c) => c.id === "cmd_skull_emperor") ?? null
);

print(
  "LUCIFER ONE OF ONE",
  commanders.find((c) => c.id === "cmd_lucifer_one") ?? null
);

print(
  "SATOSHI ONE OF ONE",
  commanders.find((c) => c.id === "cmd_satoshi_one") ?? null
);

print("COMMANDER PASSIVE SUMMARIES", {
  stone_warden: getCommanderPassiveSummary("cmd_stone_warden"),
  bronze_raider: getCommanderPassiveSummary("cmd_bronze_raider"),
  hell_judge: getCommanderPassiveSummary("cmd_hell_judge"),
  skull_emperor: getCommanderPassiveSummary("cmd_skull_emperor"),
  lucifer_one: getCommanderPassiveSummary("cmd_lucifer_one"),
  satoshi_one: getCommanderPassiveSummary("cmd_satoshi_one")
});

print("COMMANDER START OF GAME BONUSES", {
  stone_warden: getCommanderStartOfGameBonus("cmd_stone_warden"),
  bronze_raider: getCommanderStartOfGameBonus("cmd_bronze_raider"),
  hell_judge: getCommanderStartOfGameBonus("cmd_hell_judge"),
  skull_emperor: getCommanderStartOfGameBonus("cmd_skull_emperor"),
  lucifer_one: getCommanderStartOfGameBonus("cmd_lucifer_one"),
  satoshi_one: getCommanderStartOfGameBonus("cmd_satoshi_one")
});

print(
  "TOP COMMANDERS BY RARITY SCORE",
  [...commanders]
    .sort((a, b) => b.rarityScore - a.rarityScore)
    .map((c) => ({
      id: c.id,
      name: c.name,
      rarityScore: c.rarityScore,
      powerBand: c.powerBand
    }))
);

print("ALL GENERATED UNITS", units);
print("ALL GENERATED SPELLS", spells);
print("ALL GENERATED EQUIPMENT", equipment);

print("SAMPLE UNIT CHECKS", {
  stone_guard: units.find((u) => u.id === "unit_stone_guard") ?? null,
  bronze_scout: units.find((u) => u.id === "unit_bronze_scout") ?? null,
  bomb_skull: units.find((u) => u.id === "unit_bomb_skull") ?? null
});