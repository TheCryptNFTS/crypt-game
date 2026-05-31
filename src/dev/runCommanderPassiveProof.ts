/**
 * dev:commander — behavioral proof for the curated commander passives
 * (src/engine/commanderPassives.ts). These exercise the pure passive hooks
 * directly with minimal states/units, so the assertions are exact and isolated
 * from full-match noise.
 *
 * The headline guard is the LOCKED NO-BURN constraint: Bronze Raider (Raid) must
 * NEVER deal direct damage to the enemy nexus. Its identity is purely board-based
 * reach — cheap summons gain RUSH and pressure the enemy THROUGH COMBAT. This
 * proof fails loudly if anyone reintroduces nexus burn on a commander passive.
 */

import {
  commanderOnUnitSummon,
  commanderOnEquip,
} from "../engine/commanderPassives";

// Real catalog ids with known costs (see allPlayableCards): tcg_2 costs 2
// (<=3, "cheap"), tcg_10 costs 6 (>=5, "big").
const CHEAP = "tcg_2";
const BIG = "tcg_10";

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`OK: ${msg}`);
  } else {
    console.error(`FAIL: ${msg}`);
    failed += 1;
  }
}

function makeState(p1Commander: string): any {
  return {
    players: {
      P1: { commanderId: p1Commander, nexusHealth: 20 },
      P2: { commanderId: "cmd_demo", nexusHealth: 20 },
    },
  };
}

function makeUnit(cardId: string, keywords: string[] = []): any {
  return { cardId, keywords: [...keywords], attack: 2, health: 3, maxHealth: 3 };
}

// --- Bronze Raider (Raid): cheap summons gain RUSH, NO nexus burn ------------
{
  const state = makeState("cmd_bronze_raider");

  const cheap = makeUnit(CHEAP);
  commanderOnUnitSummon(state, "P1", cheap);
  assert(cheap.keywords.includes("RUSH"), "Raid grants RUSH to a cost<=3 summon");
  assert(
    state.players.P2.nexusHealth === 20,
    "Raid does NOT burn the enemy nexus on a cheap summon (no-burn)"
  );

  const big = makeUnit(BIG);
  commanderOnUnitSummon(state, "P1", big);
  assert(!big.keywords.includes("RUSH"), "Raid does NOT grant RUSH to a cost>=5 summon");
  assert(
    state.players.P2.nexusHealth === 20,
    "Raid does NOT burn the enemy nexus on a big summon (no-burn)"
  );

  // Idempotency: re-summoning a unit that already has RUSH does not duplicate it.
  commanderOnUnitSummon(state, "P1", cheap);
  assert(
    cheap.keywords.filter((k: string) => k === "RUSH").length === 1,
    "Raid RUSH grant is idempotent (no duplicate keyword)"
  );
}

// --- Stone Warden (Bulwark): summoned GUARD units enter +0/+2 ----------------
{
  const state = makeState("cmd_stone_warden");

  const guard = makeUnit(CHEAP, ["GUARD"]);
  commanderOnUnitSummon(state, "P1", guard);
  assert(guard.health === 5 && guard.maxHealth === 5, "Bulwark gives a summoned Guard +0/+2");
  assert(guard.attack === 2, "Bulwark does not change a Guard's attack");

  const plain = makeUnit(CHEAP);
  commanderOnUnitSummon(state, "P1", plain);
  assert(plain.health === 3 && plain.maxHealth === 3, "Bulwark does not buff a non-Guard summon");
}

// --- Golden Emperor (Opulence): summoned cost>=5 units enter +1/+1 -----------
{
  const state = makeState("cmd_golden_emperor");

  const big = makeUnit(BIG);
  commanderOnUnitSummon(state, "P1", big);
  assert(
    big.attack === 3 && big.health === 4 && big.maxHealth === 4,
    "Opulence gives a summoned cost>=5 unit +1/+1"
  );

  const cheap = makeUnit(CHEAP);
  commanderOnUnitSummon(state, "P1", cheap);
  assert(
    cheap.attack === 2 && cheap.health === 3,
    "Opulence does not buff a cheap (<5) summon"
  );
}

// --- Iron Warlord (Warmonger): each equip grants the unit +1 Attack ----------
{
  const state = makeState("cmd_iron_warlord");
  const unit = makeUnit(CHEAP);
  commanderOnEquip(state, "P1", unit);
  assert(unit.attack === 3, "Warmonger gives an equipped unit +1 Attack");
  assert(unit.health === 3, "Warmonger does not change the equipped unit's health");
}

// --- Cross-cutting no-burn guard: NONE of the summon passives ever lower the
// enemy nexus, regardless of which curated commander is active. -------------
{
  for (const cmd of [
    "cmd_bronze_raider",
    "cmd_stone_warden",
    "cmd_golden_emperor",
    "cmd_silver_oracle",
  ]) {
    const state = makeState(cmd);
    commanderOnUnitSummon(state, "P1", makeUnit(CHEAP, ["GUARD"]));
    commanderOnUnitSummon(state, "P1", makeUnit(BIG));
    assert(
      state.players.P2.nexusHealth === 20,
      `${cmd} summon passive leaves the enemy nexus untouched (no-burn)`
    );
  }
}

if (failed > 0) {
  console.error(`\nCOMMANDER PASSIVE PROOF FAILED: ${failed} assertion(s).`);
  process.exit(1);
}
console.log("\nALL COMMANDER PASSIVE PROOFS PASSED");
