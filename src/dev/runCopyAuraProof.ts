/**
 * dev:copy-aura — regression proof for the COPY_UNIT stale-aura bug.
 *
 * THE BUG (pre-fix): COPY_UNIT overwrote the copier's cardId/attack/health/
 * maxHealth/keywords/armor/speed from the target, but left the copier's stale
 * `auraAtk` / `auraHp` bookkeeping in place. The very next `recomputeAuras` pass
 * (reducer.ts) STRIPS those stale amounts off the freshly-copied stat line,
 * corrupting the copy (a copied 9/9 becomes 7/6). That wrong line then poisons
 * the graveyard record on death (the reducer subtracts auraAtk/auraHp when
 * recording the corpse).
 *
 * THE FIX: COPY_UNIT now zeroes `source.auraAtk` / `source.auraHp` after copying,
 * so recomputeAuras re-derives the bonus from the copier's OWN board context
 * (here: no real aura sources => 0) instead of stripping phantom amounts.
 *
 * The live COPY card (tcg_3415) fires ON_SUMMON before the copier ever accrues
 * aura, so the live path looks fine — this proof constructs the latent
 * precondition DIRECTLY (a copier already carrying aura bookkeeping) the way the
 * red-team did: drive the resolver, then run an action that triggers a recompute.
 */

import { applyAction } from "../engine/reducer";
import { resolveEffect } from "../engine/effectResolver";
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

function arena(seed = 9200): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].graveyard = [];
    m.players[p].nexusHealth = 20;
    m.players[p].energy = 99;
    m.players[p].maxEnergy = 99;
    m.players[p].hand = [];
    m.players[p].discard = [];
  }
  return m;
}

// --- COPY_UNIT clears stale aura bookkeeping so a recompute can't corrupt it ----
{
  const m = arena();
  // The copier ALREADY carries aura bonus bookkeeping (the precondition the live
  // ON_SUMMON path never reaches): a 4/6 unit that previously received +2/+3 from
  // a now-departed aura, so its line currently reads 6/9 with auraAtk=2,auraHp=3.
  const copier = unit({
    instanceId: "copier",
    cardId: "tcg_3415",
    attack: 6,
    health: 9,
    maxHealth: 9,
    auraAtk: 2,
    auraHp: 3,
  });
  // The victim: a clean 9/9 with no aura bookkeeping — the line we must end up at.
  const victim = unit({
    instanceId: "victim",
    cardId: "tcg_475",
    attack: 9,
    health: 9,
    maxHealth: 9,
    keywords: ["DEATHRATTLE"],
  });
  m.players.P1.board.front = [copier];
  m.players.P2.board.front = [victim];

  // Drive COPY_UNIT directly through the resolver (red-team path).
  resolveEffect(
    { trigger: "ON_SUMMON", op: "COPY_UNIT", raw: "copy" } as any,
    { state: m, controller: "P1", source: copier, target: victim },
  );

  // Immediately after copy, the line must equal the victim's 9/9 and the stale
  // aura bookkeeping must be cleared by the fix.
  check("COPY_UNIT copies the victim's 9/9 stat line", copier.attack === 9 && copier.maxHealth === 9, { a: copier.attack, h: copier.maxHealth });
  check("COPY_UNIT zeroes the copier's stale auraAtk", (copier.auraAtk ?? -1) === 0, copier.auraAtk);
  check("COPY_UNIT zeroes the copier's stale auraHp", (copier.auraHp ?? -1) === 0, copier.auraHp);
  check("COPY_UNIT copies the victim's keywords/cardId", copier.cardId === "tcg_475" && copier.keywords.includes("DEATHRATTLE"), copier);

  // Now run an action that mutates state -> reducer recomputeAuras fires. With no
  // real aura SOURCE on P1's board, the copy must be left untouched (pre-fix this
  // STRIPPED the phantom 2/3, corrupting 9/9 -> 7/6).
  const r = applyAction(m, { type: "END_TURN", player: "P1" });
  const after = [...r.state.players.P1.board.front, ...r.state.players.P1.board.back].find((u) => u.instanceId === "copier");
  check("recomputeAuras leaves the copied attack uncorrupted (stays 9)", after?.attack === 9, after?.attack);
  check("recomputeAuras leaves the copied maxHealth uncorrupted (stays 9)", after?.maxHealth === 9, after?.maxHealth);
}

// --- A copied unit that later DIES records the CORRECT stat line in the grave ---
{
  const m = arena();
  const copier = unit({
    instanceId: "copier",
    cardId: "tcg_3415",
    attack: 6,
    health: 9,
    maxHealth: 9,
    auraAtk: 2,
    auraHp: 3,
  });
  const victim = unit({
    instanceId: "victim",
    cardId: "tcg_475",
    attack: 9,
    health: 9,
    maxHealth: 9,
    keywords: ["DEATHRATTLE"],
  });
  m.players.P1.board.front = [copier];
  m.players.P2.board.front = [victim];

  resolveEffect(
    { trigger: "ON_SUMMON", op: "COPY_UNIT", raw: "copy" } as any,
    { state: m, controller: "P1", source: copier, target: victim },
  );

  // Hand the copier a lethal blow so the reducer records its corpse. A fresh
  // P2 attacker with exactly 9 attack trades into the 9/9 copy.
  m.players.P2.board.front.push(
    unit({ instanceId: "killer", cardId: "tcg_test", attack: 9, health: 20, maxHealth: 20 }),
  );
  m.activePlayer = "P2";
  const r = applyAction(m, { type: "ATTACK_UNIT", player: "P2", attackerInstanceId: "killer", defenderInstanceId: "copier" });

  const dead = [...r.state.players.P1.board.front, ...r.state.players.P1.board.back].find((u) => u.instanceId === "copier");
  check("the copied unit is dead/off the board", dead === undefined, dead);
  const rec = r.state.players.P1.graveyard.find((g) => g.cardId === "tcg_475");
  check("graveyard records the copied cardId (tcg_475)", !!rec, r.state.players.P1.graveyard);
  // Pre-fix the corpse line was the corrupted 7/6 (9 - stale 2, 9 - stale 3).
  check("graveyard records the CORRECT attack (9, not the phantom 7)", rec?.attack === 9, rec?.attack);
  check("graveyard records the CORRECT maxHealth (9, not the phantom 6)", rec?.maxHealth === 9, rec?.maxHealth);
  check("graveyard carries the copied keywords (DEATHRATTLE)", (rec?.keywords ?? []).includes("DEATHRATTLE"), rec?.keywords);
}

console.log(`\n=== COPY_UNIT STALE-AURA PROOF (copy clears auraAtk/auraHp; recompute + grave stay clean) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} copy-aura check(s) failed.`);
  process.exit(1);
}
console.log("ALL COPY-AURA PROOFS PASSED");
