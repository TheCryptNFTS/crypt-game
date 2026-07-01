/**
 * runSnapOnboardingProof — proves the scripted first match is a guaranteed win.
 *
 * Plays the onboarding scenario exactly as the coach guides the player (cost-N
 * card into PLAYER_LANES[N] on turn N) against the scripted opponent, and
 * asserts the pilot finishes 2–1 with the contested Crypt 3 FLIPPED on the final
 * turn (the dramatic beat). If the scenario math ever drifts, this fails loudly
 * before a real newcomer ever hits an unwinnable "tutorial".
 *
 *   npm run dev:snap-onboarding
 */

import { snapReducer } from "../snap/reducer";
import { laneOutcomes } from "../snap/scoreLane";
import {
  buildOnboardingMatch,
  expectedInstanceId,
  planOpponentTurn,
  PLAYER_LANES,
} from "../snap/onboarding";
import { MAX_TURNS, type SnapState } from "../snap/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAIL — ${msg}`);
    process.exit(1);
  }
}

function lanePower(state: SnapState, lane: number, seat: "P1" | "P2"): number {
  return state.lanes[lane][seat].reduce((sum, c) => sum + c.power, 0);
}

console.log("\nrunSnapOnboardingProof — scripted first match\n");

let s = buildOnboardingMatch();
let crypt3BehindBeforeBomb = false;

for (let turn = 1; turn <= MAX_TURNS; turn++) {
  assert(s.turn === turn, `expected turn ${turn}, got ${s.turn}`);
  assert(s.active === "P1", `expected P1 to act on turn ${turn}`);
  assert(s.players.P1.energy === turn, `energy should equal turn ${turn}, got ${s.players.P1.energy}`);

  const instanceId = expectedInstanceId(turn);
  const lane = PLAYER_LANES[turn - 1];
  assert(
    s.players.P1.hand.some((c) => c.instanceId === instanceId),
    `coached card ${instanceId} must be in hand on turn ${turn}`,
  );

  // On the final turn, verify the player is LOSING Crypt 3 before the bomb.
  if (turn === MAX_TURNS) {
    crypt3BehindBeforeBomb = lanePower(s, 2, "P1") < lanePower(s, 2, "P2");
  }

  const before = s;
  s = snapReducer(s, { type: "PLAY_CARD", seat: "P1", instanceId, lane });
  assert(s !== before, `turn ${turn}: coached play should be legal (reducer rejected it)`);

  s = snapReducer(s, { type: "END_TURN", seat: "P1" });
  assert(s.active === "P2", `turn ${turn}: after P1 ends, it should be P2's turn`);

  // Opponent auto-plays its scripted turn.
  for (const action of planOpponentTurn(s)) {
    s = snapReducer(s, action);
  }
}

assert(s.winner === "P1", `player must WIN the scripted match, got winner=${s.winner}`);
assert(s.outcomes !== null, "match should be settled with outcomes");

const outs = laneOutcomes(s);
const p1Lanes = outs.filter((o) => o.winner === "P1").length;
const p2Lanes = outs.filter((o) => o.winner === "P2").length;
assert(p1Lanes === 2 && p2Lanes === 1, `expected a 2–1 result, got ${p1Lanes}–${p2Lanes}`);
assert(outs[0].winner === "P1", "Crypt 1 should be the safe early win");
assert(outs[1].winner === "P2", "Crypt 2 should be the conceded lane");
assert(outs[2].winner === "P1", "Crypt 3 should be stolen by the final bomb");
assert(crypt3BehindBeforeBomb, "the win should be DRAMATIC — Crypt 3 must be losing before the turn-6 bomb");

for (const o of outs) {
  console.log(`  Crypt ${o.index + 1}: ${o.p1Power}–${o.p2Power} → ${o.winner}`);
}
console.log(`\nPASS — scripted first match is a guaranteed, dramatic 2–1 player win.\n`);
