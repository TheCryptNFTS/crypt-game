/**
 * dev:rating — proof for the meta-game progression scaffold.
 *
 * Asserts the Elo rating math (expected-score, symmetry, zero-sum within
 * rounding, determinism), rank-tier boundaries + season soft-reset, and an
 * XP/level progression example. Pure assertions, no randomness, no I/O beyond
 * console. Mirrors the existing dev:* proof style (assert + process.exit(1)).
 *
 * HARD-RULE CHECK: also asserts the progression path produces ONLY in-game-only
 * state (no hex / currency / wallet fields) — see the final section.
 */

import {
  expectedScore,
  computeRatingDelta,
  applyMatchResult,
  ratingOf,
  RatingState,
  DEFAULT_K,
  BASELINE_RATING,
  MIN_RATING,
} from "../meta/rating";
import {
  rankFromMmr,
  softResetMmr,
  nextSeason,
  INITIAL_SEASON,
} from "../meta/ladder";
import {
  createPlayerProfile,
  applyMatchToProfile,
  deriveLevel,
  xpForLevel,
  XP_REWARDS,
} from "../meta/progression";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAILED: ${msg}`);
    failures += 1;
  } else {
    console.log(`OK: ${msg}`);
  }
}
function approx(a: number, b: number, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

// ---------------------------------------------------------------------------
// 1. ELO EXPECTED SCORE
// ---------------------------------------------------------------------------
assert(approx(expectedScore(1000, 1000), 0.5), "equal ratings -> expected score 0.5");
assert(
  approx(expectedScore(1200, 1000) + expectedScore(1000, 1200), 1),
  "expected scores of a pair sum to 1"
);
assert(expectedScore(1400, 1000) > 0.5, "higher-rated player favored (>0.5)");
assert(expectedScore(1000, 1400) < 0.5, "lower-rated player underdog (<0.5)");

// ---------------------------------------------------------------------------
// 2. RATING DELTA — symmetry, zero-sum, bounds
// ---------------------------------------------------------------------------
{
  const d = computeRatingDelta(1000, 1000, DEFAULT_K);
  assert(d.winnerDelta + d.loserDelta === 0, "equal ratings: delta is exactly zero-sum");
  assert(d.winnerDelta === Math.round(DEFAULT_K * 0.5), "equal ratings: winner gains K/2");
}
{
  const fav = computeRatingDelta(1400, 1000, DEFAULT_K); // favorite wins
  const ups = computeRatingDelta(1000, 1400, DEFAULT_K); // underdog wins
  assert(fav.winnerDelta + fav.loserDelta === 0, "favorite win: zero-sum within rounding");
  assert(ups.winnerDelta + ups.loserDelta === 0, "upset win: zero-sum within rounding");
  assert(
    ups.winnerDelta > fav.winnerDelta,
    "upset rewards more points than an expected win"
  );
  assert(fav.winnerDelta >= 0 && fav.loserDelta <= 0, "winner gains, loser loses");
}

// ---------------------------------------------------------------------------
// 3. DETERMINISM — same inputs, same outputs
// ---------------------------------------------------------------------------
{
  const a = computeRatingDelta(1234, 987, 24);
  const b = computeRatingDelta(1234, 987, 24);
  assert(
    a.winnerDelta === b.winnerDelta && a.loserDelta === b.loserDelta,
    "computeRatingDelta is deterministic"
  );
}

// ---------------------------------------------------------------------------
// 4. applyMatchResult — table update + clamp + immutability
// ---------------------------------------------------------------------------
{
  const start: RatingState = { ratings: {} };
  const { state: after, delta } = applyMatchResult(start, { winnerId: "A", loserId: "B" });
  assert(ratingOf(start, "A") === BASELINE_RATING, "unknown player defaults to baseline");
  assert(start.ratings.A === undefined, "applyMatchResult does not mutate input state");
  assert(
    ratingOf(after, "A") === BASELINE_RATING + delta.winnerDelta,
    "winner rating moved by winnerDelta"
  );
  assert(
    ratingOf(after, "B") === BASELINE_RATING + delta.loserDelta,
    "loser rating moved by loserDelta"
  );
  // Total points conserved across both players (zero-sum) at baseline.
  assert(
    ratingOf(after, "A") + ratingOf(after, "B") === 2 * BASELINE_RATING,
    "applyMatchResult conserves total rating (zero-sum)"
  );
}
{
  // Floor clamp: a player already at MIN_RATING cannot drop below it.
  const lowState: RatingState = { ratings: { L: MIN_RATING, H: 3000 } };
  const { state } = applyMatchResult(lowState, { winnerId: "H", loserId: "L" });
  assert(ratingOf(state, "L") >= MIN_RATING, "rating clamped at MIN_RATING floor");
}

// ---------------------------------------------------------------------------
// 5. RANK TIER BOUNDARIES
// ---------------------------------------------------------------------------
assert(rankFromMmr(0).tier === "Bronze", "MMR 0 -> Bronze");
assert(rankFromMmr(899).tier === "Bronze", "MMR 899 -> Bronze (just under Silver)");
assert(rankFromMmr(900).tier === "Silver", "MMR 900 -> Silver (boundary inclusive)");
assert(rankFromMmr(1200).tier === "Gold", "MMR 1200 -> Gold (boundary inclusive)");
assert(rankFromMmr(1499).tier === "Gold", "MMR 1499 -> Gold (just under Platinum)");
assert(rankFromMmr(1500).tier === "Platinum", "MMR 1500 -> Platinum");
assert(rankFromMmr(1800).tier === "Diamond", "MMR 1800 -> Diamond");
assert(rankFromMmr(2200).tier === "Master", "MMR 2200 -> Master");
assert(rankFromMmr(5000).tier === "Master", "very high MMR stays Master (open-ended)");
{
  // Sub-divisions climb IV (low) -> I (high) in 100-MMR steps from the tier floor.
  assert(rankFromMmr(1200).label === "Gold IV", "Gold floor (1200) -> Gold IV");
  assert(rankFromMmr(1299).label === "Gold IV", "Gold 1299 -> still Gold IV (0-99 above floor)");
  assert(rankFromMmr(1300).label === "Gold III", "Gold 1300 -> Gold III");
  assert(rankFromMmr(1400).label === "Gold II", "Gold 1400 -> Gold II");
  // Platinum floor (1500) closes Gold before division I is reached; verify the
  // division ceiling is clamped (no out-of-range division for a tall tier).
  assert(rankFromMmr(1499).label === "Gold II", "Gold 1499 -> Gold II (just under Platinum)");
  assert(rankFromMmr(2200).label === "Master", "Master has no sub-division");
}

// ---------------------------------------------------------------------------
// 6. SEASON SOFT-RESET
// ---------------------------------------------------------------------------
{
  const high = 2000;
  const reset = softResetMmr(high, 0.4, BASELINE_RATING);
  assert(reset < high && reset > BASELINE_RATING, "soft reset pulls toward baseline but keeps edge");
  assert(softResetMmr(high, 0) === high, "pullFactor 0 keeps full MMR");
  assert(softResetMmr(high, 1, BASELINE_RATING) === BASELINE_RATING, "pullFactor 1 hard-resets to baseline");
  assert(nextSeason(INITIAL_SEASON).seasonId === 2, "nextSeason increments seasonId");
}

// ---------------------------------------------------------------------------
// 7. XP / LEVEL PROGRESSION EXAMPLE
// ---------------------------------------------------------------------------
{
  assert(deriveLevel(0).level === 1, "0 XP -> level 1");
  assert(xpForLevel(1) === 100, "level 1->2 costs 100 XP");
  const justUnder = deriveLevel(xpForLevel(1) - 1);
  assert(justUnder.level === 1, "just under L1 threshold stays level 1");
  const exactly = deriveLevel(xpForLevel(1));
  assert(exactly.level === 2, "exactly L1 threshold reaches level 2");
  assert(xpForLevel(2) > xpForLevel(1), "level cost increases with level");
  const li = deriveLevel(250);
  assert(li.currentLevelXp + cumulativeBelow(li.level) === 250, "currentLevelXp + cumulative = total");
}
function cumulativeBelow(level: number): number {
  let t = 0;
  for (let i = 1; i < level; i += 1) t += xpForLevel(i);
  return t;
}

// ---------------------------------------------------------------------------
// 8. PROFILE PIPELINE + HARD-RULE: in-game-only, no hex / currency / wallet
// ---------------------------------------------------------------------------
{
  let p = createPlayerProfile("local");
  assert(p.rating === BASELINE_RATING && p.level === 1 && p.seasonStars === 0, "fresh profile baseline");

  // Win vs an equal opponent: rating up, +1 star, XP = win + participation.
  p = applyMatchToProfile(p, { won: true, opponentRating: BASELINE_RATING });
  assert(p.rating > BASELINE_RATING, "win raises MMR");
  assert(p.seasonStars === 1, "win grants 1 season star");
  assert(p.xp === XP_REWARDS.win + XP_REWARDS.participation, "win XP = win + participation");
  assert(p.wins === 1 && p.losses === 0, "win recorded");

  // Loss: rating down, no star, loss XP added.
  const beforeLossRating = p.rating;
  const beforeLossStars = p.seasonStars;
  p = applyMatchToProfile(p, { won: false, opponentRating: BASELINE_RATING });
  assert(p.rating < beforeLossRating, "loss lowers MMR");
  assert(p.seasonStars === beforeLossStars, "loss grants no star");
  assert(p.losses === 1, "loss recorded");

  // HARD RULE: profile carries ONLY in-game-only fields. No hex / currency /
  // wallet / token / balance fields may exist on the progression profile.
  const keys = Object.keys(p).join(",").toLowerCase();
  const forbidden = ["hex", "wallet", "token", "balance", "crypt", "currency", "coin"];
  const leaked = forbidden.filter((f) => keys.includes(f));
  assert(leaked.length === 0, `profile has no real-asset fields (found: ${leaked.join(",") || "none"})`);
}

// ---------------------------------------------------------------------------
if (failures > 0) {
  console.error(`\nRATING PROOF FAILED: ${failures} assertion(s).`);
  process.exit(1);
}
console.log("\nALL RATING / LADDER / PROGRESSION PROOFS PASSED\n");
