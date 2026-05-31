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
import { planP2Turn } from "../game-ui/cryptMatchAI";

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

  const runHumanGreedy = () => {
    // A simple but real P1 policy: reuse the AI planner for P1 too, so the e2e
    // match is fully scripted and deterministic with no human input.
    const p1View = { ...state, players: { P1: state.players.P2, P2: state.players.P1 } } as any;
    void p1View;
    // Use the planner directly on P1 by temporarily presenting P1 as "P2".
    const plan = planP2Turn({ ...state, players: { P2: state.players.P1, P1: state.players.P2 } });
    for (const a of plan) {
      if (state.winner) break;
      let action: Action | null = null;
      if (a.kind === "playUnit") {
        const idx = state.players.P1.hand.indexOf(a.cardId);
        if (idx < 0) continue;
        action = { type: "PLAY_UNIT", player: "P1", handIndex: idx, lane: a.lane };
      } else if (a.kind === "playArtifact") {
        const idx = state.players.P1.hand.indexOf(a.cardId);
        if (idx < 0) continue;
        action = { type: "PLAY_ARTIFACT", player: "P1", handIndex: idx };
      } else if (a.kind === "equip") {
        const idx = state.players.P1.hand.indexOf(a.cardId);
        if (idx < 0) continue;
        action = { type: "EQUIP", player: "P1", handIndex: idx, targetInstanceId: a.targetInstanceId };
      } else if (a.kind === "attackUnit") {
        action = { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: a.attackerInstanceId, defenderInstanceId: a.defenderInstanceId };
      } else if (a.kind === "attackFace") {
        action = { type: "ATTACK_FACE", player: "P1", attackerInstanceId: a.attackerInstanceId };
      }
      if (!action) continue;
      state = applyAndDrain(state, action, actions, events);
    }
  };

  const runAi = () => {
    const plan = planP2Turn(state);
    for (const a of plan) {
      if (state.winner) break;
      let action: Action | null = null;
      if (a.kind === "playUnit") {
        const idx = state.players.P2.hand.indexOf(a.cardId);
        if (idx < 0) continue;
        action = { type: "PLAY_UNIT", player: "P2", handIndex: idx, lane: a.lane };
      } else if (a.kind === "playArtifact") {
        const idx = state.players.P2.hand.indexOf(a.cardId);
        if (idx < 0) continue;
        action = { type: "PLAY_ARTIFACT", player: "P2", handIndex: idx };
      } else if (a.kind === "equip") {
        const idx = state.players.P2.hand.indexOf(a.cardId);
        if (idx < 0) continue;
        action = { type: "EQUIP", player: "P2", handIndex: idx, targetInstanceId: a.targetInstanceId };
      } else if (a.kind === "attackUnit") {
        action = { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: a.attackerInstanceId, defenderInstanceId: a.defenderInstanceId };
      } else if (a.kind === "attackFace") {
        action = { type: "ATTACK_FACE", player: "P2", attackerInstanceId: a.attackerInstanceId };
      }
      if (!action) continue;
      state = applyAndDrain(state, action, actions, events);
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
