/**
 * Client bridge to the read-only SPECTATE surface: a list of LIVE public matches
 * + a NEUTRAL, fully-redacted spectator view of one match (the same `since`-poll
 * model the player transport uses, but with BOTH hands hidden and no secrets).
 *
 * This is a NEW file (kept separate from ladderApi.ts / socialApi.ts so the
 * ownership areas never collide), following the SAME dependency-free pattern: a
 * thin fetch wrapper around the server endpoints, with every call FALLING BACK
 * to null when offline / unreachable — so the "Watch live" UI degrades cleanly
 * (guest sees an empty state, never an error).
 *
 * SECURITY: the server is the fog-of-war boundary. The `view` returned here is
 * already redacted server-side (both hands count-only, no deck order, no
 * face-down/secret contents) — the client never receives, and so can never
 * leak, either player's hidden information. Spectating is READ-ONLY: there is no
 * action-submitting path in this module.
 *
 * AUTH: spectating is bearer-OPTIONAL on the server (anyone may watch the public
 * ladder). We forward the auth header WHEN signed in but do NOT gate on it, so a
 * guest can still watch. Helpers are copied (not imported) from the ladderApi
 * shape because ladderApi does not export them and is owned elsewhere.
 */

import { getAuthHeader, isSignedIn } from "../nft/gameSession";

/** Authoritative server base. Defaults to same-origin so a reverse-proxied
 *  deploy "just works"; override in dev via VITE_CRYPT_SERVER_BASE. (Mirrors
 *  ladderApi.ts / socialApi.ts — spectate lives on the same server.) */
const SERVER_BASE: string =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_CRYPT_SERVER_BASE || "";

/**
 * GET JSON from a spectate endpoint. Unlike the player-facing helpers this does
 * NOT require sign-in (spectating is bearer-optional), but it forwards the auth
 * header when present. Returns null cleanly on any non-2xx / network failure so
 * the UI can render an empty state instead of an error.
 */
async function getJson<T>(path: string): Promise<T | null> {
  try {
    const auth = isSignedIn() ? getAuthHeader() : {};
    const res = await fetch(`${SERVER_BASE}${path}`, {
      headers: { accept: "application/json", ...auth },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// LIVE MATCH LIST — in-progress PUBLIC matches available to watch.
// --------------------------------------------------------------------------

/** One row in the "watch live" list. Labels are truncated wallet ids — the list
 *  carries NO private info (no hand/deck/board, no full account id). */
export interface LiveMatchSummary {
  matchId: string;
  p1Label: string;
  p2Label: string;
  turn: number;
  startedAt: number;
}

/**
 * Fetch the list of LIVE, PUBLIC, in-progress matches available to spectate.
 * Returns null when offline / unreachable (the UI shows "no live matches"), or a
 * (possibly empty) array when reachable.
 */
export function fetchLiveMatches(): Promise<LiveMatchSummary[] | null> {
  return getJson<LiveMatchSummary[]>("/spectate/live");
}

// --------------------------------------------------------------------------
// SPECTATOR VIEW — a neutral, fully-redacted projection of one match.
// --------------------------------------------------------------------------

/**
 * A neutral redacted spectator view of a match at a given `version`. `view` is
 * the server's `MatchView`-shaped projection with BOTH hands hidden (counts
 * only) and no deck order — safe to render read-only. Typed `unknown` here to
 * keep this bridge free of an engine/view import; the page narrows it to the
 * client `MatchView` shape the board adapter consumes.
 */
export interface SpectatorView {
  matchId: string;
  version: number;
  view: unknown;
}

/** Raw incremental shape the server returns for a spectator poll. */
interface SpectatorIncremental {
  version: number;
  view: { matchId?: string } & Record<string, unknown>;
  events?: unknown[];
  stale?: boolean;
}

/**
 * Fetch the NEUTRAL spectator view of a match, polling with `since` exactly like
 * the player transport. Returns null when the match is unknown, not publicly
 * spectatable (a private friend duel), or offline — the UI returns to the list.
 * On a `stale` response (no newer state than `since`) we still return the
 * current `{ version, view }` so the caller can hold its last render.
 */
export async function fetchSpectatorView(
  matchId: string,
  since: number
): Promise<SpectatorView | null> {
  const data = await getJson<SpectatorIncremental>(
    `/spectate/${encodeURIComponent(matchId)}?since=${Number.isFinite(since) ? since : 0}`
  );
  if (!data || typeof data.version !== "number" || !data.view) return null;
  return {
    matchId: (data.view.matchId as string | undefined) ?? matchId,
    version: data.version,
    view: data.view,
  };
}
