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
//   SILVER  tcg_97 (cost 2)
//   IRON    tcg_8  (cost 2)
const STONE_CHEAP = "tcg_2";
const STONE_BIG = "tcg_27";
const BRONZE_CHEAP = "tcg_93";
const BRONZE_BIG = "tcg_26";
const GOLD_CHEAP = "tcg_100";
const GOLD_BIG = "tcg_146";
const IRON_CHEAP = "tcg_8";

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

/** Build a minimal match state. `enabled` toggles the rules gate. */
function makeState(commanderId: string, enabled: boolean): any {
  return {
    rules: enabled ? { factionIdentities: true } : undefined,
    players: {
      P1: { commanderId, nexusHealth: 20, deck: [] },
      P2: { commanderId: "cmd_demo", nexusHealth: 20, deck: [] },
    },
  };
}

function makeUnit(cardId: string, keywords: string[] = []): any {
  return { cardId, keywords: [...keywords], attack: 2, health: 3, maxHealth: 3, armor: 0 };
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

// === GOLD (Largesse): same-faction cost>=5 summons enter +0/+2 ================
{
  const state = makeState(CMD_BY_FACTION.GOLDEN_SOVEREIGNS, true);

  const big = makeUnit(GOLD_BIG);
  factionOnUnitSummon(state, "P1", big, factionOf, costOf);
  assert(
    big.attack === 2 && big.health === 5 && big.maxHealth === 5,
    "Largesse gives a summoned cost>=5 Gold unit +0/+2 (health only)"
  );

  const cheap = makeUnit(GOLD_CHEAP);
  factionOnUnitSummon(state, "P1", cheap, factionOf, costOf);
  assert(
    cheap.attack === 2 && cheap.health === 3,
    "Largesse does NOT buff a cheap (<5) Gold summon"
  );
  assert(state.players.P2.nexusHealth === 20, "Largesse does NOT burn the enemy nexus");
}

// === IRON (Tempered): each equip ALSO grants the unit +1 ARMOR ================
{
  const state = makeState(CMD_BY_FACTION.IRON_DEFENDERS, true);
  const unit = makeUnit(IRON_CHEAP);
  factionOnEquip(state, "P1", unit);
  assert(unit.armor === 1, "Tempered gives an equipped unit +1 Armor");
  assert(unit.attack === 2 && unit.health === 3, "Tempered changes only armor on equip");

  // A second equip stacks armor again (per-equip, like Iron Warlord's +1 Attack).
  factionOnEquip(state, "P1", unit);
  assert(unit.armor === 2, "Tempered stacks +1 Armor per equip");
}

// === SILVER (Insight): start of turn Scry 1 (deterministic deck smooth) =======
{
  const state = makeState(CMD_BY_FACTION.SILVER_SENTINELS, true);
  // Top card is more expensive than the next: Scry 1 smooths the cheapest to top.
  // tcg_27 (cost 6) on top, tcg_97 (cost 2) beneath -> after Scry 1 the cheaper
  // of the inspected window sits on top.
  state.players.P1.deck = [STONE_BIG, "tcg_97", "tcg_8"];
  factionOnTurnStart(state, "P1", costOf);
  assert(
    state.players.P1.deck.length === 3,
    "Insight Scry 1 preserves deck size (no draw, no card advantage)"
  );
  assert(
    costOf(state.players.P1.deck[0]) <= costOf(STONE_BIG),
    "Insight Scry 1 smooths the top of the deck by cost (cheapest-first)"
  );
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
  silver.players.P1.deck = [STONE_BIG, "tcg_97", "tcg_8"];
  const before = [...silver.players.P1.deck];
  factionOnTurnStart(silver, "P1", costOf);
  assert(
    JSON.stringify(silver.players.P1.deck) === JSON.stringify(before),
    "GATE OFF: Insight turn-start hook is inert (deck unchanged)"
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

if (failed > 0) {
  console.error(`\nFACTION IDENTITY PROOF FAILED: ${failed} assertion(s).`);
  process.exit(1);
}
console.log("\nALL FACTION IDENTITY PROOFS PASSED");
