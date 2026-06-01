/**
 * Shared harness for the reducer proof scripts (`dev:reducer-equivalence`,
 * `dev:combat-parity`, `dev:e2e`, `dev:determinism`).
 *
 * Everything here is deterministic: matches are built from an explicit seed
 * (never Date.now), and scripted action lists are applied through the SAME
 * `applyAction` the live game uses. The harness reproduces the hook's lived
 * `makeInitialMatch` seeding (base energy + nexusHealth) so fixtures match what
 * players actually experience.
 */

import { createMatchFromDecks } from "../engine/createMatchFromDecks";
import { allCommanders } from "../engine/commanders";
import { buildPlayerDeck } from "../nft/buildOwnedDeck";
import { applyAction, autoPickOption, Action, GameEvent } from "../engine/reducer";
import { MatchState, BASE_MAX_ENERGY, STARTING_NEXUS_HEALTH } from "../engine/state";
import { planP2Plays, planP2Combat, type AiAction } from "../game-ui/cryptMatchAI";

/** Build a deterministic match seeded exactly like the live hook does. */
export function makeSeededMatch(seed: number): MatchState {
  const c1 = allCommanders[0];
  const c2 = allCommanders.find((c: any) => c.id !== c1.id) ?? c1;
  const deck = buildPlayerDeck().deck;

  const match: any = createMatchFromDecks({
    p1: { commanderId: c1.id, deck },
    p2: { commanderId: c2.id, deck },
    seed,
    openingHandSize: 6,
  });

  match.activePlayer = match.activePlayer ?? "P1";
  match.turn = match.turn ?? 1;
  match.winner = match.winner ?? null;
  match.players.P1.maxEnergy = BASE_MAX_ENERGY;
  match.players.P1.energy = BASE_MAX_ENERGY;
  match.players.P2.maxEnergy = BASE_MAX_ENERGY;
  match.players.P2.energy = BASE_MAX_ENERGY;
  match.players.P1.nexusHealth = match.players.P1.nexusHealth ?? STARTING_NEXUS_HEALTH;
  match.players.P2.nexusHealth = match.players.P2.nexusHealth ?? STARTING_NEXUS_HEALTH;

  return match as MatchState;
}

export interface Replay {
  finalState: MatchState;
  events: GameEvent[];
}

/** Apply an action list through the reducer, accumulating every event. */
export function replay(start: MatchState, actions: Action[]): Replay {
  let state = start;
  const events: GameEvent[] = [];
  for (const a of actions) {
    const res = applyAction(state, a);
    state = res.state;
    for (const ev of res.events) events.push(ev);
  }
  return { finalState: state, events };
}

/**
 * Apply one action, then drain any mid-resolution CHOICE it raised with the
 * deterministic auto-pick (RESOLUTION_MODEL.md §8). The RESOLVE_CHOICE actions are
 * APPENDED to `log` so a `replay(seed, log)` reproduces the byte-identical match —
 * the chosen optionId is captured, not regenerated. Returns the settled state. A
 * choice can chain (a resume tail is a clean action boundary, but a single
 * RESOLVE_CHOICE never re-raises in v1), so the drain loops to a fixed point with a
 * guard against any pathological re-raise.
 */
function applyAndDrain(state: MatchState, action: Action, log: Action[], events: GameEvent[]): MatchState {
  let res = applyAction(state, action);
  let next = res.state;
  log.push(action);
  for (const ev of res.events) events.push(ev);
  let guard = 0;
  while (next.pendingChoice && guard < 64) {
    guard += 1;
    const optionId = autoPickOption(next);
    if (optionId == null) break;
    const resolve: Action = { type: "RESOLVE_CHOICE", player: next.pendingChoice.controller, optionId };
    res = applyAction(next, resolve);
    next = res.state;
    log.push(resolve);
    for (const ev of res.events) events.push(ev);
  }
  return next;
}

/** Drive a full P1-vs-AI match purely through `applyAction`, to a winner or a
 *  turn cap. Returns the action list actually applied + the final replay. */
export function playAiMatch(seed: number, maxTurns = 60): { actions: Action[]; result: Replay } {
  let state = makeSeededMatch(seed);
  const actions: Action[] = [];
  const events: GameEvent[] = [];

  /** Map a planner action addressed to "P2" onto the real seat, apply + drain. */
  const runAiAction = (a: AiAction, seat: "P1" | "P2"): void => {
    if (state.winner) return;
    const hand = state.players[seat].hand;
    let action: Action | null = null;
    if (a.kind === "playUnit") {
      const idx = hand.indexOf(a.cardId);
      if (idx < 0) return;
      action = { type: "PLAY_UNIT", player: seat, handIndex: idx, lane: a.lane };
    } else if (a.kind === "playArtifact") {
      const idx = hand.indexOf(a.cardId);
      if (idx < 0) return;
      action = { type: "PLAY_ARTIFACT", player: seat, handIndex: idx };
    } else if (a.kind === "playSpell") {
      const idx = hand.indexOf(a.cardId);
      if (idx < 0) return;
      action = { type: "PLAY_SPELL", player: seat, handIndex: idx, targetInstanceId: a.targetInstanceId };
    } else if (a.kind === "equip") {
      const idx = hand.indexOf(a.cardId);
      if (idx < 0) return;
      action = { type: "EQUIP", player: seat, handIndex: idx, targetInstanceId: a.targetInstanceId };
    } else if (a.kind === "attackUnit") {
      action = { type: "ATTACK_UNIT", player: seat, attackerInstanceId: a.attackerInstanceId, defenderInstanceId: a.defenderInstanceId };
    } else if (a.kind === "attackFace") {
      action = { type: "ATTACK_FACE", player: seat, attackerInstanceId: a.attackerInstanceId };
    }
    if (!action) return;
    state = applyAndDrain(state, action, actions, events);
  };

  // The planner reasons about "P2"; for a P1 turn we present P1 as "P2" in the
  // view. Two-phase (plays, then combat off the post-play board) so a freshly
  // summoned RUSH unit can swing — re-derive the view from CURRENT state each
  // phase so combat sees the new bodies.
  const runHumanGreedy = () => {
    const viewP1 = (): any => ({ ...state, players: { P2: state.players.P1, P1: state.players.P2 } });
    for (const a of planP2Plays(viewP1())) {
      if (state.winner) break;
      runAiAction(a, "P1");
    }
    for (const a of planP2Combat(viewP1())) {
      if (state.winner) break;
      runAiAction(a, "P1");
    }
  };

  const runAi = () => {
    for (const a of planP2Plays(state)) {
      if (state.winner) break;
      runAiAction(a, "P2");
    }
    for (const a of planP2Combat(state)) {
      if (state.winner) break;
      runAiAction(a, "P2");
    }
  };

  let guard = 0;
  while (!state.winner && guard < maxTurns) {
    guard += 1;
    if (state.activePlayer === "P1") {
      runHumanGreedy();
      if (state.winner) break;
      state = applyAndDrain(state, { type: "END_TURN", player: "P1" }, actions, events);
    } else {
      runAi();
      if (state.winner) break;
      state = applyAndDrain(state, { type: "END_TURN", player: "P2" }, actions, events);
    }
  }

  return { actions, result: { finalState: state, events } };
}
