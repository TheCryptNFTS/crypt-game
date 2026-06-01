/**
 * Client bridge to the AUTHORITATIVE ranked-ladder + daily-quest server.
 *
 * The server (server/server.ts) is now the source of truth for ranked rating and
 * per-UTC-day quest claims, so progress survives across devices and can't be
 * re-opened by clearing localStorage. This module is a thin, dependency-free
 * fetch wrapper around the bearer-authed endpoints; every call FALLS BACK to a
 * null result when offline / unauthenticated, so the existing local prototype
 * progression keeps working with no server.
 *
 * HEX-SAFETY: these endpoints grant ONLY game-internal rating / XP / soft
 * currency. Nothing here mints or moves real on-chain hex (the server has no
 * such path). This is purely a read/claim bridge for the retention loop.
 */

import { getAuthHeader, isSignedIn } from "../nft/gameSession";

/** Authoritative server base. Defaults to same-origin so a reverse-proxied
 *  deploy "just works"; override in dev via VITE_CRYPT_SERVER_BASE. */
const SERVER_BASE: string =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_CRYPT_SERVER_BASE || "";

export interface MyRanking {
  accountId: string;
  rating: number;
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  season: number;
  position: number;
}

export interface LeaderboardEntry {
  position: number;
  accountId: string;
  rating: number;
  wins: number;
  losses: number;
  bestStreak: number;
}

export interface ServerQuestEntry {
  id: string;
  title: string;
  xp: number;
  crypt: number;
  claimed: boolean;
}
export interface TodayQuests {
  utcDay: string;
  dailyLoginClaimed: boolean;
  quests: ServerQuestEntry[];
}

export interface ClaimResult {
  ok: true;
  claimed: boolean;
  questId: string;
  xp: number;
  crypt: number;
  utcDay: string;
}

/** The pseudo-quest id for the once-per-UTC-day login bonus (mirrors server). */
export const DAILY_LOGIN_QUEST_ID = "__daily_login__";

async function getJson<T>(path: string): Promise<T | null> {
  if (!isSignedIn()) return null;
  try {
    const res = await fetch(`${SERVER_BASE}${path}`, {
      headers: { accept: "application/json", ...getAuthHeader() },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  if (!isSignedIn()) return null;
  try {
    const res = await fetch(`${SERVER_BASE}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** My authoritative ladder standing, or null when offline/unauthenticated. */
export function fetchMyRanking(): Promise<MyRanking | null> {
  return getJson<MyRanking>("/rankings/me");
}

/** Top-N leaderboard, or null when offline/unauthenticated. */
export function fetchTopRankings(limit = 25): Promise<LeaderboardEntry[] | null> {
  return getJson<LeaderboardEntry[]>(`/rankings/top?limit=${limit}`);
}

/** Today's durable quest state, or null when offline/unauthenticated. */
export function fetchQuestsToday(): Promise<TodayQuests | null> {
  return getJson<TodayQuests>("/quests/today");
}

/**
 * Claim a quest (or the daily-login bonus) on the server. Returns the claim
 * result, or null when offline/unauthenticated. `claimed === false` means the
 * server already recorded this claim for the current UTC day (idempotent).
 */
export function claimServerQuest(questId: string): Promise<ClaimResult | null> {
  return postJson<ClaimResult>("/quests/claim", { questId });
}

// --------------------------------------------------------------------------
// RETENTION LOOP bridge: rank-up ceremony, streak rewards, cosmetic unlocks.
// Same getJson/postJson + isSignedIn-null-fallback pattern as the ladder calls.
// HEX-SAFETY: these grant only a one-shot ceremony flag / game-internal soft
// currency / cosmetic frame flag — nothing here sources or moves real hex.
// --------------------------------------------------------------------------

/** A pending one-shot rank-up the client should ceremony exactly once. */
export interface RankupEvent {
  tier: string;
  rating: number;
}

/** Fetch the caller's pending rank-up, or null if none / offline. */
export function fetchPendingRankup(): Promise<RankupEvent | null> {
  return getJson<RankupEvent>("/rankings/rankup");
}

/** Acknowledge the pending rank-up so the ceremony never replays. */
export async function ackRankup(): Promise<void> {
  await postJson<{ ok: true }>("/rankings/rankup/ack", {});
}

/** A claimable (or shown) streak reward — game-internal soft $CRYPT only. */
export interface StreakReward {
  streak: number;
  amount: number;
  claimable: boolean;
}

/** Fetch the caller's best claimable streak reward, or null if none / offline. */
export function fetchStreakReward(): Promise<StreakReward | null> {
  return getJson<StreakReward>("/rankings/streak");
}

/**
 * Claim the caller's outstanding streak reward. Returns the granted (game-
 * internal soft currency) amount + whether this call performed the claim, or
 * null when offline/unauthenticated. `claimed === false` => nothing pending.
 */
export function claimStreakReward(): Promise<{ claimed: boolean; amount: number } | null> {
  return postJson<{ claimed: boolean; amount: number }>("/rankings/streak/claim", {});
}

/** A cosmetic unlock (e.g. a profile frame) earned by crossing a tier band. */
export interface CosmeticUnlock {
  cosmeticId: string;
  unlockedAt: number;
}

/** Fetch the caller's earned cosmetic unlocks, or null when offline/unauth. */
export function fetchCosmetics(): Promise<CosmeticUnlock[] | null> {
  return getJson<CosmeticUnlock[]>("/cosmetics");
}

// --------------------------------------------------------------------------
// SEASON ("Tier 2: The Season") bridge: current window, season-scoped
// leaderboard, per-tier reward track + claim, and match history. Same
// getJson/postJson + isSignedIn-null-fallback pattern as the ladder calls.
// HEX-SAFETY: rewards are game-internal soft $CRYPT + season-scoped cosmetic
// frame flags only — nothing here sources or moves real on-chain hex.
// --------------------------------------------------------------------------

/** The active season window. */
export interface SeasonInfo {
  id: number;
  label: string;
  startsAt: number;
  endsAt: number;
  status: string;
}

/** Fetch the active season, or null when offline/unauthenticated. */
export function fetchCurrentSeason(): Promise<SeasonInfo | null> {
  return getJson<SeasonInfo>("/seasons/current");
}

/** One season-scoped leaderboard entry. */
export interface SeasonLeaderEntry {
  position: number;
  accountId: string;
  rating: number;
  wins: number;
  losses: number;
  bestStreak: number;
}

/** Fetch the top-N season leaderboard, or null when offline/unauthenticated. */
export async function fetchSeasonLeaderboard(
  limit = 25
): Promise<SeasonLeaderEntry[] | null> {
  const rows = await getJson<
    Array<{
      accountId: string;
      rating: number;
      wins: number;
      losses: number;
      bestStreak: number;
    }>
  >(`/seasons/leaderboard?limit=${limit}`);
  if (!rows) return null;
  // The server returns season-ranked rows; position is the 1-based array index.
  return rows.map((r, i) => ({ position: i + 1, ...r }));
}

/** One tier on the season reward track (reached/claimed for the caller). */
export interface SeasonRewardTier {
  tier: string;
  minRating: number;
  rewardCrypt: number;
  cosmeticId: string | null;
  reached: boolean;
  claimed: boolean;
}

/** Fetch the caller's season reward track, or null when offline/unauth. */
export function fetchSeasonRewards(): Promise<SeasonRewardTier[] | null> {
  return getJson<SeasonRewardTier[]>("/seasons/rewards");
}

/**
 * Claim a season reward tier. Returns the granted (game-internal soft $CRYPT)
 * amount + season cosmetic id + whether this call performed the claim, or null
 * when offline/unauthenticated. `claimed === false` => not reached / already
 * claimed this season (idempotent).
 */
export function claimSeasonReward(
  tier: string
): Promise<{ claimed: boolean; rewardCrypt: number; cosmeticId: string | null } | null> {
  return postJson<{ claimed: boolean; rewardCrypt: number; cosmeticId: string | null }>(
    "/seasons/rewards/claim",
    { tier }
  );
}

/** One past match in the caller's history. game-internal audit data. */
export interface MatchHistoryEntry {
  matchId: string;
  result: string;
  ratingDelta: number;
  createdAt: number;
  opponentId: string;
}

/** Fetch the caller's last-N match results, or null when offline/unauth. */
export async function fetchMatchHistory(limit = 20): Promise<MatchHistoryEntry[] | null> {
  const rows = await getJson<
    Array<{
      matchId: string;
      result: string;
      ratingDelta: number;
      createdAt: number;
      opponentId: string | null;
    }>
  >(`/matches/history?limit=${limit}`);
  if (!rows) return null;
  // Normalise a null opponent (e.g. a solo/forfeit edge) to an empty string so
  // the contract's `opponentId: string` always holds.
  return rows.map((r) => ({ ...r, opponentId: r.opponentId ?? "" }));
}

/**
 * Human-readable ladder rank label derived from authoritative rating. Used to
 * populate UserProfile.rank from the server. Pure presentation — the rating int
 * is the real source of truth.
 */
export function rankLabelForRating(rating: number): string {
  if (rating >= 1600) return "Sovereign";
  if (rating >= 1400) return "Mythic";
  if (rating >= 1200) return "Ascendant";
  if (rating >= 1050) return "Awakened";
  return "Initiate";
}
