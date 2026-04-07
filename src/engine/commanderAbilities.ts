import { COMMANDER_REGISTRY } from "../constants/commanderRegistry";

export function getCommanderPassiveSummary(commanderId: string): string {
  return (
    COMMANDER_REGISTRY[commanderId]?.passiveSummary ??
    "No passive summary found."
  );
}

export function getCommanderStartOfGameBonus(commanderId: string) {
  return (
    COMMANDER_REGISTRY[commanderId]?.startOfGameBonus ?? {
      energyBonus: 0,
      armorBonus: 0,
      healthBonus: 0,
      note: "No bonus",
    }
  );
}
