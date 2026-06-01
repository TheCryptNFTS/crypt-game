/**
 * dev:rewards — proof for the retention rewards loop.
 *
 * Asserts quest progress/completion math, Sigil earn + spend, season-tier
 * unlocks (idempotent), quest day/week rollover, and — the HARD RULE — that the
 * rewards ledger carries NO hex / wallet / token / on-chain field. Pure
 * assertions, no randomness, deterministic `now` injection, no I/O beyond
 * console. Mirrors the existing dev:* proof style (assert + process.exit(1)).
 */

import {
  createRewardsState,
  applyMatchToRewards,
  purchaseCosmetic,
  seasonTierForXp,
  settleSeasonTiers,
  metricDelta,
  rolloverQuests,
  dayBucket,
  weekBucket,
  SIGIL_REWARDS,
  SEASON_TRACK,
  questDefById,
  type RewardsState,
  type MatchResult,
} from "../meta/rewards";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAILED: ${msg}`);
    failures += 1;
  } else {
    console.log(`OK: ${msg}`);
  }
}

const T0 = 1_700_000_000_000; // fixed clock for determinism
const WIN: MatchResult = { won: true };
const LOSS: MatchResult = { won: false };

// ---------------------------------------------------------------------------
// 1. METRIC DELTA
// ---------------------------------------------------------------------------
assert(metricDelta({ kind: "wins" }, WIN) === 1, "wins metric counts a win");
assert(metricDelta({ kind: "wins" }, LOSS) === 0, "wins metric ignores a loss");
assert(metricDelta({ kind: "matches" }, LOSS) === 1, "matches metric counts any match");
assert(
  metricDelta({ kind: "factionUnits", faction: "Stone" }, { won: true, factionUnitsPlayed: { Stone: 3 } }) === 3,
  "factionUnits metric reads the faction count"
);
assert(
  metricDelta({ kind: "factionUnits", faction: "Stone" }, WIN) === 0,
  "factionUnits metric is 0 when absent"
);

// ---------------------------------------------------------------------------
// 2. BASE SIGIL EARN
// ---------------------------------------------------------------------------
{
  let s = createRewardsState(T0);
  assert(s.sigil === 0, "fresh ledger has 0 Sigil");
  s = applyMatchToRewards(s, LOSS, T0);
  assert(s.sigil === SIGIL_REWARDS.loss, "a loss pays base loss Sigil");
  const afterLoss = s.sigil;
  s = applyMatchToRewards(s, WIN, T0);
  // Win pays base win Sigil; the win also advances quests but none complete in 1.
  assert(s.sigil === afterLoss + SIGIL_REWARDS.win, "a win pays base win Sigil (no quest yet)");
}

// ---------------------------------------------------------------------------
// 3. QUEST COMPLETION MATH — "win 3" pays out exactly once
// ---------------------------------------------------------------------------
{
  let s = createRewardsState(T0);
  const def = questDefById("daily_win_3")!;
  assert(!!def, "daily_win_3 quest exists");

  // Two wins: progress 2/3, not yet complete, no quest bonus.
  s = applyMatchToRewards(s, WIN, T0);
  s = applyMatchToRewards(s, WIN, T0);
  assert(s.quests["daily_win_3"].progress === 2, "two wins -> 2/3 progress");
  assert(!s.quests["daily_win_3"].claimed, "two wins -> not yet claimed");
  const beforeThird = s.sigil;

  // Third win completes it: +base win Sigil +quest Sigil, +season XP.
  s = applyMatchToRewards(s, WIN, T0);
  assert(s.quests["daily_win_3"].progress === 3, "third win -> 3/3 progress");
  assert(s.quests["daily_win_3"].claimed, "third win -> claimed");
  assert(
    s.sigil === beforeThird + SIGIL_REWARDS.win + def.sigilReward,
    "completion pays base win + quest Sigil"
  );
  assert(s.seasonXp >= def.seasonXpReward, "completion grants quest season XP");

  // A 4th win does NOT re-pay the completed quest.
  const afterComplete = s.sigil;
  s = applyMatchToRewards(s, WIN, T0);
  assert(
    s.sigil === afterComplete + SIGIL_REWARDS.win,
    "completed quest is not re-paid (idempotent)"
  );
}

// ---------------------------------------------------------------------------
// 4. FACTION-UNITS QUEST — "play 5 Stone units"
// ---------------------------------------------------------------------------
{
  let s = createRewardsState(T0);
  s = applyMatchToRewards(s, { won: false, factionUnitsPlayed: { Stone: 2 } }, T0);
  assert(s.quests["daily_stone_5"].progress === 2, "stone quest counts 2 Stone units");
  s = applyMatchToRewards(s, { won: false, factionUnitsPlayed: { Stone: 4 } }, T0);
  assert(s.quests["daily_stone_5"].progress === 5, "stone quest clamps at goal (5)");
  assert(s.quests["daily_stone_5"].claimed, "stone quest completes at 5");
}

// ---------------------------------------------------------------------------
// 5. SEASON TIER UNLOCK + IDEMPOTENCE
// ---------------------------------------------------------------------------
{
  assert(seasonTierForXp(0) === 1, "0 XP -> tier 1");
  assert(seasonTierForXp(99) === 1, "99 XP -> still tier 1");
  assert(seasonTierForXp(100) === 2, "100 XP -> tier 2 (threshold inclusive)");
  assert(seasonTierForXp(1_000_000) === SEASON_TRACK.length, "huge XP -> top tier");

  // Cross tier 2 threshold directly; settle should pay tier 2 once.
  let s: RewardsState = { ...createRewardsState(T0), seasonXp: 120 };
  const before = s.sigil;
  s = settleSeasonTiers(s);
  const tier2 = SEASON_TRACK.find((t) => t.tier === 2)!;
  assert(s.seasonTierClaimed === 2, "settle marks tier 2 claimed");
  assert(s.sigil === before + tier2.sigilReward, "settle pays tier 2 Sigil once");

  // Re-settling pays nothing more.
  const after = s.sigil;
  s = settleSeasonTiers(s);
  assert(s.sigil === after, "re-settle is idempotent");

  // Crossing a cosmetic tier grants the cosmetic flag.
  let c: RewardsState = { ...createRewardsState(T0), seasonXp: 300 };
  c = settleSeasonTiers(c);
  assert(c.cosmetics.includes("frame_signal"), "tier 3 grants frame_signal cosmetic");
}

// ---------------------------------------------------------------------------
// 6. CURRENCY SPEND — purchase cosmetics
// ---------------------------------------------------------------------------
{
  let s: RewardsState = { ...createRewardsState(T0), sigil: 250 };
  const bad = purchaseCosmetic(s, "nope");
  assert(bad.ok === false && bad.reason === "unknown", "unknown cosmetic rejected");

  const buy = purchaseCosmetic(s, "frame_signal"); // price 200
  assert(buy.ok, "affordable cosmetic purchased");
  if (buy.ok) {
    s = buy.state;
    assert(s.sigil === 50, "Sigil debited by price (250 - 200)");
    assert(s.cosmetics.includes("frame_signal"), "cosmetic flag added");
  }

  const dup = purchaseCosmetic(s, "frame_signal");
  assert(dup.ok === false && dup.reason === "owned", "owned cosmetic cannot be re-bought");

  const broke = purchaseCosmetic(s, "frame_void"); // price 600, only 50 left
  assert(broke.ok === false && broke.reason === "insufficient", "insufficient Sigil rejected");
}

// ---------------------------------------------------------------------------
// 7. QUEST ROLLOVER — daily/weekly buckets reseed progress
// ---------------------------------------------------------------------------
{
  let s = createRewardsState(T0);
  s = applyMatchToRewards(s, WIN, T0);
  assert(s.quests["daily_win_3"].progress === 1, "same-day progress accrues");

  const nextDay = T0 + 86_400_000;
  assert(dayBucket(nextDay) !== dayBucket(T0), "next day is a new day bucket");
  const rolled = rolloverQuests(s, nextDay);
  assert(rolled.quests["daily_win_3"].progress === 0, "daily quest reseeds next day");

  const nextWeek = T0 + 86_400_000 * 7;
  assert(weekBucket(nextWeek) !== weekBucket(T0), "next week is a new week bucket");
  const rolledW = rolloverQuests(s, nextWeek);
  assert(rolledW.quests["weekly_win_15"].progress === 0, "weekly quest reseeds next week");
}

// ---------------------------------------------------------------------------
// 8. DETERMINISM — same inputs, same outputs
// ---------------------------------------------------------------------------
{
  const a = applyMatchToRewards(createRewardsState(T0), WIN, T0);
  const b = applyMatchToRewards(createRewardsState(T0), WIN, T0);
  assert(JSON.stringify(a) === JSON.stringify(b), "applyMatchToRewards is deterministic");
}

// ---------------------------------------------------------------------------
// 9. HARD RULE — ledger carries NO hex / wallet / token / on-chain field
// ---------------------------------------------------------------------------
{
  // Build a richly-populated state to exercise every field, then scan it.
  let s = createRewardsState(T0);
  s = applyMatchToRewards(s, { won: true, factionUnitsPlayed: { Stone: 5 } }, T0);
  s = { ...s, seasonXp: 1500 };
  s = settleSeasonTiers(s);
  s = { ...s, sigil: 1000 };
  const buy = purchaseCosmetic(s, "frame_signal");
  if (buy.ok) s = buy.state;

  const keys = Object.keys(s).join(",").toLowerCase();
  const blob = JSON.stringify(s).toLowerCase();
  const forbidden = ["hex", "wallet", "token", "balance", "onchain", "on_chain", "crypt", "coin", "mint", "0x"];
  const leakedKeys = forbidden.filter((f) => keys.includes(f));
  // The Sigil/cosmetic VALUES may legitimately contain none of these; assert
  // neither the field names nor the serialized blob leak a real-asset concept.
  const leakedBlob = forbidden.filter((f) => blob.includes(f));
  assert(leakedKeys.length === 0, `ledger field names carry no real-asset concept (found: ${leakedKeys.join(",") || "none"})`);
  assert(leakedBlob.length === 0, `serialized ledger carries no real-asset concept (found: ${leakedBlob.join(",") || "none"})`);
  assert(typeof (s as Record<string, unknown>).sigil === "number", "ledger's only currency is numeric Sigil");
}

// ---------------------------------------------------------------------------
if (failures > 0) {
  console.error(`\nREWARDS PROOF FAILED: ${failures} assertion(s).`);
  process.exit(1);
}
console.log("\nALL REWARDS PROOFS PASSED\n");
