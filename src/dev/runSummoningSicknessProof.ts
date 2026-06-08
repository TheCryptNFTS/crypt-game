/**
 * dev:summoning-sickness — regression proof for the summoning-sickness enforcement
 * bug (red-team BUG 1). Before the fix, the reducer checked only `exhausted` in
 * ATTACK_UNIT / ATTACK_FACE and NEVER read `summoningSick`, so a freshly-played
 * non-RUSH unit could swing the turn it arrived — making RUSH meaningless and (because
 * the AI planner already excludes sick units) handing the human a one-sided edge.
 *
 * This proof pins the corrected lived rule, driven through the SAME `applyAction` the
 * game uses:
 *   1. A non-RUSH unit played THIS turn is summoning-sick: BOTH ATTACK_FACE and
 *      ATTACK_UNIT are rejected with reason "attacker-summoning-sick".
 *   2. A RUSH unit is NOT sick: it may attack the turn it arrives.
 *   3. After END_TURN cycles back to that unit's controller (turn N -> N+1), the
 *      previously-sick unit is cleared and CAN attack.
 *
 * Deterministic: fixed seeds, crafted boards (mirrors reducerScenarios.ts), no
 * Date/Math.random. check(name,cond,detail) + process.exit(1) on any failure.
 */

import { applyAction } from "../engine/reducer";
import { MatchState, Lane } from "../engine/state";
import { makeSeededMatch } from "./reducerHarness";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`OK: ${name}`);
  else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

/** A crafted board unit, mirroring the inline units in reducerScenarios.ts. */
function craftUnit(id: string, summoningSick: boolean, keywords: string[] = []): any {
  return {
    instanceId: id,
    cardId: "t_atk",
    lane: "front" as Lane,
    attack: 4,
    health: 5,
    maxHealth: 5,
    speed: 0,
    armor: 0,
    keywords,
    exhausted: false,
    summoningSick,
  };
}

function lastRejectReason(state: MatchState, action: any): string | null {
  const res = applyAction(state, action);
  // A reject returns the state UNCHANGED with a single REJECTED event.
  const rejected = res.events.find((e: any) => e.type === "REJECTED") as any;
  return rejected?.reason ?? null;
}

function run() {
  // --- 1. A summoning-sick non-RUSH unit cannot attack (face OR unit) -----------
  {
    const s = makeSeededMatch(3001);
    s.players.P1.board.front = [craftUnit("sick_3001", true)];
    s.players.P2.board.front = [craftUnit("enemy_3001", false)];

    const faceReason = lastRejectReason(s, {
      type: "ATTACK_FACE",
      player: "P1",
      attackerInstanceId: "sick_3001",
    });
    check(
      "sick non-RUSH unit: ATTACK_FACE rejected with attacker-summoning-sick",
      faceReason === "attacker-summoning-sick",
      { faceReason }
    );

    const unitReason = lastRejectReason(s, {
      type: "ATTACK_UNIT",
      player: "P1",
      attackerInstanceId: "sick_3001",
      defenderInstanceId: "enemy_3001",
    });
    check(
      "sick non-RUSH unit: ATTACK_UNIT rejected with attacker-summoning-sick",
      unitReason === "attacker-summoning-sick",
      { unitReason }
    );
  }

  // --- 2. A RUSH unit (non-sick) CAN attack the turn it arrives -----------------
  {
    const s = makeSeededMatch(3002);
    s.players.P2.nexusHealth = 20;
    // RUSH units are seeded non-sick by setup.ts; we craft that state directly.
    s.players.P1.board.front = [craftUnit("rush_3002", false, ["RUSH"])];

    const res = applyAction(s, { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "rush_3002" });
    const wasRejected = res.events.some((e: any) => e.type === "REJECTED");
    const nexusAfter = res.state.players.P2.nexusHealth;
    check(
      "RUSH unit: ATTACK_FACE is allowed (not rejected)",
      !wasRejected,
      { events: res.events.map((e: any) => e.type) }
    );
    check(
      "RUSH unit: face actually took damage (20 -> 16)",
      nexusAfter === 16,
      { nexusAfter }
    );
  }

  // --- 3. After a full turn cycle the unit is un-sick and CAN attack ------------
  // P1 plays/has a sick unit. P1 ends turn (refreshes P2 — P1 unit stays sick).
  // P2 ends turn (refreshes P1 — P1 unit clears). Now P1 may attack.
  {
    let s: any = makeSeededMatch(3003);
    s.players.P2.nexusHealth = 20;
    s.players.P1.board.front = [craftUnit("grow_3003", true)];
    // Make sure P2 has no plays/attacks that interfere: empty its board, give it
    // a deck so its END_TURN draw does not deck-out.
    s.players.P2.board.front = [];
    s.players.P2.board.back = [];

    // Sanity: sick right now.
    const before = lastRejectReason(s, { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "grow_3003" });
    check("turn-cycle: unit is sick before any END_TURN", before === "attacker-summoning-sick", { before });

    // P1 ends turn -> P2's units refresh (NOT P1's). The P1 unit must STILL be sick.
    s = applyAction(s, { type: "END_TURN", player: "P1" }).state;
    const stillSick = s.players.P1.board.front[0].summoningSick;
    check("turn-cycle: P1 unit still sick after P1's own END_TURN", stillSick === true, { stillSick });

    // P2 ends turn -> control returns to P1, P1's units refresh and clear sickness.
    s = applyAction(s, { type: "END_TURN", player: "P2" }).state;
    const cleared = s.players.P1.board.front[0].summoningSick;
    check("turn-cycle: P1 unit un-sick after returning to P1's turn", cleared === false, { cleared });

    // And now the attack is allowed.
    const res = applyAction(s, { type: "ATTACK_FACE", player: "P1", attackerInstanceId: "grow_3003" });
    const wasRejected = res.events.some((e: any) => e.type === "REJECTED");
    check(
      "turn-cycle: un-sick unit CAN attack after the cycle",
      !wasRejected,
      { events: res.events.map((e: any) => e.type) }
    );
  }

  console.log("\n=== SUMMONING-SICKNESS ENFORCEMENT PROOF (BUG 1 regression) ===");
  if (failures > 0) {
    console.error(`FAILED: ${failures} summoning-sickness check(s) failed.`);
    process.exit(1);
  }
  console.log("ALL SUMMONING-SICKNESS PROOFS PASSED");
}

run();
