export type DeckBootstrapInput = {
  commanderId: string;
  deck: string[];
};

export type MatchBootstrapInput = {
  p1: DeckBootstrapInput;
  p2: DeckBootstrapInput;
  shuffle?: boolean;
  openingHandSize?: number;
  /**
   * Numeric seed driving all shuffles + instance-id generation. Same seed +
   * same action list => identical, reproducible match. Optional: when omitted
   * a non-deterministic seed is generated (single-player convenience), but the
   * engine itself is fully seedable for authoritative/server use.
   */
  seed?: number;
};
