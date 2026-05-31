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

  constructor(
    matchId: string,
    seed: number,
    seats: Record<Seat, AccountId>,
    bootstrap?: MatchBootstrapInput
  ) {
    this.bootstrap = bootstrap;
    this.state = buildInitialState(seed, bootstrap);
    this.record = {
      matchId,
      seed,
      seats,
      actionLog: [],
      createdAt: Date.now(),
    };
  }

  /** Read-only snapshot of the live authoritative state (defensive clone). */
  getState(): MatchState {
    return structuredClone(this.state);
  }

  get seq(): number {
    return this.record.actionLog.length;
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

/** Trivial in-memory registry. PERSISTENCE.md describes the durable backing. */
export class MatchRegistry {
  private matches = new Map<string, AuthoritativeMatch>();

  create(
    matchId: string,
    seed: number,
    seats: Record<Seat, AccountId>,
    bootstrap?: MatchBootstrapInput
  ): AuthoritativeMatch {
    if (this.matches.has(matchId)) {
      throw new Error(`match ${matchId} already exists`);
    }
    const m = new AuthoritativeMatch(matchId, seed, seats, bootstrap);
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
