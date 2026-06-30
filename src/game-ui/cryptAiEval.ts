/**
 * Heuristic board-value function + 1-ply lookahead for the Crypt solo AI.
 *
 * Split out of cryptMatchAI.ts so the planner keeps ONE responsibility (choosing
 * a legal action list) and the scoring/lookahead lives here. Everything is PURE:
 * `evaluateBoard` reads a state, `simulate` runs a candidate action through the
 * SAME deterministic reducer the live game uses on the engine's own entry-clone
 * (applyActionCore structuredClones at entry), so this never mutates the input.
 *
 * Perspective is FIXED to P2 (the AI). A higher score is better FOR P2. The
 * planner picks the action whose resulting state scores highest.
 */

import { applyAction, type Action } from "../engine/reducer";

type AnyMatch = any;
type AnyUnit = any;

// --- Tunable weights. Deliberately coarse: this is a tempo/control heuristic,
// not a solved evaluation. Order of magnitude matters more than the exact value.
// FACE damage is weighted near a stat point so racing and trading stay comparable;
// a unit's body is worth its (attack + health) plus a flat "a card on board" bonus
// so the AI values DEVELOPMENT and won't throw a body away for nothing.
const W = {
  /** Each point of enemy nexus removed is worth this (winning the game = the goal). */
  enemyNexus: 1.05,
  /** Each point of our own nexus is worth this (don't ignore our own life total). */
  ownNexus: 0.9,
  /** A unit's stat point (attack or health) on board. */
  stat: 1.0,
  /** Flat "this is a body on the board" bonus per friendly unit (board presence). */
  bodyPresence: 1.5,
  /** A card in hand (card advantage / future options). */
  handCard: 0.6,
  /** Bonus for a friendly unit that can still act (tempo this turn). */
  ready: 0.3,
  /** GUARD bodies are worth more on OUR side (they protect), enemy GUARD is a wall. */
  guard: 1.0,
};

function lanes(p: AnyUnit): AnyUnit[] {
  return [...(p?.board?.front ?? []), ...(p?.board?.back ?? [])];
}

function hasKw(u: AnyUnit, k: string): boolean {
  return (
    (Array.isArray(u?.keywords) && u.keywords.includes(k)) ||
    (Array.isArray(u?.auraKeywords) && u.auraKeywords.includes(k))
  );
}

/** Worth of a single live unit on the board (from its controller's view). */
function unitValue(u: AnyUnit): number {
  const hp = Math.max(0, u?.health ?? 0);
  if (hp <= 0) return 0;
  let v = W.bodyPresence + W.stat * ((u?.attack ?? 0) + hp);
  if (hasKw(u, "GUARD")) v += W.guard;
  // A shielded body (WARD/DIVINE_SHIELD armed) effectively has a free extra hit
  // of survivability — value it slightly above its raw stats.
  if (u?.shielded === true) v += W.stat * 1.5;
  // A unit that can act this turn carries tempo.
  if (!u?.exhausted && !u?.summoningSick) v += W.ready;
  return v;
}

/** Total board value for one player. */
function sideValue(p: AnyUnit): number {
  let total = 0;
  for (const u of lanes(p)) total += unitValue(u);
  return total;
}

/**
 * Heuristic value of `match` FROM P2's PERSPECTIVE. Higher is better for P2.
 * Combines: enemy nexus pressure (lower enemy nexus = better), our own nexus
 * (survival), board presence/quality on both sides, and card advantage. A decided
 * match is scored at +/- a large constant so a lethal line always wins the argmax.
 */
export function evaluateBoard(match: AnyMatch): number {
  if (!match) return 0;
  const me = match.players?.P2;
  const foe = match.players?.P1;

  // Terminal states dominate: a win for us is the best possible, a loss the worst.
  if (match.winner === "P2" || (foe?.nexusHealth ?? 1) <= 0) return 100000;
  if (match.winner === "P1" || (me?.nexusHealth ?? 1) <= 0) return -100000;

  const enemyNexus = Number(foe?.nexusHealth ?? 0);
  const ownNexus = Number(me?.nexusHealth ?? 0);

  let score = 0;
  // Pressure: reward a LOW enemy nexus (start from a max so smaller = bigger score).
  score += W.enemyNexus * (40 - enemyNexus);
  score += W.ownNexus * ownNexus;
  score += sideValue(me) - sideValue(foe);
  score += W.handCard * ((me?.hand?.length ?? 0) - (foe?.hand?.length ?? 0));
  return score;
}

/**
 * Run one candidate `action` (as P2) through the real reducer and return the
 * resulting state. PURE: applyAction clones at entry, so `match` is untouched. A
 * REJECTED action returns the SAME state reference unchanged — callers detect a
 * no-op by identity (`result === match`) and skip the candidate.
 */
export function simulate(match: AnyMatch, action: Action): AnyMatch {
  const { state } = applyAction(match, action);
  return state;
}

/**
 * True if `action` was a clean reject (engine returned the input unchanged). Lets
 * the planner skip an illegal candidate without re-deriving the rules — the
 * reducer is the single source of truth for legality.
 */
export function wasRejected(before: AnyMatch, after: AnyMatch): boolean {
  return before === after;
}
