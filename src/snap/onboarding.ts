/**
 * SNAP ONBOARDING — the scripted first match.
 *
 * A brand-new pilot's very first Snap game is NOT random: it is a hand-authored,
 * fully deterministic scenario that TEACHES the whole loop and is guaranteed
 * winnable if the player follows the coach. The board bypasses the seeded
 * shuffle entirely and mints fixed instance ids so the coach can point at exact
 * cards ("play THIS card HERE").
 *
 * What it teaches, in order:
 *   1. A Crypt is a lane — tap a card, tap a Crypt to place it.
 *   2. Bigger total power wins a Crypt.
 *   3. Energy = the turn number (small cards early, big cards late).
 *   4. You only need 2 of 3 Crypts — you can lose one and still win.
 *   5. The final turn can steal a Crypt back — plays are simultaneous-ish and
 *      power just sums, so a late bomb flips a lane.
 *
 * The script is arranged so the player is LOSING the contested Crypt going into
 * turn 6, then their strongest card flips it for a 2–1 victory (the dramatic
 * beat). See runSnapOnboardingProof for the machine-checked guarantee.
 *
 * IN-GAME-ONLY: nothing here sources hex or any on-chain value.
 */

import { powerForCost, SNAP_POOL, type SnapCardTemplate } from "./cards";
import {
  LANE_COUNT,
  MAX_TURNS,
  type LaneIndex,
  type Seat,
  type SnapAction,
  type SnapCard,
  type SnapLane,
  type SnapState,
} from "./types";

/**
 * The player's scripted play each turn: place the cost-N card on turn N (energy
 * exactly affords it) into this lane. Lane order is chosen so Crypt 1 is a safe
 * early win, Crypt 2 is deliberately conceded, and Crypt 3 is the contested lane
 * the turn-6 bomb steals.
 *   T1→Crypt1  T2→Crypt3  T3→Crypt1  T4→Crypt2  T5→Crypt3  T6→Crypt3(bomb)
 */
export const PLAYER_LANES: readonly LaneIndex[] = [0, 2, 0, 1, 2, 2];

/** The opponent's scripted lane each turn (it plays its cheapest card there). */
export const OPPONENT_LANES: readonly LaneIndex[] = [1, 1, 2, 1, 2, 1];

/** The player's expected card this turn is always the cost-`turn` instance. */
export function expectedInstanceId(turn: number): string {
  return `p_c${turn}`;
}

/** Pick pool templates by cost for art/name; `alt` grabs a different one so the
 *  two sides don't wear identical faces. Falls back to a synthetic name. */
function templateForCost(cost: number, alt: boolean): SnapCardTemplate | undefined {
  const matches = SNAP_POOL.filter((t) => t.cost === cost);
  if (matches.length === 0) return undefined;
  return matches[alt ? Math.min(1, matches.length - 1) : 0];
}

function mint(seat: Seat, instanceId: string, cost: number, alt: boolean): SnapCard {
  const tmpl = templateForCost(cost, alt);
  return {
    instanceId,
    cardId: tmpl?.cardId ?? `syn_${cost}`,
    name: tmpl?.name ?? `Wretch (${cost})`,
    cost,
    power: powerForCost(cost),
    imageUrl: tmpl?.imageUrl,
    keyword: null,
  };
}

/**
 * Build the fixed onboarding board: turn 1, P1 to act, hand-authored hands and
 * draw piles so the cost-N card is always in hand exactly on turn N.
 */
export function buildOnboardingMatch(): SnapState {
  // Player: the six coached cards (cost 1..6). Opening hand holds 1–3; the draw
  // pile feeds 4,5,6 on turns 2,3,4 (then two cost-6 filler cards that the coach
  // never highlights, so the hand visibly grows without changing the plan).
  const p1Hand: SnapCard[] = [1, 2, 3].map((c) => mint("P1", `p_c${c}`, c, false));
  const p1Deck: SnapCard[] = [
    mint("P1", "p_c4", 4, false),
    mint("P1", "p_c5", 5, false),
    mint("P1", "p_c6", 6, false),
    mint("P1", "p_f1", 6, false),
    mint("P1", "p_f2", 6, false),
  ];

  // Opponent: a mirror curve, but its fillers are cost 6 so its "cheapest
  // affordable" pick is always the intended main card (see planOpponentTurn).
  const p2Hand: SnapCard[] = [1, 2, 3].map((c) => mint("P2", `o_c${c}`, c, true));
  const p2Deck: SnapCard[] = [
    mint("P2", "o_c4", 4, true),
    mint("P2", "o_c5", 5, true),
    mint("P2", "o_c6", 6, true),
    mint("P2", "o_f1", 6, true),
    mint("P2", "o_f2", 6, true),
  ];

  const lanes: SnapLane[] = Array.from({ length: LANE_COUNT }, (_, i) => ({
    index: i as LaneIndex,
    P1: [],
    P2: [],
  }));

  return {
    seed: 0,
    idCounter: p1Hand.length + p1Deck.length + p2Hand.length + p2Deck.length,
    rngCursor: 0,
    turn: 1,
    active: "P1",
    players: {
      P1: { seat: "P1", deck: p1Deck, hand: p1Hand, energy: 1 },
      P2: { seat: "P2", deck: p2Deck, hand: p2Hand, energy: 1 },
    },
    lanes,
    winner: null,
    outcomes: null,
    log: ["Your first match — win 2 of 3 Crypts."],
  };
}

/**
 * The scripted opponent's turn: play its CHEAPEST affordable card into this
 * turn's scripted lane, then end. One card per turn, deliberately weak — the
 * player wins if they follow the coach. Returns [] of at most one PLAY + END.
 */
export function planOpponentTurn(state: SnapState): SnapAction[] {
  const lane = OPPONENT_LANES[Math.min(state.turn, MAX_TURNS) - 1];
  const p2 = state.players.P2;
  let pick: SnapCard | null = null;
  for (const c of p2.hand) {
    if (c.cost <= p2.energy && (pick === null || c.cost < pick.cost)) pick = c;
  }
  const actions: SnapAction[] = [];
  if (pick) actions.push({ type: "PLAY_CARD", seat: "P2", instanceId: pick.instanceId, lane });
  actions.push({ type: "END_TURN", seat: "P2" });
  return actions;
}
