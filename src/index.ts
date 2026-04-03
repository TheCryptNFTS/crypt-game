import {
    getUnitMetadata,
    getUnitClass,
    getUnitPassive,
    getUnitSubtype,
    isStoneUnit,
    isBronzeUnit,
    isRushUnit,
    isDeathBlastUnit
  } from "./engine/unitMetadata";
  
  console.log("=== STONE GUARD METADATA ===");
  console.log(JSON.stringify(getUnitMetadata("unit_stone_guard"), null, 2));
  
  console.log("\n=== BRONZE SCOUT CHECKS ===");
  console.log({
    class: getUnitClass("unit_bronze_scout"),
    passive: getUnitPassive("unit_bronze_scout"),
    subtype: getUnitSubtype("unit_bronze_scout"),
    isBronzeUnit: isBronzeUnit("unit_bronze_scout"),
    isRushUnit: isRushUnit("unit_bronze_scout")
  });
  
  console.log("\n=== BOMB SKULL CHECKS ===");
  console.log({
    class: getUnitClass("unit_bomb_skull"),
    passive: getUnitPassive("unit_bomb_skull"),
    subtype: getUnitSubtype("unit_bomb_skull"),
    isStoneUnit: isStoneUnit("unit_bomb_skull"),
    isDeathBlastUnit: isDeathBlastUnit("unit_bomb_skull")
  });