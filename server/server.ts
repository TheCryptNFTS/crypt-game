/**
 * Thin authoritative HTTP API around the AuthoritativeMatch / MatchRegistry.
 *
 * Uses ONLY Node's built-in `http` module — no new dependencies. This is a
 * SCAFFOLD: it shows the shape of the authoritative boundary (clients submit
 * actions, the server re-derives state and returns events), not a hardened
 * service. Auth here is a stub `x-account-id` header; PERSISTENCE.md describes
 * the real identity model.
 *
 * Endpoints (all JSON):
 *   POST /matches                  { seed, seats:{P1,P2}, bootstrap? } -> { matchId, seq }
 *   POST /matches/:id/actions      { action }  (header x-account-id)   -> SubmitResult
 *   POST /matches/:id/concede      (bearer)    -> { winner, version, view }
 *   GET  /matches/:id/state        -> { state, seq }
 *   GET  /matches/:id/log          -> { seed, actionLog }   (the durable record)
 *   GET  /matches/:id/reconnect    -> { state, seq }  (replay-verified snapshot)
 *
 *   Matchmaking (all bearer-authed):
 *   POST /queue                    { deck }  -> QueueStatus (queued|matched)
 *   GET  /queue                    -> QueueStatus (poll while searching)
 *   POST /queue/claim              -> { matchId, seat, version, view } | 204
 *   DELETE /queue                  -> { cancelled }   (cancel search)
 *
 *   Ranked ladder + daily quests (all bearer-authed; GAME-INTERNAL only — these
 *   never source real hex, only rating/XP/soft-currency):
 *   GET  /rankings/me              -> { rating, wins, losses, streak, position }
 *   GET  /rankings/top?limit=N     -> LeaderboardEntry[]
 *   GET  /rankings/rankup          -> PendingRankup | null  (one-shot ceremony)
 *   POST /rankings/rankup/ack      -> { ok }                (consume the ceremony)
 *   GET  /rankings/streak          -> StreakRewardRow | null (best claimable)
 *   POST /rankings/streak/claim    -> { claimed, amount }   (soft currency only)
 *   GET  /cosmetics                -> CosmeticUnlockRow[]    (frame flags)
 *   GET  /quests/today             -> TodayQuests (durable per-UTC-day claims)
 *   POST /quests/claim             { questId } -> { claimed, xp, crypt, utcDay }
 *
 * The handler functions are also exported so they can be driven IN-PROCESS
 * (no socket) — which is exactly what the convergence proof does, removing all
 * network flakiness from the determinism test.
 */

import http from "node:http";
import {
  MatchRegistry,
  type QueueStatus,
  type ChallengeStatus,
  type EmoteEvent,
  type LiveMatchSummary,
} from "./matchEngine";
import {
  PersistenceStore,
  type RankingRow,
  type PendingRankup,
  type StreakRewardRow,
  type CosmeticUnlockRow,
  type SeasonRow,
  type SeasonLeaderRow,
  type SeasonRewardTierRow,
  type MatchHistoryRow,
} from "./persistence";
import { verifyToken, bearerFromAuthHeader } from "./auth";
import { ECONOMY } from "../src/economy/progression";
import { allPlayableCards } from "../src/engine/cards";
import { allCommanders } from "../src/engine/commanders";
import type { MatchView } from "./view";
import type { Action, Seat, SubmitResult, MatchState, GameEvent, AccountId } from "./types";
import type { DeckBootstrapInput } from "../src/types/matchBootstrap";

/** How long (ms) a seat may be unreachable before the reaper auto-concedes it. */
export const DEFAULT_TIMEOUT_MS = 60_000;

/** One preset quick-chat emote. `label` is a TYPOGRAPHIC mark + the ⬡ hex glyph
 *  — NEVER an emoji (product rule) and NEVER free text (no moderation surface). */
export interface EmotePreset {
  id: string;
  label: string;
}

/**
 * THE server-side source of truth for in-match emotes. A small FIXED set of
 * greetings/taunts rendered as typographic marks + the ⬡ glyph. The client lists
 * these (`GET /emotes`) and may only send an `id` that appears here — anything
 * else is rejected. No emoji, no free text, no image assets, no currency.
 */
export const EMOTE_PRESETS: readonly EmotePreset[] = [
  { id: "greet", label: "⬡ Well met" },
  { id: "taunt", label: "⬡ Is that all?" },
  { id: "gg", label: "⬡ GG" },
  { id: "threat", label: "⬡ You're done" },
  { id: "think", label: "⬡ Hmm…" },
  { id: "nice", label: "⬡ Nicely played" },
];

/** Fast membership set for preset-id validation. */
const EMOTE_PRESET_IDS = new Set<string>(EMOTE_PRESETS.map((e) => e.id));

/**
 * A legal-enough fallback deck bootstrap for a challenge participant who did not
 * supply one (the deck-less social-bridge contract). Uses the first commander +
 * a slice of playable cards — the SAME shape the matchmaking proof builds. The
 * city proxy normally injects the player's real owned deck instead; this only
 * guarantees a join always yields a constructible match. No currency involved.
 */
function defaultDeckBootstrap(): DeckBootstrapInput {
  const commander = allCommanders[0];
  const deck = (allPlayableCards as { id: string }[]).slice(0, 30).map((c) => c.id);
  return { commanderId: commander.id, deck };
}

/** A resolved caller: the authenticated account + (if a participant) its seat in
 *  the addressed match. `seat` is null when the account is authenticated but not
 *  a player in this match (a spectator/intruder). */
export interface Caller {
  accountId: AccountId;
  seat: Seat | null;
}

/** Typed auth failure surfaced to the HTTP layer as a 401/403. */
export class AuthError extends Error {
  constructor(
    public readonly reason: string,
    public readonly status: number
  ) {
    super(reason);
  }
}

export interface CreateMatchBody {
  seed: number;
  seats: Record<Seat, string>;
  bootstrap?: import("../src/types/matchBootstrap").MatchBootstrapInput;
}

/** The caller's own ladder standing (game-internal rating — never hex). */
export interface MyRanking extends RankingRow {
  /** 1-based position on the rating ladder (1 = top). */
  position: number;
}

/** One leaderboard entry. */
export interface LeaderboardEntry {
  position: number;
  accountId: AccountId;
  rating: number;
  wins: number;
  losses: number;
  bestStreak: number;
}

/** Today's quest state for the caller. `claimed` reflects the DURABLE per-UTC-day
 *  claim, so clearing localStorage can never re-open a claimed quest. */
export interface QuestStateEntry {
  id: string;
  title: string;
  xp: number;
  crypt: number;
  claimed: boolean;
}
export interface TodayQuests {
  utcDay: string;
  dailyLoginClaimed: boolean;
  quests: QuestStateEntry[];
}

/** The pseudo-quest id under which the once-per-UTC-day login bonus is claimed. */
export const DAILY_LOGIN_QUEST_ID = "__daily_login__";

/** UTC calendar day key (YYYY-MM-DD) for a timestamp. The quest ledger is keyed
 *  by this so a claim is once-per-account-per-UTC-day. */
export function utcDayKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** One daily quest definition from the shared economy table. The source array's
 *  intersection type doesn't expose `id`/`title` on element access, so we view
 *  it through this concrete shape (the data already carries these fields). */
interface DailyQuestDef {
  id: string;
  title: string;
  xp: number;
  crypt: number;
}
/** The shared daily quest definitions, REUSED (never re-invented) from the
 *  economy table, narrowed to the concrete per-quest shape. */
export const DAILY_QUEST_DEFS = ECONOMY.quests.daily as unknown as DailyQuestDef[];

/** Resolve a daily quest's authoritative reward from the SHARED economy table
 *  (reused, never re-invented). Returns null for an unknown id. */
function dailyQuestReward(
  questId: string
): { title: string; xp: number; crypt: number } | null {
  if (questId === DAILY_LOGIN_QUEST_ID) {
    return {
      title: "Daily Login",
      xp: ECONOMY.rewards.dailyLogin.xp,
      crypt: ECONOMY.rewards.dailyLogin.crypt,
    };
  }
  const q = DAILY_QUEST_DEFS.find((d) => d.id === questId);
  return q ? { title: q.title, xp: q.xp, crypt: q.crypt } : null;
}

/**
 * The in-process API surface. This is the authoritative boundary: every method
 * takes an account id + a plain Action/body and returns derived results. The
 * HTTP layer below is a trivial adapter over this object.
 */
export class GameServer {
  readonly registry: MatchRegistry;
  /** The durable backing store (undefined => pure in-memory server). */
  readonly store?: PersistenceStore;
  private counter = 0;

  /**
   * @param store Optional durable backing. When supplied, the server bootstraps
   *   all persisted matches from disk on construction (restart recovery) and
   *   persists every accepted action going forward. Omit for a pure in-memory
   *   server (the original convergence-proof behaviour).
   */
  constructor(store?: PersistenceStore) {
    this.store = store;
    this.registry = new MatchRegistry(store);
    // Recover any matches that survived a restart, and seed the id counter past
    // the highest recovered numeric suffix so new ids never collide.
    const recovered = this.registry.bootstrap();
    if (recovered > 0) this.counter = recovered;
  }

  createMatch(body: CreateMatchBody): { matchId: string; seq: number } {
    // Skip past any ids already recovered from disk so a reused seed after a
    // restart never collides with a persisted match.
    let matchId = `m_${body.seed}_${this.counter++}`;
    while (this.registry.get(matchId)) {
      matchId = `m_${body.seed}_${this.counter++}`;
    }
    const m = this.registry.create(matchId, body.seed, body.seats, body.bootstrap);
    return { matchId, seq: m.seq };
  }

  /** Submit a client ACTION. The server re-derives state; the client's only
   *  trusted input is the action itself (+ its authenticated account id). */
  submitAction(matchId: string, accountId: string, action: Action): SubmitResult {
    const m = this.registry.get(matchId);
    if (!m) {
      return { accepted: false, seq: -1, events: [], rejectReason: "no-such-match" };
    }
    return m.submit(action, accountId);
  }

  getState(matchId: string): { state: MatchState; seq: number } {
    const m = this.registry.get(matchId);
    if (!m) throw new Error("no-such-match");
    return { state: m.getState(), seq: m.seq };
  }

  getLog(matchId: string): { seed: number; actionLog: unknown[] } {
    const m = this.registry.get(matchId);
    if (!m) throw new Error("no-such-match");
    return { seed: m.record.seed, actionLog: m.record.actionLog };
  }

  reconnect(matchId: string): { state: MatchState; seq: number } {
    return this.registry.snapshotForReconnect(matchId);
  }

  // -----------------------------------------------------------------------
  // MATCHMAKING + lifecycle (authenticated). The bearer resolves the account;
  // these never trust a client-sent accountId.
  // -----------------------------------------------------------------------

  /** Resolve an account from a bearer WITHOUT requiring it to be in any match
   *  (matchmaking happens before a match exists). Throws AuthError on bad token. */
  private accountFromBearer(bearer: string | undefined): AccountId {
    const token = bearerFromAuthHeader(bearer) ?? bearer;
    const v = verifyToken(token);
    if (!v.ok) throw new AuthError(v.reason, 401);
    return v.session.accountId;
  }

  /** ENQUEUE the caller for matchmaking with their deck. Returns queue status
   *  (queued+position, or matched+matchId+seat if paired immediately). */
  enqueue(bearer: string | undefined, deck: DeckBootstrapInput): QueueStatus {
    const account = this.accountFromBearer(bearer);
    return this.registry.enqueue(account, deck);
  }

  /** Poll the caller's matchmaking status. On "matched" the client should claim
   *  the pairing and route into the match. */
  queueStatus(bearer: string | undefined): QueueStatus {
    const account = this.accountFromBearer(bearer);
    return this.registry.queueStatus(account);
  }

  /** CLAIM the caller's pairing (consume the one-shot record) AND hand back the
   *  initial redacted view so the client can mount the match in one round-trip. */
  claimMatch(
    bearer: string | undefined
  ): { matchId: string; seat: Seat; version: number; view: MatchView } | null {
    const account = this.accountFromBearer(bearer);
    const pair = this.registry.claimMatch(account);
    if (!pair) return null;
    const m = this.registry.get(pair.matchId);
    if (!m) return null;
    m.touch(pair.seat);
    return {
      matchId: pair.matchId,
      seat: pair.seat,
      version: m.version,
      view: m.getViewForSeat(pair.seat),
    };
  }

  /** DEQUEUE / cancel the caller's matchmaking search. */
  dequeue(bearer: string | undefined): { cancelled: boolean } {
    const account = this.accountFromBearer(bearer);
    return { cancelled: this.registry.dequeue(account) };
  }

  // -----------------------------------------------------------------------
  // PRIVATE CHALLENGES ("Tier 4: Play with friends") — by short shareable code.
  // These funnel through the registry's SAME match-creation path as the public
  // queue, so a friend match records results/rankings/ceremonies identically.
  // HEX-SAFETY: a lobby + an emote carry no currency whatsoever.
  // -----------------------------------------------------------------------

  /**
   * Resolve the deck a challenge participant plays with. A caller MAY pass an
   * explicit bootstrap (the city proxy injects the player's owned deck, exactly
   * as it does for the public queue); when absent we fall back to the shared
   * default deck so the deck-less social-bridge contract still produces a legal
   * match. Deck resolution is a SERVER authority — never trusted blindly for
   * currency (there is none here).
   */
  private resolveChallengeDeck(deck?: DeckBootstrapInput): DeckBootstrapInput {
    if (deck && deck.commanderId && Array.isArray(deck.deck) && deck.deck.length > 0) {
      return deck;
    }
    return defaultDeckBootstrap();
  }

  /** CREATE a private challenge lobby with the caller's deck. Returns the
   *  shareable code + its expiry. The creator waits OUTSIDE the public queue. */
  createChallenge(
    bearer: string | undefined,
    deck?: DeckBootstrapInput
  ): { code: string; expiresAt: number } {
    const account = this.accountFromBearer(bearer);
    return this.registry.createChallenge(account, this.resolveChallengeDeck(deck));
  }

  /** JOIN a private lobby by code as the second player. On success the two are
   *  paired into a normal match; the caller then claims it like any pairing. */
  joinChallenge(
    bearer: string | undefined,
    code: string,
    deck?: DeckBootstrapInput
  ): { matchId: string } | { error: string } {
    const account = this.accountFromBearer(bearer);
    return this.registry.joinChallenge(account, String(code ?? ""), this.resolveChallengeDeck(deck));
  }

  /** Poll a lobby's status by code (creator-facing). Null if unknown/expired. */
  challengeStatus(
    bearer: string | undefined,
    code: string
  ): ChallengeStatus | null {
    // Authenticate the caller (consistent with the rest of the surface) but the
    // status itself is keyed by the code, not the account.
    this.accountFromBearer(bearer);
    return this.registry.challengeStatus(String(code ?? ""));
  }

  /** CANCEL the caller's open lobby (creator only, pre-join). */
  cancelChallenge(bearer: string | undefined, code: string): { cancelled: boolean } {
    const account = this.accountFromBearer(bearer);
    return { cancelled: this.registry.cancelChallenge(String(code ?? ""), account) };
  }

  // -----------------------------------------------------------------------
  // IN-MATCH EMOTES — typographic quick-chat relay (no free text / image / hex).
  // -----------------------------------------------------------------------

  /** The fixed preset emote set (the only ids a client may send). */
  listEmotes(): EmotePreset[] {
    return [...EMOTE_PRESETS];
  }

  /**
   * Send an emote in a match. Validates: (a) the caller is a participant, and
   * (b) the id is in the preset set (the server is the source of truth). Then
   * the registry rate-limits + relays it to the opponent's poll channel.
   */
  sendEmote(
    matchId: string,
    bearer: string | undefined,
    emoteId: string
  ): { ok: boolean } {
    const caller = this.resolveCaller(matchId, bearer);
    if (caller.seat === null) throw new AuthError("not-a-participant", 403);
    if (!EMOTE_PRESET_IDS.has(emoteId)) {
      // Unknown/forged emote id — reject without relaying (no moderation surface).
      return { ok: false };
    }
    const res = this.registry.pushEmote(matchId, caller.accountId, emoteId);
    return { ok: res.ok };
  }

  /**
   * Poll emotes in a match newer than `since`. The caller must be a participant
   * (so emotes never leak to spectators). Returns the recent-emotes delta.
   */
  pollEmotes(
    matchId: string,
    bearer: string | undefined,
    since: number
  ): EmoteEvent[] {
    const caller = this.resolveCaller(matchId, bearer);
    if (caller.seat === null) throw new AuthError("not-a-participant", 403);
    return this.registry.emotesSince(matchId, Number.isFinite(since) ? since : 0);
  }

  /** CONCEDE: the caller forfeits the addressed match; opponent wins. Returns the
   *  winning seat + the caller's now-decided view. Enforces participation. */
  concede(
    matchId: string,
    bearer: string | undefined
  ): { winner: Seat; version: number; view: MatchView } {
    const caller = this.resolveCaller(matchId, bearer);
    if (caller.seat === null) throw new AuthError("not-a-participant", 403);
    const m = this.registry.get(matchId)!;
    const winner = m.forfeit(caller.seat);
    return { winner, version: m.version, view: m.getViewForSeat(caller.seat) };
  }

  /** Run one reaper sweep (auto-concede unreachable seats). Returns reaped ids.
   *  `now` is injectable for deterministic tests (defaults to wall clock). */
  reap(timeoutMs: number = DEFAULT_TIMEOUT_MS, now: number = Date.now()): string[] {
    return this.registry.reapTimedOut(timeoutMs, now);
  }

  // -----------------------------------------------------------------------
  // RANKED LADDER + DAILY QUESTS (authenticated, server-authoritative).
  //
  // HARD INVARIANT: every grant below is game-internal rating / XP / soft
  // currency. NONE of these methods mints or transfers real on-chain hex — the
  // store has no such path. The server is a hex SINK at most, never a source.
  // -----------------------------------------------------------------------

  /** The caller's own ladder standing (rating, W/L, streak, ladder position). */
  myRanking(bearer: string | undefined): MyRanking {
    const account = this.accountFromBearer(bearer);
    if (!this.store) {
      // Pure in-memory server (proofs): synthesise a default standing.
      return {
        accountId: account,
        rating: 1000,
        wins: 0,
        losses: 0,
        currentStreak: 0,
        bestStreak: 0,
        season: 1,
        position: 0,
      };
    }
    const row = this.store.getRanking(account);
    const position = this.store.rankPosition(account);
    return { ...row, position };
  }

  /** Top-N leaderboard by rating. `limit` is clamped to a sane range. */
  topRankings(limit = 25): LeaderboardEntry[] {
    if (!this.store) return [];
    const clamped = Math.min(100, Math.max(1, Math.floor(limit) || 25));
    return this.store.topRankings(clamped).map((r, i) => ({
      position: i + 1,
      accountId: r.accountId,
      rating: r.rating,
      wins: r.wins,
      losses: r.losses,
      bestStreak: r.bestStreak,
    }));
  }

  /** Today's quest state for the caller (durable per-UTC-day claim flags). */
  questsToday(bearer: string | undefined, now: number = Date.now()): TodayQuests {
    const account = this.accountFromBearer(bearer);
    const utcDay = utcDayKey(now);
    const claimed = this.store
      ? new Set(this.store.claimedQuestIds(account, utcDay))
      : new Set<string>();
    return {
      utcDay,
      dailyLoginClaimed: claimed.has(DAILY_LOGIN_QUEST_ID),
      quests: DAILY_QUEST_DEFS.map((q) => ({
        id: q.id,
        title: q.title,
        xp: q.xp,
        crypt: q.crypt,
        claimed: claimed.has(q.id),
      })),
    };
  }

  /**
   * Claim a daily quest (or the daily-login bonus) for the caller, ONCE per UTC
   * day. The reward amounts come from the SHARED economy table; the server is
   * the sole authority on whether the claim is allowed. Returns the granted
   * (game-internal) reward + whether this call performed the claim.
   *
   * HEX-SAFETY: `xp`/`crypt` here are game-internal progression + soft currency.
   * No real hex is sourced — there is intentionally no code path to do so.
   */
  claimQuest(
    bearer: string | undefined,
    questId: string,
    now: number = Date.now()
  ):
    | { ok: true; claimed: boolean; questId: string; xp: number; crypt: number; utcDay: string }
    | { ok: false; reason: string } {
    const account = this.accountFromBearer(bearer);
    const reward = dailyQuestReward(questId);
    if (!reward) return { ok: false, reason: "unknown-quest" };
    const utcDay = utcDayKey(now);
    if (!this.store) {
      // No durable store (proof harness): treat as a successful first claim.
      return { ok: true, claimed: true, questId, xp: reward.xp, crypt: reward.crypt, utcDay };
    }
    const claimed = this.store.claimQuest({
      accountId: account,
      questId,
      utcDay,
      xp: reward.xp,
      crypt: reward.crypt,
      now,
    });
    // `claimed === false` => already claimed today (idempotent no-op grant).
    return { ok: true, claimed, questId, xp: reward.xp, crypt: reward.crypt, utcDay };
  }

  // -----------------------------------------------------------------------
  // RETENTION LOOP: rank-up ceremony, streak rewards, cosmetic unlocks.
  // All game-internal (one-shot ceremony flag / soft currency / cosmetic flag).
  // HEX-SAFETY: none of these source or move real hex — the store has no path.
  // -----------------------------------------------------------------------

  /** The caller's pending one-shot rank-up (play the ceremony once), or null. */
  pendingRankup(bearer: string | undefined): PendingRankup | null {
    const account = this.accountFromBearer(bearer);
    if (!this.store) return null;
    return this.store.pendingRankup(account);
  }

  /** Acknowledge the caller's pending rank-up so it never replays. */
  ackRankup(bearer: string | undefined): { ok: true } {
    const account = this.accountFromBearer(bearer);
    this.store?.ackRankup(account);
    return { ok: true };
  }

  /** The caller's best outstanding (claimable) streak reward, or null. */
  streakReward(bearer: string | undefined): StreakRewardRow | null {
    const account = this.accountFromBearer(bearer);
    if (!this.store) return null;
    return this.store.pendingStreakReward(account);
  }

  /** Claim the caller's outstanding streak reward (game-internal soft currency).
   *  Idempotent: returns { claimed:false, amount:0 } when nothing is pending. */
  claimStreak(bearer: string | undefined): { claimed: boolean; amount: number } {
    const account = this.accountFromBearer(bearer);
    if (!this.store) return { claimed: false, amount: 0 };
    return this.store.claimStreakReward(account);
  }

  /** The caller's earned cosmetic unlocks (frame flags). */
  cosmetics(bearer: string | undefined): CosmeticUnlockRow[] {
    const account = this.accountFromBearer(bearer);
    if (!this.store) return [];
    return this.store.cosmeticUnlocks(account);
  }

  // -----------------------------------------------------------------------
  // SEASON ("Tier 2: The Season"): current window, season-scoped leaderboard,
  // per-tier reward track + claim, and match history.
  // HEX-SAFETY: rewards are soft $CRYPT / season-scoped cosmetic flags only.
  // -----------------------------------------------------------------------

  /** The active season window. Null only on a pure in-memory (proof) server. */
  currentSeason(): SeasonRow | null {
    if (!this.store) return null;
    return this.store.currentSeason();
  }

  /** Top-N rankings WITHIN the active season. `limit` clamped to a sane range. */
  seasonLeaderboard(limit = 25): SeasonLeaderRow[] {
    if (!this.store) return [];
    const clamped = Math.min(100, Math.max(1, Math.floor(limit) || 25));
    return this.store.seasonTopRankings(clamped);
  }

  /** The caller's season reward track (reached/claimed per tier band). */
  seasonRewards(bearer: string | undefined): SeasonRewardTierRow[] {
    const account = this.accountFromBearer(bearer);
    if (!this.store) return [];
    return this.store.seasonRewards(account);
  }

  /** Claim one season reward tier (soft $CRYPT + season cosmetic flag). Returns
   *  { claimed:false } when not reachable / already claimed this season. */
  claimSeasonReward(
    bearer: string | undefined,
    tier: string
  ): { claimed: boolean; rewardCrypt: number; cosmeticId: string | null } {
    const account = this.accountFromBearer(bearer);
    if (!this.store) return { claimed: false, rewardCrypt: 0, cosmeticId: null };
    return this.store.claimSeasonReward(account, tier);
  }

  /** The caller's last-N match results (newest first). `limit` clamped. */
  matchHistory(bearer: string | undefined, limit = 20): MatchHistoryRow[] {
    const account = this.accountFromBearer(bearer);
    if (!this.store) return [];
    const clamped = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    return this.store.matchHistory(account, clamped);
  }

  // -----------------------------------------------------------------------
  // Authenticated, FOG-OF-WAR boundary. These are what the HTTP layer calls.
  // They verify a session token, resolve the seat, and return REDACTED views —
  // never the raw MatchState. The raw-state methods above are kept for the
  // in-process determinism proofs (which read full authoritative truth).
  // -----------------------------------------------------------------------

  /**
   * Resolve a request's caller from its bearer token. Verifies the HMAC
   * signature + expiry (see auth.ts) BEFORE trusting any identity, then binds
   * the account to its seat in `matchId`. Throws `AuthError` on any failure.
   */
  resolveCaller(matchId: string, authorization: string | undefined): Caller {
    // Accept either a raw token or a full `Bearer <token>` header value, so
    // callers can forward the client's `Authorization` header verbatim.
    const token = bearerFromAuthHeader(authorization) ?? authorization;
    const v = verifyToken(token);
    if (!v.ok) {
      // missing/expired/forged/tampered token => 401 Unauthorized.
      throw new AuthError(v.reason, 401);
    }
    const m = this.registry.get(matchId);
    if (!m) throw new AuthError("no-such-match", 404);
    const seat = m.seatForAccount(v.session.accountId);
    return { accountId: v.session.accountId, seat };
  }

  /**
   * Authenticated action submission. The token resolves the account; the match
   * layer enforces seat ownership (a token for A can never submit for B's seat —
   * `submit()` rejects `seat-spoof`). Returns the resulting REDACTED view for the
   * caller's seat plus the new version + this step's events.
   */
  submitActionAuthed(
    matchId: string,
    bearer: string | undefined,
    action: Action
  ): {
    accepted: boolean;
    version: number;
    view: MatchView | null;
    events: GameEvent[];
    rejectReason?: string;
  } {
    const caller = this.resolveCaller(matchId, bearer);
    if (caller.seat === null) {
      // Authenticated, but not a participant in this match.
      throw new AuthError("not-a-participant", 403);
    }
    const m = this.registry.get(matchId)!;
    const res = m.submit(action, caller.accountId);
    return {
      accepted: res.accepted,
      version: m.version,
      // Even on a soft-reject we hand back the caller's current authoritative
      // view so the client can reconcile its optimistic echo immediately.
      view: m.getViewForSeat(caller.seat),
      events: res.events,
      rejectReason: res.rejectReason,
    };
  }

  /**
   * Authenticated incremental read. Returns the caller's redacted view + version
   * + the events since `since`. When `since >= version`, `stale` is true and the
   * client can no-op. A participant sees their own hand; a non-participant gets a
   * spectator view (still fog-of-war for BOTH hands — no `seat` privilege).
   */
  getViewAuthed(
    matchId: string,
    bearer: string | undefined,
    since?: number
  ): { version: number; view: MatchView; events: GameEvent[]; stale: boolean } {
    const caller = this.resolveCaller(matchId, bearer);
    const m = this.registry.get(matchId)!;
    // A spectator (authenticated non-participant) defaults to the P1 vantage but
    // still gets a fog-of-war view of BOTH hands (selfSide of a seat they don't
    // own would leak — so spectators see P1's public side only via projection,
    // never P1's hand). To avoid leaking either hand to a non-player, project
    // from the opponent's vantage of whichever seat — simplest correct choice:
    // give non-participants a view where neither hand is theirs. We model that by
    // projecting for a seat they own; non-participants get P1 vantage WITHOUT a
    // self-hand only if they aren't that seat. Since a non-participant owns no
    // seat, we must not reveal P1's hand: build a fully-redacted spectator view.
    if (caller.seat === null) {
      const inc = m.getIncrementalForSeat("P1", since ?? 0);
      // Strip P1's own hand contents so a spectator never reads a real hand.
      const spectatorView: MatchView = {
        ...inc.view,
        self: { ...inc.view.self, hand: undefined },
      };
      return { version: inc.version, view: spectatorView, events: inc.events, stale: inc.stale };
    }
    // A poll/read from a participant is a liveness signal (reconnect support):
    // a player who returns and reads the match resets their timeout clock.
    m.touch(caller.seat);
    return m.getIncrementalForSeat(caller.seat, since ?? 0);
  }

  // -----------------------------------------------------------------------
  // SPECTATE — read-only neutral observation of LIVE public matches.
  //
  // SECURITY: a spectator owns no seat and receives ONLY public (intersection)
  // state — both hands are count-only, no deck order, no secrets. The view is
  // produced by the SAME fog redactor the player path uses, applied for BOTH
  // seats. Spectating is bearer-OPTIONAL (anyone can watch the public ladder),
  // and STRICTLY read-only: these methods never submit an action, never advance
  // a match, never touch the action log or results.
  //
  // PRIVACY: only PUBLIC-QUEUE matches are listed/watchable. Private friend
  // challenge matches are NOT spectatable (they carry no `spectatable` flag), so
  // the friend-duel intent is respected.
  // -----------------------------------------------------------------------

  /** The live "watch" list: in-progress PUBLIC matches with truncated labels. */
  liveSpectatable(): LiveMatchSummary[] {
    return this.registry.liveSpectatable();
  }

  /**
   * A NEUTRAL incremental spectator read of a match (same `since`-poll model as
   * the player transport, but fully redacted). Returns null when the match is
   * unknown or not publicly spectatable — the HTTP layer maps null to 404 so a
   * private friend match is indistinguishable from a non-existent one.
   */
  spectatorView(
    matchId: string,
    since?: number
  ): { version: number; view: MatchView; events: GameEvent[]; stale: boolean } | null {
    return this.registry.spectatorIncremental(matchId, since ?? 0);
  }
}

// --------------------------------------------------------------------------
// HTTP adapter (only wired up when this file is run directly).
// --------------------------------------------------------------------------

function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export function createHttpServer(server = new GameServer()): http.Server {
  return http.createServer(async (req, res) => {
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const parts = url.pathname.split("/").filter(Boolean); // e.g. ["matches","m_1","actions"]
      // Real auth: a verifiable HMAC bearer (Authorization: Bearer <token>).
      // verifyToken (in resolveCaller) checks signature + expiry per request.
      const bearer = bearerFromAuthHeader(req.headers["authorization"]);

      if (req.method === "POST" && parts.length === 1 && parts[0] === "matches") {
        return send(200, server.createMatch(await readJson(req)));
      }

      // --- Matchmaking queue (bearer-authed) --------------------------------
      if (parts[0] === "queue" && parts.length === 1) {
        const rawAuth = req.headers["authorization"] as string | undefined;
        if (req.method === "POST") {
          const { deck } = await readJson(req);
          return send(200, server.enqueue(rawAuth, deck as DeckBootstrapInput));
        }
        if (req.method === "GET") {
          return send(200, server.queueStatus(rawAuth));
        }
        if (req.method === "DELETE") {
          return send(200, server.dequeue(rawAuth));
        }
      }
      if (
        req.method === "POST" &&
        parts[0] === "queue" &&
        parts[1] === "claim" &&
        parts.length === 2
      ) {
        const rawAuth = req.headers["authorization"] as string | undefined;
        const claimed = server.claimMatch(rawAuth);
        if (!claimed) return send(204, {});
        return send(200, claimed);
      }

      // --- Private challenges ("play with friends" by code; bearer-authed) ---
      if (parts[0] === "challenge") {
        const rawAuth = req.headers["authorization"] as string | undefined;
        if (req.method === "POST" && parts[1] === "create" && parts.length === 2) {
          const { deck } = await readJson(req);
          return send(200, server.createChallenge(rawAuth, deck as DeckBootstrapInput));
        }
        if (req.method === "POST" && parts[1] === "join" && parts.length === 2) {
          const { code, deck } = await readJson(req);
          const out = server.joinChallenge(rawAuth, String(code ?? ""), deck as DeckBootstrapInput);
          // Typed lobby errors map to 404 (invalid/expired/consumed/own-code);
          // a successful pairing returns 200 { matchId }.
          if ("error" in out) return send(404, out);
          return send(200, out);
        }
        if (req.method === "GET" && parts[1] === "status" && parts.length === 2) {
          const code = url.searchParams.get("code") ?? "";
          const out = server.challengeStatus(rawAuth, code);
          if (!out) return send(404, { error: "invalid-code" });
          return send(200, out);
        }
        if (req.method === "POST" && parts[1] === "cancel" && parts.length === 2) {
          const { code } = await readJson(req);
          return send(200, server.cancelChallenge(rawAuth, String(code ?? "")));
        }
      }

      // --- Emote preset set (the source-of-truth list; bearer-authed) --------
      if (parts[0] === "emotes" && parts.length === 1 && req.method === "GET") {
        return send(200, server.listEmotes());
      }
      // --- Ranked ladder (bearer-authed, game-internal rating only) ---------
      if (parts[0] === "rankings") {
        const rawAuth = req.headers["authorization"] as string | undefined;
        if (req.method === "GET" && parts[1] === "me" && parts.length === 2) {
          return send(200, server.myRanking(rawAuth));
        }
        if (req.method === "GET" && parts[1] === "top" && parts.length === 2) {
          const limitRaw = url.searchParams.get("limit");
          const limit = limitRaw !== null ? Number(limitRaw) : undefined;
          return send(200, server.topRankings(limit));
        }
        // One-shot rank-up ceremony: fetch the pending crossing (null if none),
        // ack it so it never replays.
        if (req.method === "GET" && parts[1] === "rankup" && parts.length === 2) {
          return send(200, server.pendingRankup(rawAuth));
        }
        if (
          req.method === "POST" &&
          parts[1] === "rankup" &&
          parts[2] === "ack" &&
          parts.length === 3
        ) {
          return send(200, server.ackRankup(rawAuth));
        }
        // Streak rewards: fetch the best claimable reward (null if none); claim
        // grants game-internal soft currency exactly once.
        if (req.method === "GET" && parts[1] === "streak" && parts.length === 2) {
          return send(200, server.streakReward(rawAuth));
        }
        if (
          req.method === "POST" &&
          parts[1] === "streak" &&
          parts[2] === "claim" &&
          parts.length === 3
        ) {
          return send(200, server.claimStreak(rawAuth));
        }
      }

      // --- Cosmetic unlocks (bearer-authed; cosmetic FLAGS only, never hex) ---
      if (
        parts[0] === "cosmetics" &&
        parts.length === 1 &&
        req.method === "GET"
      ) {
        const rawAuth = req.headers["authorization"] as string | undefined;
        return send(200, server.cosmetics(rawAuth));
      }

      // --- Season (bearer-authed; soft $CRYPT / cosmetic flags only, no hex) --
      if (parts[0] === "seasons") {
        const rawAuth = req.headers["authorization"] as string | undefined;
        if (req.method === "GET" && parts[1] === "current" && parts.length === 2) {
          return send(200, server.currentSeason());
        }
        if (req.method === "GET" && parts[1] === "leaderboard" && parts.length === 2) {
          const limitRaw = url.searchParams.get("limit");
          const limit = limitRaw !== null ? Number(limitRaw) : undefined;
          return send(200, server.seasonLeaderboard(limit));
        }
        if (req.method === "GET" && parts[1] === "rewards" && parts.length === 2) {
          return send(200, server.seasonRewards(rawAuth));
        }
        if (
          req.method === "POST" &&
          parts[1] === "rewards" &&
          parts[2] === "claim" &&
          parts.length === 3
        ) {
          const { tier } = await readJson(req);
          return send(200, server.claimSeasonReward(rawAuth, String(tier ?? "")));
        }
      }

      // --- Match history (bearer-authed; reads the caller's last-N results) ---
      if (
        parts[0] === "matches" &&
        parts[1] === "history" &&
        parts.length === 2 &&
        req.method === "GET"
      ) {
        const rawAuth = req.headers["authorization"] as string | undefined;
        const limitRaw = url.searchParams.get("limit");
        const limit = limitRaw !== null ? Number(limitRaw) : undefined;
        return send(200, server.matchHistory(rawAuth, limit));
      }

      // --- Daily quests (bearer-authed, durable per-UTC-day claims) ----------
      if (parts[0] === "quests") {
        const rawAuth = req.headers["authorization"] as string | undefined;
        if (req.method === "GET" && parts[1] === "today" && parts.length === 2) {
          return send(200, server.questsToday(rawAuth));
        }
        if (req.method === "POST" && parts[1] === "claim" && parts.length === 2) {
          const { questId } = await readJson(req);
          const out = server.claimQuest(rawAuth, String(questId ?? ""));
          if (!out.ok) return send(400, out);
          return send(200, out);
        }
      }

      // --- In-match emotes (singular `match` path, matching the social bridge
      //     contract). POST relays an emote; GET polls the recent-emotes delta.
      //     Both are participant-only; emotes never touch the engine/log. -------
      if (parts[0] === "match" && parts[1] && parts.length === 3) {
        const matchId = parts[1];
        const rawAuth = req.headers["authorization"] as string | undefined;
        if (req.method === "POST" && parts[2] === "emote") {
          const { emoteId } = await readJson(req);
          return send(200, server.sendEmote(matchId, rawAuth, String(emoteId ?? "")));
        }
        if (req.method === "GET" && parts[2] === "emotes") {
          const sinceRaw = url.searchParams.get("since");
          const since = sinceRaw !== null ? Number(sinceRaw) : 0;
          return send(200, server.pollEmotes(matchId, rawAuth, since));
        }
      }

      // --- Spectate (read-only neutral observation of LIVE public matches) ---
      //     GET /spectate/live      -> LiveMatchSummary[]   (in-progress public)
      //     GET /spectate/:id?since=N -> neutral redacted { version, view, events,
      //                                  stale }  (both hands hidden; no secrets)
      //     Bearer-OPTIONAL: anyone may watch the public ladder. Strictly
      //     read-only — no action is ever injected here. A private (friend)
      //     match returns 404 (not listed, not watchable).
      if (parts[0] === "spectate") {
        if (req.method === "GET" && parts[1] === "live" && parts.length === 2) {
          return send(200, server.liveSpectatable());
        }
        if (req.method === "GET" && parts[1] && parts.length === 2) {
          const matchId = parts[1];
          const sinceRaw = url.searchParams.get("since");
          const since = sinceRaw !== null ? Number(sinceRaw) : undefined;
          const out = server.spectatorView(matchId, since);
          if (!out) return send(404, { error: "not-spectatable" });
          return send(200, out);
        }
      }

      if (parts[0] === "matches" && parts[1]) {
        const matchId = parts[1];

        // Authenticated, fog-of-war action submission. Maps reducer outcome to
        // HTTP status the client hook expects: 200 accepted, 422 illegal move.
        if (req.method === "POST" && parts[2] === "actions") {
          const { action } = await readJson(req);
          const out = server.submitActionAuthed(matchId, bearer, action);
          if (out.accepted) {
            return send(200, { version: out.version, view: out.view, events: out.events });
          }
          // Soft-reject (illegal move) — 422 with the corrected view so the
          // client can reconcile its optimistic echo (see useRemoteCryptMatch).
          return send(422, {
            rejected: true,
            rejectReason: out.rejectReason,
            version: out.version,
            view: out.view,
          });
        }

        // Concede / forfeit: the caller loses, opponent wins. Returns the
        // caller's now-decided view (winner set) so the UI can end immediately.
        if (req.method === "POST" && parts[2] === "concede") {
          const out = server.concede(matchId, bearer);
          return send(200, out);
        }

        // Reconnect-by-action alias kept above (GET reconnect). Authenticated,
        // fog-of-war incremental state read. `?since=N` returns only events newer
        // than version N; `stale:true` if the client is current.
        if (req.method === "GET" && parts[2] === "state") {
          const sinceRaw = url.searchParams.get("since");
          const since = sinceRaw !== null ? Number(sinceRaw) : undefined;
          const out = server.getViewAuthed(matchId, bearer, since);
          return send(200, out);
        }

        // The durable record is NOT fog-of-war (it is the seed + action log, the
        // anti-cheat audit surface). It carries no hidden zone contents directly.
        if (req.method === "GET" && parts[2] === "log") {
          return send(200, server.getLog(matchId));
        }

        // Reconnect: authenticated, returns a replay-verified REDACTED view.
        if (req.method === "GET" && parts[2] === "reconnect") {
          const out = server.getViewAuthed(matchId, bearer, undefined);
          return send(200, { version: out.version, view: out.view });
        }
      }
      send(404, { error: "not-found" });
    } catch (err) {
      if (err instanceof AuthError) {
        return send(err.status, { error: err.reason });
      }
      send(400, { error: (err as Error).message });
    }
  });
}

// Run directly: `tsx server/server.ts`
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("server.ts");
if (isMain) {
  const port = Number(process.env.PORT ?? 8787);
  // Durable by default when run as a real server (CRYPT_DB_PATH overrides path).
  const store = new PersistenceStore();
  const server = new GameServer(store);
  // Reaper: every 15s, auto-concede any seat unreachable past the timeout.
  const timeoutMs = Number(process.env.CRYPT_TURN_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const reaper = setInterval(() => {
    const reaped = server.reap(timeoutMs);
    if (reaped.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[crypt reaper] auto-conceded timed-out matches: ${reaped.join(", ")}`);
    }
  }, 15_000);
  reaper.unref?.(); // never keep the process alive just for the reaper
  createHttpServer(server).listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[crypt authoritative server] listening on :${port}`);
  });
}
