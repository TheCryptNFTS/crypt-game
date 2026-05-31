/**
 * Crypt PvP wallet sign-in (EIP-4361 / "Sign-In with Ethereum"-shaped).
 *
 * This proves the player controls their address so the authoritative PvP server
 * can bind a match seat to a wallet. It is purely an IDENTITY proof for PvP:
 *
 *   SCOPE / SECURITY: the issued token grants ZERO economy authority. It cannot
 *   move funds, mint, burn, or source/sink hex — it only authenticates match
 *   actions (play/attack/end-turn) which the server validates against the
 *   authoritative reducer. A stolen token can, at worst, let someone play your
 *   PvP turns; it can never touch the economy.
 *
 *   XSS NOTE: the token is held in memory AND mirrored to `localStorage`
 *   (key `crypt.gameSession`) so a refresh keeps you signed in. localStorage is
 *   readable by any script on the origin, so an XSS bug could exfiltrate the
 *   token. We accept that tradeoff ONLY because the token has no economy power
 *   (see above) and expires; never store anything funds-bearing this way.
 *
 * Flow:
 *   1. POST /api/auth/nonce {address}            -> {nonce}
 *   2. build the EIP-4361-shaped message (MUST byte-match the server's
 *      buildAuthMessage — coordinated via the locked contract, not importable
 *      cross-repo) and `personal_sign` it with the injected EIP-1193 provider.
 *   3. POST /api/auth/verify {address, signature} -> {token, address, expiresAt}
 */

const CITY_API_BASE: string =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_CITY_API_BASE || "https://freeloncity.com";

/** Domain the server signs/verifies against. MUST match server buildAuthMessage. */
const AUTH_DOMAIN = "freeloncity.com";
const AUTH_STATEMENT =
  "Authenticate to Crypt PvP. This does not move funds or hex.";

const STORAGE_KEY = "crypt.gameSession";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type StoredSession = {
  token: string;
  address: string;
  expiresAt: number;
};

/** Reuse the same injected-provider access pattern as walletOwnership.ts. */
function getProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return eth && typeof eth.request === "function" ? eth : null;
}

// In-memory copy of the active session (authoritative within the tab).
let session: StoredSession | null = null;

function loadFromStorage(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.address) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(next: StoredSession | null) {
  session = next;
  if (typeof window === "undefined") return;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage may be unavailable (private mode) — in-memory copy still works. */
  }
}

function currentSession(): StoredSession | null {
  if (!session) session = loadFromStorage();
  if (session && session.expiresAt && session.expiresAt <= Date.now()) {
    // Expired — drop it so callers re-sign rather than send a dead token.
    persist(null);
    return null;
  }
  return session;
}

/**
 * Build the EIP-4361-shaped message. The EXACT string must match the server's
 * `buildAuthMessage(address, nonce, issuedAt)`; this replicates the agreed
 * format. Field order and labels are load-bearing — do not reorder.
 */
export function buildAuthMessage(
  address: string,
  nonce: string,
  issuedAt: string,
): string {
  return [
    `${AUTH_DOMAIN} wants you to sign in with your Ethereum account:`,
    address,
    "",
    AUTH_STATEMENT,
    "",
    `URI: https://${AUTH_DOMAIN}`,
    "Version: 1",
    "Chain ID: 1",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

async function postJson<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(`${CITY_API_BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...getAuthHeader() },
      body: JSON.stringify(body),
    });
    let data: T | null = null;
    try {
      data = (await res.json()) as T;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/**
 * Full sign-in. Returns the bearer token on success, or null on any failure
 * (no wallet, user rejected the signature, server rejected the proof).
 *
 * The contract's /verify body is {address, signature} only — the server
 * reconstructs the exact signed message from the nonce it minted (and, if it
 * issues one, the issuedAt it stored against that nonce). We therefore prefer a
 * server-provided `issuedAt` from /nonce so both sides build a byte-identical
 * message; we only fall back to a client timestamp if the server omits it.
 */
export async function signIn(address: string): Promise<string | null> {
  const provider = getProvider();
  if (!provider || !address) return null;

  const lower = address.toLowerCase();

  // 1. Ask the server for a fresh nonce bound to this address.
  const nonceRes = await postJson<{ nonce?: string; issuedAt?: string }>(
    "/api/auth/nonce",
    { address: lower },
  );
  if (!nonceRes.ok || !nonceRes.data?.nonce) return null;
  const nonce = nonceRes.data.nonce;
  // The server derives Issued At deterministically from the nonce (a constant
  // epoch-0 timestamp; see city `nonceIssuedAt`) and does NOT round-trip it, so
  // we must default to that SAME constant for the message to recover the right
  // address. Still prefer a server-provided value if the contract ever sends one.
  const issuedAt = nonceRes.data.issuedAt ?? new Date(0).toISOString();

  // 2. Build + sign the message with the player's wallet.
  const message = buildAuthMessage(lower, nonce, issuedAt);
  let signature: string;
  try {
    signature = (await provider.request({
      method: "personal_sign",
      // personal_sign params: [message, address]. Hex-encoding the message is
      // accepted by all major wallets; we pass the raw UTF-8 string which
      // MetaMask/Rabby treat as the human-readable message.
      params: [message, lower],
    })) as string;
  } catch {
    // User rejected the signature prompt, or the provider errored.
    return null;
  }
  if (!signature) return null;

  // 3. Exchange the signature for a bearer token.
  const verifyRes = await postJson<{ token?: string; address?: string; expiresAt?: number }>(
    "/api/auth/verify",
    { address: lower, signature },
  );
  if (!verifyRes.ok || !verifyRes.data?.token) return null;

  persist({
    token: verifyRes.data.token,
    address: verifyRes.data.address ?? lower,
    // Default to a 24h window if the server omits an explicit expiry.
    expiresAt: verifyRes.data.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000,
  });
  return verifyRes.data.token;
}

/** Authorization header for authed calls, or `{}` when not signed in. */
export function getAuthHeader(): Record<string, string> {
  const s = currentSession();
  return s ? { Authorization: `Bearer ${s.token}` } : {};
}

/** The signed-in address (lowercased), or null. */
export function getSessionAddress(): string | null {
  return currentSession()?.address ?? null;
}

/** True when a non-expired token is held. */
export function isSignedIn(): boolean {
  return currentSession() !== null;
}

/** Drop the session from memory + localStorage. */
export function signOut(): void {
  persist(null);
}
