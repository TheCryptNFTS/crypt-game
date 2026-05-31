/**
 * Session auth — HMAC-signed bearer tokens (no network, no new dependency).
 *
 * The scaffold trusted an `x-account-id` header outright: anyone could claim to
 * be anyone. This module replaces that with a verifiable, self-contained session
 * token, signed with a server-held secret using Node's built-in `crypto`
 * (HMAC-SHA-256). A token carries `{ accountId, expiry }` and a signature over
 * exactly those fields; the server re-derives the signature on every request and
 * rejects anything tampered or expired BEFORE resolving a seat.
 *
 * Token wire form (compact, URL-safe, three base64url segments):
 *
 *     base64url(headerJson) "." base64url(payloadJson) "." base64url(hmac)
 *
 *   - header  = { alg: "HS256", typ: "CST" }        (CST = Crypt Session Token)
 *   - payload = { sub: accountId, exp: epochMs }
 *   - hmac    = HMAC_SHA256(secret, `${headerSeg}.${payloadSeg}`)
 *
 * This is intentionally JWT-shaped (and would be a strict JWT if we wanted a
 * `kid`/`iat`), but we keep it minimal and dependency-free. Verification uses a
 * CONSTANT-TIME comparison (`crypto.timingSafeEqual`) so a forged signature
 * leaks nothing through timing.
 *
 * SECRET: read from `CRYPT_SESSION_SECRET`. For local proofs / dev there is a
 * clearly-marked default dev secret so in-process tests need no env wiring — but
 * a deployment MUST set a real secret (see DEPLOY.md). The token grants ZERO
 * economy authority (see gameSession.ts / PERSISTENCE.md §4): at worst a stolen
 * token lets someone play your PvP turns until it expires.
 *
 * What this STANDS IN FOR: in production the bearer the client presents is the
 * verified output of a real IdP handshake (the SIWE wallet flow in
 * `src/nft/gameSession.ts`, or an OIDC/JWT IdP). The handshake resolves an
 * `accountId`; THIS module is exactly the "mint a session bearer for a resolved
 * accountId, then verify it cheaply per request" half of that. ANTICHEAT.md §5
 * documents what the real handshake replaces.
 */

import crypto from "node:crypto";

/** Default DEV-ONLY secret. Overridden by `CRYPT_SESSION_SECRET`. NEVER ship
 *  a deployment relying on this — DEPLOY.md lists secret provisioning. */
export const DEV_SESSION_SECRET = "crypt-dev-session-secret-DO-NOT-USE-IN-PROD";

/** Resolve the active signing secret: env var wins, dev default otherwise. */
export function sessionSecret(): string {
  return process.env.CRYPT_SESSION_SECRET || DEV_SESSION_SECRET;
}

/** Default token lifetime when an explicit expiry isn't supplied (24h). */
export const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

interface TokenHeader {
  alg: "HS256";
  typ: "CST";
}

interface TokenPayload {
  /** Subject: the authenticated accountId. */
  sub: string;
  /** Expiry, epoch milliseconds. */
  exp: number;
}

/** The successful result of verifying a token. */
export interface VerifiedSession {
  accountId: string;
  expiry: number;
}

export type AuthFailureReason =
  | "missing-token"
  | "malformed-token"
  | "bad-signature"
  | "expired";

export interface VerifyOk {
  ok: true;
  session: VerifiedSession;
  reason?: undefined;
}
export interface VerifyFail {
  ok: false;
  reason: AuthFailureReason;
  session?: undefined;
}
export type VerifyResult = VerifyOk | VerifyFail;

// --- base64url helpers (no padding) -----------------------------------------

function b64urlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function b64urlDecodeToString(seg: string): string {
  return Buffer.from(seg, "base64url").toString("utf8");
}

function hmac(secret: string, signingInput: string): Buffer {
  return crypto.createHmac("sha256", secret).update(signingInput).digest();
}

const HEADER: TokenHeader = { alg: "HS256", typ: "CST" };
const HEADER_SEG = b64urlEncode(JSON.stringify(HEADER));

/**
 * Mint a signed session token for a resolved accountId. This is the
 * issue-token helper tests + a real IdP-gateway both use AFTER they have
 * authenticated the account by some out-of-band means (wallet signature, OIDC).
 *
 * @param accountId the authenticated account
 * @param opts.ttlMs   lifetime from now (default 24h)
 * @param opts.now     injectable clock for deterministic tests
 * @param opts.expiry  explicit absolute expiry (overrides ttlMs) — used to mint
 *                     already-expired tokens in tests
 * @param opts.secret  override the signing secret (tests forge with a wrong one)
 */
export function issueToken(
  accountId: string,
  opts: { ttlMs?: number; now?: number; expiry?: number; secret?: string } = {}
): string {
  const now = opts.now ?? Date.now();
  const exp = opts.expiry ?? now + (opts.ttlMs ?? DEFAULT_TOKEN_TTL_MS);
  const payload: TokenPayload = { sub: accountId, exp };
  const payloadSeg = b64urlEncode(JSON.stringify(payload));
  const signingInput = `${HEADER_SEG}.${payloadSeg}`;
  const sig = hmac(opts.secret ?? sessionSecret(), signingInput);
  return `${signingInput}.${b64urlEncode(sig)}`;
}

/**
 * Verify a session token: structural parse, CONSTANT-TIME signature check
 * against the server secret, then expiry. Returns the resolved accountId on
 * success or a typed failure reason. Never throws on bad input.
 *
 * @param now injectable clock for deterministic expiry tests
 */
export function verifyToken(
  token: string | undefined | null,
  now: number = Date.now()
): VerifyResult {
  if (!token) return { ok: false, reason: "missing-token" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed-token" };
  const [headerSeg, payloadSeg, sigSeg] = parts;

  // Recompute the signature over the EXACT received header.payload bytes and
  // compare in constant time. A tampered header/payload OR a forged signature
  // (e.g. signed with the wrong secret) fails here.
  const expectedSig = hmac(sessionSecret(), `${headerSeg}.${payloadSeg}`);
  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(sigSeg, "base64url");
  } catch {
    return { ok: false, reason: "malformed-token" };
  }
  if (
    providedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(providedSig, expectedSig)
  ) {
    return { ok: false, reason: "bad-signature" };
  }

  // Signature is valid — now the payload is trustworthy to parse.
  let payload: TokenPayload;
  try {
    payload = JSON.parse(b64urlDecodeToString(payloadSeg)) as TokenPayload;
  } catch {
    return { ok: false, reason: "malformed-token" };
  }
  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") {
    return { ok: false, reason: "malformed-token" };
  }
  if (payload.exp <= now) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, session: { accountId: payload.sub, expiry: payload.exp } };
}

/**
 * Extract a bearer token from an HTTP `Authorization` header value.
 * Accepts `Authorization: Bearer <token>` (the shape `gameSession.getAuthHeader`
 * already sends). Returns undefined if absent/malformed.
 */
export function bearerFromAuthHeader(
  header: string | string[] | undefined
): string | undefined {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m ? m[1].trim() : undefined;
}
