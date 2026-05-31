/**
 * AuthoritativeMatch — the server-side wrapper around the pure engine reducer.
 *
 * THE determinism contract (why this whole server exists):
 *   live MatchState === replay(seed, actionLog)   ... byte-for-byte, always.
 *
 * The server NEVER trusts a client-sent state. A client may only submit an
 * `Action` (an intent). The server folds that action through the pure
 * `applyAction` reducer, and — only if the reducer actually advanced state —
 * APPENDS `{seq, action}` to an immutable log alongside the match seed. Because
 * the engine is pure and seeded (no Date/Math.random; all RNG rebuilt from
 * `state.seed` + `state.rngCursor`), `(seed, actionLog)` fully determines the
 * live state, which is what makes reconnection-by-replay and replay-based
 * anti-cheat possible.
 *
 * This module imports the engine READ-ONLY and adds NO rules of its own.
 */

import { applyAction } from "../src/engine/reducer";
import { createMatch } from "../src/engine/setup";
import { createMatchFromDecks } from "../src/engine/createMatchFromDecks";
import type { MatchBootstrapInput } from "../src/types/matchBootstrap";
import { PersistenceStore } from "./persistence";
import { projectViewForSeat, type MatchView } from "./view";
import type {
  Action,
  GameEvent,
  MatchState,
  MatchRecord,
  ActionLogEntry,
  AccountId,
  Seat,
  SubmitResult,
} from "./types";

/**
 * One committed step's broadcast payload, indexed by `version`. `version` is the
 * 1-based monotonic counter incremented per ACCEPTED action (== seq+1 of the
 * entry that produced it), so `committedEvents[i]` carries the events emitted at
 * version `i+1`. Used to answer `GET .../state?since=N` with only the events a
 * client hasn't seen. Reconstructed from the durable log on rehydrate, so it
 * survives a restart exactly like the action log it derives from.
 */
export interface CommittedStep {
  version: number;
  events: GameEvent[];
}

/**
 * A stable, order-sensitive structural hash of a MatchState. We use
 * `JSON.stringify` of the canonical state object: the engine guarantees the
 * state is structuredClone-stable and never depends on Map/Set iteration order,
 * so two byte-identical states stringify identically. Cheap enough for a
 * scaffold; a production server would swap in a streaming SHA-256 over a
 * canonical encoding. Equality of this hash === byte-identical state.
 */
export function hashState(state: MatchState): string {
  return JSON.stringify(state);
}

/** Build the initial authoritative state for a seed. Kept as the SINGLE place
 *  the server constructs an initial state, so live-creation and replay share
 *  exactly one constructor (any drift here would break the replay invariant). */
function buildInitialState(
  seed: number,
  bootstrap?: MatchBootstrapInput
): MatchState {
  if (bootstrap) {
    // Force the caller's seed onto the bootstrap so live + replay agree.
    return createMatchFromDecks({ ...bootstrap, seed }) as MatchState;
  }
  return createMatch(seed);
}

/**
 * Replay a match purely from its durable record `{seed, actionLog}` by folding
 * `applyAction` over the logged actions in `seq` order. This is THE proof that
 * the server is authoritative-by-derivation: it takes NO live state as input.
 *
 * Used for (a) reconnection (rebuild a dropped observer's view) and (b)
 * anti-cheat audit (recompute a match from scratch and compare).
 */
export function replayMatch(
  record: Pick<MatchRecord, "seed" | "actionLog">,
  bootstrap?: MatchBootstrapInput
): MatchState {
  let state = buildInitialState(record.seed, bootstrap);
  // Defensive: fold in strict seq order regardless of array order on disk.
  const ordered = [...record.actionLog].sort((a, b) => a.seq - b.seq);
  for (const entry of ordered) {
    state = applyAction(state, entry.action).state;
  }
  return state;
}

/**
 * The authoritative in-memory match. One instance per live match. Holds the
 * canonical state CACHE plus the durable record (seed + append-only log). The
 * cache is always reconstructible via `replayMatch(this.record)`.
 */
export class AuthoritativeMatch {
  readonly record: MatchRecord;
  private state: MatchState;
  private readonly bootstrap?: MatchBootstrapInput;
  /** Optional durable backing. When set, every ACCEPTED action is appended to
   *  the store AFTER the in-memory append. Undefined => pure in-memory match. */
  private readonly store?: PersistenceStore;
  /**
   * Per-accepted-action broadcast events, indexed so `committedSteps[i]` is the
   * step at `version === i+1`. Rebuilt on rehydrate by re-folding the durable
   * log, so it is consistent across restarts. NOT itself persisted — it is a
   * derivable cache of the events the reducer emitted for each logged action.
   */
  private readonly committedSteps: CommittedStep[] = [];

  constructor(
    matchId: string,
    seed: number,
    seats: Record<Seat, AccountId>,
    bootstrap?: MatchBootstrapInput,
    store?: PersistenceStore
  ) {
    this.bootstrap = bootstrap;
    this.store = store;
    this.state = buildInitialState(seed, bootstrap);
    this.record = {
      matchId,
      seed,
      seats,
      actionLog: [],
      createdAt: Date.now(),
    };
    // Persist the immutable header once at creation. Idempotent in the store.
    this.store?.insertMatchHeader({
      matchId,
      seed,
      seats,
      bootstrap,
      createdAt: this.record.createdAt,
    });
  }

  /**
   * Rebuild a live match from its DURABLE record on startup (restart recovery).
   * This is NOT the live-play path: it replays the already-persisted action log
   * through the same reducer and does NOT re-persist anything (the rows already
   * exist on disk). The resulting match is byte-identical to the one that
   * produced the log, by the engine's determinism contract.
   */
  static rehydrate(
    header: {
      matchId: string;
      seed: number;
      seats: Record<Seat, AccountId>;
      bootstrap?: MatchBootstrapInput;
      createdAt: number;
    },
    persistedLog: ActionLogEntry[],
    store?: PersistenceStore
  ): AuthoritativeMatch {
    const m = new AuthoritativeMatch(
      header.matchId,
      header.seed,
      header.seats,
      header.bootstrap,
      store
    );
    // Preserve the original creation timestamp (audit metadata, excluded from
    // determinism — but we keep it stable across restarts anyway).
    m.record.createdAt = header.createdAt;
    // Fold the persisted log in strict seq order, replacing the live cache and
    // rebuilding the derivable per-step event cache so `?since=N` works after a
    // restart exactly as it did live.
    const ordered = [...persistedLog].sort((a, b) => a.seq - b.seq);
    for (const entry of ordered) {
      const { state: nextState, events } = applyAction(m.state, entry.action);
      m.state = nextState;
      m.record.actionLog.push(entry);
      m.committedSteps.push({ version: entry.seq + 1, events });
    }
    return m;
  }

  /** Read-only snapshot of the live authoritative state (defensive clone). */
  getState(): MatchState {
    return structuredClone(this.state);
  }

  get seq(): number {
    return this.record.actionLog.length;
  }

  /**
   * Monotonically increasing match version: incremented once per ACCEPTED
   * action. Defined as `seq` (== number of committed actions). It survives a
   * restart because the durable action log it counts is replayed on rehydrate,
   * so a recovered match resumes at exactly the version it had before the crash.
   */
  get version(): number {
    return this.seq;
  }

  /**
   * THE outbound projection. Returns the REDACTED, per-seat `MatchView` of the
   * current authoritative state: the requesting seat sees its own hand; the
   * opponent's hand is count-only; neither deck's ORDER is revealed. This is a
   * pure view transform over the complete authoritative state — it does NOT
   * mutate or weaken the state the reducer folds/persists (determinism intact).
   */
  getViewForSeat(seat: Seat): MatchView {
    return projectViewForSeat(this.record.matchId, this.state, seat);
  }

  /**
   * Incremental update: everything a client at `since` needs to catch up.
   * Returns the current `version`, the redacted view for `seat`, and the events
   * committed strictly AFTER `since` (in version order). `stale` is true when the
   * client is already current (`since >= version`) — the client can skip
   * re-rendering. The view is always the LATEST (clients adopt full truth on
   * adoption); the event delta is for the combat log / animations only.
   */
  getIncrementalForSeat(
    seat: Seat,
    since: number
  ): { version: number; view: MatchView; events: GameEvent[]; stale: boolean } {
    const version = this.version;
    const stale = since >= version;
    // Steps are indexed by (version-1); take every step with version > since.
    const events: GameEvent[] = [];
    for (const step of this.committedSteps) {
      if (step.version > since) events.push(...step.events);
    }
    return {
      version,
      view: this.getViewForSeat(seat),
      events,
      stale,
    };
  }

  /**
   * The ONLY mutation entrypoint. Folds a client-submitted ACTION through the
   * pure reducer. If the reducer advanced state, commit the action to the
   * append-only log and update the cache; if it reject-softed (state unchanged
   * identity OR a REJECTED event), the log is UNTOUCHED — an illegal/impossible
   * action can never enter the durable record.
   *
   * `by` is the submitting account. We also enforce SEAT OWNERSHIP here: an
   * account may only submit actions for the seat it owns. A spoofed
   * `action.player` is rejected before it ever reaches the reducer.
   */
  submit(action: Action, by: AccountId): SubmitResult {
    // --- Identity / seat guard (server-authority, pre-reducer) -------------
    const seatOfSubmitter = this.seatForAccount(by);
    if (seatOfSubmitter === null) {
      return { accepted: false, seq: this.seq, events: [], rejectReason: "not-a-participant" };
    }
    if ((action as { player?: string }).player !== seatOfSubmitter) {
      return { accepted: false, seq: this.seq, events: [], rejectReason: "seat-spoof" };
    }

    // --- Fold through the PURE reducer (the single source of legality) ------
    const prev = this.state;
    const { state: nextState, events } = applyAction(prev, action);

    // Reject-soft detection: the reducer returns the ORIGINAL reference on an
    // illegal action (see reducer.ts applyAction chokepoint). A returned
    // REJECTED event is the explicit signal.
    const rejected =
      nextState === prev || events.some((e) => e.type === "REJECTED");
    if (rejected) {
      const reason =
        (events.find((e) => e.type === "REJECTED") as { reason?: string } | undefined)
          ?.reason ?? "rejected";
      return { accepted: false, seq: this.seq, events, rejectReason: reason };
    }

    // --- Commit to the APPEND-ONLY log, then update the cache --------------
    const entry: ActionLogEntry = {
      seq: this.record.actionLog.length,
      action,
      by,
      receivedAt: Date.now(),
    };
    this.record.actionLog.push(entry);
    this.state = nextState;
    // Record this step's events under its monotonic version (== seq+1) so an
    // incremental client can fetch only what it hasn't seen.
    this.committedSteps.push({ version: entry.seq + 1, events });

    // --- Durably append AFTER the in-memory append (only accepted actions
    //     ever reach here; rejects returned above never persist). The store's
    //     (matchId, seq) UNIQUE constraint makes this idempotent on retry. ----
    this.store?.appendAction(this.record.matchId, {
      seq: entry.seq,
      action: entry.action,
      by: entry.by,
      receivedAt: entry.receivedAt,
    });

    return { accepted: true, seq: entry.seq, events };
  }

  /** Which seat (if any) this account owns. */
  seatForAccount(account: AccountId): Seat | null {
    if (this.record.seats.P1 === account) return "P1";
    if (this.record.seats.P2 === account) return "P2";
    return null;
  }

  /**
   * Reconnection: rebuild the live state from the durable record and ASSERT it
   * equals the cache. Returns the replayed state; throws if it ever diverges
   * (which would be a determinism bug, not a normal condition).
   */
  reconcileFromLog(): MatchState {
    const replayed = replayMatch(this.record, this.bootstrap);
    if (hashState(replayed) !== hashState(this.state)) {
      throw new Error(
        `DETERMINISM VIOLATION: replay(seed,log) != live state for match ${this.record.matchId}`
      );
    }
    return replayed;
  }
}

/**
 * Match registry. In-memory `Map` for live access, optionally backed by a
 * durable `PersistenceStore`. When a store is supplied, created matches persist
 * their header + accepted actions, and `bootstrap()` rebuilds all live matches
 * from disk on startup — so a server restart loses nothing.
 */
export class MatchRegistry {
  private matches = new Map<string, AuthoritativeMatch>();
  private readonly store?: PersistenceStore;

  constructor(store?: PersistenceStore) {
    this.store = store;
  }

  /**
   * Restart recovery. Load every persisted match header, replay its durable
   * action log through the reducer, and register the rebuilt live match. Safe
   * to call once at construction; a no-op if no store is configured. Returns
   * the number of matches recovered.
   */
  bootstrap(): number {
    if (!this.store) return 0;
    let recovered = 0;
    for (const header of this.store.loadAllHeaders()) {
      if (this.matches.has(header.matchId)) continue; // never clobber live
      const persisted = this.store.loadActions(header.matchId);
      const log: ActionLogEntry[] = persisted.map((p) => ({
        seq: p.seq,
        action: p.action,
        by: p.by,
        receivedAt: p.receivedAt,
      }));
      const m = AuthoritativeMatch.rehydrate(header, log, this.store);
      this.matches.set(header.matchId, m);
      recovered++;
    }
    return recovered;
  }

  create(
    matchId: string,
    seed: number,
    seats: Record<Seat, AccountId>,
    bootstrap?: MatchBootstrapInput
  ): AuthoritativeMatch {
    if (this.matches.has(matchId)) {
      throw new Error(`match ${matchId} already exists`);
    }
    const m = new AuthoritativeMatch(matchId, seed, seats, bootstrap, this.store);
    this.matches.set(matchId, m);
    return m;
  }

  get(matchId: string): AuthoritativeMatch | undefined {
    return this.matches.get(matchId);
  }

  /** Reconnection entrypoint: hand a dropped client a fresh, replay-verified
   *  snapshot + the seq it should resume listening from. */
  snapshotForReconnect(matchId: string): { state: MatchState; seq: number } {
    const m = this.matches.get(matchId);
    if (!m) throw new Error(`no such match ${matchId}`);
    const state = m.reconcileFromLog();
    return { state, seq: m.seq };
  }
}

export type { Action, GameEvent, MatchState };
