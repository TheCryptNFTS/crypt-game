import { LoadedCommander } from "./traitEngine";

export function getCommanderPassiveSummary(commanderId: string): string {
  switch (commanderId) {
    case "cmd_stone_warden":
      return "Stone Warden: Defensive commander. Built for tanky boards and sustain.";
    case "cmd_bronze_raider":
      return "Bronze Raider: Aggressive commander. Built for speed, pressure, and armor-piercing hits.";
    case "cmd_hell_judge":
      return "Hell Judge: Shadow commander. Built for infernal pressure and lifesteal-style combat.";
    case "cmd_skull_emperor":
      return "Skull Emperor: Finisher commander. Built for kill pressure and closing damaged targets.";
    case "cmd_lucifer_one":
      return "Lucifer: Shadow commander. Built for infernal pressure and lifesteal-style combat.";
    case "cmd_satoshi_one":
      return "Satoshi: Resource commander. Built for value, economy, and out-scaling.";
    default:
      return "No passive summary found.";
  }
}

export function getCommanderStartOfGameBonus(commander: LoadedCommander) {
  switch (commander.profile.passive) {
    case "HEALING_AURA":
      return {
        energyBonus: 0,
        armorBonus: 1,
        healthBonus: 2,
        note: "Extra sustain and frontline durability"
      };
    case "IGNORE_ARMOR":
      return {
        energyBonus: 0,
        armorBonus: 0,
        healthBonus: 0,
        note: "Aggressive commander. No free durability."
      };
    case "INFERNAL_GATE":
      return {
        energyBonus: 0,
        armorBonus: 0,
        healthBonus: 2,
        note: "Shadow sustain and pressure"
      };
    case "EXECUTE":
      return {
        energyBonus: 0,
        armorBonus: 1,
        healthBonus: 0,
        note: "Finisher pressure"
      };
    case "BONUS_RESOURCE":
      return {
        energyBonus: 1,
        armorBonus: 1,
        healthBonus: 0,
        note: "Economic scaling boost"
      };
    default:
      return {
        energyBonus: 0,
        armorBonus: 0,
        healthBonus: 0,
        note: "No special opening bonus"
      };
  }
}