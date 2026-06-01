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

// --------------------------------------------------------------------------
// FRIENDS — a local-first contact list for direct challenges.
//
// This is a DEVICE-LOCAL list today (localStorage, same graceful pattern as
// meta/progression.ts + lib/localProgress.ts) with a deliberate PLUGGABLE SEAM
// so a real backend can be dropped in later without touching the UI: every
// accessor is async and routes through `friendsBackend`. The default backend is
// the local store; assign `friendsBackend = <server-backed impl>` once the
// authoritative endpoints exist. HEX-SAFETY: a friend entry is just a label +
// a reusable private challenge code — it carries NO currency and mints nothing.
// --------------------------------------------------------------------------

/** One saved friend: a stable id, a display label, and the reusable private
 *  challenge code they shared (the same short code `createChallenge` mints).
 *  `code` may be empty for a name-only contact added before a code is known. */
export interface Friend {
  id: string;
  name: string;
  /** The friend's reusable private challenge code (empty if not yet known). */
  code: string;
  /** When this friend was added (epoch ms). */
  addedAt: number;
}

/** The seam a later backend implements. The default is the local store below. */
export interface FriendsBackend {
  list(): Promise<Friend[]>;
  add(input: { name: string; code?: string }): Promise<Friend[]>;
  remove(id: string): Promise<Friend[]>;
}

const FRIENDS_STORAGE_KEY = "crypt_social_friends_v1";

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function readFriends(): Friend[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Defensively normalise each entry so a hand-edited/legacy blob stays safe.
    return parsed
      .map((f) => f as Partial<Friend>)
      .filter((f) => typeof f?.id === "string" && typeof f?.name === "string")
      .map((f) => ({
        id: f.id as string,
        name: (f.name as string).trim(),
        code: typeof f.code === "string" ? f.code.trim() : "",
        addedAt: typeof f.addedAt === "number" ? f.addedAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

function writeFriends(friends: Friend[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(friends));
  } catch {
    /* quota/private-mode — degrade to in-memory for this session */
  }
}

function makeFriendId(): string {
  // Browser-safe unique id (no node globals); falls back when crypto is absent.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** The default, device-local friends backend (localStorage-backed). */
const localFriendsBackend: FriendsBackend = {
  async list() {
    return readFriends();
  },
  async add({ name, code }) {
    const trimmedName = name.trim();
    if (!trimmedName) return readFriends();
    const trimmedCode = (code ?? "").trim();
    const friends = readFriends();
    // De-dupe: same code (when present) OR same case-insensitive name.
    const existing = friends.find(
      (f) =>
        (trimmedCode && f.code === trimmedCode) ||
        f.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existing) {
      // Update a known friend's code if a newer one was supplied.
      if (trimmedCode && existing.code !== trimmedCode) {
        existing.code = trimmedCode;
        writeFriends(friends);
      }
      return friends;
    }
    const next: Friend[] = [
      ...friends,
      { id: makeFriendId(), name: trimmedName, code: trimmedCode, addedAt: Date.now() },
    ];
    writeFriends(next);
    return next;
  },
  async remove(id) {
    const next = readFriends().filter((f) => f.id !== id);
    writeFriends(next);
    return next;
  },
};

/**
 * The active friends backend. Defaults to the device-local store; reassign to a
 * server-backed implementation later WITHOUT changing any caller. This is the
 * single seam the UI talks to.
 */
export let friendsBackend: FriendsBackend = localFriendsBackend;

/** Swap in a different friends backend (e.g. a future server-backed one). */
export function setFriendsBackend(backend: FriendsBackend): void {
  friendsBackend = backend;
}

/** List saved friends. */
export function listFriends(): Promise<Friend[]> {
  return friendsBackend.list();
}

/** Add a friend by display name (+ optional private challenge code). Returns
 *  the updated list. No-ops on an empty name. */
export function addFriend(input: { name: string; code?: string }): Promise<Friend[]> {
  return friendsBackend.add(input);
}

/** Remove a friend by id. Returns the updated list. */
export function removeFriend(id: string): Promise<Friend[]> {
  return friendsBackend.remove(id);
}

// --------------------------------------------------------------------------
// IN-MATCH EMOTES (cont.)
// --------------------------------------------------------------------------

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
