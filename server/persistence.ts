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
    `);
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
