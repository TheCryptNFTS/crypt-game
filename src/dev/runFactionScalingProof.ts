/**
 * dev:faction-scaling — pins faction-scaled Oath/Vow/Martyr buffs END-TO-END
 * through `applyAction`. These cards compile to an ON_SUMMON BUFF_SELF carrying a
 * `scaleFaction` noun ("... Stone Keeper you control"); the resolver multiplies
 * the buff by the count of the controller's matching board faction.
 *
 *   tcg_19   STONE_KEEPERS    "+1/+1 for each OTHER Stone Keeper you control"  (excludes self)
 *   tcg_5830 BRONZE_GUARDIANS "+2/+2 for each Bronze Guardian you control"     (includes self)
 *
 * Real ids drive the reducer's cardId -> ability + cardId -> faction lookups
 * exactly as in a match. We measure the buff as a DELTA versus an empty-board
 * control so the proof is independent of the card's printed base stat line.
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

function arena(seed = 3131): MatchState {
  const m = makeSeededMatch(seed);
  m.activePlayer = "P1";
  m.winner = null;
  for (const p of ["P1", "P2"] as const) {
    m.players[p].board.front = [];
    m.players[p].board.back = [];
    m.players[p].nexusHealth = 20;
    m.players[p].energy = 99;
    m.players[p].maxEnergy = 99;
  }
  return m;
}

/** Play the Oath card `cardId` with `allies` already on the board, return the
 *  summoned unit's post-buff (attack, health). */
function playWith(cardId: string, allies: UnitInPlay[]): { attack: number; health: number } {
  const m = arena();
  m.players.P1.board.front = allies;
  m.players.P1.hand = [cardId, ...m.players.P1.hand];
  // Fillers may share the played cardId, so identify the summoned unit by the
  // instanceId the engine minted (i.e. one not present among the fillers).
  const fillerIds = new Set(allies.map((u) => u.instanceId));
  const r = applyAction(m, { type: "PLAY_UNIT", player: "P1", handIndex: 0, lane: "front" });
  const summoned = r.state.players.P1.board.front.find((u) => u.cardId === cardId && !fillerIds.has(u.instanceId));
  if (!summoned) throw new Error(`summoned ${cardId} not found on board`);
  return { attack: summoned.attack, health: summoned.health };
}

// Real Stone Keeper ids (faction STONE_KEEPERS) used as inert board fillers.
const sk = (id: string, n: number) => unit({ instanceId: `sk_${n}`, cardId: id, attack: 0, health: 5, maxHealth: 5 });
// Real Bronze Guardian ids.
const bg = (id: string, n: number) => unit({ instanceId: `bg_${n}`, cardId: id, attack: 0, health: 5, maxHealth: 5 });

// --- tcg_19: "+1/+1 for each OTHER Stone Keeper you control" -------------------
{
  // Control: no other Stone Keepers -> multiplier 0 -> no buff. Establishes base.
  const base = playWith("tcg_19", []);
  // 3 OTHER Stone Keepers on board -> multiplier 3 -> +3/+3 over base.
  const scaled = playWith("tcg_19", [sk("tcg_1", 1), sk("tcg_2", 2), sk("tcg_3", 3)]);
  check("tcg_19 scales +1/+1 per OTHER Stone Keeper (atk +3)", scaled.attack === base.attack + 3, { base, scaled });
  check("tcg_19 scales +1/+1 per OTHER Stone Keeper (hp +3)", scaled.health === base.health + 3, { base, scaled });

  // A lone non-matching ally (a Bronze Guardian) must NOT count toward a Stone
  // Keeper oath -> still 0 multiplier -> identical to base.
  const offFaction = playWith("tcg_19", [bg("tcg_5830", 9)]);
  check("tcg_19 ignores non-Stone-Keeper allies (no buff)", offFaction.attack === base.attack && offFaction.health === base.health, { base, offFaction });
}

// --- tcg_5830: "+2/+2 for each Bronze Guardian you control" (INCLUDES self) ----
{
  // No "other"/"ally" qualifier: the source itself is a Bronze Guardian, so an
  // empty board still yields multiplier 1 -> +2/+2 already applied.
  const selfOnly = playWith("tcg_5830", []);
  // 2 other Bronze Guardians -> multiplier 3 -> +6/+6: that is +4/+4 OVER the
  // self-only (mult 1) baseline.
  const withTwo = playWith("tcg_5830", [bg("tcg_14", 1), bg("tcg_17", 2)]);
  check("tcg_5830 counts SELF (no 'other'): +2 atk per step", withTwo.attack === selfOnly.attack + 4, { selfOnly, withTwo });
  check("tcg_5830 counts SELF (no 'other'): +2 hp per step", withTwo.health === selfOnly.health + 4, { selfOnly, withTwo });
}

console.log(`\n=== FACTION SCALING PROOF (Oath/Vow/Martyr BUFF_SELF * faction count) ===`);
if (failures > 0) {
  console.error(`FAILED: ${failures} faction-scaling check(s) failed.`);
  process.exit(1);
}
console.log("ALL FACTION SCALING PROOFS PASSED");
