/**
 * SNAP MATCH SETUP — build 12-card decks and deal the opening board.
 *
 * All randomness comes from the engine's seeded mulberry32 (makeRng) so a match
 * is fully reproducible from (seed, action list) — same discipline the TCG uses.
 */

import { makeRng } from "../engine/rng";
import { SNAP_POOL, type SnapCardTemplate } from "./cards";
import {
  DECK_SIZE,
  LANE_COUNT,
  OPENING_HAND,
  type LaneIndex,
  type Seat,
  type SnapCard,
  type SnapLane,
  type SnapPlayerState,
  type SnapState,
} from "./types";

/** Seeded Fisher-Yates over a copy. Returns [shuffled, drawsConsumed]. */
function shuffled<T>(items: readonly T[], seed: number, cursor: number): [T[], number] {
  const rng = makeRng(seed);
  for (let i = 0; i < cursor; i++) rng(); // fast-forward
  const arr = items.slice();
  let draws = 0;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    draws++;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return [arr, cursor + draws];
}

/**
 * Build a 12-card vanilla deck: a seeded sample of the pool, biased to span the
 * cost curve so a deck is playable every turn (not all 6-drops). Deterministic.
 */
export function buildSnapDeck(seed: number): SnapCardTemplate[] {
  const [pool] = shuffled(SNAP_POOL, seed, 0);
  // Take the first DECK_SIZE unique-by-cardId templates.
  const deck: SnapCardTemplate[] = [];
  const seen = new Set<string>();
  for (const t of pool) {
    if (seen.has(t.cardId)) continue;
    seen.add(t.cardId);
    deck.push(t);
    if (deck.length >= DECK_SIZE) break;
  }
  return deck;
}

function makePlayer(
  seat: Seat,
  templates: SnapCardTemplate[],
  seed: number,
  startCursor: number,
): { player: SnapPlayerState; nextCursor: number; nextId: number } {
  // Shuffle the 12-card deck, then mint stable instance ids.
  const [order, nextCursor] = shuffled(templates, seed + (seat === "P1" ? 1 : 2), startCursor);
  let id = 0;
  const cards: SnapCard[] = order.map((t) => ({
    instanceId: `c_${seat}_${id++}`,
    cardId: t.cardId,
    name: t.name,
    cost: t.cost,
    power: t.power,
    imageUrl: t.imageUrl,
    keyword: null,
  }));
  const hand = cards.slice(0, OPENING_HAND);
  const deck = cards.slice(OPENING_HAND);
  return {
    player: { seat, deck, hand, energy: 1 },
    nextCursor,
    nextId: id,
  };
}

export type CreateSnapOptions = {
  seed?: number;
  p1Deck?: SnapCardTemplate[];
  p2Deck?: SnapCardTemplate[];
};

/** Create a fresh, dealt Snap match at turn 1 with P1 to act. */
export function createSnapMatch(options: CreateSnapOptions = {}): SnapState {
  const seed = options.seed ?? Date.now();
  const p1Templates = options.p1Deck ?? buildSnapDeck(seed);
  const p2Templates = options.p2Deck ?? buildSnapDeck(seed + 7);

  const p1 = makePlayer("P1", p1Templates, seed, 0);
  const p2 = makePlayer("P2", p2Templates, seed, p1.nextCursor);

  const lanes: SnapLane[] = Array.from({ length: LANE_COUNT }, (_, i) => ({
    index: i as LaneIndex,
    P1: [],
    P2: [],
  }));

  return {
    seed,
    idCounter: p1.nextId + p2.nextId,
    rngCursor: p2.nextCursor,
    turn: 1,
    active: "P1",
    players: { P1: p1.player, P2: p2.player },
    lanes,
    winner: null,
    outcomes: null,
    log: ["Match start — win 2 of 3 Crypts by turn 6."],
  };
}
