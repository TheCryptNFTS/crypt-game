/**
 * dev:marquee-redteam — PINS the 5 red-team bug fixes that slipped past the
 * existing green marquee suite because those proofs used crafted units with NO
 * continuous auras and NO combo interactions. Each block below exercises exactly
 * that gap: an aura-buffed victim under a stat-replace, a debuff+replace+end-turn
 * sequence, a double-attack+mirror combo, a copy of a revive unit, and a board
 * cap under a death-watcher.
 *
 * Where the effect triggers ON_SUMMON (Kiss of Death, Lucifer, The Deceiver) it
 * is driven through the REAL play path (PLAY_UNIT from hand). Crafted `unit()` is
 * used only for the victims / aura-sources / combat fodder.
 *
 *   P-H1  SWAP_STATS_ALL_ENEMIES on an AURA-BUFFED enemy swaps BASE stats, aura
 *         re-applied on top (no double-count); 0-base-hp swap dies cleanly.
 *   P-H2  DEBUFF_ALL_ENEMIES then SWAP/COPY then END_TURN leaves no stale +atk.
 *   P-M1  DOUBLE_ATTACK + MIRROR_ATTACK = at most 3 strikes (not 4).
 *   P-M3  COPY_UNIT of a once-death-revive unit does NOT grant the copy a revive.
 *   P-L1  SUMMON_ON_ANY_DEATH respects the board cap (MAX_LANE_UNITS = 7).
 *
 * LOCKED: no op may damage the enemy nexus (asserted unchanged on every swap /
 * mirror / destroy scenario); rejections are asserted by SAME state ref +
 * REJECTED event, never by catching a throw. Deterministic seeds only.
 */

import { applyAction } from "../engine/reducer";
import { makeSeededMatch } from "./reducerHarness";
import { MatchState, UnitInPlay, MAX_LANE_UNITS } from "../engine/state";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`OK: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}` + (detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""));
  }
}

function unit(over: Partial<UnitInPlay> & { instanceId: string; cardId: string }): UnitInPlay {
  return {
    lane: "front",
    attack: 1,
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

function arena(seed = 9600): MatchState {
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
    m.players[p].graveyard = [];
  }
  return m;
}

// ===========================================================================
// P-H1 — SWAP_STATS_ALL_ENEMIES on an AURA-BUFFED enemy swaps BASE stats; the
// aura re-applies on top with no double-count. The aura source used is the REAL
// +1/+1 Stone-Keeper aura (tcg_707 "Watcher of Stone Paths"); the victim is a
// Stone-Keeper (tcg_6) so it benefits. Victim BASE = 2/5; under +1/+1 it shows
// live 3/6. After Kiss of Death (tcg_3267) swaps BASE (2/5 -> 5/2) and the aura
// re-applies, the FINAL live line is 6/3 (swapped base 5/2, then +1/+1).
// ===========================================================================
{
  const m = arena();
  // Enemy (P2) board: aura source + aura-buffed victim. Victim stored line already
  // INCLUDES the +1/+1 aura: attack 3 = base 2 + auraAtk 1; health 6 = base 5 +
  // auraHp 1; maxHealth 6 = base 5 + auraHp 1.
  m.players.P2.board.front = [
    unit({ instanceId: "src", cardId: "tcg_707", attack: 6, health: 8, maxHealth: 8 }),
    unit({ instanceId: "vic", cardId: "tcg_6", attack: 3, health: 6, maxHealth: 6, auraAtk: 1, auraHp: 1 } as any),
  ];
  m.players.P1.hand = ["tcg_3267"];
  const nexusBefore = m.players.P2.nexusHealth;

  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const vic = r.state.players.P2.board.front.find((u) => u.instanceId === "vic") as any;
  check(
    "P-H1: aura-buffed victim base 2/5 swapped to base 5/2 then +1/+1 aura = live 6/3",
    !!vic && vic.attack === 6 && vic.health === 3 && vic.maxHealth === 3,
    vic && { atk: vic.attack, hp: vic.health, max: vic.maxHealth, auraAtk: vic.auraAtk, auraHp: vic.auraHp }
  );
  check(
    "P-H1: aura bookkeeping re-derived to exactly +1/+1 (no double-count)",
    !!vic && vic.auraAtk === 1 && vic.auraHp === 1,
    vic && { auraAtk: vic.auraAtk, auraHp: vic.auraHp }
  );
  check("P-H1: SWAP deals NO face damage to enemy nexus", r.state.players.P2.nexusHealth === nexusBefore, r.state.players.P2.nexusHealth);

  // Idempotence: issue a trivial follow-up action (END_TURN) to force another
  // recompute pass; the live line must NOT drift.
  const r2 = applyAction(r.state, { type: "END_TURN", player: "P1" });
  const vic2 = r2.state.players.P2.board.front.find((u) => u.instanceId === "vic") as any;
  check(
    "P-H1: line is STABLE after a follow-up recompute (still 6/3, no drift)",
    !!vic2 && vic2.attack === 6 && vic2.health === 3 && vic2.maxHealth === 3,
    vic2 && { atk: vic2.attack, hp: vic2.health, max: vic2.maxHealth }
  );

  // 0-base-health swap: a victim whose BASE attack is 0 swaps to 0 base HP and
  // dies cleanly (not a 0-hp zombie). Use a NON-Stone-Keeper so no +hp aura keeps
  // it alive. base 0/9 -> swapped base 9/0 -> dead.
  const m3 = arena();
  m3.players.P2.board.front = [unit({ instanceId: "z", cardId: "tcg_101", attack: 0, health: 9, maxHealth: 9 })];
  m3.players.P1.hand = ["tcg_3267"];
  const r3 = applyAction(m3, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  check(
    "P-H1: a unit swapped to 0 base health dies cleanly (no 0-hp zombie)",
    !r3.state.players.P2.board.front.some((u) => u.instanceId === "z"),
    r3.state.players.P2.board.front.map((u) => ({ id: u.instanceId, hp: u.health }))
  );
}

// ===========================================================================
// P-H2 — DEBUFF_ALL_ENEMIES then a stat-replace (SWAP) then END_TURN must NOT
// leave a stale +atk drift. Enemy base attack 5. Lucifer (tcg_3385) applies -3 ->
// attack 2 (tempAtkDebuff=2 recorded). Then Kiss of Death (tcg_3267) SWAPS the
// unit: base atk<->hp. Enemy base 5/8 -> swapped base 8/5; the SWAP fix clears
// tempAtkDebuff. After END_TURN the attack stays 8 (NOT 8+stale-debuff, NOT 2).
// ===========================================================================
{
  const m = arena();
  // Enemy unit, non-faction (tcg_101) so no aura interferes: base 5/8.
  m.players.P2.board.front = [unit({ instanceId: "e", cardId: "tcg_101", attack: 5, health: 8, maxHealth: 8 })];
  m.players.P1.hand = ["tcg_3385", "tcg_3267"];

  // Lucifer: -3 atk this turn (tempAtkDebuff). 5 -> 2.
  const rDebuff = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const eD = rDebuff.state.players.P2.board.front.find((u) => u.instanceId === "e") as any;
  check("P-H2: Lucifer -3 debuff drops enemy atk 5 -> 2", eD?.attack === 2, eD?.attack);
  check("P-H2: the -3 was recorded as tempAtkDebuff=3", eD?.tempAtkDebuff === 3, eD?.tempAtkDebuff);

  // Kiss of Death: SWAP base atk<->hp. base atk 5 (NOT the live 2), base hp 8 ->
  // swapped base 8/5. The fix clears tempAtkDebuff on the swap.
  const rSwap = applyAction(rDebuff.state, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const eS = rSwap.state.players.P2.board.front.find((u) => u.instanceId === "e") as any;
  check("P-H2: SWAP replaces attack with base-hp (8), not the debuffed 2", eS?.attack === 8, eS?.attack);
  check("P-H2: SWAP cleared the stale tempAtkDebuff (now 0)", (eS?.tempAtkDebuff ?? 0) === 0, eS?.tempAtkDebuff);
  check("P-H2: swap on debuffed unit deals NO face damage", rSwap.state.players.P2.nexusHealth === 20, rSwap.state.players.P2.nexusHealth);

  // END_TURN: the end-of-turn debuff-restore must NOT add a stale +3 onto 8.
  const rEnd = applyAction(rSwap.state, { type: "END_TURN", player: "P1" });
  const eE = rEnd.state.players.P2.board.front.find((u) => u.instanceId === "e") as any;
  check("P-H2: after END_TURN attack stays 8 (NOT 11 stale-restore, NOT stale 2)", eE?.attack === 8, eE?.attack);

  // Control: debuff -3, NO swap, end turn -> attack restored to 5.
  const mc = arena();
  mc.players.P2.board.front = [unit({ instanceId: "e", cardId: "tcg_101", attack: 5, health: 8, maxHealth: 8 })];
  mc.players.P1.hand = ["tcg_3385"];
  const rc1 = applyAction(mc, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  check("P-H2 control: -3 debuff (no swap) drops atk 5 -> 2", rc1.state.players.P2.board.front[0].attack === 2, rc1.state.players.P2.board.front[0].attack);
  const rc2 = applyAction(rc1.state, { type: "END_TURN", player: "P1" });
  check("P-H2 control: END_TURN restores the debuffed atk back to 5", rc2.state.players.P2.board.front.find((u) => u.instanceId === "e")?.attack === 5, rc2.state.players.P2.board.front.find((u) => u.instanceId === "e")?.attack);
}

// ===========================================================================
// P-M1 — DOUBLE_ATTACK + MIRROR_ATTACK = at most 3 strikes (not 4). The engine
// keys both ops off `unitHasOp(cardId, ...)`, and the live corpus has no single
// card carrying BOTH (tcg_3345 = DOUBLE only; tcg_3410 = MIRROR only). So the
// combo is driven at the instance level on the engine's REAL gates: a MIRROR unit
// (tcg_3410) swings, then we clear its exhaustion the way DOUBLE_ATTACK would
// (keep-ready after swing 1, WITHOUT resetting attacksThisTurn) and swing again.
// The MIRROR fix gates the phantom to attacksThisTurn===1, so the second swing
// mints NO phantom: swing1 (real+phantom) + swing2 (real only) = exactly 3
// strikes on the shared defender. Also pins the pure-mirror 2-strike case.
// ===========================================================================
{
  // Pure-mirror case: a MIRROR-only unit's single attack = 2 strikes (20 -> 12).
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "t2", cardId: "tcg_3410", attack: 4, health: 8, maxHealth: 8 })];
  m.players.P2.board.front = [unit({ instanceId: "def", cardId: "tcg_test", attack: 0, health: 20, maxHealth: 20 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "t2", defenderInstanceId: "def" });
  const def = r.state.players.P2.board.front.find((u) => u.instanceId === "def");
  check("P-M1 pure-mirror: single attack = 2 strikes (20 - 4 - 4 = 12)", def?.health === 12, def?.health);
  check("P-M1 pure-mirror: enemy nexus untouched (no phantom face leak)", r.state.players.P2.nexusHealth === 20, r.state.players.P2.nexusHealth);
}
{
  // DOUBLE+MIRROR combo. A single cardId must carry both ops, so we craft the
  // attacker and STAMP both ops by overriding the op-lookup via a cardId that
  // carries them. Since the corpus has no such card, we simulate the combo at the
  // instance level using the engine's REAL gates: attack twice with a MIRROR unit
  // that is ALSO allowed a second swing. We grant the second swing by clearing
  // exhaustion the way DOUBLE_ATTACK does (attacksThisTurn<2 keeps it ready), and
  // assert the MIRROR gate (attacksThisTurn===1) caps phantoms to the FIRST swing.
  //
  // Concretely: T2 (MIRROR) attacks d1 -> 2 strikes (real + phantom). We then
  // manually clear exhaustion (mimicking DOUBLE_ATTACK's "stay ready") WITHOUT
  // resetting attacksThisTurn, attack d2 -> exactly 1 strike (NO phantom, because
  // attacksThisTurn===2 now). Total to a single shared defender = 3 strikes.
  const m = arena();
  m.players.P1.board.front = [unit({ instanceId: "t2", cardId: "tcg_3410", attack: 5, health: 9, maxHealth: 9 })];
  m.players.P2.board.front = [unit({ instanceId: "def", cardId: "tcg_test", attack: 0, health: 30, maxHealth: 30 })];
  // First swing: MIRROR fires (attacksThisTurn becomes 1) -> 2 strikes of 5 = 10.
  const r1 = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "t2", defenderInstanceId: "def" });
  const d1 = r1.state.players.P2.board.front.find((u) => u.instanceId === "def");
  check("P-M1 combo: first swing of a MIRROR unit deals 2 strikes (30 -> 20)", d1?.health === 20, d1?.health);
  const a1 = r1.state.players.P1.board.front.find((u) => u.instanceId === "t2") as any;
  check("P-M1 combo: attacksThisTurn===1 after the first swing", a1?.attacksThisTurn === 1, a1?.attacksThisTurn);

  // Mimic DOUBLE_ATTACK granting a legal second swing: clear exhaustion only.
  const mid = structuredClone(r1.state) as MatchState;
  const midAtk = mid.players.P1.board.front.find((u) => u.instanceId === "t2") as any;
  midAtk.exhausted = false; // DOUBLE_ATTACK would have kept it ready after swing 1
  const r2 = applyAction(mid, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "t2", defenderInstanceId: "def" });
  const d2 = r2.state.players.P2.board.front.find((u) => u.instanceId === "def");
  // Second swing: attacksThisTurn===2 now, so MIRROR is GATED OFF -> 1 strike of 5.
  check("P-M1 combo: SECOND swing mints NO phantom (mirror gated to swing 1): 20 -> 15", d2?.health === 15, d2?.health);
  check("P-M1 combo: defender took exactly 3x attack total (30 - 15 = 15 = 3*5)", (30 - (d2?.health ?? 0)) === 15, 30 - (d2?.health ?? 0));
  check("P-M1 combo: enemy nexus never touched by the combo", r2.state.players.P2.nexusHealth === 20, r2.state.players.P2.nexusHealth);

  // A third swing on the same (now-exhausted) unit is rejected: same state ref.
  const r3 = applyAction(r2.state, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "t2", defenderInstanceId: "def" });
  check("P-M1 combo: a THIRD swing is rejected (state ref unchanged)", r3.state === r2.state, r3.state === r2.state);
  check("P-M1 combo: third-swing reject emits REJECTED", r3.events.some((e) => e.type === "REJECTED"), r3.events);
}

// ===========================================================================
// P-M3 — COPY_UNIT of a once-death-revive unit does NOT grant the copy a fresh
// revive. P2 fields Jean (tcg_3355, ONCEDEATH_REVIVE). P1 plays The Deceiver
// (tcg_3415, COPY_UNIT) -> copies Jean's cardId + stats; the COPY fix marks the
// inherited revive as already used, so killing the copy does NOT revive it.
// ===========================================================================
{
  const m = arena();
  // Jean on enemy board (no FLYING here so the copy can be hit by a ground unit).
  m.players.P2.board.front = [unit({ instanceId: "jean", cardId: "tcg_3355", attack: 6, health: 6, maxHealth: 6 })];
  // P1 plays The Deceiver via the real path. COPY_UNIT targets the (only) enemy.
  m.players.P1.hand = ["tcg_3415"];
  m.players.P1.board.front = [unit({ instanceId: "exec", cardId: "tcg_test", attack: 10, health: 50, maxHealth: 50 })];
  const rPlay = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  // The Deceiver should now be a copy of Jean (cardId tcg_3355) on P1's board.
  const copy = rPlay.state.players.P1.board.front.find((u) => u.cardId === "tcg_3355") as any;
  check("P-M3: The Deceiver copied Jean (now cardId tcg_3355)", !!copy, rPlay.state.players.P1.board.front.map((u) => u.cardId));
  check("P-M3: the copy's reviveUsed is pre-set TRUE (no fresh revive)", copy?.reviveUsed === true, copy?.reviveUsed);

  // Kill the copy: it must NOT revive; it dies to graveyard.
  // P2 needs an attacker; give it a big one and let it strike the copy.
  rPlay.state.players.P2.board.front.push(unit({ instanceId: "killer", cardId: "tcg_test", attack: 20, health: 20, maxHealth: 20 }));
  rPlay.state.activePlayer = "P2";
  const rKill = applyAction(rPlay.state, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "killer", defenderInstanceId: copy.instanceId });
  check("P-M3: the killed copy does NOT revive (off the board)", !rKill.state.players.P1.board.front.some((u) => u.instanceId === copy.instanceId), rKill.state.players.P1.board.front.map((u) => u.instanceId));
  check("P-M3: the dead copy is recorded to P1 graveyard (as tcg_3355)", rKill.state.players.P1.graveyard.some((g) => g.cardId === "tcg_3355"), rKill.state.players.P1.graveyard);

  // Contrast: a genuinely summoned Jean DOES revive once at full HP, then dies on
  // the second death (keep the existing assertion passing).
  const m2 = arena();
  m2.players.P1.board.front = [unit({ instanceId: "exec", cardId: "tcg_test", attack: 10, health: 50, maxHealth: 50 })];
  m2.players.P2.board.front = [unit({ instanceId: "jean", cardId: "tcg_3355", attack: 2, health: 6, maxHealth: 6 })];
  const j1 = applyAction(m2, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "exec", defenderInstanceId: "jean" });
  const jr = j1.state.players.P2.board.front.find((u) => u.instanceId === "jean") as any;
  check("P-M3 contrast: a REAL Jean revives once at full HP (6/6)", !!jr && jr.health === 6 && jr.reviveUsed === true, jr && { hp: jr.health, used: jr.reviveUsed });
  const next = structuredClone(j1.state) as MatchState;
  next.players.P1.board.front.forEach((u: any) => (u.exhausted = false));
  const j2 = applyAction(next, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "exec", defenderInstanceId: "jean" });
  check("P-M3 contrast: the SECOND death actually kills the real Jean", !j2.state.players.P2.board.front.some((u) => u.instanceId === "jean"), j2.state.players.P2.board.front.map((u) => u.instanceId));
}

// ===========================================================================
// P-L1 — SUMMON_ON_ANY_DEATH respects the board cap (MAX_LANE_UNITS). A Crypt
// Keeper (tcg_3380) controller whose front lane already holds 7 units: a death
// mints NO 8th token (clean no-op, lane stays at 7). With room (<7) the token IS
// minted.
// ===========================================================================
{
  const m = arena();
  // P1 front lane = 7 units: Crypt Keeper + 6 fillers. The 7th slot is full.
  const filled: UnitInPlay[] = [unit({ instanceId: "ck", cardId: "tcg_3380", attack: 6, health: 8, maxHealth: 8 })];
  for (let i = 0; i < 6; i += 1) filled.push(unit({ instanceId: `f${i}`, cardId: "tcg_test", attack: 0, health: 5, maxHealth: 5 }));
  m.players.P1.board.front = filled;
  check("P-L1 setup: P1 front lane is at the cap of 7", m.players.P1.board.front.length === MAX_LANE_UNITS, m.players.P1.board.front.length);
  // An enemy dies (P1 executes it). The death-watcher tries to mint into the FULL
  // P1 front lane -> refused, lane stays at 7. Use one filler as the executioner.
  m.players.P1.board.front[1].attack = 10; // give a filler lethal attack
  m.players.P2.board.front = [unit({ instanceId: "v", cardId: "tcg_19", attack: 0, health: 1, maxHealth: 1 })];
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "f0", defenderInstanceId: "v" });
  check("P-L1: a death does NOT mint an 8th token into a full lane (stays at 7)", r.state.players.P1.board.front.length === MAX_LANE_UNITS, r.state.players.P1.board.front.length);
  check("P-L1: no token was minted (no token_* on the capped lane)", !r.state.players.P1.board.front.some((u) => u.cardId.startsWith("token_")), r.state.players.P1.board.front.map((u) => u.cardId));
  check("P-L1: enemy nexus untouched by the refused mint", r.state.players.P2.nexusHealth === 20, r.state.players.P2.nexusHealth);

  // With room (<7): the same death DOES mint a token.
  const m2 = arena();
  m2.players.P1.board.front = [
    unit({ instanceId: "ck", cardId: "tcg_3380", attack: 6, health: 8, maxHealth: 8 }),
    unit({ instanceId: "exec", cardId: "tcg_test", attack: 10, health: 10, maxHealth: 10 }),
  ];
  m2.players.P2.board.front = [unit({ instanceId: "v", cardId: "tcg_19", attack: 0, health: 1, maxHealth: 1 })];
  const before = m2.players.P1.board.front.length;
  const r2 = applyAction(m2, { type: "ATTACK_UNIT", player: "P1", attackerInstanceId: "exec", defenderInstanceId: "v" });
  const tokens = r2.state.players.P1.board.front.filter((u) => u.cardId.startsWith("token_"));
  check("P-L1: with room (<7) the death-watcher mints exactly one token", tokens.length === 1 && r2.state.players.P1.board.front.length === before + 1, { tokens: tokens.length, len: r2.state.players.P1.board.front.length });
}

console.log(`\n=== MARQUEE RED-TEAM PROOF (P-H1 / P-H2 / P-M1 / P-M3 / P-L1) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} marquee-redteam check(s) failed.`);
  process.exit(1);
}
console.log("ALL MARQUEE RED-TEAM PROOFS PASSED");
