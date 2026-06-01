import type { MatchRules } from "../engine/state";

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
   * Per-match ruleset (faction identities, etc.). Optional + additive: when
   * omitted the match stays vanilla (rules undefined survives structuredClone),
   * so replay and any caller that doesn't opt in is byte-identical. Live play
   * (solo + server) opts in to `factionIdentities`; dev/determinism harnesses
   * leave it absent.
   */
  rules?: MatchRules | null;
  /**
   * Numeric seed driving all shuffles + instance-id generation. Same seed +
   * same action list => identical, reproducible match. Optional: when omitted
   * a non-deterministic seed is generated (single-player convenience), but the
   * engine itself is fully seedable for authoritative/server use.
   */
  seed?: number;
};
