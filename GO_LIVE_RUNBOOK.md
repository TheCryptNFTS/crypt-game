# CRYPT — Go-Live Runbook

Everything is built, committed, and offline. This is the exact sequence to make
the game live at **play.freeloncity.com**, wired to the city API. Run top to
bottom. Each step says how to verify before moving on.

## State at time of writing
- **Game SPA** (`/Users/billy/crypt-game`, branch `main`): committed, offline.
  The crypt-game Vercel project was **removed** earlier (deployment is gone).
- **2026-06-10 update (commit `0678b8a`)**: the teardown P0–P2 landed — engine-trust
  fixes, response-stack/secrets/alt-wincon/server//replay deletions, artifact cut,
  FTUE rebuild, vitest now 118. `/replay` no longer exists; `/puzzles`, `/spectate`
  and `/leaderboard` are delisted from nav (direct-URL only); guest PvP is hidden
  on /play (sign-in only). Smoke list below updated to match.
- **City** (`/Users/billy/freelon/phase3/freelon-city-site`, `main`): match/auth
  layer + vendored engine committed; `/combat-archives` reverted to "sealed".
- Both repos: `git push` NOT done yet (push triggers Vercel auto-deploy).
- DNS: `play.freeloncity.com` is on **Cloudflare** (`betty/carlos.ns.cloudflare.com`).
- Engine re-synced into the city (commit `0a41d39`), `verify:engine` OK.

---

## 0. Pre-flight (verify code is green on real infra)
```
# Game
cd /Users/billy/crypt-game
npx tsc --noEmit            # expect 0 errors
npx vitest run             # expect all green (118)
npx vite build             # expect exit 0

# City
cd /Users/billy/freelon/phase3/freelon-city-site
npm ci                     # clean dep restore
npx tsc --noEmit           # 0 errors
npx vitest run             # expect 120 passing
npm run build              # full next build — MUST pass on your machine
```
> Note: the sandbox's static-export worker was flaky; `--experimental-build-mode
> compile` passed. Confirm the **full** `next build` is green on your machine
> before pushing.

## 1. City env (Vercel → freelon-city project → Settings → Environment Variables)
Confirm these Production vars exist (they did as of this session):
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `X_OAUTH_CLIENT_SECRET`,
`OPENSEA_API_KEY`. Add/confirm:
- `CRYPT_GAME_ORIGIN = https://play.freeloncity.com`  (CORS allow-list; comma-sep
  if you also want a preview origin, e.g. `https://play.freeloncity.com,https://crypt-game.vercel.app`)
- Leave `OWNED_CARDS_REQUIRE_AUTH` **unset** (OFF) for open play. Flip to `true`
  ONLY when a reward/leaderboard starts trusting ownership.

## 2. Push the city → deploy the API + (still-sealed) combat-archives
```
cd /Users/billy/freelon/phase3/freelon-city-site
git push origin main
```
Verify after deploy (≈1–2 min):
```
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://www.freeloncity.com/api/match/create   # 401 (deployed, auth-gated)
curl -s -i -X OPTIONS https://www.freeloncity.com/api/match/create \
  -H "Origin: https://play.freeloncity.com" -H "Access-Control-Request-Method: POST" \
  | grep -i access-control-allow-origin   # must echo https://play.freeloncity.com
```

## 3. Deploy the SPA as its own Vercel project
```
cd /Users/billy/crypt-game
git push origin main          # if using git-connected deploy
# Create/connect a Vercel project for this repo (build: `vite build`, output: `dist`).
vercel link --project crypt-game --scope the-crypt-s-projects --yes
vercel --prod --yes           # build + deploy; expect READY
```
- The SPA needs **no env var** in prod: `VITE_CITY_API_BASE` defaults to
  `https://freeloncity.com`. (Set it only to point at a city *preview*.)
- `vercel.json` already has the SPA rewrite (`/(.*) → /index.html`).
Verify: `curl -s -o /dev/null -w "%{http_code}\n" https://crypt-game.vercel.app` → 200.

## 4. Attach the domain (needs a green SPA deploy first)
```
cd /Users/billy/crypt-game
vercel domains add play.freeloncity.com    # (project must be linked)
```
This prints the DNS target. Then in **Cloudflare → freeloncity.com → DNS**, add:
| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `play` | `cname.vercel-dns.com` | **DNS only (grey cloud)** |
(or `A play → 76.76.21.21`). Vercel auto-verifies within minutes.
Verify: `curl -s -o /dev/null -w "%{http_code}\n" https://play.freeloncity.com` → 200.

## 5. Flip /combat-archives live (the in-city entry point)
The "terminal online + ENTER COMBAT ARCHIVES → play.freeloncity.com" version was
built then reverted. Re-apply it:
```
cd /Users/billy/freelon/phase3/freelon-city-site
# re-apply the combat-archives "online" copy (commit 9242f11 had it; cherry-pick
# the page change OR re-edit: status pill → "SIGNAL RESTORED · TERMINAL ONLINE",
# CTA <a href="https://play.freeloncity.com">ENTER COMBAT ARCHIVES →</a>)
git push origin main
```
Verify: `https://www.freeloncity.com/combat-archives` shows the CTA.

## 6. End-to-end smoke (on play.freeloncity.com)
- App mounts; connect wallet → owned-cards returns token ids → owned deck builds.
- Start a solo match: mulligan → play → attack → win ceremony.
- (If testing PvP) sign-in (SIWE) → create/queue → action round-trips; inspect a
  redacted view payload → NO `seed`/`rngCursor`/opponent hand/deck. NOTE: the
  Find Match / Challenge panels only render when signed in (guests see one line).
- Share buttons (deck `/d`, result image, challenge link) work. (`/replay` was
  deleted 2026-06-10 — a viewer nothing could produce codes for.)

---

## Rollback (if anything's wrong)
- SPA: `vercel rm crypt-game --yes` (takes play.* offline) or redeploy a prior good build.
- City: `git revert` the combat-archives commit + push (re-seals the entry point);
  the match APIs are auth-gated + unadvertised, harmless to leave deployed.
- Domain: `vercel domains rm play.freeloncity.com` detaches it.

## Pre-stakes security gate (DO NOT skip before any reward/leaderboard ties to ownership)
1. `OWNED_CARDS_REQUIRE_AUTH=true` (force SIWE on ownership reads).
2. Keep the match reducer/action route writing **zero** hex (the isolation invariant).
3. Confirm `x-real-ip` is present on the host (rate-limiter integrity) — true on Vercel.
4. HMAC prod hard-fail is in place (commit `a55c90a`) — boot fails if the secret is unset.
