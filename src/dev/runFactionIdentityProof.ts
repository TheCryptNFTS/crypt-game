/**
 * dev:faction-identity — behavioral proof for the five faction IDENTITIES
 * (src/engine/factionIdentity.ts). These exercise the pure identity hooks
 * directly with minimal states / units, so the assertions are exact and isolated
 * from full-match noise (mirrors src/dev/runCommanderPassiveProof.ts).
 *
 * Two locked guards run through every case:
 *   1. NO BURN — no identity hook ever lowers the enemy nexus. The cross-cutting
 *      block fails loudly if anyone reintroduces face burn on a faction identity.
 *   2. GATED — with rules.factionIdentities ABSENT (the vanilla default) EVERY
 *      hook is a clean no-op, which is what keeps the golden fixtures byte-
 *      identical. The "gate off" block proves the inert path.
 *
 * `factionOf` / `costOf` are driven off the REAL card catalog (allPlayableCards),
 * so the cardId -> faction / cost lookups are exactly what the reducer feeds the
 * hooks in a live match.
 */

import {
  factionOnUnitSummon,
  factionOnEquip,
  factionOnTurnStart,
} from "../engine/factionIdentity";
import { allPlayableCards } from "../engine/cards";

// Real catalog lookups (the reducer passes equivalent closures).
const META = new Map<string, any>((allPlayableCards as any[]).map((c) => [c.id, c]));
const factionOf = (id: string): string | null => META.get(id)?.faction ?? null;
const costOf = (id: string): number => META.get(id)?.cost ?? 0;

// Real ids with known faction + cost (probed from the catalog):
//   STONE   tcg_2  (cost 2)         tcg_27  (cost 6)
//   BRONZE  tcg_93 (cost 2)         tcg_26  (cost 5)
//   GOLD    tcg_100(cost 2)         tcg_146 (cost 6)
//   SILVER  tcg_97 (cost 2)        tcg_75  (cost 3)
//   IRON    tcg_8  (cost 2)
const STONE_CHEAP = "tcg_2";
const STONE_BIG = "tcg_27";
const BRONZE_CHEAP = "tcg_93";
const BRONZE_BIG = "tcg_26";
const GOLD_CHEAP = "tcg_100";
const GOLD_BIG = "tcg_146";
const IRON_CHEAP = "tcg_8";
const SILVER_CHEAP = "tcg_97";
const SILVER_BIG = "tcg_75";

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`OK: ${msg}`);
  } else {
    console.error(`FAIL: ${msg}`);
    failed += 1;
  }
}

const CMD_BY_FACTION: Record<string, string> = {
  STONE_KEEPERS: "cmd_stone_warden",
  IRON_DEFENDERS: "cmd_iron_warlord",
  BRONZE_GUARDIANS: "cmd_bronze_raider",
  SILVER_SENTINELS: "cmd_silver_oracle",
  GOLDEN_SOVEREIGNS: "cmd_golden_emperor",
};

/** Build a minimal match state. `enabled` toggles the identity gate; `archetypes`
 *  opts into the deepened threshold layer (OFF by default, mirroring the shipped
 *  CORE ruleset, so base-identity cases stay flat). Each player has an empty board
 *  (front/back) so archetype threshold counting has live lanes to read. */
function makeState(commanderId: string, enabled: boolean, archetypes = false): any {
  return {
    rules: enabled ? { factionIdentities: true, factionArchetypes: archetypes } : undefined,
    players: {
      P1: { commanderId, nexusHealth: 20, deck: [], board: { front: [], back: [] } },
      P2: { commanderId: "cmd_demo", nexusHealth: 20, deck: [], board: { front: [], back: [] } },
    },
  };
}

function makeUnit(cardId: string, keywords: string[] = []): any {
  return { cardId, keywords: [...keywords], attack: 2, health: 3, maxHealth: 3, armor: 0 };
}

/** Place `count` units of `cardId` onto a player's front lane (live board count for
 *  threshold tests). Returns the array so callers can keep references if needed. */
function fillBoard(state: any, playerId: string, cardId: string, count: number): any[] {
  const lane = state.players[playerId].board.front;
  for (let i = 0; i < count; i += 1) lane.push(makeUnit(cardId));
  return lane;
}

// === STONE (Bedrock): same-faction summons enter with +1 ARMOR ================
{
  const state = makeState(CMD_BY_FACTION.STONE_KEEPERS, true);

  const onFaction = makeUnit(STONE_CHEAP);
  factionOnUnitSummon(state, "P1", onFaction, factionOf, costOf);
  assert(onFaction.armor === 1, "Bedrock gives a summoned Stone unit +1 Armor");
  assert(
    onFaction.attack === 2 && onFaction.health === 3,
    "Bedrock does NOT change a Stone unit's attack/health (armor-only)"
  );

  // Off-faction splash (a Bronze unit under a Stone commander) gains nothing.
  const offFaction = makeUnit(BRONZE_CHEAP);
  factionOnUnitSummon(state, "P1", offFaction, factionOf, costOf);
  assert(offFaction.armor === 0, "Bedrock ignores an OFF-faction (Bronze) summon");
  assert(state.players.P2.nexusHealth === 20, "Bedrock does NOT burn the enemy nexus");
}

// === BRONZE (Onslaught): same-faction cost<=2 summons gain RUSH ===============
{
  const state = makeState(CMD_BY_FACTION.BRONZE_GUARDIANS, true);

  const cheap = makeUnit(BRONZE_CHEAP);
  factionOnUnitSummon(state, "P1", cheap, factionOf, costOf);
  assert(cheap.keywords.includes("RUSH"), "Onslaught grants RUSH to a cost<=2 Bronze summon");

  const big = makeUnit(BRONZE_BIG);
  factionOnUnitSummon(state, "P1", big, factionOf, costOf);
  assert(!big.keywords.includes("RUSH"), "Onslaught does NOT grant RUSH to a cost>=5 Bronze summon");

  // Idempotency: re-running does not duplicate the keyword.
  factionOnUnitSummon(state, "P1", cheap, factionOf, costOf);
  assert(
    cheap.keywords.filter((k: string) => k === "RUSH").length === 1,
    "Onslaught RUSH grant is idempotent"
  );
  assert(state.players.P2.nexusHealth === 20, "Onslaught does NOT burn the enemy nexus");
}

// === GOLD (Largesse): same-faction cost>=5 summons enter +0/+1 ================
// (2026.06.06 faction-compression: Largesse shaved from +0/+2 to +0/+1 — GOLD was the
// top of the ladder; the identity-side shave trims its premium top-end durability.)
{
  const state = makeState(CMD_BY_FACTION.GOLDEN_SOVEREIGNS, true);

  const big = makeUnit(GOLD_BIG);
  factionOnUnitSummon(state, "P1", big, factionOf, costOf);
  assert(
    big.attack === 2 && big.health === 4 && big.maxHealth === 4,
    "Largesse gives a summoned cost>=5 Gold unit +0/+1 (health only)"
  );

  const cheap = makeUnit(GOLD_CHEAP);
  factionOnUnitSummon(state, "P1", cheap, factionOf, costOf);
  assert(
    cheap.attack === 2 && cheap.health === 3,
    "Largesse does NOT buff a cheap (<5) Gold summon"
  );
  assert(state.players.P2.nexusHealth === 20, "Largesse does NOT burn the enemy nexus");
}

// === IRON (Tempered): each equip ALSO grants the unit +1 ATTACK / +1 ARMOR =====
// (2026.06.06 faction-compression: the +1 Attack was PROMOTED from the 3+ Iron
// archetype threshold to BASELINE so Iron — the bottom of the faction ladder — has a
// real combat identity from the first weapon. Per-equip, own-side, no-burn.)
{
  const state = makeState(CMD_BY_FACTION.IRON_DEFENDERS, true);
  const unit = makeUnit(IRON_CHEAP);
  factionOnEquip(state, "P1", unit);
  assert(unit.armor === 1, "Tempered gives an equipped unit +1 Armor");
  assert(unit.attack === 3, "Tempered gives an equipped unit +1 Attack (baseline)");
  assert(unit.health === 3, "Tempered does not touch health on equip");

  // A second equip stacks both again (per-equip).
  factionOnEquip(state, "P1", unit);
  assert(unit.armor === 2, "Tempered stacks +1 Armor per equip");
  assert(unit.attack === 4, "Tempered stacks +1 Attack per equip");
}

// === SILVER (Insight): same-faction cost<=2 summons enter with +1 ATTACK =======
// (Replaces the old board-irrelevant "Scry 1" with a tempo board edge — a unit that
// actually hits harder in the combat race; see factionOnUnitSummon SILVER case.)
{
  const state = makeState(CMD_BY_FACTION.SILVER_SENTINELS, true);

  const cheap = makeUnit(SILVER_CHEAP);
  factionOnUnitSummon(state, "P1", cheap, factionOf, costOf);
  assert(cheap.attack === 3, "Insight gives a cost<=2 Silver summon +1 Attack");
  assert(
    cheap.health === 3 && cheap.armor === 0,
    "Insight changes only attack on a cheap Silver summon (no health/armor)"
  );

  const big = makeUnit(SILVER_BIG);
  factionOnUnitSummon(state, "P1", big, factionOf, costOf);
  assert(big.attack === 2, "Insight does NOT buff a cost>=3 Silver summon (base band <=2)");

  // Off-faction splash (a Stone unit under a Silver commander) gains nothing.
  const off = makeUnit(STONE_CHEAP);
  factionOnUnitSummon(state, "P1", off, factionOf, costOf);
  assert(off.attack === 2, "Insight ignores an OFF-faction (Stone) summon");
  assert(state.players.P2.nexusHealth === 20, "Insight does NOT burn the enemy nexus");
}

// === GATE OFF (vanilla default): every hook is a clean no-op =================
{
  // Same factioned commanders, but rules.factionIdentities ABSENT.
  const stone = makeState(CMD_BY_FACTION.STONE_KEEPERS, false);
  const u1 = makeUnit(STONE_CHEAP);
  factionOnUnitSummon(stone, "P1", u1, factionOf, costOf);
  assert(u1.armor === 0, "GATE OFF: Bedrock summon hook is inert");

  const bronze = makeState(CMD_BY_FACTION.BRONZE_GUARDIANS, false);
  const u2 = makeUnit(BRONZE_CHEAP);
  factionOnUnitSummon(bronze, "P1", u2, factionOf, costOf);
  assert(!u2.keywords.includes("RUSH"), "GATE OFF: Onslaught summon hook is inert");

  const iron = makeState(CMD_BY_FACTION.IRON_DEFENDERS, false);
  const u3 = makeUnit(IRON_CHEAP);
  factionOnEquip(iron, "P1", u3);
  assert(u3.armor === 0, "GATE OFF: Tempered equip hook is inert");

  const silver = makeState(CMD_BY_FACTION.SILVER_SENTINELS, false);
  const u4 = makeUnit(SILVER_CHEAP);
  factionOnUnitSummon(silver, "P1", u4, factionOf, costOf);
  assert(u4.attack === 2, "GATE OFF: Insight summon hook is inert (no +1 Attack)");

  // The retained turn-start seam is an intentional no-op for ALL factions now.
  const silverTs = makeState(CMD_BY_FACTION.SILVER_SENTINELS, true);
  silverTs.players.P1.deck = [STONE_BIG, SILVER_CHEAP, "tcg_8"];
  const before = [...silverTs.players.P1.deck];
  factionOnTurnStart(silverTs, "P1", costOf, factionOf);
  assert(
    JSON.stringify(silverTs.players.P1.deck) === JSON.stringify(before),
    "Turn-start hook is an inert no-op even with identities ON (no faction uses it)"
  );
}

// === NON-CURATED COMMANDER: no faction -> no-op even with gate ON ============
{
  const state = makeState("cmd_6665", true); // generated NFT commander, faction null
  const u = makeUnit(STONE_CHEAP);
  factionOnUnitSummon(state, "P1", u, factionOf, costOf);
  factionOnEquip(state, "P1", u);
  assert(u.armor === 0, "Non-curated commander has NO faction identity (clean no-op)");
}

// === CROSS-CUTTING NO-BURN: no summon identity ever lowers the enemy nexus ====
{
  for (const f of Object.keys(CMD_BY_FACTION)) {
    const state = makeState(CMD_BY_FACTION[f], true);
    factionOnUnitSummon(state, "P1", makeUnit(STONE_CHEAP), factionOf, costOf);
    factionOnUnitSummon(state, "P1", makeUnit(GOLD_BIG), factionOf, costOf);
    assert(
      state.players.P2.nexusHealth === 20,
      `${f} identity leaves the enemy nexus untouched (no-burn)`
    );
  }
}

// ============================================================================
// ARCHETYPE DEPTH (#8b) — threshold payoffs that activate at N+ OWN-faction units
// ============================================================================
// Catalog ids by faction+cost (probed from allPlayableCards):
//   STONE  tcg_27 (6)   BRONZE tcg_17 (3) / tcg_93 (2) / tcg_26 (5)
//   SILVER tcg_97 (2)   IRON   tcg_8  (2)              GOLD tcg_146 (6)
const BRONZE_MID = "tcg_17"; // cost 3 (between base <=2 and archetype <=3)

// === STONE archetype: at 3+ Stone live, Bedrock deepens to +2 Armor ===========
{
  // BELOW threshold (2 Stone on board) -> base +1.
  const below = makeState(CMD_BY_FACTION.STONE_KEEPERS, true, true);
  fillBoard(below, "P1", STONE_CHEAP, 2);
  const u1 = makeUnit(STONE_CHEAP);
  factionOnUnitSummon(below, "P1", u1, factionOf, costOf);
  assert(u1.armor === 1, "STONE below threshold (2 units): base Bedrock +1 Armor only");

  // AT threshold (3 Stone on board, e.g. the just-summoned unit is on board) -> +2.
  const at = makeState(CMD_BY_FACTION.STONE_KEEPERS, true, true);
  fillBoard(at, "P1", STONE_CHEAP, 3);
  const u2 = makeUnit(STONE_CHEAP);
  factionOnUnitSummon(at, "P1", u2, factionOf, costOf);
  assert(u2.armor === 2, "STONE at 3+ units: Bedrock deepens to +2 Armor");
  assert(at.players.P2.nexusHealth === 20, "STONE archetype does NOT burn enemy nexus");
}

// === BRONZE archetype: at 3+ Bronze live, Rush extends to cost<=3 =============
{
  // BELOW threshold (2 Bronze on board): a cost-3 Bronze unit does NOT get Rush.
  const below = makeState(CMD_BY_FACTION.BRONZE_GUARDIANS, true, true);
  fillBoard(below, "P1", BRONZE_CHEAP, 2);
  const mid1 = makeUnit(BRONZE_MID);
  factionOnUnitSummon(below, "P1", mid1, factionOf, costOf);
  assert(!mid1.keywords.includes("RUSH"), "BRONZE below threshold: cost-3 unit gets NO Rush (base <=2)");

  // AT threshold (3 Bronze on board): the cost-3 unit now gains Rush.
  const at = makeState(CMD_BY_FACTION.BRONZE_GUARDIANS, true, true);
  fillBoard(at, "P1", BRONZE_CHEAP, 3);
  const mid2 = makeUnit(BRONZE_MID);
  factionOnUnitSummon(at, "P1", mid2, factionOf, costOf);
  assert(mid2.keywords.includes("RUSH"), "BRONZE at 3+ units: Rush extends to cost<=3");

  // A cost-5 Bronze unit is still OUTSIDE the widened band (no Rush even deep).
  const big = makeUnit(BRONZE_BIG);
  factionOnUnitSummon(at, "P1", big, factionOf, costOf);
  assert(!big.keywords.includes("RUSH"), "BRONZE archetype still excludes cost-5 from Rush");
  assert(at.players.P2.nexusHealth === 20, "BRONZE archetype does NOT burn enemy nexus");
}

// === GOLD archetype: at 4+ Gold live, Largesse deepens to +0/+2 ===============
// (2026.06.06: shaved from +1/+3 to +0/+2 alongside the +0/+2 -> +0/+1 baseline shave.)
{
  // BELOW threshold (3 Gold on board) -> base +0/+1.
  const below = makeState(CMD_BY_FACTION.GOLDEN_SOVEREIGNS, true, true);
  fillBoard(below, "P1", GOLD_BIG, 3);
  const b1 = makeUnit(GOLD_BIG);
  factionOnUnitSummon(below, "P1", b1, factionOf, costOf);
  assert(b1.attack === 2 && b1.health === 4, "GOLD below threshold (3 units): base +0/+1 only");

  // AT threshold (4 Gold on board) -> +0/+2.
  const at = makeState(CMD_BY_FACTION.GOLDEN_SOVEREIGNS, true, true);
  fillBoard(at, "P1", GOLD_BIG, 4);
  const b2 = makeUnit(GOLD_BIG);
  factionOnUnitSummon(at, "P1", b2, factionOf, costOf);
  assert(
    b2.attack === 2 && b2.health === 5 && b2.maxHealth === 5,
    "GOLD at 4+ units: Largesse deepens to +0/+2"
  );
  // A cheap (<5) Gold unit is untouched regardless of threshold.
  const cheap = makeUnit(GOLD_CHEAP);
  factionOnUnitSummon(at, "P1", cheap, factionOf, costOf);
  assert(cheap.attack === 2 && cheap.health === 3, "GOLD archetype still ignores cheap (<5) summon");
  assert(at.players.P2.nexusHealth === 20, "GOLD archetype does NOT burn enemy nexus");
}

// === IRON archetype: at 3+ Iron live, equip grants a SECOND +1 Attack =========
// (2026.06.06: baseline equip is now +1 ATK / +1 Armor; the 3+ Iron archetype stacks
// a SECOND +1 Attack on top, so the deepened payoff reads attack 4, not 3.)
{
  // BELOW threshold (2 Iron on board) -> equip gives the baseline +1 Armor / +1 ATK.
  const below = makeState(CMD_BY_FACTION.IRON_DEFENDERS, true, true);
  fillBoard(below, "P1", IRON_CHEAP, 2);
  const u1 = makeUnit(IRON_CHEAP);
  factionOnEquip(below, "P1", u1, factionOf);
  assert(u1.armor === 1 && u1.attack === 3, "IRON below threshold: equip gives baseline +1 Armor / +1 Attack");

  // AT threshold (3 Iron on board) -> equip gives +1 Armor AND a SECOND +1 Attack.
  const at = makeState(CMD_BY_FACTION.IRON_DEFENDERS, true, true);
  fillBoard(at, "P1", IRON_CHEAP, 3);
  const u2 = makeUnit(IRON_CHEAP);
  factionOnEquip(at, "P1", u2, factionOf);
  assert(u2.armor === 1 && u2.attack === 4, "IRON at 3+ units: equip grants +1 Armor AND a second +1 Attack");
  assert(u2.health === 3 && u2.maxHealth === 3, "IRON archetype leaves health untouched");
  assert(at.players.P2.nexusHealth === 20, "IRON archetype does NOT burn enemy nexus");
}

// === SILVER archetype: at 3+ Silver live, Insight +1 ATK band widens to cost<=3 ==
{
  // BELOW threshold (2 Silver on board): base band cost<=2, so a cost-3 Silver
  // summon gets NO +1 Attack.
  const below = makeState(CMD_BY_FACTION.SILVER_SENTINELS, true, true);
  fillBoard(below, "P1", SILVER_CHEAP, 2);
  const belowBig = makeUnit(SILVER_BIG); // cost 3
  factionOnUnitSummon(below, "P1", belowBig, factionOf, costOf);
  assert(belowBig.attack === 2, "SILVER below threshold: cost-3 summon gets NO +1 Attack (base band <=2)");

  // AT threshold (3 Silver on board): band widens to cost<=3, so the cost-3 summon
  // now gains +1 Attack.
  const at = makeState(CMD_BY_FACTION.SILVER_SENTINELS, true, true);
  fillBoard(at, "P1", SILVER_CHEAP, 3);
  const atBig = makeUnit(SILVER_BIG); // cost 3
  factionOnUnitSummon(at, "P1", atBig, factionOf, costOf);
  assert(atBig.attack === 3, "SILVER at 3+ units: +1 Attack band widens to cost<=3");
  assert(
    atBig.health === 3 && atBig.armor === 0,
    "SILVER archetype changes only attack (no health/armor)"
  );
  // A cost-5 Silver summon stays outside even the widened band.
  const atTop = makeState(CMD_BY_FACTION.SILVER_SENTINELS, true, true);
  fillBoard(atTop, "P1", SILVER_CHEAP, 3);
  const five = makeUnit("tcg_55"); // Silver cost 5
  factionOnUnitSummon(atTop, "P1", five, factionOf, costOf);
  assert(five.attack === 2, "SILVER archetype still excludes cost-5 from the +1 Attack band");
  assert(at.players.P2.nexusHealth === 20, "SILVER archetype does NOT burn enemy nexus");
}

// === ARCHETYPE GATE OFF: flag absent -> NO base AND NO threshold payoff =======
{
  const stone = makeState(CMD_BY_FACTION.STONE_KEEPERS, false);
  fillBoard(stone, "P1", STONE_CHEAP, 5); // well over threshold
  const u = makeUnit(STONE_CHEAP);
  factionOnUnitSummon(stone, "P1", u, factionOf, costOf);
  assert(u.armor === 0, "GATE OFF: STONE archetype inert even at 5 units (no base, no payoff)");

  const iron = makeState(CMD_BY_FACTION.IRON_DEFENDERS, false);
  fillBoard(iron, "P1", IRON_CHEAP, 5);
  const iu = makeUnit(IRON_CHEAP);
  factionOnEquip(iron, "P1", iu, factionOf);
  assert(iu.armor === 0 && iu.attack === 2, "GATE OFF: IRON archetype equip inert even at 5 units");
}

// === DETERMINISM: identical setup twice -> byte-identical archetype result ====
{
  function runGoldDeep(): any {
    const s = makeState(CMD_BY_FACTION.GOLDEN_SOVEREIGNS, true, true);
    fillBoard(s, "P1", GOLD_BIG, 4);
    const u = makeUnit(GOLD_BIG);
    factionOnUnitSummon(s, "P1", u, factionOf, costOf);
    return { attack: u.attack, health: u.health, maxHealth: u.maxHealth };
  }
  assert(
    JSON.stringify(runGoldDeep()) === JSON.stringify(runGoldDeep()),
    "DETERMINISM: GOLD archetype payoff is identical across two identical runs"
  );
}

if (failed > 0) {
  console.error(`\nFACTION IDENTITY PROOF FAILED: ${failed} assertion(s).`);
  process.exit(1);
}
console.log("\nALL FACTION IDENTITY PROOFS PASSED");
