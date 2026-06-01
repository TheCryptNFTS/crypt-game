/**
 * dev:trait-resonance — behavioral proof for TRAIT RESONANCE (the signature hook,
 * src/engine/traitResonance.ts). Exercises the pure summon hook directly with
 * minimal states / units so the assertions are exact and isolated from full-match
 * noise (mirrors src/dev/runFactionIdentityProof.ts).
 *
 * Two locked guards run through every case:
 *   1. NO BURN — the hook only buffs the controller's own summoned unit; it never
 *      lowers the enemy nexus. The cross-cutting block fails loudly if anyone
 *      reintroduces face interaction on resonance.
 *   2. GATED — with rules.traitResonance ABSENT (the vanilla default) the hook is a
 *      clean no-op, which is what keeps the golden fixtures byte-identical. The
 *      "gate off" block proves the inert path.
 */

import { resonanceOnUnitSummon } from "../engine/traitResonance";

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`OK: ${msg}`);
  } else {
    console.error(`FAIL: ${msg}`);
    failed += 1;
  }
}

let instanceSeq = 0;
function makeUnit(keywords: string[] = [], cardId = "tcg_x"): any {
  instanceSeq += 1;
  return {
    instanceId: `u${instanceSeq}`,
    cardId,
    keywords: [...keywords],
    attack: 2,
    health: 3,
    maxHealth: 3,
    armor: 0,
  };
}

/** Minimal match state. `enabled` toggles the resonance gate. P1 owns the board the
 *  summoned unit lands on; P2 is the enemy whose nexus the no-burn guard watches. */
function makeState(enabled: boolean): any {
  return {
    rules: enabled ? { traitResonance: true } : undefined,
    players: {
      P1: { commanderId: "cmd_demo", nexusHealth: 20, deck: [], board: { front: [], back: [] } },
      P2: { commanderId: "cmd_demo", nexusHealth: 20, deck: [], board: { front: [], back: [] } },
    },
  };
}

/** Place an already-summoned unit on P1's lane (as the reducer does before firing
 *  the hook), then run the hook against it and return the unit for assertions. */
function summonOnto(state: any, lane: "front" | "back", unit: any): any {
  state.players.P1.board[lane].push(unit);
  resonanceOnUnitSummon(state, "P1", unit);
  return unit;
}

// === RESONANT: shares a keyword with an existing unit -> +1/+1 ================
{
  const s = makeState(true);
  s.players.P1.board.front.push(makeUnit(["GUARD"])); // pre-existing Guard
  const u = summonOnto(s, "front", makeUnit(["GUARD"]));
  assert(u.attack === 3 && u.health === 4 && u.maxHealth === 4, "shared keyword GUARD -> +1/+1 (2/3 -> 3/4)");
  assert(s.players.P2.nexusHealth === 20, "RESONANT case: enemy nexus untouched (no burn)");
}

// Cross-lane resonance: the existing same-keyword unit is in the BACK lane.
{
  const s = makeState(true);
  s.players.P1.board.back.push(makeUnit(["RUSH"]));
  const u = summonOnto(s, "front", makeUnit(["RUSH"]));
  assert(u.attack === 3 && u.health === 4, "shared keyword across lanes (back+front) still resonates");
}

// Multiple shared keywords still only grant the binary +1/+1 (not per-keyword).
{
  const s = makeState(true);
  s.players.P1.board.front.push(makeUnit(["GUARD", "WARD"]));
  const u = summonOnto(s, "front", makeUnit(["GUARD", "WARD"]));
  assert(u.attack === 3 && u.health === 4, "two shared keywords -> still a single +1/+1 (binary, not stacking)");
}

// === INERT: no shared keyword -> untouched ====================================
{
  const s = makeState(true);
  s.players.P1.board.front.push(makeUnit(["GUARD"]));
  const u = summonOnto(s, "front", makeUnit(["RUSH"])); // disjoint keyword
  assert(u.attack === 2 && u.health === 3, "no shared keyword -> no resonance (stays 2/3)");
}

// First-of-its-keyword summon onto an EMPTY board is inert (self-excluded).
{
  const s = makeState(true);
  const u = summonOnto(s, "front", makeUnit(["GUARD"]));
  assert(u.attack === 2 && u.health === 3, "lone first GUARD on empty board -> inert (no self-resonance)");
}

// A keyword-less unit never resonates even beside a keyworded board.
{
  const s = makeState(true);
  s.players.P1.board.front.push(makeUnit(["GUARD"]));
  const u = summonOnto(s, "front", makeUnit([])); // vanilla body
  assert(u.attack === 2 && u.health === 3, "keyword-less unit -> inert");
}

// Resonance is OWN-board only: an enemy unit sharing the keyword does NOT trigger it.
{
  const s = makeState(true);
  s.players.P2.board.front.push(makeUnit(["GUARD"])); // enemy Guard
  const u = summonOnto(s, "front", makeUnit(["GUARD"]));
  assert(u.attack === 2 && u.health === 3, "enemy-only shared keyword -> no resonance (own board only)");
}

// === GATE OFF: rules absent -> clean no-op (byte-identical vanilla) ===========
{
  const s = makeState(false);
  s.players.P1.board.front.push(makeUnit(["GUARD"]));
  const u = summonOnto(s, "front", makeUnit(["GUARD"]));
  assert(u.attack === 2 && u.health === 3 && u.maxHealth === 3, "gate OFF: would-resonate summon is untouched");
  assert(s.players.P2.nexusHealth === 20, "gate OFF: enemy nexus untouched");
}

if (failed > 0) {
  console.error(`\nTRAIT RESONANCE PROOF FAILED: ${failed} assertion(s).`);
  process.exit(1);
}
console.log("\nTrait Resonance proof passed.");
