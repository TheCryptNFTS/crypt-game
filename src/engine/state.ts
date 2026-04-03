export type PlayerId = "P1" | "P2";
export type Lane = "front" | "back";
export type Phase = "draw" | "main" | "combat" | "end";

export type UnitInPlay = {
  instanceId: string;
  cardId: string;
  lane: Lane;
  attack: number;
  health: number;
  speed: number;
  armor: number;
  keywords: string[];
  exhausted: boolean;
  summoningSick: boolean;
};

export type PlayerState = {
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
};

export type MatchState = {
  turn: number;
  activePlayer: PlayerId;
  phase: Phase;
  winner: PlayerId | null;
  players: Record<PlayerId, PlayerState>;
};