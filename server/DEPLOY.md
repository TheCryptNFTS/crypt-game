# Deploy — Crypt Authoritative Server

Everything in `server/**` is **code-complete and proven locally**: fog-of-war
redaction, HMAC session auth, monotonic `version` + incremental `?since=N`
reads, and SQLite durability across restart. All four gates are green in-process
(no sockets):

```
npx tsc --noEmit                  # clean for server/** + the two new proofs
npm run dev:server-convergence    # determinism: live == replay(seed, log)
npm run dev:server-persistence    # survives restart, rejects never persist
npx tsx src/dev/runFogOfWarProof.ts
npx tsx src/dev/runAuthProof.ts
```

What remains is **TRUE-external** — infrastructure + secrets the owner executes.
None of it is code in this repo; it is the line we cannot cross from here.

---

## Punch list (owner executes)

### 1. Deploy target
- [ ] Pick a host that runs a long-lived Node process with a **persistent disk**
      (SQLite is a local file — serverless/ephemeral FS will lose the action log).
      e.g. a small VM, Fly.io, Railway, Render, or a container with a mounted
      volume. NOT a stateless lambda unless you swap the store for a hosted DB.
- [ ] Run `npm run server` (i.e. `tsx server/server.ts`) under a supervisor
      (systemd / pm2 / container restart policy). On boot it auto-recovers every
      persisted match (`MatchRegistry.bootstrap()`), so a restart loses nothing.
- [ ] Set `PORT` (default 8787) and `CRYPT_DB_PATH` (default `server/.data/crypt.db`)
      to a path on the persistent volume.

### 2. DNS — freeloncity.com
- [ ] Point the API hostname the client uses (`VITE_CITY_API_BASE`, default
      `https://freeloncity.com`) at the deployed host, OR put the city site in
      front as a reverse proxy that maps the client's paths to the server's:
      - client `POST /api/match/:id/action`  → server `POST /matches/:id/actions`
      - client `GET  /api/match/:id?since=N`  → server `GET  /matches/:id/state?since=N`
      - client `POST /api/auth/nonce`         → IdP nonce endpoint (see §4)
      - client `POST /api/auth/verify`        → IdP verify endpoint (see §4)
      The response shapes already match the client hook
      (`{ version, view, events }` / `{ version, view, stale }`), so the proxy is
      a pure path rewrite — no body transform.

### 3. TLS
- [ ] Terminate HTTPS at the edge (managed cert via the host, or
      Caddy/nginx/Cloudflare in front). The Node `http` server itself is plain
      HTTP behind the terminator. The bearer token must only travel over TLS.

### 4. Real IdP handshake (replace the issue-token shortcut)
- [ ] Stand up the two auth endpoints the client already calls
      (`src/nft/gameSession.ts`): `/api/auth/nonce` and `/api/auth/verify`.
- [ ] `/api/auth/verify` performs the SIWE wallet-signature check (recover the
      address from the EIP-4361 message the client signed; the message format is
      locked in `buildAuthMessage`), and ONLY on success calls
      `issueToken(address)` from `server/auth.ts` to mint the bearer it returns.
- [ ] (Alternative IdP) If using OIDC/JWT instead of wallet SIWE, the verify step
      validates the IdP's token, extracts the subject claim as the `accountId`,
      then calls `issueToken(accountId)`. The per-request `verifyToken` path in
      this server does NOT change either way.
- [ ] Decide `accountId` canonicalization (checksummed vs lowercased address) and
      make `/api/auth/verify` and `createMatch`'s `seats` use the SAME form, or
      seat ownership will silently fail to resolve.

### 5. Secret storage
- [ ] Provision a strong random `CRYPT_SESSION_SECRET` (e.g. 32+ bytes from a
      CSPRNG) and inject it as an env var via the host's secret store
      (Fly secrets / Railway vars / Vault / cloud secret manager). NEVER ship the
      dev default (`DEV_SESSION_SECRET` in `server/auth.ts`) — `sessionSecret()`
      falls back to it only when the env var is unset, which is for local tests.
- [ ] Rotate by setting a new secret; in-flight tokens become invalid (acceptable
      — clients re-sign). If you need zero-downtime rotation, add a secondary
      verify key (small change to `verifyToken`) — not required for launch.

### 6. Point CITY_BASE() at the deployed host
- [ ] Set `VITE_CITY_API_BASE` at the client build to the deployed API origin
      (used by `useRemoteCryptMatch.ts` `CITY_BASE()` and `gameSession.ts`).
      Defaults to `https://freeloncity.com`; override per environment.

### 7. Operational (recommended, not blocking)
- [ ] Add per-seat action-rate limits + turn timers at the gateway (the reducer
      is timing-agnostic by design — timers live outside it; see ANTICHEAT.md §5).
- [ ] Back up / replicate the SQLite file (or migrate to hosted Postgres using
      the same append-only `(matchId, seq)` shape — see PERSISTENCE.md §storage).
- [ ] Health check endpoint + structured logs.

---

## Not in scope here (other owners)
- Economy settlement / hex burn-on-entry (game ledgers SINK, never SOURCE — see
  PERSISTENCE.md §4). This server is authoritative over match OUTCOMES only.
- The engine (`src/engine/**`) — owned separately; this server only projects,
  persists, and serves it.
