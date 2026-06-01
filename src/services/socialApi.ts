/**
 * Client bridge to the AUTHORITATIVE social surface: private "play with friends"
 * challenges (by short shareable code) + in-match typographic quick-chat emotes.
 *
 * This is a NEW file (kept separate from ladderApi.ts so the two ownership areas
 * never collide), but it follows the SAME dependency-free pattern: a thin fetch
 * wrapper around the bearer-authed server endpoints, with every call FALLING
 * BACK to a null result when offline / unauthenticated — so guest/offline UI
 * degrades cleanly with no server.
 *
 * HEX-SAFETY: a private lobby and an emote carry NO currency whatsoever. Nothing
 * here mints or moves real on-chain hex (the server has no such path). Challenges
 * pair two players into a normal deterministic match; emotes are a fixed preset
 * set of typographic marks + the ⬡ glyph — no free text, no images, no emoji.
 */

import { getAuthHeader, isSignedIn } from "../nft/gameSession";

/** Authoritative server base. Defaults to same-origin so a reverse-proxied
 *  deploy "just works"; override in dev via VITE_CRYPT_SERVER_BASE. (Mirrors
 *  ladderApi.ts — the social endpoints live on the same authoritative server.) */
const SERVER_BASE: string =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_CRYPT_SERVER_BASE || "";

// --- Shared fetch helpers (same shape as ladderApi.ts; copied rather than
//     imported because ladderApi does not export them and is owned elsewhere).
//     Both return null cleanly when offline/guest so the UI can fall back. -----

async function getJson<T>(path: string): Promise<T | null> {
  if (!isSignedIn()) return null;
  try {
    const res = await fetch(`${SERVER_BASE}${path}`, {
      headers: { accept: "application/json", ...getAuthHeader() },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  if (!isSignedIn()) return null;
  try {
    const res = await fetch(`${SERVER_BASE}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// PRIVATE CHALLENGES — "play with friends" by short shareable code.
// --------------------------------------------------------------------------

/** A freshly-created private lobby: the shareable code + its expiry (epoch ms). */
export interface ChallengeLobby {
  code: string;
  expiresAt: number;
}

/**
 * CREATE a private lobby. The server mints a short code and parks the caller as
 * the creator (P1) OUTSIDE the public queue. Share the code with one friend.
 * Returns null when offline/unauthenticated. The deck is resolved server-side
 * (the city proxy injects the caller's owned deck, exactly as for the queue).
 */
export function createChallenge(): Promise<ChallengeLobby | null> {
  return postJson<ChallengeLobby>("/challenge/create", {});
}

/** A creator's poll of their lobby: has a friend joined, and the paired matchId. */
export interface ChallengeStatus {
  code: string;
  joined: boolean;
  matchId: string | null;
}

/**
 * POLL a lobby by code (creator-facing). When `joined` flips true, `matchId` is
 * the paired match the creator should claim + enter. Returns null when offline /
 * unauthenticated / the code is unknown or expired.
 */
export function pollChallenge(code: string): Promise<ChallengeStatus | null> {
  return getJson<ChallengeStatus>(`/challenge/status?code=${encodeURIComponent(code)}`);
}

/**
 * JOIN a lobby by code as the second player (P2). On success the server pairs
 * exactly these two into a normal deterministic match and returns `{ matchId }`;
 * a bad/expired/consumed/own code returns `{ error }`. Returns null only when
 * offline/unauthenticated. The joiner's deck is resolved server-side.
 */
export async function joinChallenge(
  code: string
): Promise<{ matchId: string } | { error: string } | null> {
  if (!isSignedIn()) return null;
  try {
    const res = await fetch(`${SERVER_BASE}/challenge/join`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ code }),
    });
    // 200 => { matchId }; 404 => { error } (invalid/expired/consumed/own-code).
    if (res.status === 200) return (await res.json()) as { matchId: string };
    if (res.status === 404) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      return { error: data?.error ?? "invalid-code" };
    }
    return null;
  } catch {
    return null;
  }
}

/** CANCEL the caller's open lobby (creator only, before anyone joins). Fire-and
 *  -forget: silently no-ops when offline/unauthenticated. */
export async function cancelChallenge(code: string): Promise<void> {
  await postJson<{ cancelled: boolean }>("/challenge/cancel", { code });
}

// --------------------------------------------------------------------------
// IN-MATCH EMOTES — typographic quick-chat relay (no free text/image/emoji/hex).
// --------------------------------------------------------------------------

/** One preset emote: a stable id + its typographic label (⬡ glyph + marks). */
export interface EmotePreset {
  id: string;
  label: string;
}

/** Fetch the server's fixed preset emote set (the only ids a client may send).
 *  Returns null when offline/unauthenticated. */
export function listEmotes(): Promise<EmotePreset[] | null> {
  return getJson<EmotePreset[]>("/emotes");
}

/**
 * Send an emote in a match. The server validates the caller is a participant +
 * the id is in the preset set, rate-limits (~1 / 2s), then relays it to the
 * opponent's poll channel. Returns `{ ok }`, or null when offline/unauthenticated.
 */
export function sendEmote(
  matchId: string,
  emoteId: string
): Promise<{ ok: boolean } | null> {
  return postJson<{ ok: boolean }>(
    `/match/${encodeURIComponent(matchId)}/emote`,
    { emoteId }
  );
}

/** One delivered emote: which account sent it, the id, and when (epoch ms). */
export interface EmoteEvent {
  from: string;
  emoteId: string;
  at: number;
}

/**
 * Poll emotes in a match newer than `since` (epoch ms; pass 0 first time, then
 * the max `at` you've seen). Participant-only on the server. Returns the recent
 * delta, or null when offline/unauthenticated.
 */
export function pollEmotes(
  matchId: string,
  since: number
): Promise<EmoteEvent[] | null> {
  return getJson<EmoteEvent[]>(
    `/match/${encodeURIComponent(matchId)}/emotes?since=${since}`
  );
}
