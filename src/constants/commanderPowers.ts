export type CommanderPower = {
  id: string;
  displayName: string;
  tags: string[];
  moves: string[];
  passives: string[];
  statMods?: {
    attack?: number;
    health?: number;
    armor?: number;
    crit?: number;
    speed?: number;
    utility?: number;
  };
  special?: boolean;
};

export const COMMANDER_POWERS: CommanderPower[] = [];
