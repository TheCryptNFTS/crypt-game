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
import {
  ENABLE_ENRICHMENT,
  enrichmentBandOf,
  enrichmentV2SpecsFor,
  bandValueCap,
  enrichmentValuePoints,
  type EnrichableCard,
} from "../engine/abilityEnrichment";
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

  // ====================================================================
  // ENRICHMENT V2 — DECISION-creating effects on the rare+/higher-Grade band.
  // These prove a V2 spec RESOLVES end-to-end (board-dependent), and that the
  // per-band power cap holds for every V2 card.
  // ====================================================================
  const RARE_POKE_ID = "tcg_5864"; // RUSH rare 6/5 -> ON_SUMMON DEAL_DAMAGE 2 (STRONGEST_ENEMY)
  const LEGEND_DESTROY_ID = "tcg_5391"; // RUSH legendary -> ON_SUMMON DESTROY_ENEMY_SELECT HIGHEST_COST
  const LEGEND_DEBUFF_ID = "tcg_6664"; // GUARD legendary -> ON_SUMMON DEBUFF_ALL_ENEMIES 2

  // ---- (A4) catalog carries the V2 decision specs (not a V1 chip) -------------
  {
    const poke = getPlayableCardById(RARE_POKE_ID) as any;
    const destroy = getPlayableCardById(LEGEND_DESTROY_ID) as any;
    check(
      `${RARE_POKE_ID} catalog carries an ON_SUMMON DEAL_DAMAGE (STRONGEST_ENEMY) V2 spec`,
      Array.isArray(poke?.enrichmentSpecs) &&
        poke.enrichmentSpecs.some((s: any) => s.op === "DEAL_DAMAGE" && s.damageTarget === "STRONGEST_ENEMY"),
      poke?.enrichmentSpecs
    );
    check(
      `${LEGEND_DESTROY_ID} catalog carries an ON_SUMMON DESTROY_ENEMY_SELECT(HIGHEST_COST) V2 spec`,
      Array.isArray(destroy?.enrichmentSpecs) &&
        destroy.enrichmentSpecs.some((s: any) => s.op === "DESTROY_ENEMY_SELECT" && s.selector === "HIGHEST_COST"),
      destroy?.enrichmentSpecs
    );
  }

  // ---- (A5) rare poke RESOLVES: on play, auto-hits the strongest enemy --------
  {
    const m = arena();
    m.players.P2.board.front = [
      unit({ instanceId: "weak", cardId: "tcg_a", attack: 1, health: 9, maxHealth: 9 }),
      unit({ instanceId: "strong", cardId: "tcg_b", attack: 7, health: 9, maxHealth: 9 }),
    ];
    m.players.P1.hand = [RARE_POKE_ID];
    const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
    const strong = r.state.players.P2.board.front.find((u) => u.instanceId === "strong");
    const weak = r.state.players.P2.board.front.find((u) => u.instanceId === "weak");
    check("V2 rare poke hits the STRONGEST enemy for 2 (9 -> 7)", strong?.health === 7, strong);
    check("V2 rare poke leaves the weaker enemy untouched (9)", weak?.health === 9, weak);
  }

  // ---- (A6) legendary removal RESOLVES: destroys the highest-cost enemy -------
  {
    const m = arena();
    const cheap = getPlayableCardById("tcg_6568")?.id ?? "tcg_6568"; // a low-cost catalog unit
    // Two enemies; the costlier must be the one reaped. Use catalog ids so costOf
    // resolves a real cost; tcg_5391 (Poseidon, cost high) sits opposite as victim.
    m.players.P2.board.front = [
      unit({ instanceId: "cheapU", cardId: cheap, attack: 1, health: 3, maxHealth: 3 }),
      unit({ instanceId: "bombU", cardId: "tcg_5181", attack: 8, health: 8, maxHealth: 8 }), // Zeus, high cost
    ];
    m.players.P1.hand = [LEGEND_DESTROY_ID];
    const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
    const survivors = r.state.players.P2.board.front.map((u) => u.instanceId);
    const bombGone = !survivors.includes("bombU");
    check("V2 legendary removal destroys the highest-cost enemy (bomb)", bombGone, survivors);
  }

  // ---- (A7) legendary board debuff RESOLVES: all enemies -2 attack this turn --
  {
    const m = arena();
    m.players.P2.board.front = [
      unit({ instanceId: "e1", cardId: "tcg_a", attack: 5, health: 9, maxHealth: 9 }),
      unit({ instanceId: "e2", cardId: "tcg_b", attack: 3, health: 9, maxHealth: 9 }),
    ];
    m.players.P1.hand = [LEGEND_DEBUFF_ID];
    const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
    const e1 = r.state.players.P2.board.front.find((u) => u.instanceId === "e1");
    const e2 = r.state.players.P2.board.front.find((u) => u.instanceId === "e2");
    check("V2 legendary debuff drops enemy e1 attack 5 -> 3", e1?.attack === 3, e1);
    check("V2 legendary debuff drops enemy e2 attack 3 -> 1", e2?.attack === 1, e2);
  }

  // ---- (A8) per-band power cap holds for EVERY V2 card in the catalog ---------
  {
    const raw = require("../data/generatedTcgCards.json") as any[];
    const { normalizeFaction } = require("../types/faction");
    let overCap = 0;
    let v2count = 0;
    for (const c of raw) {
      const card: EnrichableCard = {
        id: c.id,
        faction: normalizeFaction(c.faction ?? "STONE_KEEPERS"),
        rarity: String(c.rarity ?? "COMMON"),
        keywords: c.keywords ?? [],
        rawTraits: c.rawTraits ?? {},
        sourceCardClass: c.cardClass ?? null,
        sourceSubtype: c.subtype ?? null,
      };
      const specs = enrichmentV2SpecsFor(card);
      if (specs.length === 0) continue;
      v2count += 1;
      const band = enrichmentBandOf(card)!;
      if (enrichmentValuePoints(specs) > bandValueCap(band)) overCap += 1;
    }
    check(`V2 catalog has decision cards (${v2count} > 0)`, v2count > 0, v2count);
    check(`every V2 card respects its band value cap (${overCap} over-cap)`, overCap === 0, overCap);
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
