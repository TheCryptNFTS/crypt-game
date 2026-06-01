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

import crypto from "node:crypto";
import { applyAction } from "../src/engine/reducer";
import { createMatch } from "../src/engine/setup";
import { createMatchFromDecks } from "../src/engine/createMatchFromDecks";
import type { MatchBootstrapInput, DeckBootstrapInput } from "../src/types/matchBootstrap";
import { PersistenceStore } from "./persistence";
import { projectViewForSeat, projectSpectatorView, type MatchView } from "./view";
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

/**
 * Fixed, deterministic, server-computed rating swing for a decided ranked match.
 * Kept intentionally simple (+win / -loss, symmetric-ish) per the product's
 * "keep the surface small" rule — NOT a full Elo. The winner gains
 * `RATING_WIN_DELTA`; the loser drops `RATING_LOSS_DELTA` (floored at 0 in the
 * store). This is game-internal LADDER rating ONLY — it never touches real hex.
 */
export const RATING_WIN_DELTA = 25;
export const RATING_LOSS_DELTA = 20;

/** Default joinable lifetime (ms) of a private challenge code. A few minutes is
 *  enough to share a code and have a friend join; expired codes are GC'd. */
export const DEFAULT_LOBBY_TTL_MS = 5 * 60 * 1000;

/** Minimum spacing (ms) between a player's emotes — anti-spam rate limit. */
export const EMOTE_MIN_INTERVAL_MS = 2_000;

/** How many recent emotes per match are retained for the `since`-poll channel. */
export const EMOTE_RING_SIZE = 32;

/**
 * Code alphabet: unambiguous uppercase letters + digits (no 0/O/1/I) so a code
 * is easy to read aloud / type. 6 chars from this 32-symbol set = ~30 bits of
 * space; collisions are additionally checked against live lobbies on mint.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

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
  /**
   * Whether this match is publicly SPECTATABLE. True for public-queue matches;
   * false for private friend-challenge matches (respecting the friend-duel
   * intent) and for raw test/direct-created matches. This is a pure
   * visibility/registry concern — it NEVER affects the reducer, the action log,
   * or the determinism contract; it only gates whether the match appears in the
   * spectator list + can be watched. Defaults to false (opt-in to public).
   */
  readonly spectatable: boolean;
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

  /**
   * SERVER-SIDE outcome overlay for forfeits (concede / timeout). The engine
   * has NO concede action (it is imported read-only), so a forfeit can never go
   * through the reducer or into the durable action log without breaking the
   * `live === replay(seed, log)` determinism contract. Instead we record the
   * winning seat HERE, out-of-band: the action log stays pure-engine (replay is
   * untouched), and the view projection reports this winner when set. Null until
   * someone forfeits. Once set it is terminal — the match is decided.
   */
  private forfeitWinner: Seat | null = null;
  /**
   * One-shot guard: true once this match's decided outcome has been written to
   * the ranked ladder. Ensures both players' rating rows are recorded EXACTLY
   * once regardless of which path (engine win / concede / timeout) decided it,
   * and regardless of how many times a decided match is re-touched. The store's
   * per-match dedupe (hasMatchResult) is a second safety net across restarts.
   */
  private outcomeRecorded = false;
  /**
   * Per-seat last-activity wall clock (epoch ms). Updated whenever a seat's
   * account is observed acting on or reading the match (submit / authed view /
   * reconnect). Audit/liveness metadata ONLY — never fed to the reducer, so it
   * is excluded from determinism. Used by the registry's reaper to auto-concede
   * a seat that has been unreachable past the timeout.
   */
  private readonly lastSeen: Record<Seat, number>;

  constructor(
    matchId: string,
    seed: number,
    seats: Record<Seat, AccountId>,
    bootstrap?: MatchBootstrapInput,
    store?: PersistenceStore,
    spectatable = false
  ) {
    this.bootstrap = bootstrap;
    this.store = store;
    this.spectatable = spectatable;
    this.state = buildInitialState(seed, bootstrap);
    const now = Date.now();
    this.lastSeen = { P1: now, P2: now };
    this.record = {
      matchId,
      seed,
      seats,
      actionLog: [],
      createdAt: now,
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
    return projectViewForSeat(this.record.matchId, this.state, seat, this.forfeitWinner);
  }

  /**
   * THE NEUTRAL SPECTATOR projection. Returns a view of the current
   * authoritative state in which BOTH players' hands are redacted to counts and
   * NEITHER deck's order is revealed — the intersection of what is public to
   * each seat. It reuses the SAME fog redactor (`projectSpectatorView`, which
   * applies the opponent-side projection to both seats) as the player path, so a
   * spectator can never receive hidden information about either player. Pure
   * view transform — never mutates the state the reducer folds/persists.
   */
  getSpectatorView(): MatchView {
    return projectSpectatorView(this.record.matchId, this.state, this.forfeitWinner);
  }

  /**
   * Incremental SPECTATOR update mirroring `getIncrementalForSeat` but neutral:
   * the latest fully-redacted spectator view + the events committed strictly
   * AFTER `since` (in version order) for the spectator's combat log. Read-only:
   * it never advances the match, never injects an action, never touches the
   * action log. `stale` is true when the spectator is already current.
   */
  getSpectatorIncremental(
    since: number
  ): { version: number; view: MatchView; events: GameEvent[]; stale: boolean } {
    const version = this.version;
    const stale = since >= version;
    const events: GameEvent[] = [];
    for (const step of this.committedSteps) {
      if (step.version > since) events.push(...step.events);
    }
    return { version, view: this.getSpectatorView(), events, stale };
  }

  /** The effective winner: a forfeit (concede/timeout) wins over the engine's
   *  own win condition; otherwise the engine's `state.winner`. */
  get winner(): Seat | null {
    return this.forfeitWinner ?? this.state.winner ?? null;
  }

  /** True once the match is decided by EITHER a forfeit or the engine. A decided
   *  match accepts no further actions and is eligible for reaping. */
  get decided(): boolean {
    return this.winner !== null;
  }

  /**
   * FORFEIT: record `loser`'s opponent as the server-side winner. Idempotent and
   * terminal — the FIRST forfeit decides the match; a later one (or a forfeit of
   * an already-engine-decided match) is ignored. This NEVER touches the action
   * log or engine state, so `replay(seed, log)` is unaffected: the forfeit is a
   * pure out-of-band outcome overlay. Returns the winning seat (current winner).
   */
  forfeit(loser: Seat): Seat {
    if (this.forfeitWinner === null && this.state.winner === null) {
      this.forfeitWinner = loser === "P1" ? "P2" : "P1";
    }
    this.recordOutcomeIfDecided();
    return this.winner!;
  }

  /**
   * RANKED LADDER write — fires exactly once, the first time the match is
   * decided (by engine win OR forfeit/timeout). Records BOTH seats' results +
   * server-computed rating deltas to the durable store. Idempotent via the
   * `outcomeRecorded` flag (and the store's per-match dedupe across restarts).
   *
   * HEX-SAFETY: this writes only game-internal ladder rating + win/loss/streak
   * rows. It NEVER credits a wallet with real hex; the store has no such path.
   * No-op when there is no durable store (pure in-memory proof matches).
   */
  private recordOutcomeIfDecided(): void {
    if (this.outcomeRecorded) return;
    const winnerSeat = this.winner;
    if (winnerSeat === null) return; // not decided yet
    this.outcomeRecorded = true;
    if (!this.store) return;
    const loserSeat: Seat = winnerSeat === "P1" ? "P2" : "P1";
    const winnerAcct = this.record.seats[winnerSeat];
    const loserAcct = this.record.seats[loserSeat];
    const matchId = this.record.matchId;
    // Guard against a double-write across a restart (e.g. a match decided then
    // rehydrated): only write if this match hasn't been recorded for the seat.
    if (!this.store.hasMatchResult(matchId, winnerAcct)) {
      this.store.recordMatchResult({
        matchId,
        accountId: winnerAcct,
        opponentId: loserAcct,
        result: "win",
        ratingDelta: RATING_WIN_DELTA,
      });
    }
    if (!this.store.hasMatchResult(matchId, loserAcct)) {
      this.store.recordMatchResult({
        matchId,
        accountId: loserAcct,
        opponentId: winnerAcct,
        result: "loss",
        ratingDelta: -RATING_LOSS_DELTA,
      });
    }
  }

  /** Concede by ACCOUNT: resolves the account's seat and forfeits it. Returns the
   *  winning seat, or null if the account does not own a seat in this match. */
  concede(by: AccountId): Seat | null {
    const seat = this.seatForAccount(by);
    if (seat === null) return null;
    return this.forfeit(seat);
  }

  /** Record liveness for a seat (called on any authed read/submit). Used by the
   *  reaper to detect an unreachable player. No-op for a decided match. */
  touch(seat: Seat): void {
    if (!this.decided) this.lastSeen[seat] = Date.now();
  }

  /** Epoch-ms of the last activity seen from `seat`. */
  lastSeenAt(seat: Seat): number {
    return this.lastSeen[seat];
  }

  /**
   * Reaper helper: if the match is undecided and SOME seat has been silent for
   * longer than `timeoutMs`, forfeit the stalest such seat (auto-concede). The
   * other seat must have been seen more recently (so we never forfeit a match
   * where BOTH sides are simply idle between turns within the window). Returns
   * the winning seat if a timeout forfeit fired, else null.
   */
  reapIfTimedOut(timeoutMs: number, now: number = Date.now()): Seat | null {
    if (this.decided) return null;
    const p1Silent = now - this.lastSeen.P1;
    const p2Silent = now - this.lastSeen.P2;
    if (p1Silent <= timeoutMs && p2Silent <= timeoutMs) return null;
    // Forfeit whichever seat has been silent the longest.
    const loser: Seat = p1Silent >= p2Silent ? "P1" : "P2";
    return this.forfeit(loser);
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
    // A forfeited (conceded/timed-out) match is terminal: reject any further
    // action so a returning loser can't keep playing past their concede.
    if (this.forfeitWinner !== null) {
      return { accepted: false, seq: this.seq, events: [], rejectReason: "match-decided" };
    }
    // Acting is a strong liveness signal for this seat.
    this.touch(seatOfSubmitter);

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

    // If this accepted action ended the match (engine set a winner), fold the
    // outcome into the ranked ladder once. game-internal rating only — no hex.
    this.recordOutcomeIfDecided();

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
/** One waiting player in the matchmaking queue. */
interface QueueTicket {
  accountId: AccountId;
  /** This player's deck bootstrap (commander + deck), used to build the match. */
  deck: DeckBootstrapInput;
  enqueuedAt: number;
}

/** What a queued player learns about their pairing once matched. */
export interface QueueStatus {
  state: "queued" | "matched" | "idle";
  /** Set when state === "matched": the match they were paired into + their seat. */
  matchId?: string;
  seat?: Seat;
  /** Set when state === "queued": position (1 === next to be paired). */
  position?: number;
}

/**
 * A PRIVATE challenge lobby ("play with friends"): the creator parks their deck
 * keyed by a short shareable CODE and waits for exactly one specific opponent to
 * `join`. This is a parallel waiting room to the public FIFO queue — it never
 * enters that queue — but on join it funnels through the SAME match-creation
 * path (`createPairedMatch`), so the produced match is byte-identical in
 * resolution to a queued one. In-memory + transient by design (a lobby that
 * doesn't survive a restart is fine to drop; only match RESULTS persist).
 *
 * HEX-SAFETY: a lobby holds a deck bootstrap + a code. No currency whatsoever.
 */
interface ChallengeLobbyTicket {
  code: string;
  /** The creator's account (the only one allowed to cancel / poll-as-creator). */
  creator: AccountId;
  /** The creator's deck bootstrap, used as P1 when someone joins. */
  deck: DeckBootstrapInput;
  createdAt: number;
  expiresAt: number;
  /** Set once a second player joins and the match is created. Terminal. */
  matchId: string | null;
}

/** What a challenge creator learns when they poll their lobby by code. */
export interface ChallengeStatus {
  code: string;
  joined: boolean;
  matchId: string | null;
}

/** One delivered in-match emote (typographic quick-chat; never free text). */
export interface EmoteEvent {
  /** The submitting seat's ACCOUNT id (the opponent renders "them" vs "you"). */
  from: AccountId;
  emoteId: string;
  at: number;
}

/**
 * One row in the public "watch live" list. Carries ONLY non-private metadata: a
 * matchId to subscribe to, TRUNCATED seat labels (never full account/wallet
 * ids), the current turn, and when the match started. No hand/deck/board state —
 * the neutral spectator view is fetched separately per match.
 */
export interface LiveMatchSummary {
  matchId: string;
  p1Label: string;
  p2Label: string;
  turn: number;
  startedAt: number;
}

/**
 * Truncate an account/wallet id to a short public label (e.g. `0x12ab…cd34`)
 * so the live list never exposes a full identity. Short ids are returned as-is.
 */
export function truncateLabel(accountId: AccountId): string {
  const id = String(accountId ?? "");
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export class MatchRegistry {
  private matches = new Map<string, AuthoritativeMatch>();
  private readonly store?: PersistenceStore;

  /**
   * FIFO matchmaking queue: longest-waiting at index 0. A SINGLE deterministic
   * FIFO is the whole policy here — no ELO/MMR/ranked (premature). Keyed by
   * account so a double-enqueue is idempotent (refreshes the same ticket).
   */
  private queue: QueueTicket[] = [];
  /**
   * Pairings produced by `pair()`, keyed by accountId, so a player who enqueued
   * and then polls learns "you're matched: here's your matchId + seat". An entry
   * lives until the player acknowledges it (claims it via `claimMatch`).
   */
  private pairings = new Map<AccountId, { matchId: string; seat: Seat }>();
  /** Monotonic counter so paired matches get unique ids independent of seed. */
  private mmCounter = 0;

  /**
   * Private "play with friends" lobbies, keyed by their short shareable CODE.
   * Parallel to (never inside) the public FIFO queue. In-memory + transient: a
   * lobby is fine to lose on restart (only match RESULTS persist). GC'd lazily
   * on access + opportunistically when a new lobby is created.
   */
  private lobbies = new Map<string, ChallengeLobbyTicket>();
  /** How long (ms) a freshly-created challenge code stays joinable. */
  private readonly lobbyTtlMs: number;

  /**
   * Per-match RECENT-emotes ring buffer (quick-chat relay), keyed by matchId.
   * In-memory + transient, parallel to the action log but NEVER part of it —
   * emotes carry no game effect, so they must never reach the reducer or the
   * durable record (the `live === replay(seed,log)` contract stays intact).
   * Per-account last-emote wall clock backs the rate limit.
   */
  private emotes = new Map<string, EmoteEvent[]>();
  private lastEmoteAt = new Map<string, number>();

  constructor(store?: PersistenceStore, lobbyTtlMs = DEFAULT_LOBBY_TTL_MS) {
    this.store = store;
    this.lobbyTtlMs = lobbyTtlMs;
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
    bootstrap?: MatchBootstrapInput,
    /** Whether this match is publicly spectatable. Default false (direct/test
     *  creation is private); the public FIFO queue passes true. */
    spectatable = false
  ): AuthoritativeMatch {
    if (this.matches.has(matchId)) {
      throw new Error(`match ${matchId} already exists`);
    }
    const m = new AuthoritativeMatch(matchId, seed, seats, bootstrap, this.store, spectatable);
    this.matches.set(matchId, m);
    return m;
  }

  get(matchId: string): AuthoritativeMatch | undefined {
    return this.matches.get(matchId);
  }

  // -----------------------------------------------------------------------
  // SPECTATE — read-only neutral observation of LIVE public matches. Reuses the
  // registry + fog redactor; builds NO parallel system. A spectator owns no
  // seat and receives only public (intersection) state — never hidden info.
  // -----------------------------------------------------------------------

  /**
   * The list of LIVE, PUBLIC, UNDECIDED matches available to watch. A match is
   * listed only when it is (a) marked `spectatable` (public-queue, not a private
   * friend challenge) and (b) not yet decided. Labels are truncated — no full
   * account ids cross. Sorted newest-first (most recently started on top).
   */
  liveSpectatable(): LiveMatchSummary[] {
    const out: LiveMatchSummary[] = [];
    for (const m of this.matches.values()) {
      if (!m.spectatable) continue;
      if (m.decided) continue;
      out.push({
        matchId: m.record.matchId,
        p1Label: truncateLabel(m.record.seats.P1),
        p2Label: truncateLabel(m.record.seats.P2),
        turn: m.getSpectatorView().turn,
        startedAt: m.record.createdAt,
      });
    }
    out.sort((a, b) => b.startedAt - a.startedAt);
    return out;
  }

  /**
   * A NEUTRAL incremental spectator read for a match, or null when the match is
   * unknown OR not publicly spectatable (a private friend duel is never
   * watchable). Read-only: it never advances the match, never injects an action,
   * never touches the action log. The view is fully redacted (both hands hidden,
   * no deck order) by the SAME fog redactor the player path uses.
   */
  spectatorIncremental(
    matchId: string,
    since: number
  ): { version: number; view: MatchView; events: GameEvent[]; stale: boolean } | null {
    const m = this.matches.get(matchId);
    if (!m || !m.spectatable) return null;
    return m.getSpectatorIncremental(Number.isFinite(since) ? since : 0);
  }

  /** Reconnection entrypoint: hand a dropped client a fresh, replay-verified
   *  snapshot + the seq it should resume listening from. */
  snapshotForReconnect(matchId: string): { state: MatchState; seq: number } {
    const m = this.matches.get(matchId);
    if (!m) throw new Error(`no such match ${matchId}`);
    const state = m.reconcileFromLog();
    return { state, seq: m.seq };
  }

  // -----------------------------------------------------------------------
  // MATCHMAKING — a deterministic FIFO queue. enqueue -> (pair) -> claim.
  // No ELO/MMR/ranked: longest-waiting two players are paired, period.
  // -----------------------------------------------------------------------

  /**
   * ENQUEUE a player for matchmaking, then immediately try to pair. Idempotent:
   * a re-enqueue refreshes the same account's ticket (no duplicates) and keeps
   * its original wait position. If the player already has an unclaimed pairing,
   * we return that directly (their "Find Match" reconnected to an existing pair).
   *
   * Returns the player's resulting `QueueStatus` (queued+position OR matched).
   */
  enqueue(accountId: AccountId, deck: DeckBootstrapInput): QueueStatus {
    // Already paired but not yet claimed? Hand back the pairing.
    const existingPair = this.pairings.get(accountId);
    if (existingPair) {
      return { state: "matched", matchId: existingPair.matchId, seat: existingPair.seat };
    }
    // De-dupe: keep the earliest enqueuedAt if the account is already waiting.
    const idx = this.queue.findIndex((t) => t.accountId === accountId);
    if (idx >= 0) {
      this.queue[idx].deck = deck; // allow a deck swap while waiting
    } else {
      this.queue.push({ accountId, deck, enqueuedAt: Date.now() });
    }
    this.pair();
    return this.queueStatus(accountId);
  }

  /**
   * Pair the two longest-waiting players into a fresh AuthoritativeMatch. Loops
   * so a backlog drains in one call. Seat assignment is deterministic: the
   * earlier-waiting player is P1. The match seed is derived from the new match
   * id counter (a server choice; the engine is fully seedable). Records each
   * player's pairing so their next poll learns matchId + seat.
   */
  pair(): void {
    while (this.queue.length >= 2) {
      const a = this.queue.shift()!; // longest-waiting => P1
      const b = this.queue.shift()!; // next => P2
      // PUBLIC-queue pairings are spectatable: two anonymous ladder players, no
      // friend-duel privacy expectation, so the City can broadcast the match.
      const matchId = this.createPairedMatch(a.accountId, a.deck, b.accountId, b.deck, true);
      this.pairings.set(a.accountId, { matchId, seat: "P1" });
      this.pairings.set(b.accountId, { matchId, seat: "P2" });
    }
  }

  /**
   * THE single match-creation codepath shared by BOTH the public FIFO queue and
   * private challenge lobbies. Given the P1/P2 accounts + decks, it derives the
   * seed and id exactly as the queue always has, bootstraps the match, and
   * registers it. Returns the new matchId. Keeping this in one place is what
   * makes a friend-challenge match byte-identical in resolution to a queued one:
   * identical seed discipline (mmCounter + Date.now mix — the SAME server-side
   * RNG the public queue already uses, no new wall-clock/RNG surface), identical
   * shuffle flag, identical create() → identical result/ranking/ceremony path.
   */
  private createPairedMatch(
    p1Acct: AccountId,
    p1Deck: DeckBootstrapInput,
    p2Acct: AccountId,
    p2Deck: DeckBootstrapInput,
    /** Whether the produced match is publicly spectatable. The public queue
     *  passes true; private friend-challenge joins pass false (default). This
     *  is the ONLY difference between the two paths — match RESOLUTION (seed,
     *  shuffle, create) is byte-identical, so determinism is unaffected. */
    spectatable = false
  ): string {
    const seed = (Date.now() ^ (this.mmCounter * 0x9e3779b1)) >>> 0;
    const matchId = `mm_${seed}_${this.mmCounter++}`;
    const bootstrap: MatchBootstrapInput = {
      p1: p1Deck,
      p2: p2Deck,
      shuffle: true,
      seed,
    };
    this.create(matchId, seed, { P1: p1Acct, P2: p2Acct }, bootstrap, spectatable);
    return matchId;
  }

  /** The current matchmaking status for an account (queued+position, matched, or
   *  idle if neither waiting nor paired). The client polls this after enqueue. */
  queueStatus(accountId: AccountId): QueueStatus {
    const pair = this.pairings.get(accountId);
    if (pair) return { state: "matched", matchId: pair.matchId, seat: pair.seat };
    const idx = this.queue.findIndex((t) => t.accountId === accountId);
    if (idx >= 0) return { state: "queued", position: idx + 1 };
    return { state: "idle" };
  }

  /**
   * CLAIM a pairing: the player has been routed into the match, so consume the
   * one-shot pairing record. Returns the claimed {matchId, seat} or null if the
   * account has no pending pairing. Safe to call repeatedly (null after first).
   */
  claimMatch(accountId: AccountId): { matchId: string; seat: Seat } | null {
    const pair = this.pairings.get(accountId);
    if (!pair) return null;
    this.pairings.delete(accountId);
    return pair;
  }

  /** DEQUEUE / cancel: remove a player from the queue. Does NOT undo an
   *  already-produced pairing (that match exists). Returns true if removed. */
  dequeue(accountId: AccountId): boolean {
    const before = this.queue.length;
    this.queue = this.queue.filter((t) => t.accountId !== accountId);
    return this.queue.length !== before;
  }

  // -----------------------------------------------------------------------
  // PRIVATE CHALLENGE LOBBIES — "play with friends" by short shareable code.
  // Parallel to the public queue; on join they funnel through the SAME
  // createPairedMatch() path so the produced match is identical to a queued one.
  // In-memory + transient (fine to drop on restart). NO currency at all.
  // -----------------------------------------------------------------------

  /** Mint a collision-free uppercase code from the unambiguous alphabet. Checks
   *  against live lobbies so two open codes never collide. */
  private mintCode(): string {
    for (let attempt = 0; attempt < 64; attempt++) {
      let code = "";
      const bytes = crypto.randomBytes(CODE_LENGTH);
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
      }
      if (!this.lobbies.has(code)) return code;
    }
    // Astronomically unlikely fallback: widen with the monotonic counter.
    return `Z${(this.mmCounter++).toString(36).toUpperCase()}`.slice(0, CODE_LENGTH);
  }

  /** Drop any expired, un-joined lobbies (lazy GC). A lobby that already paired
   *  (matchId set) is left for the creator to read its status once, then GC'd by
   *  TTL like the rest — the match itself lives independently in `matches`. */
  private gcLobbies(now: number = Date.now()): void {
    for (const [code, lobby] of this.lobbies) {
      if (lobby.expiresAt <= now) this.lobbies.delete(code);
    }
  }

  /**
   * CREATE a private lobby for `creator` + their deck. Returns the shareable code
   * and its expiry. The creator parks here (NOT in the public queue) until a
   * friend joins. Idempotent-ish: creating again simply mints a fresh code (old
   * ones expire on their own).
   */
  createChallenge(
    creator: AccountId,
    deck: DeckBootstrapInput,
    now: number = Date.now()
  ): { code: string; expiresAt: number } {
    this.gcLobbies(now);
    const code = this.mintCode();
    const expiresAt = now + this.lobbyTtlMs;
    this.lobbies.set(code, {
      code,
      creator,
      deck,
      createdAt: now,
      expiresAt,
      matchId: null,
    });
    return { code, expiresAt };
  }

  /**
   * JOIN a private lobby by code as the second player. On success pairs EXACTLY
   * these two through createPairedMatch (creator => P1, joiner => P2) and records
   * the joiner's pairing so they claim it identically to a queued match; the
   * lobby is stamped with the matchId so the creator's next poll learns it.
   *
   * Returns the new matchId, or a typed error: not-found / expired / already a
   * consumed code / joining your own code.
   */
  joinChallenge(
    joiner: AccountId,
    code: string,
    joinerDeck: DeckBootstrapInput,
    now: number = Date.now()
  ): { matchId: string } | { error: string } {
    // NB: do NOT GC before the lookup here — an expired-but-still-present lobby
    // must surface the precise `expired-code` reason rather than `invalid-code`.
    const lobby = this.lobbies.get(code);
    if (!lobby) return { error: "invalid-code" };
    if (lobby.expiresAt <= now) {
      this.lobbies.delete(code);
      return { error: "expired-code" };
    }
    this.gcLobbies(now);
    if (lobby.matchId !== null) return { error: "code-consumed" };
    if (lobby.creator === joiner) return { error: "cannot-join-own-code" };
    // SAME match-creation path as the public queue: creator is P1, joiner is P2.
    const matchId = this.createPairedMatch(lobby.creator, lobby.deck, joiner, joinerDeck);
    lobby.matchId = matchId;
    // The creator claims via queueStatus/claimMatch exactly like a queued P1;
    // the joiner gets their pairing recorded here so claimMatch works for them.
    this.pairings.set(lobby.creator, { matchId, seat: "P1" });
    this.pairings.set(joiner, { matchId, seat: "P2" });
    return { matchId };
  }

  /** Poll a lobby's status by code (creator-facing). Reports whether a friend
   *  joined and, once paired, the matchId. Null if the code is unknown/expired. */
  challengeStatus(code: string, now: number = Date.now()): ChallengeStatus | null {
    this.gcLobbies(now);
    const lobby = this.lobbies.get(code);
    if (!lobby) return null;
    return { code, joined: lobby.matchId !== null, matchId: lobby.matchId };
  }

  /**
   * CANCEL a lobby (creator aborts). Only the creator may cancel, and only while
   * it is still open (not yet joined). Returns true if a lobby was removed.
   */
  cancelChallenge(code: string, by: AccountId, now: number = Date.now()): boolean {
    this.gcLobbies(now);
    const lobby = this.lobbies.get(code);
    if (!lobby) return false;
    if (lobby.creator !== by) return false;
    if (lobby.matchId !== null) return false; // already consumed — too late
    this.lobbies.delete(code);
    return true;
  }

  // -----------------------------------------------------------------------
  // IN-MATCH EMOTES — typographic quick-chat relay (no free text, no images,
  // no currency). A small recent-emotes channel attached per match, polled by
  // `since`. Never touches the reducer or the durable record.
  // -----------------------------------------------------------------------

  /**
   * Record an emote from `by` in `matchId`, after the SERVER validates the
   * sender is a participant and rate-limits to one emote / EMOTE_MIN_INTERVAL_MS.
   * Returns ok:false with a reason on a rejected emote. The preset/id validity is
   * enforced one layer up (GameServer holds the preset set as source of truth).
   */
  pushEmote(
    matchId: string,
    by: AccountId,
    emoteId: string,
    now: number = Date.now()
  ): { ok: true } | { ok: false; reason: string } {
    const m = this.matches.get(matchId);
    if (!m) return { ok: false, reason: "no-such-match" };
    if (m.seatForAccount(by) === null) return { ok: false, reason: "not-a-participant" };
    // Per-player rate limit (anti-spam): at most one emote per interval.
    const rlKey = `${matchId}:${by}`;
    const last = this.lastEmoteAt.get(rlKey) ?? 0;
    if (now - last < EMOTE_MIN_INTERVAL_MS) return { ok: false, reason: "rate-limited" };
    this.lastEmoteAt.set(rlKey, now);
    const ring = this.emotes.get(matchId) ?? [];
    ring.push({ from: by, emoteId, at: now });
    // Cap the ring so a long match can't grow this unboundedly.
    if (ring.length > EMOTE_RING_SIZE) ring.splice(0, ring.length - EMOTE_RING_SIZE);
    this.emotes.set(matchId, ring);
    return { ok: true };
  }

  /**
   * Read emotes in `matchId` newer than `since` (epoch ms). The caller must be a
   * participant (enforced one layer up). Returns [] when none / unknown match.
   */
  emotesSince(matchId: string, since: number): EmoteEvent[] {
    const ring = this.emotes.get(matchId);
    if (!ring) return [];
    return ring.filter((e) => e.at > since);
  }

  /** Concede a match on behalf of an account; returns the winning seat or null
   *  (no such match / not a participant). */
  concede(matchId: string, by: AccountId): Seat | null {
    const m = this.matches.get(matchId);
    if (!m) return null;
    return m.concede(by);
  }

  /**
   * REAPER: forfeit any undecided match whose loser has been unreachable past
   * `timeoutMs`. Intended to be called periodically (setInterval) by the running
   * server. Returns the matchIds that were timed-out this sweep.
   */
  reapTimedOut(timeoutMs: number, now: number = Date.now()): string[] {
    const reaped: string[] = [];
    for (const [id, m] of this.matches) {
      if (m.reapIfTimedOut(timeoutMs, now)) reaped.push(id);
    }
    return reaped;
  }
}

export type { Action, GameEvent, MatchState };
