export type CommanderLegendaryRule = {
  value: "Legendary";
  effectType: string;
  summary: string;
  bonus?: {
    attack?: number;
    health?: number;
    armor?: number;
    crit?: number;
    speed?: number;
    utility?: number;
  };
};

export const COMMANDER_LEGENDARY_RULES: CommanderLegendaryRule[] = [
  {
    value: "Legendary",
    effectType: "legendary_aura",
    summary: "Legendary commanders gain elevated synergy scaling, stronger passive weight, and higher boost ceilings when matching cards or traits.",
    bonus: {
      attack: 1,
      health: 1,
      utility: 2
    }
  }
];
