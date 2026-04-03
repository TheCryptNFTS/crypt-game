import { loadCommanderById } from "../data/loadCommanders";

export function getCommanderPassiveSummary(commanderId: string): string {
  const commander = loadCommanderById(commanderId);

  if (!commander) {
    return "Unknown commander passive.";
  }

  switch (commander.profile.passive) {
    case "HEALING_AURA":
      return `${commander.name}: Defensive commander. Built for tanky boards and sustain.`;

    case "IGNORE_ARMOR":
      return `${commander.name}: Aggressive commander. Built for speed, pressure, and armor-piercing hits.`;

    case "FEAR":
      return `${commander.name}: Control spellcaster. Built for disruption, tempo loss, and evasive pressure.`;

    case "INFERNAL_GATE":
      return `${commander.name}: Shadow commander. Built for infernal pressure and lifesteal-style combat.`;

    case "TECH_SYNC":
      return `${commander.name}: Tech commander. Built for control, efficiency, and value engines.`;

    case "GRAVEYARD_POWER":
      return `${commander.name}: Graveyard commander. Built for death triggers and cursed recursion.`;

    case "EXECUTE":
      return `${commander.name}: Finisher commander. Built for kill pressure and closing damaged targets.`;

    case "TIME_MANIPULATION":
      return `${commander.name}: Mythic tempo commander. Built for swing turns and control of pace.`;

    case "SCRY":
      return `${commander.name}: Foresight commander. Built for setup, vision, and planned power turns.`;

    case "BONUS_RESOURCE":
      return `${commander.name}: Resource commander. Built for value, economy, and out-scaling.`;

    default:
      return `${commander.name}: Flexible commander with no defined summary yet.`;
  }
}

export function getCommanderStartOfGameBonus(commanderId: string): {
  energyBonus: number;
  armorBonus: number;
  healthBonus: number;
  note: string;
} {
  const commander = loadCommanderById(commanderId);

  if (!commander) {
    return {
      energyBonus: 0,
      armorBonus: 0,
      healthBonus: 0,
      note: "Unknown commander"
    };
  }

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

    case "FEAR":
      return {
        energyBonus: 0,
        armorBonus: 0,
        healthBonus: 1,
        note: "Control-focused setup"
      };

    case "INFERNAL_GATE":
      return {
        energyBonus: 0,
        armorBonus: 0,
        healthBonus: 2,
        note: "Shadow sustain and pressure"
      };

    case "TECH_SYNC":
      return {
        energyBonus: 1,
        armorBonus: 0,
        healthBonus: 0,
        note: "Tech tempo bonus"
      };

    case "GRAVEYARD_POWER":
      return {
        energyBonus: 0,
        armorBonus: 0,
        healthBonus: 1,
        note: "Death-synergy setup"
      };

    case "EXECUTE":
      return {
        energyBonus: 0,
        armorBonus: 1,
        healthBonus: 0,
        note: "Finisher pressure"
      };

    case "TIME_MANIPULATION":
      return {
        energyBonus: 1,
        armorBonus: 0,
        healthBonus: 1,
        note: "Tempo swing bonus"
      };

    case "SCRY":
      return {
        energyBonus: 0,
        armorBonus: 0,
        healthBonus: 0,
        note: "Information advantage, not raw stats"
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
        note: "No bonus"
      };
  }
}