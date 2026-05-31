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
import type { Action, Seat, SubmitResult, MatchState } from "./types";

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
  readonly registry = new MatchRegistry();
  private counter = 0;

  createMatch(body: CreateMatchBody): { matchId: string; seq: number } {
    const matchId = `m_${body.seed}_${this.counter++}`;
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
      const accountId = (req.headers["x-account-id"] as string) ?? "";

      if (req.method === "POST" && parts.length === 1 && parts[0] === "matches") {
        return send(200, server.createMatch(await readJson(req)));
      }
      if (parts[0] === "matches" && parts[1]) {
        const matchId = parts[1];
        if (req.method === "POST" && parts[2] === "actions") {
          const { action } = await readJson(req);
          return send(200, server.submitAction(matchId, accountId, action));
        }
        if (req.method === "GET" && parts[2] === "state") {
          return send(200, server.getState(matchId));
        }
        if (req.method === "GET" && parts[2] === "log") {
          return send(200, server.getLog(matchId));
        }
        if (req.method === "GET" && parts[2] === "reconnect") {
          return send(200, server.reconnect(matchId));
        }
      }
      send(404, { error: "not-found" });
    } catch (err) {
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
  createHttpServer().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[crypt authoritative server] listening on :${port}`);
  });
}
