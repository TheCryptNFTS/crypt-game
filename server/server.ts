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
 *   GET  /matches/:id/state        -> { state, seq }
 *   GET  /matches/:id/log          -> { seed, actionLog }   (the durable record)
 *   GET  /matches/:id/reconnect    -> { state, seq }  (replay-verified snapshot)
 *
 * The handler functions are also exported so they can be driven IN-PROCESS
 * (no socket) — which is exactly what the convergence proof does, removing all
 * network flakiness from the determinism test.
 */

import http from "node:http";
import { MatchRegistry } from "./matchEngine";
import { PersistenceStore } from "./persistence";
import { verifyToken, bearerFromAuthHeader } from "./auth";
import type { MatchView } from "./view";
import type { Action, Seat, SubmitResult, MatchState, GameEvent, AccountId } from "./types";

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
    return m.getIncrementalForSeat(caller.seat, since ?? 0);
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

        // Authenticated, fog-of-war incremental state read. `?since=N` returns
        // only events newer than version N; `stale:true` if the client is current.
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
  createHttpServer(server).listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[crypt authoritative server] listening on :${port}`);
  });
}
