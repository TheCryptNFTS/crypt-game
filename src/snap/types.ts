/**
 * SNAP-STYLE LANE BATTLER — Cut 1 types.
 *
 * A deliberate, drastic simplification of the TCG (which stays live at /match).
 * The whole model a player must hold in their head is: "Where do I place this
 * card to win 2 of 3 Crypts?" — nothing else.
 *
 *   - 12-card deck
 *   - 3 lanes ("Crypts")
 *   - 6 turns
 *   - energy = the turn number (turn 1 → 1 energy … turn 6 → 6 energy)
 *   - tap a card, tap a Crypt to place it (no attack, no rows, no targets)
 *   - at turn 6 the higher total power wins each Crypt; win 2 of 3 to win
 *
 * Cut 1 uses VANILLA cards only (cost + power, no keywords). Keyword behaviour
 * (Guard / Rush / Crush / Echo / Curse) arrives in later cuts through the
 * reveal pipeline — this type module already leaves room for it but does not
 * implement it.
 *
 * IN-GAME-ONLY: nothing here sources hex or any on-chain/wallet value.
 */

export type Seat = "P1" | "P2";
export type LaneIndex = 0 | 1 | 2;
export type SnapWinner = Seat | "DRAW" | null;

/** Number of lanes ("Crypts"). */
export const LANE_COUNT = 3;
/** Cards each side may stack in a single Crypt. */
export const LANE_CAPACITY = 4;
/** The match ends after this many turns; power is scored at the end of it. */
export const MAX_TURNS = 6;
/** Cards dealt to each player's opening hand. */
export const OPENING_HAND = 3;
/** A legal Snap deck is exactly this many cards. */
export const DECK_SIZE = 12;
/** Power is capped so a late blowout can still be contested (comeback math). */
export const MAX_POWER = 12;

/**
 * One concrete card instance in a match. `instanceId` is deterministic
 * (`c_<seat>_<n>`) so ids are stable for a given seed + action order. Cut-1
 * cards are vanilla: only `cost` and `power` matter. `keyword` is carried for
 * later cuts but is never read by the Cut-1 reducer.
 */
export type SnapCard = {
  instanceId: string;
  /** Stable catalog id the card was minted from (for art/name reuse). */
  cardId: string;
  name: string;
  cost: number;
  power: number;
  imageUrl?: string;
  /** Reserved for later cuts (Guard/Rush/Crush/Echo/Curse). Unused in Cut 1. */
  keyword?: "GUARD" | "RUSH" | "CRUSH" | "ECHO" | "CURSE" | null;
};

/** Per-seat private state: draw pile, hand, and this-turn energy. */
export type SnapPlayerState = {
  seat: Seat;
  /** Draw pile (top = index 0). */
  deck: SnapCard[];
  /** Cards in hand, playable this turn if affordable. */
  hand: SnapCard[];
  /** Energy available THIS turn. Reset to the turn number each round. */
  energy: number;
};

/** One Crypt: the cards each side has committed to it. */
export type SnapLane = {
  index: LaneIndex;
  P1: SnapCard[];
  P2: SnapCard[];
};

/** Final per-lane scoring, computed once the match decides. */
export type LaneOutcome = {
  index: LaneIndex;
  p1Power: number;
  p2Power: number;
  winner: SnapWinner; // Seat that took the Crypt, or "DRAW" if tied.
};

export type SnapState = {
  seed: number;
  /** Monotonic id counter → deterministic instance ids. */
  idCounter: number;
  /** RNG draws consumed since creation (reproducible shuffles). */
  rngCursor: number;

  /** Current turn (1..MAX_TURNS). */
  turn: number;
  /** Whose placement phase it is right now. */
  active: Seat;
  players: { P1: SnapPlayerState; P2: SnapPlayerState };
  /** Exactly LANE_COUNT Crypts. */
  lanes: SnapLane[];

  /** Decided winner, or null while the match is live. */
  winner: SnapWinner;
  /** Per-lane breakdown, populated once `winner` is set. */
  outcomes: LaneOutcome[] | null;

  /** Human-readable event trail (newest last). View-layer only. */
  log: string[];
};

/** Every action the Snap reducer understands. Intentionally tiny. */
export type SnapAction =
  | { type: "PLAY_CARD"; seat: Seat; instanceId: string; lane: LaneIndex }
  | { type: "END_TURN"; seat: Seat };
