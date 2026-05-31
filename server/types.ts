/**
 * Server-side wire + storage types.
 *
 * This file imports the engine's public types READ-ONLY (it never edits or
 * re-implements any rule). The authoritative server speaks ONLY in terms of
 * `Action`s (client intents) and re-derives `MatchState` itself — it never
 * trusts a client-sent state. See ANTICHEAT.md.
 */

import type { Action, GameEvent } from "../src/engine/reducer";
import type { MatchState } from "../src/engine/state";

export type { Action, GameEvent, MatchState };

/** Opaque account / identity handle. See PERSISTENCE.md §account model. */
export type AccountId = string;

/** Which engine seat (P1/P2) an account occupies in a given match. */
export type Seat = "P1" | "P2";

/**
 * One APPEND-ONLY entry in a match's authoritative action log. `seq` is a
 * 0-based monotonic index; `(seed, [actions in seq order])` fully determines
 * the live `MatchState`, so this log + the seed is the entire durable record of
 * a match. `by` records WHICH account submitted it (for audit / anti-cheat),
 * never used by the pure reducer.
 */
export interface ActionLogEntry {
  seq: number;
  action: Action;
  by: AccountId;
  /** Wall-clock receipt time. Audit metadata ONLY — never fed to the reducer
   *  (the engine forbids Date.now); excluded from determinism. */
  receivedAt: number;
}

/**
 * The complete durable record of a match. Everything needed to replay it
 * byte-identically lives here: the immutable seed + the append-only log. The
 * live `MatchState` is a CACHE derived from these two and can always be rebuilt.
 */
export interface MatchRecord {
  matchId: string;
  seed: number;
  /** seat -> account binding, fixed at creation. */
  seats: Record<Seat, AccountId>;
  /** Append-only; index === seq. */
  actionLog: ActionLogEntry[];
  createdAt: number;
}

/** Result of submitting an action to the authoritative server. */
export interface SubmitResult {
  /** True if the reducer ADVANCED state (a fresh clone). False == reject-soft. */
  accepted: boolean;
  /** The new authoritative seq if accepted; the last committed seq otherwise. */
  seq: number;
  /** Events the reducer emitted for this action (broadcast payload). */
  events: GameEvent[];
  /** Set on a soft-rejected action: the REJECTED event's reason. */
  rejectReason?: string;
}

/** A message broadcast to observers after an accepted action. */
export interface Broadcast {
  matchId: string;
  seq: number;
  action: Action;
  events: GameEvent[];
  /** A monotonic hash of the resulting state, so observers can cheaply detect
   *  divergence without shipping the full state every tick. */
  stateHash: string;
}
