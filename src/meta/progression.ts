/**
 * PROGRESSION — per-player XP / level / season "stars", in-game-only.
 *
 * *** HARD RULE (non-negotiable) ***
 * This game uses a real on-chain currency ("hex"). This module operates
 * ENTIRELY on non-real, in-game-only state: XP, level, MMR/rank, and season
 * stars. It does NOT mint, grant, credit, or source hex or any on-chain asset,
 * and it never touches wallet balances. Game ledgers may sink real hex but must
 * never source it; this scaffold sources NOTHING real. Any reward that would
 * require real value is intentionally absent and left as a TODO for the owner.
 *
 * The PlayerProfile below is a plain serializable shape persisted to
 * localStorage under its own key. Pure math functions + a thin local-only
 * persistence layer. No randomness, no network.
 */

import {
  RatingState,
  applyMatchResult,
  ratingOf,
  BASELINE_RATING,
} from "./rating";
import { Rank, Season, rankFromMmr, INITIAL_SEASON } from "./ladder";

// ---------------------------------------------------------------------------
// XP / LEVEL CURVE (in-game-only; not a currency)
// ---------------------------------------------------------------------------

/** XP awarded per match outcome. Pure constants — NOT hex, NOT spendable. */
export const XP_REWARDS = {
  win: 100,
  loss: 25,
  /** Floor everyone gets just for finishing a match. */
  participation: 25,
} as const;

/** Season stars: a light cosmetic progress pip. +1 per win, never negative. */
export const STARS_PER_WIN = 1;

/**
 * XP required to advance FROM the given level to the next. A gentle quadratic
 * curve: level 1->2 costs 100, scaling up. Pure.
 */
export function xpForLevel(level: number): number {
  const L = Math.max(1, Math.floor(level));
  return 100 + (L - 1) * 50 + Math.floor(Math.pow(L - 1, 2) * 10);
}

export type LevelInfo = {
  level: number;
  /** XP accumulated within the current level. */
  currentLevelXp: number;
  /** XP needed to reach the next level from the current one. */
  nextLevelXp: number;
  totalXp: number;
};

/** Derive level + progress from a cumulative XP total. Pure, deterministic. */
export function deriveLevel(totalXp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));

  // Cap iterations defensively; the curve grows so this terminates quickly.
  while (level < 1000) {
    const need = xpForLevel(level);
    if (remaining < need) break;
    remaining -= need;
    level += 1;
  }

  return {
    level,
    currentLevelXp: remaining,
    nextLevelXp: xpForLevel(level),
    totalXp: Math.max(0, Math.floor(totalXp)),
  };
}

// ---------------------------------------------------------------------------
// PLAYER PROFILE
// ---------------------------------------------------------------------------

export type PlayerProfile = {
  playerId: string;
  /** Elo MMR (see rating.ts). In-game skill scalar, not an asset. */
  rating: number;
  /** Derived rank label cache (recomputed on update; safe to ignore on load). */
  rank: Rank;
  /** Cumulative lifetime XP (in-game-only). */
  xp: number;
  /** Derived from xp. */
  level: number;
  /** Season progress pips (in-game-only cosmetic). */
  seasonStars: number;
  /** Current season. */
  season: Season;
  wins: number;
  losses: number;
};

export function createPlayerProfile(playerId: string): PlayerProfile {
  return {
    playerId,
    rating: BASELINE_RATING,
    rank: rankFromMmr(BASELINE_RATING),
    xp: 0,
    level: 1,
    seasonStars: 0,
    season: INITIAL_SEASON,
    wins: 0,
    losses: 0,
  };
}

export type MatchOutcome = {
  /** True if THIS profile's player won the match. */
  won: boolean;
  /** The opponent's rating, used to drive the Elo exchange. */
  opponentRating: number;
};

/**
 * Apply a decided match to a profile, returning a NEW profile (immutable, pure).
 * Updates MMR via Elo, awards XP + participation, bumps season stars on a win,
 * and recomputes derived level + rank. Sources nothing real.
 */
export function applyMatchToProfile(
  profile: PlayerProfile,
  outcome: MatchOutcome
): PlayerProfile {
  // Drive the Elo exchange through the shared rating math so MMR stays
  // consistent with the standalone rating engine.
  const table: RatingState = {
    ratings: {
      [profile.playerId]: profile.rating,
      __opp__: outcome.opponentRating,
    },
  };
  const winnerId = outcome.won ? profile.playerId : "__opp__";
  const loserId = outcome.won ? "__opp__" : profile.playerId;
  const { state: nextTable } = applyMatchResult(table, { winnerId, loserId });
  const nextRating = ratingOf(nextTable, profile.playerId);

  const xpGain =
    (outcome.won ? XP_REWARDS.win : XP_REWARDS.loss) + XP_REWARDS.participation;
  const nextXp = profile.xp + xpGain;
  const level = deriveLevel(nextXp).level;

  return {
    ...profile,
    rating: nextRating,
    rank: rankFromMmr(nextRating),
    xp: nextXp,
    level,
    seasonStars: profile.seasonStars + (outcome.won ? STARS_PER_WIN : 0),
    wins: profile.wins + (outcome.won ? 1 : 0),
    losses: profile.losses + (outcome.won ? 0 : 1),
  };
}

// ---------------------------------------------------------------------------
// LOCAL-ONLY PERSISTENCE (no network, no wallet, no on-chain writes)
// ---------------------------------------------------------------------------

/** Distinct from the main app-state key so we never collide with it. */
const PROFILE_STORAGE_KEY = "crypt_meta_profile_v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Load the local profile, or create a fresh one for `playerId`. */
export function loadProfile(playerId = "local"): PlayerProfile {
  if (!canUseStorage()) return createPlayerProfile(playerId);
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return createPlayerProfile(playerId);
    const parsed = JSON.parse(raw) as PlayerProfile;
    // Re-derive cached fields so a hand-edited/legacy blob stays consistent.
    return {
      ...createPlayerProfile(parsed.playerId ?? playerId),
      ...parsed,
      rank: rankFromMmr(parsed.rating ?? BASELINE_RATING),
      level: deriveLevel(parsed.xp ?? 0).level,
    };
  } catch {
    return createPlayerProfile(playerId);
  }
}

/** Persist the profile locally. Local storage only — never leaves the device. */
export function saveProfile(profile: PlayerProfile): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

/** Wipe the local profile (e.g. for a fresh test run). Local only. */
export function resetProfile(playerId = "local"): PlayerProfile {
  const fresh = createPlayerProfile(playerId);
  saveProfile(fresh);
  return fresh;
}

// TODO(owner): Any reward that would grant real hex / on-chain assets / wallet
// credit is intentionally NOT implemented here. Rewards above are in-game-only
// (XP, level, MMR/rank, season stars). If you want season payouts that source
// real value, that requires an explicit owner decision and a mint/transfer path
// that this module deliberately does not provide.
