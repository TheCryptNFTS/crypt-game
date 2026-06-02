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

  // 4 — OVER THE WALL: enemy nexus at 6 behind a GUARD. A flyer alone can't reach
  // the face while the GUARD stands. Clear the GUARD with a ground body first, THEN
  // the flyer swings face for exactly 6. Wrong line opens with the flyer into the
  // face: GUARD blocks it (reject / no-op), nexus untouched.
  {
    id: "lethal-4",
    title: "Over the Wall",
    objective: "Win this turn. Open the lane before you fly in.",
    difficulty: "Standard",
    seed: 7004,
    heroSeat: "P1",
    build: () => {
      const s = blankArena(7004);
      s.players.P2.nexusHealth = 6;
      s.players.P1.board.front = [
        unit("hero_clear", "pz_skirm", "front", 3, 3),
        unit("hero_fly", "pz_raptor", "front", 6, 4, { keywords: ["FLYING"] }),
      ];
      s.players.P2.board.front = [unit("foe_wall", "pz_guard", "front", 0, 3, { keywords: ["GUARD"] })];
      return s;
    },
    solution: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_clear", defenderInstanceId: "foe_wall" },
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_fly" },
    ],
    // Flyer into the face while the GUARD stands: blocked, no damage, nexus stays 6.
    wrongLine: [{ type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_fly" }],
  },

  // 5 — TRADE TO OPEN: enemy nexus at 5 behind a sturdy 3/4 GUARD. The expendable
  // 5/2 trades into the wall to clear it (and dies to the counter — that's fine),
  // freeing the 5/5 finisher to swing face for lethal. Wrong line tries to swing
  // the finisher at the face first: the GUARD blocks it, nexus stays at 5.
  {
    id: "lethal-5",
    title: "Trade to Open",
    objective: "Win this turn. Spend the small blade to free the big one.",
    difficulty: "Standard",
    seed: 7005,
    heroSeat: "P1",
    build: () => {
      const s = blankArena(7005);
      s.players.P2.nexusHealth = 5;
      s.players.P1.board.front = [
        unit("hero_trade", "pz_duelist", "front", 5, 2),
        unit("hero_fin", "pz_titan", "front", 5, 5),
      ];
      s.players.P2.board.front = [unit("foe_wall", "pz_guard", "front", 3, 4, { keywords: ["GUARD"] })];
      return s;
    },
    solution: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_trade", defenderInstanceId: "foe_wall" },
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_fin" },
    ],
    // Finisher into the face while the GUARD stands: blocked, nexus stays 5.
    wrongLine: [{ type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_fin" }],
  },

  // 6 — EXECUTIONER: enemy nexus at 3 behind a beefy 1/5 GUARD (maxHealth 5). A
  // plain hit can't kill a 5-health wall this turn — but the EXECUTE attacker drops
  // it below half (5 -> 2, 2 <= ceil(5/2)=3) and finishes it. Then the 3/3 swings
  // face for exactly 3. Wrong line sends the finisher into the wall (no EXECUTE): the
  // wall survives on 2, the GUARD still stands, no lethal.
  {
    id: "lethal-6",
    title: "Executioner's Window",
    objective: "Win this turn. The big wall dies only to the right blade.",
    difficulty: "Tactical",
    seed: 7006,
    heroSeat: "P1",
    build: () => {
      const s = blankArena(7006);
      s.players.P2.nexusHealth = 3;
      s.players.P1.board.front = [
        unit("hero_exec", "pz_reaper", "front", 3, 4, { keywords: ["EXECUTE"] }),
        unit("hero_fin", "pz_blade", "front", 3, 3),
      ];
      s.players.P2.board.front = [unit("foe_wall", "pz_bulwark", "front", 1, 5, { keywords: ["GUARD"] })];
      return s;
    },
    solution: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_exec", defenderInstanceId: "foe_wall" },
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_fin" },
    ],
    // Finisher (no EXECUTE) into the wall: deals 3, wall lives on 2, GUARD holds.
    wrongLine: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_fin", defenderInstanceId: "foe_wall" },
    ],
  },

  // 7 — DON'T FEED THE LEECH: enemy nexus at 6, lethal to a single 6/8 swing — and
  // the enemy LIFESTEAL body is NOT a GUARD, so the face is already open. Going face
  // wins outright. The trap: trading into the 3/5 leech lets it counter for 3 and
  // HEAL the enemy nexus by 3 (6 -> 9), and your attacker is now spent. Restraint is
  // the puzzle: ignore the bait, hit face.
  {
    id: "lethal-7",
    title: "Don't Feed the Leech",
    objective: "Win this turn. The open face is the only line — ignore the bait.",
    difficulty: "Tactical",
    seed: 7007,
    heroSeat: "P1",
    build: () => {
      const s = blankArena(7007);
      s.players.P2.nexusHealth = 6;
      s.players.P1.board.front = [unit("hero_a", "pz_juggernaut", "front", 6, 8)];
      s.players.P2.board.front = [unit("foe_leech", "pz_leech", "front", 3, 5, { keywords: ["LIFESTEAL"] })];
      return s;
    },
    solution: [{ type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_a" }],
    // Trading into the leech: it counters for 3 and lifesteals the enemy nexus to 9.
    wrongLine: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_a", defenderInstanceId: "foe_leech" },
    ],
  },

  // 8 — TWIN GATES: enemy nexus at 4 behind TWO GUARDs. Both must fall before the
  // finisher can reach the face. Clear g1, clear g2, then crash for 4. Wrong line
  // clears only ONE gate and tries to finish: the second GUARD blocks the face.
  {
    id: "lethal-8",
    title: "Twin Gates",
    objective: "Win this turn. Two gates stand — both must fall first.",
    difficulty: "Tactical",
    seed: 7008,
    heroSeat: "P1",
    build: () => {
      const s = blankArena(7008);
      s.players.P2.nexusHealth = 4;
      s.players.P1.board.front = [
        unit("hero_c1", "pz_skirm", "front", 2, 2),
        unit("hero_c2", "pz_skirm", "front", 2, 2),
        unit("hero_fin", "pz_titan", "front", 4, 4),
      ];
      s.players.P2.board.front = [
        unit("foe_g1", "pz_gate", "front", 0, 2, { keywords: ["GUARD"] }),
        unit("foe_g2", "pz_gate", "front", 0, 2, { keywords: ["GUARD"] }),
      ];
      return s;
    },
    solution: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_c1", defenderInstanceId: "foe_g1" },
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_c2", defenderInstanceId: "foe_g2" },
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_fin" },
    ],
    // Only one gate cleared: the second GUARD still blocks the finisher's face swing.
    wrongLine: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_c1", defenderInstanceId: "foe_g1" },
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_fin" },
    ],
  },

  // 9 — CRUSH THROUGH: enemy nexus at 3 behind a 0/2 GUARD (maxHealth 2). The lone
  // attacker has CRUSH: when it overkills the GUARD, the excess (5 dealt - 2 health
  // = 3) spills onto the nexus for exactly lethal. You CANNOT swing face (GUARD), so
  // the only line is to crash the wall and let the overflow finish. Wrong line tries
  // the face directly: the GUARD blocks it, nothing happens.
  {
    id: "lethal-9",
    title: "Crush Through",
    objective: "Win this turn. Smash the gate hard enough and the spill is lethal.",
    difficulty: "Tactical",
    seed: 7009,
    heroSeat: "P1",
    build: () => {
      const s = blankArena(7009);
      s.players.P2.nexusHealth = 3;
      s.players.P1.board.front = [unit("hero_crush", "pz_ram", "front", 5, 6, { keywords: ["CRUSH"] })];
      s.players.P2.board.front = [unit("foe_wall", "pz_guard", "front", 0, 2, { keywords: ["GUARD"] })];
      return s;
    },
    // Crash the GUARD: 5 dealt vs 2 health -> 3 overflow spills to the nexus (3 -> 0).
    solution: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_crush", defenderInstanceId: "foe_wall" },
    ],
    // Swing the face directly: the GUARD blocks it, nexus stays at 3.
    wrongLine: [{ type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_crush" }],
  },

  // 10 — SHIELD POP: enemy nexus at 5 behind a shielded 0/1 GUARD. The one-shot
  // shield eats the FIRST hit whole, so it takes TWO strikes to drop the gate before
  // the finisher can reach the face. Tap once to pop the shield, tap again to kill,
  // then crash for 5. Wrong line pops the shield but only hits once: the GUARD lives
  // and still blocks the face.
  {
    id: "lethal-10",
    title: "Pop the Shield",
    objective: "Win this turn. The gate's ward eats the first blow — bring two.",
    difficulty: "Tactical",
    seed: 7010,
    heroSeat: "P1",
    build: () => {
      const s = blankArena(7010);
      s.players.P2.nexusHealth = 5;
      s.players.P1.board.front = [
        unit("hero_tap1", "pz_skirm", "front", 1, 2),
        unit("hero_tap2", "pz_skirm", "front", 1, 2),
        unit("hero_fin", "pz_titan", "front", 5, 5),
      ];
      s.players.P2.board.front = [
        unit("foe_gate", "pz_warded", "front", 0, 1, { keywords: ["GUARD", "SHIELD"], shielded: true }),
      ];
      return s;
    },
    solution: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_tap1", defenderInstanceId: "foe_gate" },
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_tap2", defenderInstanceId: "foe_gate" },
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_fin" },
    ],
    // One tap only pops the shield; the GUARD survives on 1 and still blocks the face.
    wrongLine: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_tap1", defenderInstanceId: "foe_gate" },
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_fin" },
    ],
  },

  // 11 — RANGED PICK: enemy nexus at 5 behind a FLYING GUARD. Only a RANGED (or
  // FLYING) attacker can target a flyer, so the ground bodies can't clear it. Use the
  // RANGED skirmisher to shoot the flying gate down, then the FLYING finisher swings
  // face for 5. Wrong line points a plain ground attacker at the flyer: it can't be
  // targeted (reject / no-op), the GUARD holds, no lethal.
  {
    id: "lethal-11",
    title: "Ranged Pick",
    objective: "Win this turn. Only the right tool can pull a flyer down.",
    difficulty: "Tactical",
    seed: 7011,
    heroSeat: "P1",
    build: () => {
      const s = blankArena(7011);
      s.players.P2.nexusHealth = 5;
      s.players.P1.board.front = [
        unit("hero_ground", "pz_brute", "front", 4, 4),
        unit("hero_ranged", "pz_archer", "front", 3, 3, { keywords: ["RANGED"] }),
        unit("hero_fly", "pz_raptor", "front", 5, 5, { keywords: ["FLYING"] }),
      ];
      s.players.P2.board.front = [
        unit("foe_skygate", "pz_skygate", "front", 0, 3, { keywords: ["GUARD", "FLYING"] }),
      ];
      return s;
    },
    solution: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_ranged", defenderInstanceId: "foe_skygate" },
      { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "hero_fly" },
    ],
    // The ground brute cannot target a flyer: the strike is rejected, the GUARD holds.
    wrongLine: [
      { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "hero_ground", defenderInstanceId: "foe_skygate" },
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
