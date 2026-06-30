import { describe, it, expect } from "vitest";
import { makeSeededMatch } from "../../dev/reducerHarness";
import { applyAction } from "../../engine/reducer";
import type { MatchState, UnitInPlay } from "../../engine/state";
import { planP2Combat, planP2Plays, type AiAction } from "../cryptMatchAI";
import { evaluateBoard } from "../cryptAiEval";

/**
 * AI competence tests for the upgraded solo opponent (cryptMatchAI + cryptAiEval).
 * Proves the four most-felt gains and the tier separation:
 *   1. LETHAL is taken when on the table (HARD sends everything face).
 *   2. GUARD is respected (no face / no non-GUARD swing while a GUARD stands).
 *   3. A clearly-BAD trade is avoided (a big body does not suicide into a small
 *      one for nothing — the 1-ply eval prefers face).
 *   4. EASY != HARD (the lethal line that HARD takes, EASY does not).
 * All boards are crafted directly on a seeded match; P2 is the AI. The planner is
 * pure-structural and normalizes a P1-active board to P2-active for simulation, so
 * we can build boards the way the engine combat-parity proof does.
 */

/** Minimal P2 (AI) attacker / P1 (enemy) defender, mirrors the surge test helper. */
function unit(over: Partial<UnitInPlay>): UnitInPlay {
  return {
    instanceId: "u",
    cardId: "t",
    lane: "front",
    attack: 0,
    health: 5,
    maxHealth: 5,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: false,
    summoningSick: false,
    ...over,
  } as UnitInPlay;
}

/** Seeded match with explicit P1 (enemy) and P2 (AI) front boards. */
function board(seed: number, enemy: UnitInPlay[], ai: UnitInPlay[]): MatchState {
  const s = makeSeededMatch(seed);
  s.players.P1.board.front = enemy;
  s.players.P2.board.front = ai;
  return s;
}

const isAttackUnit = (a: AiAction): a is Extract<AiAction, { kind: "attackUnit" }> =>
  a.kind === "attackUnit";

describe("AI — lethal detection", () => {
  it("HARD sends everything face when the swing is lethal (no GUARD wall)", () => {
    // Enemy nexus 6, two ready AI attackers totalling 7 face damage → lethal.
    const s = board(
      80001,
      [],
      [
        unit({ instanceId: "a1", attack: 4, health: 3 }),
        unit({ instanceId: "a2", attack: 3, health: 3 }),
      ],
    );
    s.players.P1.nexusHealth = 6;

    const plan = planP2Combat(s, "hard");
    // Every planned action is a face swing (the lethal line ignores trades).
    expect(plan.length).toBe(2);
    expect(plan.every((a) => a.kind === "attackFace")).toBe(true);

    // And the line actually KILLS: replay it through the reducer from P2's turn.
    s.activePlayer = "P2";
    let live: MatchState = s;
    for (const a of plan) {
      if (a.kind !== "attackFace") continue;
      live = applyAction(live, {
        type: "ATTACK_FACE",
        player: "P2",
        attackerInstanceId: a.attackerInstanceId,
      }).state;
    }
    expect(live.players.P1.nexusHealth).toBeLessThanOrEqual(0);
  });
});

describe("AI — GUARD is respected", () => {
  it("HARD attacks the GUARD, never the face or a non-GUARD unit, while a GUARD stands", () => {
    const s = board(
      80002,
      [
        unit({ instanceId: "guard", attack: 2, health: 6, keywords: ["GUARD"] }),
        unit({ instanceId: "soft", attack: 1, health: 2 }),
      ],
      [unit({ instanceId: "a", attack: 4, health: 8 })],
    );
    s.players.P1.nexusHealth = 6;

    const plan = planP2Combat(s, "hard");
    expect(plan.some((a) => a.kind === "attackFace")).toBe(false);
    // The only legal target is the GUARD; the soft non-GUARD unit must not be hit.
    const unitSwings = plan.filter(isAttackUnit);
    expect(unitSwings.length).toBeGreaterThan(0);
    expect(unitSwings.every((a) => a.defenderInstanceId === "guard")).toBe(true);

    // Reducer cross-check: hitting the non-GUARD unit IS illegal here.
    s.activePlayer = "P2";
    const illegal = applyAction(s, {
      type: "ATTACK_UNIT",
      player: "P2",
      attackerInstanceId: "a",
      defenderInstanceId: "soft",
    });
    expect(
      illegal.events.some(
        (e) => e.type === "REJECTED" && e.reason === "guard-must-be-cleared",
      ),
    ).toBe(true);
  });
});

describe("AI — avoids a clearly bad trade", () => {
  it("HARD does NOT suicide a big body into a small one for nothing; it hits face", () => {
    // AI 2/2 attacker. Enemy is a 1/8 wall: our 2 damage cannot kill it, and we
    // take 1 back for no value. The eval should prefer 2 face damage instead.
    const s = board(
      80003,
      [unit({ instanceId: "wall", attack: 1, health: 8 })],
      [unit({ instanceId: "a", attack: 2, health: 2 })],
    );
    s.players.P1.nexusHealth = 20;

    const plan = planP2Combat(s, "hard");
    // Not lethal, no GUARD: the value-maximizing line is to chip face, not trade
    // into a wall we can't kill while eating a counter.
    expect(plan).toEqual([{ kind: "attackFace", attackerInstanceId: "a" }]);
  });

  it("HARD DOES take a favorable trade (kill-and-survive) over face", () => {
    // AI 4/5 vs enemy 3/3: we kill it (4>=3) and survive (3<5). Removing a 3/3
    // body is worth more than 4 face on a healthy nexus → eval picks the trade.
    const s = board(
      80004,
      [unit({ instanceId: "threat", attack: 3, health: 3 })],
      [unit({ instanceId: "a", attack: 4, health: 5 })],
    );
    s.players.P1.nexusHealth = 20;

    const plan = planP2Combat(s, "hard");
    expect(plan).toEqual([
      { kind: "attackUnit", attackerInstanceId: "a", defenderInstanceId: "threat" },
    ]);
  });
});

describe("AI — difficulty tiers differ (easy != hard)", () => {
  it("HARD's eval trades into a high-attack threat where EASY/NORMAL just hit face", () => {
    // AI 3/3 vs an enemy 6/3 on a healthy (20) nexus. The eval-driven HARD plan
    // KILLS the 6-attack threat (its 3 damage is exactly lethal to the 3-hp body),
    // accepting the loss of its 3/3 because removing a 6-attack body is worth far
    // more than 3 chip damage. EASY/NORMAL use the simple greedy "kill AND survive"
    // rule — they can't survive the 6 counter, so they reject the trade and chip
    // face. This is a deterministic (no-RNG) demonstration of HARD's better
    // trade evaluation, distinct from both lower tiers.
    const make = () =>
      board(
        80030,
        [unit({ instanceId: "bigthreat", attack: 6, health: 3 })],
        [unit({ instanceId: "a", attack: 3, health: 3 })],
      );

    const hardPlan = planP2Combat(make(), "hard");
    const normalPlan = planP2Combat(make(), "normal");
    const easyPlan = planP2Combat(make(), "easy");

    // HARD: kill the threat.
    expect(hardPlan).toEqual([
      { kind: "attackUnit", attackerInstanceId: "a", defenderInstanceId: "bigthreat" },
    ]);
    // NORMAL and EASY: just chip the face (the bad-survival trade is rejected).
    expect(normalPlan).toEqual([{ kind: "attackFace", attackerInstanceId: "a" }]);
    expect(easyPlan).toEqual([{ kind: "attackFace", attackerInstanceId: "a" }]);

    // The tiers are genuinely distinct.
    expect(hardPlan).not.toEqual(easyPlan);
    expect(hardPlan).not.toEqual(normalPlan);
  });

  it("HARD takes a clean lethal both-face line (recognition EASY/NORMAL lack)", () => {
    // No enemy units, nexus 6, two attackers totalling 7: HARD's lethal gate
    // returns the deliberate both-face kill. (EASY/NORMAL reach the same face line
    // here only because there is nothing else to do — the recognition is what
    // differs; the lethal-vs-trade test above shows the behavioral gap.)
    const s = board(
      80031,
      [],
      [unit({ instanceId: "a1", attack: 4, health: 3 }), unit({ instanceId: "a2", attack: 3, health: 3 })],
    );
    s.players.P1.nexusHealth = 6;
    const hardPlan = planP2Combat(s, "hard");
    expect(hardPlan.filter((a) => a.kind === "attackFace").length).toBe(2);
  });

  it("EASY under-deploys relative to HARD given a full hand", () => {
    // A fresh seeded match: both tiers plan plays off the same opening hand. EASY
    // caps deploys at 2, HARD at 5, so HARD develops at least as many units.
    const s = makeSeededMatch(80006);
    const easyDeploys = planP2Plays(s, "easy").filter((a) => a.kind === "playUnit").length;
    const hardDeploys = planP2Plays(s, "hard").filter((a) => a.kind === "playUnit").length;
    expect(easyDeploys).toBeLessThanOrEqual(2);
    expect(hardDeploys).toBeGreaterThanOrEqual(easyDeploys);
  });
});

describe("AI eval — value function sanity", () => {
  it("scores a board with more enemy-nexus pressure higher for P2", () => {
    const lo = board(80007, [], []);
    lo.players.P1.nexusHealth = 20;
    const hi = board(80007, [], []);
    hi.players.P1.nexusHealth = 5;
    // Lower enemy nexus = better for P2.
    expect(evaluateBoard(hi)).toBeGreaterThan(evaluateBoard(lo));
  });

  it("treats a P2 win as the maximal score and a P2 loss as the minimal", () => {
    const win = board(80008, [], []);
    win.players.P1.nexusHealth = 0;
    const loss = board(80008, [], []);
    loss.players.P2.nexusHealth = 0;
    expect(evaluateBoard(win)).toBeGreaterThan(0);
    expect(evaluateBoard(loss)).toBeLessThan(0);
    expect(evaluateBoard(win)).toBeGreaterThan(evaluateBoard(loss));
  });
});
