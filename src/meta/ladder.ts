/**
 * LADDER / RANKS + SEASONS — pure, deterministic, in-game-only.
 *
 * Maps an Elo MMR value (see src/meta/rating.ts) to a named rank tier with
 * sub-divisions, and defines a season construct whose reset SOFT-pulls MMR back
 * toward a baseline. Nothing here is an on-chain asset: ranks and seasons are
 * cosmetic/skill display state only. No randomness, no I/O.
 */

import { BASELINE_RATING } from "./rating";

export type RankTierName =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Master";

/** A tier's lower MMR bound (inclusive). Tiers are checked high -> low. */
type TierBand = { name: RankTierName; floor: number };

/**
 * Tier floors. Bronze is the catch-all below Silver; Master is open-ended above
 * its floor. Boundaries are inclusive on the floor (>= floor enters the tier).
 */
const TIER_BANDS: TierBand[] = [
  { name: "Master", floor: 2200 },
  { name: "Diamond", floor: 1800 },
  { name: "Platinum", floor: 1500 },
  { name: "Gold", floor: 1200 },
  { name: "Silver", floor: 900 },
  { name: "Bronze", floor: 0 },
];

/** Width of one sub-division within a (non-Master) tier, in MMR points. */
const DIVISION_WIDTH = 100;
/** Number of sub-divisions per tier (IV is lowest, I is highest). */
const DIVISIONS_PER_TIER = 4;
const DIVISION_LABELS = ["IV", "III", "II", "I"] as const;

export type Rank = {
  tier: RankTierName;
  /** 1..4 where 1 is the highest division in the tier (e.g. "Gold I"). */
  division: number;
  /** Human label, e.g. "Gold II" or "Master". */
  label: string;
};

/**
 * Map an MMR value to a rank tier + sub-division. Master has no sub-divisions
 * (it's the open-ended apex). Pure and total: any finite number returns a rank.
 */
export function rankFromMmr(mmr: number): Rank {
  const band = TIER_BANDS.find((b) => mmr >= b.floor) ?? TIER_BANDS[TIER_BANDS.length - 1];

  if (band.name === "Master") {
    return { tier: "Master", division: 1, label: "Master" };
  }

  // How far into the tier are we? Clamp the span so very wide tiers still map
  // into the 4 divisions, and progress goes IV (low) -> I (high).
  const intoTier = Math.max(0, mmr - band.floor);
  const rawDivIndex = Math.floor(intoTier / DIVISION_WIDTH);
  const divIndex = Math.min(DIVISIONS_PER_TIER - 1, rawDivIndex); // 0..3
  const label = DIVISION_LABELS[divIndex]; // IV..I
  // division number: index 0 -> 4 (IV), index 3 -> 1 (I).
  const division = DIVISIONS_PER_TIER - divIndex;

  return { tier: band.name, division, label: `${band.name} ${label}` };
}

// ---------------------------------------------------------------------------
// SEASONS
// ---------------------------------------------------------------------------

export type Season = {
  /** Monotonic season id (1-based). */
  seasonId: number;
};

/**
 * Soft-reset an MMR toward the baseline at season rollover. We pull the rating a
 * fraction of the way back to BASELINE_RATING so strong players keep an edge but
 * everyone re-converges — the standard ladder "soft reset".
 *
 * pullFactor in [0,1]: 0 = no reset (keep full MMR), 1 = hard reset to baseline.
 * Pure + deterministic; rounds to a whole point.
 */
export function softResetMmr(
  currentMmr: number,
  pullFactor = 0.4,
  baseline: number = BASELINE_RATING
): number {
  const clamped = Math.min(1, Math.max(0, pullFactor));
  return Math.round(currentMmr + (baseline - currentMmr) * clamped);
}

/** Advance to the next season (id + 1). Pure. */
export function nextSeason(season: Season): Season {
  return { seasonId: season.seasonId + 1 };
}

export const INITIAL_SEASON: Season = { seasonId: 1 };
