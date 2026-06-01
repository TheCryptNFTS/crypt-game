/**
 * SQLite-backed durable persistence for the authoritative server.
 *
 * The durable shape mirrors PERSISTENCE.md exactly:
 *   - a `matches` HEADER table (matchId, seed, seats, bootstrap, createdAt), and
 *   - an APPEND-ONLY `actions` table keyed `(matchId, seq)` with a UNIQUE
 *     constraint on `(matchId, seq)`.
 *
 * Only the seed + append-only action log are authoritative; the live MatchState
 * is always a derivable cache (see matchEngine.replayMatch). This store knows
 * NOTHING about the engine or reducer — it persists and reloads raw rows. The
 * `(matchId, seq)` UNIQUE constraint makes a duplicated append idempotent, so a
 * crash between in-memory append and durable append is safe to retry.
 *
 * Uses `better-sqlite3`: synchronous, zero-config, perfect for an append-only
 * log. The DB path is configurable via `CRYPT_DB_PATH` (default
 * `server/.data/crypt.db`); pass `:memory:` for tests.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Action, AccountId, Seat } from "./types";
import type { MatchBootstrapInput } from "../src/types/matchBootstrap";

/** A persisted match header row (everything needed to construct the initial
 *  state for replay: seed + optional bootstrap). */
export interface PersistedMatchHeader {
  matchId: string;
  seed: number;
  seats: Record<Seat, AccountId>;
  bootstrap?: MatchBootstrapInput;
  createdAt: number;
}

/** A ranking ladder row for an account. Pure game-internal rating — never hex. */
export interface RankingRow {
  accountId: AccountId;
  rating: number;
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  season: number;
}

/**
 * Rating -> tier band table. The SINGLE server-side source of truth for the
 * ladder tier boundaries (the client mirrors these in `rankLabelForRating`).
 * Ordered ASCENDING by `min` so a forward scan finds the highest crossed band.
 * Each tier above Initiate has a `cosmeticId` granted (once) on first crossing
 * — a cosmetic-unlock FLAG only, never real hex.
 */
export interface RankTier {
  tier: string;
  min: number;
  cosmeticId: string | null;
}
export const RANK_TIERS: readonly RankTier[] = [
  { tier: "Initiate", min: 0, cosmeticId: null },
  { tier: "Awakened", min: 1050, cosmeticId: "frame_awakened" },
  { tier: "Ascendant", min: 1200, cosmeticId: "frame_ascendant" },
  { tier: "Mythic", min: 1400, cosmeticId: "frame_mythic" },
  { tier: "Sovereign", min: 1600, cosmeticId: "frame_sovereign" },
] as const;

/** The tier band a rating falls into (highest band whose `min` it meets). */
export function tierForRating(rating: number): RankTier {
  let band = RANK_TIERS[0];
  for (const t of RANK_TIERS) {
    if (rating >= t.min) band = t;
  }
  return band;
}

/**
 * Soft-currency streak rewards at milestones. game-internal $CRYPT ONLY — these
 * mark a CLAIMABLE in-game reward, never real on-chain hex. Escalating.
 */
export const STREAK_MILESTONES: readonly { streak: number; amount: number }[] = [
  { streak: 3, amount: 50 },
  { streak: 5, amount: 100 },
  { streak: 10, amount: 250 },
] as const;

/** The soft-currency reward for hitting EXACTLY this streak, or null if `streak`
 *  is not a milestone. */
export function streakMilestoneReward(streak: number): number | null {
  const m = STREAK_MILESTONES.find((x) => x.streak === streak);
  return m ? m.amount : null;
}

/** A pending rank-up the client should ceremony exactly once. */
export interface PendingRankup {
  tier: string;
  rating: number;
}

// ---------------------------------------------------------------------------
// SEASON ("Tier 2: The Season"). A season is a fixed time window; reaching a
// RANK_TIERS band within a season unlocks a soft-$CRYPT payout AND/OR a
// season-scoped cosmetic frame. All game-internal — nothing here sources hex.
// ---------------------------------------------------------------------------

/** A season row: a labelled, time-boxed competitive window. */
export interface SeasonRow {
  id: number;
  label: string;
  startsAt: number;
  endsAt: number;
  status: string; // 'active' | 'ended'
}

/** Fixed, DETERMINISTIC anchor for Season 1 so migration seeds never depend on
 *  Date.now() (which would make the persistence proof non-deterministic). */
export const SEASON_EPOCH = Date.parse("2026-06-01T00:00:00Z");
/** A season runs 30 days. The rollover creates the next season +30d. */
export const SEASON_LENGTH_MS = 30 * 24 * 60 * 60 * 1000;

/** Themed season labels (Signal Doctrine flavour). Index 0 == Season 1. */
const SEASON_THEMES: readonly string[] = [
  "Fracture",
  "Transmission",
  "Corruption",
  "Synthesis",
  "Growth",
  "Sovereignty",
  "Oracle",
  "Ignition",
  "Machine",
  "Void",
];

/** The themed label for season number `n` (1-based), cycling the doctrines. */
export function seasonLabel(n: number): string {
  const theme = SEASON_THEMES[(n - 1) % SEASON_THEMES.length];
  return `Season ${n} · ${theme}`;
}

/**
 * The season reward TRACK, keyed to the RANK_TIERS bands (REUSED, not a parallel
 * tier system). Reaching a band's `minRating` as your season-high makes that
 * tier's reward claimable ONCE per season. `rewardCrypt` is game-internal soft
 * currency; `cosmeticId` is a season-scoped frame flag. Neither sources hex.
 * Initiate (the baseline band) carries no reward — there is nothing to "reach".
 */
export interface SeasonRewardDef {
  tier: string;
  minRating: number;
  rewardCrypt: number;
  cosmeticId: string | null;
}

/** Build the season reward track for a given season number. Cosmetic ids are
 *  season-scoped (e.g. `s1_frame_ascendant`) so each season's frame is unique. */
export function seasonRewardTrack(seasonId: number): SeasonRewardDef[] {
  const payouts: Record<string, number> = {
    Awakened: 100,
    Ascendant: 250,
    Mythic: 500,
    Sovereign: 1000,
  };
  return RANK_TIERS.filter((t) => t.min > 0).map((t) => ({
    tier: t.tier,
    minRating: t.min,
    rewardCrypt: payouts[t.tier] ?? 0,
    cosmeticId: `s${seasonId}_frame_${t.tier.toLowerCase()}`,
  }));
}

/** A season reward tier as seen by the caller: definition + reached/claimed. */
export interface SeasonRewardTierRow extends SeasonRewardDef {
  reached: boolean;
  claimed: boolean;
}

/** One season-scoped leaderboard entry. */
export interface SeasonLeaderRow {
  accountId: AccountId;
  rating: number;
  wins: number;
  losses: number;
  bestStreak: number;
}

/** A claimable (or already-claimed) streak reward for an account. */
export interface StreakRewardRow {
  streak: number;
  amount: number;
  claimable: boolean;
}

/** A granted cosmetic unlock (game-internal flag — never hex). */
export interface CosmeticUnlockRow {
  cosmeticId: string;
  unlockedAt: number;
}

/** One past match result for the caller's history view. game-internal. */
export interface MatchHistoryRow {
  matchId: string;
  result: string; // 'win' | 'loss'
  ratingDelta: number;
  createdAt: number;
  opponentId: string | null;
}

/** A persisted append-only action row. Shape mirrors ActionLogEntry minus the
 *  derivable index identity; `seq` is the dense 0-based position. */
export interface PersistedAction {
  seq: number;
  action: Action;
  by: AccountId;
  receivedAt: number;
}

/** Resolve the DB path: explicit arg > env var > default file. `:memory:` is
 *  passed straight through to better-sqlite3 for ephemeral test stores. */
export function resolveDbPath(explicit?: string): string {
  return explicit ?? process.env.CRYPT_DB_PATH ?? "server/.data/crypt.db";
}

/**
 * The durable store. Owns one SQLite connection and the prepared statements for
 * the two tables. All methods are synchronous (better-sqlite3 semantics).
 */
export class PersistenceStore {
  private readonly db: Database.Database;

  constructor(dbPath: string = resolveDbPath()) {
    if (dbPath !== ":memory:") {
      // Ensure the parent directory exists for a file-backed DB.
      const dir = path.dirname(dbPath);
      if (dir && dir !== "." && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new Database(dbPath);
    // Durability + sane concurrency for an append-only workload.
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS matches (
        matchId   TEXT PRIMARY KEY,
        seed      INTEGER NOT NULL,
        seats     TEXT NOT NULL,      -- JSON { P1, P2 }
        bootstrap TEXT,               -- JSON MatchBootstrapInput | NULL
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS actions (
        matchId    TEXT NOT NULL,
        seq        INTEGER NOT NULL,
        action     TEXT NOT NULL,     -- JSON Action
        by         TEXT NOT NULL,     -- submitting AccountId
        receivedAt INTEGER NOT NULL,
        UNIQUE (matchId, seq),
        FOREIGN KEY (matchId) REFERENCES matches(matchId)
      );

      CREATE INDEX IF NOT EXISTS idx_actions_match_seq
        ON actions (matchId, seq);

      -- ---------------------------------------------------------------------
      -- RETENTION LEDGER (server-authoritative ranked ladder + daily quests).
      --
      -- HARD INVARIANT: nothing here ever SOURCES real on-chain hex. These tables
      -- track game-internal rating / XP / quest claims ONLY. No column or query
      -- credits a wallet with real hex — see questClaims (game-internal reward
      -- bookkeeping) and rankings (rating, never currency).
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS accounts (
        accountId  TEXT PRIMARY KEY,
        createdAt  INTEGER NOT NULL,
        lastSeen   INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rankings (
        accountId      TEXT PRIMARY KEY,
        rating         INTEGER NOT NULL DEFAULT 1000,
        wins           INTEGER NOT NULL DEFAULT 0,
        losses         INTEGER NOT NULL DEFAULT 0,
        currentStreak  INTEGER NOT NULL DEFAULT 0,
        bestStreak     INTEGER NOT NULL DEFAULT 0,
        season         INTEGER NOT NULL DEFAULT 1,
        updatedAt      INTEGER NOT NULL,
        FOREIGN KEY (accountId) REFERENCES accounts(accountId)
      );

      -- Pending one-shot rank-up ceremony state, parked on the rankings row.
      -- Set when a win crosses UP into a higher tier band; cleared on ack. The
      -- tier name + the rating that triggered it are enough for the client to
      -- play the ceremony exactly once. game-internal — never hex.
      CREATE TABLE IF NOT EXISTS last_rankup (
        accountId  TEXT PRIMARY KEY,
        tier       TEXT NOT NULL,
        rating     INTEGER NOT NULL,
        createdAt  INTEGER NOT NULL,
        FOREIGN KEY (accountId) REFERENCES accounts(accountId)
      );

      -- One row per (account, streak-milestone). The UNIQUE key makes a grant
      -- un-double-able: a second win that re-hits the same milestone is an
      -- INSERT OR IGNORE no-op. claimedAt NULL => claimable, set => claimed.
      -- amount is game-internal soft $CRYPT ONLY (never real hex).
      CREATE TABLE IF NOT EXISTS streak_claims (
        accountId  TEXT NOT NULL,
        streak     INTEGER NOT NULL,
        amount     INTEGER NOT NULL,    -- game-internal soft currency (never hex)
        markedAt   INTEGER NOT NULL,
        claimedAt  INTEGER,             -- NULL until the player claims it
        UNIQUE (accountId, streak)
      );

      -- Cosmetic unlocks granted on first crossing of a tier boundary. The
      -- UNIQUE key makes the grant idempotent. A cosmetic is a COSMETIC FLAG
      -- ONLY (e.g. a profile frame) — it sources no hex and moves no hex.
      CREATE TABLE IF NOT EXISTS cosmetic_unlocks (
        accountId   TEXT NOT NULL,
        cosmeticId  TEXT NOT NULL,
        unlockedAt  INTEGER NOT NULL,
        UNIQUE (accountId, cosmeticId)
      );

      CREATE TABLE IF NOT EXISTS match_results (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        matchId      TEXT NOT NULL,
        accountId    TEXT NOT NULL,
        opponentId   TEXT,
        result       TEXT NOT NULL,     -- 'win' | 'loss'
        ratingDelta  INTEGER NOT NULL,
        createdAt    INTEGER NOT NULL
      );

      -- One row per (account, quest, UTC-day). The UNIQUE key is what makes a
      -- claim un-forgeable by clearing localStorage: a second claim on the same
      -- UTC day is an INSERT OR IGNORE no-op. dailyLogin is modelled as the
      -- pseudo-quest id '__daily_login__'.
      CREATE TABLE IF NOT EXISTS quest_claims (
        accountId  TEXT NOT NULL,
        questId    TEXT NOT NULL,
        utcDay     TEXT NOT NULL,       -- 'YYYY-MM-DD' (UTC)
        xp         INTEGER NOT NULL,    -- game-internal XP granted (never hex)
        crypt      INTEGER NOT NULL,    -- game-internal soft currency (never hex)
        claimedAt  INTEGER NOT NULL,
        UNIQUE (accountId, questId, utcDay)
      );

      -- ---------------------------------------------------------------------
      -- SEASON lifecycle. A season is a fixed time window; players carry a
      -- soft-decayed rating across rollovers and can claim per-tier rewards
      -- once per season. HEX-SAFE: rewards are soft $CRYPT / cosmetic flags only.
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS seasons (
        id        INTEGER PRIMARY KEY,
        label     TEXT NOT NULL,
        startsAt  INTEGER NOT NULL,
        endsAt    INTEGER NOT NULL,
        status    TEXT NOT NULL          -- 'active' | 'ended'
      );

      -- One row per (account, season, tier). The UNIQUE key makes a season
      -- reward claim un-double-able. rewardCrypt is game-internal soft currency
      -- (never hex); cosmeticId is a season-scoped frame flag (never hex).
      CREATE TABLE IF NOT EXISTS season_reward_claims (
        accountId    TEXT NOT NULL,
        season       INTEGER NOT NULL,
        tier         TEXT NOT NULL,
        rewardCrypt  INTEGER NOT NULL,
        cosmeticId   TEXT,
        claimedAt    INTEGER NOT NULL,
        UNIQUE (accountId, season, tier)
      );

      CREATE INDEX IF NOT EXISTS idx_season_reward_claims_account
        ON season_reward_claims (accountId, season);

      CREATE INDEX IF NOT EXISTS idx_match_results_account
        ON match_results (accountId, createdAt);
      CREATE INDEX IF NOT EXISTS idx_quest_claims_account_day
        ON quest_claims (accountId, utcDay);
      CREATE INDEX IF NOT EXISTS idx_streak_claims_account
        ON streak_claims (accountId, streak);
      CREATE INDEX IF NOT EXISTS idx_cosmetic_unlocks_account
        ON cosmetic_unlocks (accountId);
    `);

    // Seed Season 1 idempotently with a FIXED (deterministic) window anchored on
    // SEASON_EPOCH — never Date.now(), so the persistence proof stays byte-stable.
    this.db
      .prepare(
        `INSERT OR IGNORE INTO seasons (id, label, startsAt, endsAt, status)
         VALUES (1, @label, @startsAt, @endsAt, 'active')`
      )
      .run({
        label: seasonLabel(1),
        startsAt: SEASON_EPOCH,
        endsAt: SEASON_EPOCH + SEASON_LENGTH_MS,
      });
  }

  // -----------------------------------------------------------------------
  // RETENTION LEDGER queries. Inline-prepared in the existing style of this
  // store (no repo/ORM layer). All synchronous (better-sqlite3).
  //
  // HEX-SAFETY: these methods read/write game-internal rating + XP + soft
  // currency ONLY. There is deliberately NO method that mints/transfers real
  // hex; the server is a hex SINK at most, never a source.
  // -----------------------------------------------------------------------

  /** Upsert an account's existence + bump lastSeen. Idempotent. Also ensures a
   *  rankings row exists at the default rating so reads never 404 an account. */
  touchAccount(accountId: AccountId, now: number = Date.now()): void {
    this.db
      .prepare(
        `INSERT INTO accounts (accountId, createdAt, lastSeen)
         VALUES (@accountId, @now, @now)
         ON CONFLICT(accountId) DO UPDATE SET lastSeen = @now`
      )
      .run({ accountId, now });
    this.db
      .prepare(
        `INSERT OR IGNORE INTO rankings (accountId, updatedAt)
         VALUES (@accountId, @now)`
      )
      .run({ accountId, now });
  }

  /** Read an account's ranking row (creating defaults if absent). */
  getRanking(accountId: AccountId, now: number = Date.now()): RankingRow {
    this.touchAccount(accountId, now);
    const row = this.db
      .prepare(
        `SELECT accountId, rating, wins, losses, currentStreak, bestStreak, season
         FROM rankings WHERE accountId = ?`
      )
      .get(accountId) as RankingRow;
    return row;
  }

  /**
   * Record ONE match outcome for ONE account and fold it into their ranking.
   * `result` is server-computed; `ratingDelta` is the server-computed Elo-ish
   * delta. This both appends an immutable match_results row AND updates the
   * rolling rankings aggregate (wins/losses/streaks/rating). game-internal only.
   */
  recordMatchResult(input: {
    matchId: string;
    accountId: AccountId;
    opponentId: AccountId | null;
    result: "win" | "loss";
    ratingDelta: number;
    now?: number;
  }): void {
    const now = input.now ?? Date.now();
    this.touchAccount(input.accountId, now);
    // Lazily roll the season over if its window has elapsed before stamping.
    this.rolloverSeasonIfDue(now);
    const seasonId = this.currentSeason(now).id;
    this.db
      .prepare(
        `INSERT INTO match_results (matchId, accountId, opponentId, result, ratingDelta, createdAt)
         VALUES (@matchId, @accountId, @opponentId, @result, @ratingDelta, @now)`
      )
      .run({
        matchId: input.matchId,
        accountId: input.accountId,
        opponentId: input.opponentId,
        result: input.result,
        ratingDelta: input.ratingDelta,
        now,
      });
    const cur = this.getRanking(input.accountId, now);
    const won = input.result === "win";
    const nextStreak = won ? cur.currentStreak + 1 : 0;
    const nextBest = Math.max(cur.bestStreak, nextStreak);
    // Rating floor at 0 so a long loss streak can never go negative.
    const nextRating = Math.max(0, cur.rating + input.ratingDelta);
    this.db
      .prepare(
        `UPDATE rankings SET
           rating = @rating,
           wins = wins + @winInc,
           losses = losses + @lossInc,
           currentStreak = @streak,
           bestStreak = @best,
           season = @season,
           updatedAt = @now
         WHERE accountId = @accountId`
      )
      .run({
        accountId: input.accountId,
        rating: nextRating,
        winInc: won ? 1 : 0,
        lossInc: won ? 0 : 1,
        streak: nextStreak,
        best: nextBest,
        season: seasonId,
        now,
      });

    // --- Retention side-effects (game-internal ONLY; nothing here sources hex) -
    if (won) {
      // 1. Rank-up + cosmetic unlock: did this win cross UP into a higher tier?
      const fromTier = tierForRating(cur.rating);
      const toTier = tierForRating(nextRating);
      if (toTier.min > fromTier.min) {
        // Park a one-shot rank-up ceremony (latest crossing wins until ack'd).
        this.db
          .prepare(
            `INSERT INTO last_rankup (accountId, tier, rating, createdAt)
             VALUES (@accountId, @tier, @rating, @now)
             ON CONFLICT(accountId) DO UPDATE SET
               tier = @tier, rating = @rating, createdAt = @now`
          )
          .run({ accountId: input.accountId, tier: toTier.tier, rating: nextRating, now });
        // Grant the cosmetic for the new tier (and any skipped intermediate
        // tiers on a big jump). Idempotent via the UNIQUE (account, cosmetic).
        for (const t of RANK_TIERS) {
          if (t.cosmeticId && t.min > fromTier.min && t.min <= toTier.min) {
            this.db
              .prepare(
                `INSERT OR IGNORE INTO cosmetic_unlocks (accountId, cosmeticId, unlockedAt)
                 VALUES (@accountId, @cosmeticId, @now)`
              )
              .run({ accountId: input.accountId, cosmeticId: t.cosmeticId, now });
          }
        }
      }
      // 2. Streak milestone: mark a claimable soft-currency reward if this win
      //    pushed the streak onto a milestone. UNIQUE (account, streak) prevents
      //    a double-grant if the same streak count is somehow re-reached.
      const amount = streakMilestoneReward(nextStreak);
      if (amount !== null) {
        this.db
          .prepare(
            `INSERT OR IGNORE INTO streak_claims (accountId, streak, amount, markedAt)
             VALUES (@accountId, @streak, @amount, @now)`
          )
          .run({ accountId: input.accountId, streak: nextStreak, amount, now });
      }
    }
  }

  // -----------------------------------------------------------------------
  // RETENTION-LOOP reads + claims (rank-up ceremony, streak rewards, cosmetics).
  // HEX-SAFETY: all game-internal flags / soft currency. No hex path exists.
  // -----------------------------------------------------------------------

  /** The account's pending one-shot rank-up, or null if none is outstanding. */
  pendingRankup(accountId: AccountId): PendingRankup | null {
    const row = this.db
      .prepare(`SELECT tier, rating FROM last_rankup WHERE accountId = ?`)
      .get(accountId) as PendingRankup | undefined;
    return row ?? null;
  }

  /** Acknowledge (consume) the pending rank-up so the ceremony plays once. */
  ackRankup(accountId: AccountId): void {
    this.db.prepare(`DELETE FROM last_rankup WHERE accountId = ?`).run(accountId);
  }

  /** The account's best OUTSTANDING (highest, unclaimed) streak reward, or null.
   *  The client shows + claims one at a time; the highest unclaimed wins. */
  pendingStreakReward(accountId: AccountId): StreakRewardRow | null {
    const row = this.db
      .prepare(
        `SELECT streak, amount FROM streak_claims
         WHERE accountId = ? AND claimedAt IS NULL
         ORDER BY streak DESC LIMIT 1`
      )
      .get(accountId) as { streak: number; amount: number } | undefined;
    if (!row) return null;
    return { streak: row.streak, amount: row.amount, claimable: true };
  }

  /**
   * Atomically claim the highest outstanding streak reward. Returns the granted
   * (game-internal soft currency) amount + true if THIS call claimed it, or
   * { claimed:false, amount:0 } if there was nothing to claim. Idempotent: a
   * second call finds no unclaimed row.
   */
  claimStreakReward(
    accountId: AccountId,
    now: number = Date.now()
  ): { claimed: boolean; amount: number } {
    this.touchAccount(accountId, now);
    const pending = this.pendingStreakReward(accountId);
    if (!pending) return { claimed: false, amount: 0 };
    const info = this.db
      .prepare(
        `UPDATE streak_claims SET claimedAt = @now
         WHERE accountId = @accountId AND streak = @streak AND claimedAt IS NULL`
      )
      .run({ accountId, streak: pending.streak, now });
    if (info.changes === 0) return { claimed: false, amount: 0 };
    return { claimed: true, amount: pending.amount };
  }

  /** All cosmetic unlocks an account has earned (newest first). */
  cosmeticUnlocks(accountId: AccountId): CosmeticUnlockRow[] {
    return this.db
      .prepare(
        `SELECT cosmeticId, unlockedAt FROM cosmetic_unlocks
         WHERE accountId = ? ORDER BY unlockedAt DESC, cosmeticId ASC`
      )
      .all(accountId) as CosmeticUnlockRow[];
  }

  /** True if this account already recorded a result for this matchId (so we
   *  never double-count a match on a retry/forfeit-after-win race). */
  hasMatchResult(matchId: string, accountId: AccountId): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM match_results WHERE matchId = ? AND accountId = ? LIMIT 1`
      )
      .get(matchId, accountId);
    return row !== undefined;
  }

  /** Top-N leaderboard by rating (desc), then fewer losses, then alpha. */
  topRankings(limit: number): RankingRow[] {
    return this.db
      .prepare(
        `SELECT accountId, rating, wins, losses, currentStreak, bestStreak, season
         FROM rankings
         ORDER BY rating DESC, losses ASC, accountId ASC
         LIMIT ?`
      )
      .all(limit) as RankingRow[];
  }

  // -----------------------------------------------------------------------
  // SEASON lifecycle + reward track + season-scoped leaderboard.
  // HEX-SAFETY: rollover only adjusts the rating int (no currency); rewards are
  // soft $CRYPT + cosmetic flags. No method here mints or moves real hex.
  // -----------------------------------------------------------------------

  /** The currently-active season row. Rolls over lazily if the window elapsed,
   *  so this is always the season `now` falls within. */
  currentSeason(now: number = Date.now()): SeasonRow {
    this.rolloverSeasonIfDue(now);
    const row = this.db
      .prepare(
        `SELECT id, label, startsAt, endsAt, status FROM seasons
         WHERE status = 'active' ORDER BY id DESC LIMIT 1`
      )
      .get() as SeasonRow | undefined;
    // Defensive: the migration always seeds Season 1, so this should never be
    // null — but never crash a read if the row is somehow missing.
    if (row) return row;
    return {
      id: 1,
      label: seasonLabel(1),
      startsAt: SEASON_EPOCH,
      endsAt: SEASON_EPOCH + SEASON_LENGTH_MS,
      status: "active",
    };
  }

  /**
   * Lazy season ROLLOVER (check-on-read; no timers). If the active season's
   * `endsAt` has passed at `now`, mark it 'ended', create the next season
   * (+30d), and apply SOFT rating decay to compress everyone toward baseline:
   *   new = floor(1000 + (rating - 1000) * 0.5), floored at 1000.
   * Decay grants NO currency — it only adjusts the rating int (hex-safe). Loops
   * so a long gap (multiple elapsed windows) catches up in one call. Idempotent
   * and safe to call on every request.
   */
  rolloverSeasonIfDue(now: number = Date.now()): void {
    // Loop in case more than one full window has elapsed since the last call.
    for (let guard = 0; guard < 1000; guard++) {
      const active = this.db
        .prepare(
          `SELECT id, label, startsAt, endsAt, status FROM seasons
           WHERE status = 'active' ORDER BY id DESC LIMIT 1`
        )
        .get() as SeasonRow | undefined;
      if (!active || now < active.endsAt) return; // nothing due
      const nextId = active.id + 1;
      const nextStarts = active.endsAt;
      const nextEnds = nextStarts + SEASON_LENGTH_MS;
      // Atomic rollover: end the old, create the new, decay all ratings, and
      // restamp every ranking row onto the new season.
      const tx = this.db.transaction(() => {
        this.db
          .prepare(`UPDATE seasons SET status = 'ended' WHERE id = @id`)
          .run({ id: active.id });
        this.db
          .prepare(
            `INSERT OR IGNORE INTO seasons (id, label, startsAt, endsAt, status)
             VALUES (@id, @label, @startsAt, @endsAt, 'active')`
          )
          .run({ id: nextId, label: seasonLabel(nextId), startsAt: nextStarts, endsAt: nextEnds });
        // SOFT decay toward 1000 baseline (never below). Pure rating math.
        this.db
          .prepare(
            `UPDATE rankings SET
               rating = MAX(1000, CAST(1000 + (rating - 1000) * 0.5 AS INTEGER)),
               season = @season,
               updatedAt = @now`
          )
          .run({ season: nextId, now });
      });
      tx();
    }
  }

  /** Top-N rankings WITHIN the active season (season-scoped leaderboard). */
  seasonTopRankings(limit: number, now: number = Date.now()): SeasonLeaderRow[] {
    const seasonId = this.currentSeason(now).id;
    return this.db
      .prepare(
        `SELECT accountId, rating, wins, losses, bestStreak
         FROM rankings
         WHERE season = ?
         ORDER BY rating DESC, losses ASC, accountId ASC
         LIMIT ?`
      )
      .all(seasonId, limit) as SeasonLeaderRow[];
  }

  /**
   * The caller's season reward track: every reward tier with whether they've
   * REACHED it (current season rating >= band, OR already claimed) and whether
   * they've CLAIMED it this season. Reusing RANK_TIERS bands — no parallel tier
   * system. game-internal: soft $CRYPT + season-scoped cosmetic flags only.
   */
  seasonRewards(accountId: AccountId, now: number = Date.now()): SeasonRewardTierRow[] {
    const seasonId = this.currentSeason(now).id;
    const ranking = this.getRanking(accountId, now);
    const claimed = new Set(
      (
        this.db
          .prepare(
            `SELECT tier FROM season_reward_claims WHERE accountId = ? AND season = ?`
          )
          .all(accountId, seasonId) as Array<{ tier: string }>
      ).map((r) => r.tier)
    );
    return seasonRewardTrack(seasonId).map((def) => ({
      ...def,
      reached: ranking.rating >= def.minRating || claimed.has(def.tier),
      claimed: claimed.has(def.tier),
    }));
  }

  /**
   * Claim ONE season reward tier for the caller. Allowed only if the tier is
   * REACHED (current season rating >= band) and not yet claimed this season.
   * Idempotent via UNIQUE (accountId, season, tier). On a fresh claim, also
   * grants the season-scoped cosmetic flag. Returns the granted soft $CRYPT +
   * cosmeticId, or { claimed:false } when not reachable / already claimed.
   *
   * HEX-SAFETY: rewardCrypt is game-internal soft currency; cosmeticId is a
   * frame flag. No real hex is sourced or moved.
   */
  claimSeasonReward(
    accountId: AccountId,
    tier: string,
    now: number = Date.now()
  ): { claimed: boolean; rewardCrypt: number; cosmeticId: string | null } {
    this.touchAccount(accountId, now);
    const seasonId = this.currentSeason(now).id;
    const def = seasonRewardTrack(seasonId).find((d) => d.tier === tier);
    if (!def) return { claimed: false, rewardCrypt: 0, cosmeticId: null };
    const ranking = this.getRanking(accountId, now);
    // Gate on REACHED — a player can't claim a band they haven't hit this season.
    if (ranking.rating < def.minRating) {
      return { claimed: false, rewardCrypt: 0, cosmeticId: null };
    }
    const info = this.db
      .prepare(
        `INSERT OR IGNORE INTO season_reward_claims
           (accountId, season, tier, rewardCrypt, cosmeticId, claimedAt)
         VALUES (@accountId, @season, @tier, @rewardCrypt, @cosmeticId, @now)`
      )
      .run({
        accountId,
        season: seasonId,
        tier: def.tier,
        rewardCrypt: def.rewardCrypt,
        cosmeticId: def.cosmeticId,
        now,
      });
    if (info.changes === 0) {
      // Already claimed this season (idempotent no-op).
      return { claimed: false, rewardCrypt: 0, cosmeticId: null };
    }
    // Grant the season-scoped cosmetic frame flag (idempotent). Never hex.
    if (def.cosmeticId) {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO cosmetic_unlocks (accountId, cosmeticId, unlockedAt)
           VALUES (@accountId, @cosmeticId, @now)`
        )
        .run({ accountId, cosmeticId: def.cosmeticId, now });
    }
    return { claimed: true, rewardCrypt: def.rewardCrypt, cosmeticId: def.cosmeticId };
  }

  /** The caller's last-N match results (newest first). Audit/history read; the
   *  rows already exist (written by recordMatchResult). game-internal only. */
  matchHistory(accountId: AccountId, limit: number): MatchHistoryRow[] {
    return this.db
      .prepare(
        `SELECT matchId, result, ratingDelta, createdAt, opponentId
         FROM match_results
         WHERE accountId = ?
         ORDER BY createdAt DESC, id DESC
         LIMIT ?`
      )
      .all(accountId, limit) as MatchHistoryRow[];
  }

  /** Dense 1-based rank of an account on the rating ladder (1 = top). */
  rankPosition(accountId: AccountId): number {
    const me = this.db
      .prepare(`SELECT rating FROM rankings WHERE accountId = ?`)
      .get(accountId) as { rating: number } | undefined;
    if (!me) return 0;
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS ahead FROM rankings WHERE rating > ?`
      )
      .get(me.rating) as { ahead: number };
    return row.ahead + 1;
  }

  /**
   * Atomically claim a quest for an account on a UTC day. Returns true if this
   * call performed the claim (first time today), false if it was already claimed
   * (the UNIQUE (accountId, questId, utcDay) made it a no-op). The XP/crypt are
   * game-internal reward bookkeeping ONLY — never real hex.
   */
  claimQuest(input: {
    accountId: AccountId;
    questId: string;
    utcDay: string;
    xp: number;
    crypt: number;
    now?: number;
  }): boolean {
    const now = input.now ?? Date.now();
    this.touchAccount(input.accountId, now);
    const info = this.db
      .prepare(
        `INSERT OR IGNORE INTO quest_claims (accountId, questId, utcDay, xp, crypt, claimedAt)
         VALUES (@accountId, @questId, @utcDay, @xp, @crypt, @now)`
      )
      .run({
        accountId: input.accountId,
        questId: input.questId,
        utcDay: input.utcDay,
        xp: input.xp,
        crypt: input.crypt,
        now,
      });
    return info.changes > 0;
  }

  /** The set of questIds this account has already claimed on `utcDay`. */
  claimedQuestIds(accountId: AccountId, utcDay: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT questId FROM quest_claims WHERE accountId = ? AND utcDay = ?`
      )
      .all(accountId, utcDay) as Array<{ questId: string }>;
    return rows.map((r) => r.questId);
  }

  /** Insert a match header. Idempotent: re-inserting the same matchId is a
   *  no-op (INSERT OR IGNORE) so bootstrap/restart double-calls are safe. */
  insertMatchHeader(header: PersistedMatchHeader): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO matches (matchId, seed, seats, bootstrap, createdAt)
         VALUES (@matchId, @seed, @seats, @bootstrap, @createdAt)`
      )
      .run({
        matchId: header.matchId,
        seed: header.seed,
        seats: JSON.stringify(header.seats),
        bootstrap: header.bootstrap ? JSON.stringify(header.bootstrap) : null,
        createdAt: header.createdAt,
      });
  }

  /**
   * Durably append ONE accepted action. The `(matchId, seq)` UNIQUE constraint
   * makes this idempotent — a duplicated append (e.g. a retry after a crash
   * between in-memory and durable append) is silently ignored, never doubled.
   */
  appendAction(matchId: string, entry: PersistedAction): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO actions (matchId, seq, action, by, receivedAt)
         VALUES (@matchId, @seq, @action, @by, @receivedAt)`
      )
      .run({
        matchId,
        seq: entry.seq,
        action: JSON.stringify(entry.action),
        by: entry.by,
        receivedAt: entry.receivedAt,
      });
  }

  /** Load every match header. Used by MatchRegistry.bootstrap() on startup. */
  loadAllHeaders(): PersistedMatchHeader[] {
    const rows = this.db
      .prepare(`SELECT matchId, seed, seats, bootstrap, createdAt FROM matches`)
      .all() as Array<{
      matchId: string;
      seed: number;
      seats: string;
      bootstrap: string | null;
      createdAt: number;
    }>;
    return rows.map((r) => ({
      matchId: r.matchId,
      seed: r.seed,
      seats: JSON.parse(r.seats) as Record<Seat, AccountId>,
      bootstrap: r.bootstrap
        ? (JSON.parse(r.bootstrap) as MatchBootstrapInput)
        : undefined,
      createdAt: r.createdAt,
    }));
  }

  /** Load a single match's full append-only action log in strict seq order. */
  loadActions(matchId: string): PersistedAction[] {
    const rows = this.db
      .prepare(
        `SELECT seq, action, by, receivedAt FROM actions
         WHERE matchId = ? ORDER BY seq ASC`
      )
      .all(matchId) as Array<{
      seq: number;
      action: string;
      by: string;
      receivedAt: number;
    }>;
    return rows.map((r) => ({
      seq: r.seq,
      action: JSON.parse(r.action) as Action,
      by: r.by,
      receivedAt: r.receivedAt,
    }));
  }

  close(): void {
    this.db.close();
  }
}
