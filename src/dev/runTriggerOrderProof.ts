/**
 * dev:trigger-order — locks in the engine's SIMULTANEOUS-TRIGGER ORDERING as a
 * gate-enforced contract. See `src/engine/RESOLUTION_MODEL.md` for the canonical
 * spec. The engine is no-stack / immediate-resolution; this proof pins the
 * DETERMINISTIC order in which simultaneous deaths/triggers resolve, via
 * OBSERVABLE side effects (graveyard insertion order, token instanceId order,
 * byte-identical re-runs of a trigger storm).
 *
 * Documented order (resolveDeaths): owner P1-before-P2, lane front-before-back,
 * array index ascending. Multi-token summons mint left-to-right (idCounter asc).
 *
 * Cards used (real catalog ids, probed from allPlayableCards):
 *   tcg_293  CLEAVE attacker (splash floor(attack/2) to struck unit's neighbors)
 *   tcg_71/72/84  DEATHRATTLE keyword carriers (fixed nexus burst on death)
 *   tcg_209  "When this unit dies, summon a 1/1 stonechild" (ON_DEATH summon)
 *   tcg_2967 "On play: summon two 2/2 Tentacles" (ON_SUMMON count=2 multi-token)
 */

import { applyAction } from "../engine/reducer";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, UnitInPlay } from "../engine/state";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`OK: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

function unit(over: Partial<UnitInPlay> & { instanceId: string }): UnitInPlay {
  return {
    cardId: "tcg_test",
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
  };
}

function arena(seed = 9123): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].energy = 99;
    m.players[p].maxEnergy = 99;
    m.players[p].hand = [];
    m.players[p].discard = [];
    (m.players[p] as any).graveyard = [];
  }
  return m;
}

// (a) MULTI-DEATH ORDER: one cleave kills three at once; their DEATHRATTLE/ON_DEATH
//     fire and graveyard records land in STABLE index-ascending board order. -------
{
  const m = arena();
  // Cleave 6: combat 6 kills the 6hp middle, splash floor(6/2)=3 kills the 3hp
  // neighbors — all three P2.front units die from this SINGLE action.
  m.players.P1.board.front = [unit({ instanceId: "cl", cardId: "tcg_293", attack: 6, health: 9, maxHealth: 9 })];
  m.players.P2.board.front = [
    unit({ instanceId: "L", cardId: "tcg_71", health: 3, maxHealth: 3, keywords: ["DEATHRATTLE"] }),
    unit({ instanceId: "M", cardId: "tcg_72", health: 6, maxHealth: 6, keywords: ["DEATHRATTLE"] }),
    unit({ instanceId: "R", cardId: "tcg_84", health: 3, maxHealth: 3, keywords: ["DEATHRATTLE"] }),
  ];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "cl", defenderInstanceId: "M" });
  const grave = (r.state.players.P2 as any).graveyard.map((g: any) => g.cardId);
  check(
    "simultaneous deaths record graveyard in index-ascending board order (L,M,R = tcg_71,tcg_72,tcg_84)",
    JSON.stringify(grave) === JSON.stringify(["tcg_71", "tcg_72", "tcg_84"]),
    grave
  );
  check("all three P2.front units were reaped in one action", r.state.players.P2.board.front.length === 0, r.state.players.P2.board.front.map((u) => u.instanceId));
  // 3 deathrattle bursts of 2 each land on the dead units' enemy (P1): 20 -> 14.
  check("each dead unit's DEATHRATTLE fired exactly once (3 x 2 = 6 to P1 nexus, 20 -> 14)", r.state.players.P1.nexusHealth === 14, r.state.players.P1.nexusHealth);
}

// (b) MULTI-TOKEN MINT ORDER: a count=2 summon mints tokens left-to-right with
//     strictly ascending, deterministic idCounter instanceIds. ------------------
{
  const m = arena();
  m.players.P1.hand = ["tcg_2967"]; // "summon two 2/2 Tentacles"
  const before = m.idCounter ?? 0;
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const front = r.state.players.P1.board.front;
  const tokens = front.filter((u) => u.cardId.startsWith("token_"));
  check("count=2 summon mints exactly two tokens", tokens.length === 2, front.map((u) => u.cardId));
  // The source took id `before`, then the two tokens took before+1, before+2 in
  // left-to-right loop order.
  check(
    "tokens mint left-to-right with ascending idCounter instanceIds",
    tokens[0].instanceId === `unit_${r.state.seed}_${before + 1}` &&
      tokens[1].instanceId === `unit_${r.state.seed}_${before + 2}`,
    tokens.map((t) => t.instanceId)
  );
  check("idCounter advanced by exactly 3 (source + 2 tokens)", (r.state.idCounter ?? 0) === before + 3, r.state.idCounter);
}

// (c) TRIGGER CHAIN: a death triggers an ON_DEATH summon; the minted token enters
//     the dead unit's lane and survives the same pass — identical across runs. ----
function chainStorm(): MatchState {
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "killer", cardId: "tcg_test", attack: 10, health: 10, maxHealth: 10 })];
  // tcg_209: "When this unit dies, summon a 1/1 stonechild with Taunt."
  m.players.P2.board.front = [unit({ instanceId: "dier", cardId: "tcg_209", attack: 1, health: 1, maxHealth: 1 })];
  return applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "killer", defenderInstanceId: "dier" }).state;
}
{
  const s = chainStorm();
  const p2front = s.players.P2.board.front;
  const corpseGone = !p2front.some((u) => u.instanceId === "dier");
  const token = p2front.find((u) => u.cardId.startsWith("token_stonechild"));
  check("death -> ON_DEATH summon resolves fully (corpse cleared, token minted)", corpseGone && !!token, p2front.map((u) => u.cardId));
  check("chain-summoned token survives the same death-resolution pass (fresh 1/1)", token?.health === 1 && token?.maxHealth === 1, token);
}

// (d) STORM DETERMINISM: run the SAME trigger storm twice -> byte-identical
//     resulting state AND event stream. This is the core no-desync guarantee
//     for trigger storms specifically. ------------------------------------------
function bigStorm(seed: number) {
  const m = arena(seed);
  m.players.P1.board.front = [unit({ instanceId: "cl", cardId: "tcg_293", attack: 6, health: 9, maxHealth: 9 })];
  // Mixed storm: deathrattle carriers + an ON_DEATH summoner, all dying at once.
  m.players.P2.board.front = [
    unit({ instanceId: "L", cardId: "tcg_209", health: 3, maxHealth: 3 }), // summons on death
    unit({ instanceId: "M", cardId: "tcg_72", health: 6, maxHealth: 6, keywords: ["DEATHRATTLE"] }),
    unit({ instanceId: "R", cardId: "tcg_84", health: 3, maxHealth: 3, keywords: ["DEATHRATTLE"] }),
  ];
  return applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "cl", defenderInstanceId: "M" });
}
{
  const a = bigStorm(4242);
  const b = bigStorm(4242);
  check(
    "same trigger storm twice -> byte-identical resulting state",
    JSON.stringify(a.state) === JSON.stringify(b.state)
  );
  check(
    "same trigger storm twice -> byte-identical event stream",
    JSON.stringify(a.events) === JSON.stringify(b.events)
  );
  // And the chain summon's token id is stable across both runs.
  const tokA = a.state.players.P2.board.front.find((u) => u.cardId.startsWith("token_stonechild"));
  const tokB = b.state.players.P2.board.front.find((u) => u.cardId.startsWith("token_stonechild"));
  check("chain-summoned token has identical, deterministic instanceId across runs", !!tokA && tokA?.instanceId === tokB?.instanceId, [tokA?.instanceId, tokB?.instanceId]);
}

console.log(`\n=== TRIGGER-ORDER PROOF (simultaneous-resolution determinism) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} trigger-order check(s) failed.`);
  process.exit(1);
}
console.log("ALL TRIGGER-ORDER PROOFS PASSED");
