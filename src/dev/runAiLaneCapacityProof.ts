/**
 * dev:ai-lane-capacity — proves the P2 AI planner respects the SAME lane-capacity
 * rule the reducer enforces (MAX_LANE_UNITS per lane), spilling deploys into the
 * back lane when the front is full instead of planning guaranteed-reject "front"
 * plays.
 *
 * THE BUG (accumulating-state / AI-vs-reducer divergence): `planP2Plays` used to
 * hard-code `lane: "front"` for every unit. In a long match the AI's front lane
 * fills to MAX_LANE_UNITS=7; from then on the reducer rejects EVERY further deploy
 * with "lane-full", so the AI stops developing its board entirely — it sits with a
 * bloated hand and a completely empty back lane while the human runs it over. The
 * reducer (and a human, via onPlayBack) can use the back lane; the planner could not.
 *
 * This proof drives everything through the SAME `applyAction` the live game uses, so
 * it pins the LIVE path, not a reimplementation.
 */

import { applyAction } from "../engine/reducer";
import { makeSeededMatch } from "./reducerHarness";
import { MAX_LANE_UNITS } from "../engine/state";
import { planP2Plays, type AiAction } from "../game-ui/cryptMatchAI";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

console.log("=== AI LANE CAPACITY PROOF (planner respects MAX_LANE_UNITS; back-lane fallback) ===\n");

function fillerUnit(i: number, lane: "front" | "back") {
  return {
    instanceId: `pre_${lane}_${i}`,
    cardId: "tcg_filler",
    lane,
    attack: 1,
    health: 1,
    maxHealth: 1,
    speed: 0,
    armor: 0,
    keywords: [],
    exhausted: true,
    summoningSick: false,
  };
}

// Count how many of the planner's unit deploys the reducer ACCEPTS, and how many it
// rejects "lane-full". Applies plays in order against live state (front-to-back as
// planned), exactly like the hook.
function runPlan(state: any, plan: AiAction[]) {
  let s = state;
  let deployed = 0;
  let laneFull = 0;
  const lanes: Record<string, number> = { front: 0, back: 0 };
  for (const a of plan) {
    if (a.kind !== "playUnit") continue;
    const idx = s.players.P2.hand.indexOf(a.cardId);
    if (idx < 0) continue;
    const res = applyAction(s, { type: "PLAY_UNIT", player: "P2", handIndex: idx, lane: a.lane });
    const rej = res.events.find((e: any) => e.type === "REJECTED");
    if (rej && (rej as any).reason === "lane-full") {
      laneFull += 1;
    } else if (!rej) {
      deployed += 1;
      lanes[a.lane] += 1;
      s = res.state;
    }
  }
  return { deployed, laneFull, lanes, state: s };
}

// --- 1. Front lane FULL (7), back empty: the AI must spill into the back lane and
//        deploy successfully — NOT plan rejected front deploys. ---
{
  let state: any = makeSeededMatch(7);
  state.activePlayer = "P2";
  state.players.P2.energy = 10;
  state.players.P2.maxEnergy = 10;
  state.players.P2.board.front = Array.from({ length: MAX_LANE_UNITS }, (_, i) => fillerUnit(i, "front"));
  state.players.P2.board.back = [];

  const plan = planP2Plays(state, "hard");
  const unitPlays = plan.filter((a) => a.kind === "playUnit");
  assert(unitPlays.length > 0, "front-full: planner still WANTS to deploy units (hand has units)");
  assert(
    unitPlays.every((a: any) => a.lane === "back"),
    "front-full: every planned deploy targets the BACK lane (front-first, back fallback)",
  );
  const r = runPlan(state, plan);
  assert(r.laneFull === 0, "front-full: reducer rejects NONE of the deploys as lane-full");
  assert(r.deployed === unitPlays.length, "front-full: every planned deploy is ACCEPTED by the reducer");
  assert(r.lanes.back === r.deployed, "front-full: all accepted deploys landed in the back lane");
}

// --- 2. BOTH lanes full (7 + 7 = 14): the planner must plan ZERO deploys (no
//        guaranteed-reject plays), a clean no-op. ---
{
  let state: any = makeSeededMatch(11);
  state.activePlayer = "P2";
  state.players.P2.energy = 10;
  state.players.P2.maxEnergy = 10;
  state.players.P2.board.front = Array.from({ length: MAX_LANE_UNITS }, (_, i) => fillerUnit(i, "front"));
  state.players.P2.board.back = Array.from({ length: MAX_LANE_UNITS }, (_, i) => fillerUnit(i, "back"));

  const plan = planP2Plays(state, "hard");
  const unitPlays = plan.filter((a) => a.kind === "playUnit");
  assert(unitPlays.length === 0, "board-full: planner plans ZERO unit deploys (no lane-full rejects)");
  const r = runPlan(state, plan);
  assert(r.laneFull === 0, "board-full: reducer issues NO lane-full rejects (nothing was even attempted)");
}

// --- 3. Empty board: the planner still uses the FRONT lane first (no regression to
//        the historical front-preferring behavior). ---
{
  let state: any = makeSeededMatch(7);
  state.activePlayer = "P2";
  state.players.P2.energy = 10;
  state.players.P2.maxEnergy = 10;
  state.players.P2.board.front = [];
  state.players.P2.board.back = [];

  const plan = planP2Plays(state, "hard");
  const unitPlays = plan.filter((a) => a.kind === "playUnit");
  assert(unitPlays.length > 0, "empty-board: planner deploys units");
  assert(
    unitPlays.every((a: any) => a.lane === "front"),
    "empty-board: front-preferring behavior preserved (all deploys to front)",
  );
}

// --- 4. Partial front (6 of 7) + small hand: the 7th unit fills front, the rest
//        spill to back — proves the SIMULATED per-lane fill advances within one turn. ---
{
  let state: any = makeSeededMatch(7);
  state.activePlayer = "P2";
  state.players.P2.energy = 10;
  state.players.P2.maxEnergy = 10;
  state.players.P2.board.front = Array.from({ length: MAX_LANE_UNITS - 1 }, (_, i) => fillerUnit(i, "front"));
  state.players.P2.board.back = [];

  const plan = planP2Plays(state, "hard");
  const r = runPlan(state, plan);
  assert(r.laneFull === 0, "partial-front: no lane-full rejects across the turn's deploys");
  assert(r.lanes.front <= 1, "partial-front: at most ONE deploy goes to the (1-slot) front before spilling");
  // The post-play front lane never exceeds the cap.
  assert(r.state.players.P2.board.front.length <= MAX_LANE_UNITS, "partial-front: front never exceeds MAX_LANE_UNITS");
}

console.log("\nALL AI LANE CAPACITY PROOFS PASSED\n");
