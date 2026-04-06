export type DeckBootstrapInput = {
  commanderId: string;
  deck: string[];
};

export type MatchBootstrapInput = {
  p1: DeckBootstrapInput;
  p2: DeckBootstrapInput;
  shuffle?: boolean;
  openingHandSize?: number;
};
