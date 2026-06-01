/**
 * puzzles.ts — DETERMINISTIC PUZZLE / SOLO MODE (A9).
 *
 * A puzzle is a fixed, hand-authored scenario: a preset board/hand + a fixed seed
 * + a win condition (e.g. "win this turn"). It is driven ENTIRELY by the EXISTING
 * reducer — a puzzle's "solution" is just an Action[] replayed through
 * `applyAction`, and "solved" means the reducer awarded the player the win. No new
 * engine ops, no new tokens, no reducer edit.
 *
 * HARD INVARIANTS:
 *   - BROWSER-SAFE. No node globals at import (no `process`/`Date.now()`); a
 *     puzzle's seed is baked in, so the build is reproducible on client + in the
 *     Node proof identically.
 *   - ADDITIVE. The reducer/golden are untouched. A puzzle builds a `MatchState`
 *     by hand (same shape the reducer-equivalence scenarios use) and plays it
 *     through the shipped `applyAction`.
 *   - DETERMINISTIC. `(seed, board, actions)` fully determines the outcome, so a
 *     given solution either wins on every run or never.
 */

import type { MatchState, PlayerId, UnitInPlay, Lane } from "./state";
import { STARTING_NEXUS_HEALTH } from "./state";
import { applyAction, type Action } from "./reducer";

/** A puzzle definition: a fixed start state + the win condition + the intended
 *  (and a deliberately-wrong) solution line, both as reducer Action lists. */
export interface PuzzleDef {
  /** Stable id, e.g. "lethal-1". */
  id: string;
  /** Display title for the client. */
  title: string;
  /** One-line objective the player reads ("Win this turn."). */
  objective: string;
  /** Difficulty bucket for the client (pure label). */
  difficulty: "Intro" | "Standard" | "Tactical";
  /** Fixed seed the scenario state is built from. */
  seed: number;
  /** Build the FIXED starting state. Pure; no RNG beyond the baked seed. */
  build: () => MatchState;
  /** The intended solution — replayed through applyAction, it must WIN for the
   *  hero (`heroSeat`). */
  solution: Action[];
  /** A plausible WRONG line that must NOT win this turn (proves the puzzle has a
   *  real decision, not a trivially-winning board). */
  wrongLine: Action[];
  /** Which seat the player controls / must win as. */
  heroSeat: PlayerId;
}

/** Minimal helper to mint a board unit with sane combat defaults. Keeps the
 *  fixed scenarios terse and matches the reducer-equivalence fixture shape. */
function unit(
  instanceId: string,
  cardId: string,
  lane: Lane,
  attack: number,
  health: number,
  extra: Partial<UnitInPlay> = {},
): UnitInPlay {
  return {
    instanceId,
    cardId,
    lane,
    attack,
    health,
    maxHealth: health,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: false,
    summoningSick: false,
    ...extra,
  };
}

/**
 * A clean scenario skeleton: empty boards/hands, full nexuses, P1 to act, no
 * special rules. Puzzles layer their fixed board onto this. NOTE: we construct the
 * state object directly (no deck shuffles) so it is 100% deterministic and carries
 * NO mulligan/rules fields — exactly like the hand-built reducer-equivalence
 * scenarios.
 */
function blankArena(seed: number): MatchState {
  const player = (id: PlayerId): MatchState["players"]["P1"] => ({
    id,
    nexusHealth: STARTING_NEXUS_HEALTH,
    health: 30,
    energy: 10,
    maxEnergy: 10,
    commanderId: "",
    deck: [],
    hand: [],
    discard: [],
    graveyard: [],
    deckCount: 0,
    artifacts: [],
    board: { front: [], back: [] },
    turnFlags: { firstUnitCostReduction: 0, firstUnitPlayed: false },
  });
  return {
    turn: 1,
    activePlayer: "P1",
    winner: null,
    seed,
    idCounter: 0,
    rngCursor: 0,
    players: { P1: player("P1"), P2: player("P2") },
  };
}

/**
 * THE PUZZLE TABLE — fixed, hand-authored, deterministic. Each puzzle's solution
 * is verified by `dev:puzzle`: the intended line WINS, the wrong line does NOT.
 */
export const PUZZLES: readonly PuzzleDef[] = [
  // 1 — INTRO LETHAL: one big attacker, enemy nexus at exactly its attack value.
  // Solution: swing face for lethal. Wrong line: trade into their blocker instead.
  {
    id: "lethal-1",
    title: "Finish the Line",
    objective: "Win this turn. The enemy nexus is one swing from falling.",
    difficulty: "Intro",
    seed: 7001,
    heroSeat: "P1",
    build: () => {
      const s = blankArena(7001);
      s.players.P2.nexusHealth = 6;
      s.players.P1.board.front = [unit("hero_a", "pz_bruiser", "front", 6, 6)];
      s.players.P2.board.front = [unit("foe_a", "pz_chump", "front", 1, 3)];
      return s;
    },
    solution: [{ type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_a" }],
    // Trading into their unit leaves the nexus at 6 — no win this turn.
    wrongLine: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_a", defenderInstanceId: "foe_a" },
    ],
  },

  // 2 — TWO-FOR-LETHAL: nexus at 7, two attackers (4 + 3). BOTH must go face.
  // The wrong line sends one into the enemy unit, falling 3 short.
  {
    id: "lethal-2",
    title: "Both Blades",
    objective: "Win this turn. It takes everything you have.",
    difficulty: "Standard",
    seed: 7002,
    heroSeat: "P1",
    build: () => {
      const s = blankArena(7002);
      s.players.P2.nexusHealth = 7;
      s.players.P1.board.front = [
        unit("hero_a", "pz_blade", "front", 4, 4),
        unit("hero_b", "pz_blade", "front", 3, 3),
      ];
      s.players.P2.board.front = [unit("foe_a", "pz_wall", "front", 0, 5)];
      return s;
    },
    solution: [
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_a" },
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_b" },
    ],
    // Sending the 3-power blade into the wall leaves nexus at 7-4 = 3 -> no win.
    wrongLine: [
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_a" },
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_b", defenderInstanceId: "foe_a" },
    ],
  },

  // 3 — TACTICAL ORDER: a Rush-style attacker must clear the blocker first, then
  // a second attacker swings face for exact lethal. Nexus at 5; clearer is 3/2,
  // finisher is 5/5 but blocked by a 4-health GUARD wall on the only enemy unit.
  // Solution: kill the wall with the 3-power body (trading), then face with the
  // 5-power. Wrong line: face with the 5-power first into the wall is illegal /
  // just trades and leaves nexus up. We model the wrong line as both-into-face
  // without clearing — the finisher hits the wall, not the face.
  {
    id: "lethal-3",
    title: "Clear, Then Crash",
    objective: "Win this turn. Order is everything.",
    difficulty: "Tactical",
    seed: 7003,
    heroSeat: "P1",
    build: () => {
      const s = blankArena(7003);
      s.players.P2.nexusHealth = 5;
      s.players.P1.board.front = [
        unit("hero_clear", "pz_skirm", "front", 3, 3),
        unit("hero_fin", "pz_titan", "front", 5, 5),
      ];
      // Enemy GUARD wall must be cleared before the face is open.
      s.players.P2.board.front = [unit("foe_wall", "pz_guard", "front", 2, 3, { keywords: ["GUARD"] })];
      return s;
    },
    // Clear the GUARD wall with the skirmisher, then the titan has a clean face swing.
    solution: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_clear", defenderInstanceId: "foe_wall" },
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_fin" },
    ],
    // Swing the titan into the wall instead of clearing-then-facing: nexus stays at 5.
    wrongLine: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_fin", defenderInstanceId: "foe_wall" },
    ],
  },
] as const;

/** Result of running a puzzle solution through the reducer. */
export interface PuzzleRunResult {
  /** True iff the reducer awarded the hero seat the win after replaying actions. */
  solved: boolean;
  /** The winner the reducer reports (or null). */
  winner: PlayerId | null;
  /** The settled state, for inspection / the client board. */
  finalState: MatchState;
}

/**
 * Replay an action list through the SHIPPED reducer against a puzzle's fixed
 * start state and report whether the hero won. Pure: builds the state fresh, so
 * repeated calls are independent and deterministic.
 */
export function runPuzzleLine(puzzle: PuzzleDef, actions: Action[]): PuzzleRunResult {
  let state = puzzle.build();
  for (const action of actions) {
    state = applyAction(state, action).state;
  }
  return {
    solved: state.winner === puzzle.heroSeat,
    winner: state.winner ?? null,
    finalState: state,
  };
}

/** Convenience: run a puzzle's INTENDED solution. */
export function solvePuzzle(puzzle: PuzzleDef): PuzzleRunResult {
  return runPuzzleLine(puzzle, puzzle.solution);
}

/** Lookup a puzzle by id. Pure. */
export function getPuzzleById(id: string): PuzzleDef | undefined {
  return PUZZLES.find((p) => p.id === id);
}
