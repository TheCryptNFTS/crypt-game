export type PlayerId = "P1" | "P2";
export type Lane = "front" | "back";
export type Phase = "main" | "combat" | "end";

export interface UnitInPlay {
  instanceId: string;
  cardId: string;
  lane: Lane;
  attack: number;
  health: number;
  maxHealth: number;
  speed: number;
  armor: number;
  keywords: string[];
  exhausted: boolean;
  summoningSick: boolean;
}

export interface PlayerState {
  id: PlayerId;
  health: number;
  energy: number;
  maxEnergy: number;
  commanderId: string;
  deck: string[];
  hand: string[];
  discard: string[];
  board: {
    front: UnitInPlay[];
    back: UnitInPlay[];
  };
  turnFlags: {
    firstUnitCostReduction: number;
    firstUnitPlayed: boolean;
  };
}

export interface MatchState {
  turn: number;
  activePlayer: PlayerId;
  phase: Phase;
  winner: PlayerId | null;
  players: {
    P1: PlayerState;
    P2: PlayerState;
  };
}