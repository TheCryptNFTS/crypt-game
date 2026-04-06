export type UiPlayerId = "P1" | "P2";

export type UiCommanderZone = {
  cardId: string;
  name?: string;
  faction?: string;
};

export type UiUnit = {
  instanceId: string;
  cardId: string;
  attack?: number;
  health?: number;
  exhausted?: boolean;
};

export type UiPlayerState = {
  commander?: {
    id: string;
    name?: string;
    faction?: string;
  };
  commanderZone?: UiCommanderZone;
  hand: string[];
  deck: string[];
  deckCount?: number;
  discard: string[];
  artifacts: Array<{ cardId: string }>;
  board: {
    front: UiUnit[];
  };
  energy?: number;
  maxEnergy?: number;
};

export type UiMatchState = {
  turn?: number;
  phase?: string;
  activePlayer?: UiPlayerId;
  winner?: string | null;
  players: {
    P1: UiPlayerState;
    P2: UiPlayerState;
  };
};
