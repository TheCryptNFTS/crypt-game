/**
 * dev:enrichment-proof — the two REVERSIBILITY/CORRECTNESS proofs for the
 * raise-the-floor enrichment layer (`abilityEnrichment.ts`):
 *
 * NOTE ON BASELINE: the proof plays through `cmd_stone_warden`, whose summon
 * passive already grants a Guard +0/+2 HEALTH. So the GUARD body's baseline entry
 * (flag OFF) is its authored 3/6 PLUS the commander's +2 = 3/8 (deterministic
 * across seeds). The enrichment's job is to add EXACTLY +1 more on top, so flag ON
 * = 3/9. The proof asserts BOTH the absolute deterministic values AND that the
 * enrichment delta is precisely +1 health — never more (power sanity in-match).
 *
 *   (A) FLAG ON  (CRYPT_ENRICHMENT=1): an enriched vanilla Stone Keepers common's
 *       derived effect RESOLVES end-to-end through `applyAction`:
 *         - tcg_6569 "Sentinel of Endless Stone" (GUARD 3/6, +2 commander = 3/8)
 *           enters as 3/9 (ON_SUMMON BUFF_SELF +0/+1 from the enrichment);
 *         - tcg_6568 "Vigil of the Silent Stone" (DEATHRATTLE 1/2) leaves a 0/1
 *           Rubble token behind when it dies (ON_DEATH SUMMON_TOKEN);
 *         - the live catalog card carries `enrichmentSpecs`.
 *
 *   (B) FLAG OFF (default, no env): the SAME cards are byte-identical to today —
 *       no `enrichmentSpecs` on any catalog card, the GUARD body enters at its
 *       authored 3/6, and the DEATHRATTLE body leaves NO token. This is the
 *       isolation guarantee the reducer-equivalence golden also pins.
 *
 * The live `ENABLE_ENRICHMENT` flag (read once at module load) selects which
 * branch this run asserts. The gate runs the script BOTH ways.
 */

import { applyAction } from "../engine/reducer";
import { makeSeededMatch } from "./reducerHarness";
import { getPlayableCardById } from "../engine/cards";
import { ENABLE_ENRICHMENT } from "../engine/abilityEnrichment";
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

function arena(seed = 4242): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].hand = [];
    m.players[p].discard = [];
    m.players[p].energy = 99;
    m.players[p].maxEnergy = 99;
  }
  return m;
}

// Enriched slice exemplars (vanilla Stone Keepers common UNITS):
const GUARD_ID = "tcg_6569"; // GUARD 3/6 -> ON_SUMMON BUFF_SELF +0/+1
const DR_ID = "tcg_6568"; // DEATHRATTLE 1/2 -> ON_DEATH SUMMON_TOKEN 0/1 "Rubble"
// Deterministic baseline entry health for GUARD_ID played via cmd_stone_warden:
// authored 6 + commander Guard +2 = 8 (flag OFF). Enrichment adds EXACTLY +1 -> 9.
const GUARD_BASE_HEALTH = 8;
const GUARD_ENRICHED_HEALTH = GUARD_BASE_HEALTH + 1;

console.log(`\n=== ENRICHMENT PROOF (flag ${ENABLE_ENRICHMENT ? "ON" : "OFF"}) ===\n`);

// Sanity: the exemplars exist and have their authored vanilla stat line.
{
  const guard = getPlayableCardById(GUARD_ID);
  const dr = getPlayableCardById(DR_ID);
  check(`${GUARD_ID} present in catalog`, !!guard, guard?.id);
  check(`${DR_ID} present in catalog`, !!dr, dr?.id);
  check(`${GUARD_ID} authored stats are 3/6`, guard?.stats.attack === 3 && guard?.stats.health === 6, guard?.stats);
  check(`${DR_ID} authored stats are 1/2`, dr?.stats.attack === 1 && dr?.stats.health === 2, dr?.stats);
}

if (ENABLE_ENRICHMENT) {
  // ---- (A1) catalog carries enrichmentSpecs under the flag --------------------
  {
    const guard = getPlayableCardById(GUARD_ID) as any;
    const dr = getPlayableCardById(DR_ID) as any;
    check(
      `${GUARD_ID} catalog carries an ON_SUMMON BUFF_SELF enrichment`,
      Array.isArray(guard?.enrichmentSpecs) &&
        guard.enrichmentSpecs.some((s: any) => s.trigger === "ON_SUMMON" && s.op === "BUFF_SELF"),
      guard?.enrichmentSpecs
    );
    check(
      `${DR_ID} catalog carries an ON_DEATH SUMMON_TOKEN enrichment`,
      Array.isArray(dr?.enrichmentSpecs) &&
        dr.enrichmentSpecs.some((s: any) => s.trigger === "ON_DEATH" && s.op === "SUMMON_TOKEN"),
      dr?.enrichmentSpecs
    );
  }

  // ---- (A2) ON_SUMMON BUFF_SELF resolves: GUARD body enters at 3/7 ------------
  {
    const m = arena();
    m.players.P1.hand = [GUARD_ID];
    const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
    const played = r.state.players.P1.board.front.find((u) => u.cardId === GUARD_ID);
    check(
      `enriched GUARD body resolves ON_SUMMON +0/+1 (health ${GUARD_BASE_HEALTH} -> ${GUARD_ENRICHED_HEALTH})`,
      played?.health === GUARD_ENRICHED_HEALTH,
      played
    );
    check("enriched GUARD body keeps its authored attack (3, no attack creep)", played?.attack === 3, played);
  }

  // ---- (A3) ON_DEATH SUMMON_TOKEN resolves: a Rubble token is left behind -----
  {
    const m = arena();
    m.players.P1.board.front = [unit({ instanceId: "killer", cardId: "tcg_test", attack: 10, health: 10, maxHealth: 10 })];
    m.players.P2.board.front = [unit({ instanceId: "dier", cardId: DR_ID, attack: 1, health: 1, maxHealth: 1 })];
    const r = applyAction(m, {
      type: "ATTACK_UNIT",
      player: "P1",
      attackerInstanceId: "killer",
      defenderInstanceId: "dier",
    });
    const p2front = r.state.players.P2.board.front;
    const corpse = p2front.find((u) => u.instanceId === "dier");
    const token = p2front.find((u) => u.cardId.startsWith("token_rubble"));
    check("enriched DEATHRATTLE corpse is cleared", corpse === undefined, p2front.map((u) => u.cardId));
    check("enriched DEATHRATTLE leaves a Rubble token on death", !!token, p2front.map((u) => u.cardId));
    check("Rubble token is a 0/1 body", token?.attack === 0 && token?.health === 1, token);
  }
} else {
  // ---- (B1) NO enrichment leaks into the catalog with the flag OFF ------------
  {
    const guard = getPlayableCardById(GUARD_ID) as any;
    const dr = getPlayableCardById(DR_ID) as any;
    check(
      `${GUARD_ID} catalog carries NO enrichmentSpecs (flag off)`,
      !guard?.enrichmentSpecs || guard.enrichmentSpecs.length === 0,
      guard?.enrichmentSpecs
    );
    check(
      `${DR_ID} catalog carries NO enrichmentSpecs (flag off)`,
      !dr?.enrichmentSpecs || dr.enrichmentSpecs.length === 0,
      dr?.enrichmentSpecs
    );
  }

  // ---- (B2) GUARD body enters at its authored 3/6 (no buff) -------------------
  {
    const m = arena();
    m.players.P1.hand = [GUARD_ID];
    const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
    const played = r.state.players.P1.board.front.find((u) => u.cardId === GUARD_ID);
    check(
      `flag OFF: GUARD body enters at baseline 3/${GUARD_BASE_HEALTH} (commander only, NO enrichment buff)`,
      played?.health === GUARD_BASE_HEALTH && played?.attack === 3,
      played
    );
  }

  // ---- (B3) DEATHRATTLE body leaves NO token on death ------------------------
  {
    const m = arena();
    m.players.P1.board.front = [unit({ instanceId: "killer", cardId: "tcg_test", attack: 10, health: 10, maxHealth: 10 })];
    m.players.P2.board.front = [unit({ instanceId: "dier", cardId: DR_ID, attack: 1, health: 1, maxHealth: 1 })];
    const r = applyAction(m, {
      type: "ATTACK_UNIT",
      player: "P1",
      attackerInstanceId: "killer",
      defenderInstanceId: "dier",
    });
    const p2front = r.state.players.P2.board.front;
    check("flag OFF: DEATHRATTLE body leaves NO token (board empty)", p2front.length === 0, p2front.map((u) => u.cardId));
  }
}

console.log(`\n=== ENRICHMENT PROOF SUMMARY (flag ${ENABLE_ENRICHMENT ? "ON" : "OFF"}) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} enrichment proof check(s) failed.`);
  process.exit(1);
}
console.log("ALL ENRICHMENT PROOFS PASSED");
