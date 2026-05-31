import { describe, it, expect } from "vitest";
import { applyAction } from "../reducer";
import { makeSeededMatch, playAiMatch } from "../../dev/reducerHarness";

/**
 * Reject-soft + core invariants. Invalid actions must be a clean no-op: the
 * reducer never throws, returns the ORIGINAL state reference unchanged, and
 * emits a single REJECTED event (RESOLUTION_MODEL.md). Plus a couple of core
 * structural assertions over a real seeded match.
 */
describe("reducer reject-soft", () => {
  it("an out-of-bounds hand index rejects without throwing or mutating state", () => {
    const state = makeSeededMatch(13131);
    let res!: ReturnType<typeof applyAction>;
    expect(() => {
      res = applyAction(state, {
        type: "PLAY_UNIT",
        player: "P1",
        handIndex: 9999,
        lane: "front",
      });
    }).not.toThrow();
    // Reject returns the SAME reference (true no-op) + one REJECTED event.
    expect(res.state).toBe(state);
    expect(res.events).toHaveLength(1);
    expect(res.events[0].type).toBe("REJECTED");
  });

  it("acting out of turn rejects (not-your-turn)", () => {
    const state = makeSeededMatch(24242);
    expect(state.activePlayer).toBe("P1");
    const res = applyAction(state, { type: "END_TURN", player: "P2" });
    expect(res.state).toBe(state);
    expect(res.events).toEqual([{ type: "REJECTED", reason: "not-your-turn" }]);
  });

  it("a RESOLVE_CHOICE with no pending choice is a clean no-op", () => {
    const state = makeSeededMatch(35353);
    expect(state.pendingChoice ?? null).toBeNull();
    const res = applyAction(state, {
      type: "RESOLVE_CHOICE",
      player: "P1",
      optionId: "anything",
    });
    expect(res.state).toBe(state);
    expect(res.events).toEqual([
      { type: "REJECTED", reason: "no-pending-choice" },
    ]);
  });
});

describe("reducer core mechanics", () => {
  it("END_TURN passes the turn to the opponent and emits TURN_END/TURN_START", () => {
    const state = makeSeededMatch(46464);
    expect(state.activePlayer).toBe("P1");
    const res = applyAction(state, { type: "END_TURN", player: "P1" });
    // A successful action returns a fresh clone, never the input reference.
    expect(res.state).not.toBe(state);
    expect(res.state.activePlayer).toBe("P2");
    const evTypes = res.events.map((e) => e.type);
    expect(evTypes).toContain("TURN_END");
    expect(evTypes).toContain("TURN_START");
  });

  it("a full seeded match terminates with conserved/valid nexus health", () => {
    const { actions, result } = playAiMatch(77001);
    expect(actions.length).toBeGreaterThan(0);
    expect(result.events.length).toBeGreaterThan(0);
    const p1 = result.finalState.players.P1.nexusHealth ?? 20;
    const p2 = result.finalState.players.P2.nexusHealth ?? 20;
    // Nexus health is a bounded integer that only ever moves down through play.
    expect(p1).toBeLessThanOrEqual(20);
    expect(p2).toBeLessThanOrEqual(20);
    // A decided match emits a WIN event for the winner.
    if (result.finalState.winner) {
      expect(result.events.some((e) => e.type === "WIN")).toBe(true);
    }
  });
});
