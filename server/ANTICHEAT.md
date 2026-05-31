# Anti-Cheat — Crypt Authoritative Server

The whole value proposition of the Crypt engine is **determinism**:
`applyAction(state, action) => { state, events }` is pure and seeded, so
`(seed, actionLog)` reproduces a match byte-for-byte. The server leverages this
for anti-cheat. There are no client-side rules to trust.

---

## 1. The authoritative-outcome principle

**The client sends INTENTS, never state.**

A client may submit only an `Action` (e.g. `PLAY_UNIT`, `ATTACK_FACE`,
`END_TURN`). It may **never** submit a `MatchState`, a damage number, a draw, an
RNG result, or "I won". The server:

1. Authenticates the account and resolves its seat.
2. Folds the action through the **pure reducer** to derive the next state.
3. Decides legality and *all* outcomes itself (damage, draws, deaths, RNG).
4. Broadcasts only the reducer's `events`.

The client is a renderer of server-derived truth. Anything it computes locally
is a *prediction* the server can overrule. This single rule eliminates the
entire class of "client claims an impossible result" cheats, because the client
never gets to assert a result at all.

---

## 2. How an impossible action is caught

There are two layers, both server-side.

### Layer A — pre-reducer identity guard (`AuthoritativeMatch.submit`)

Before the reducer runs, the server checks **seat ownership**: the submitting
account must own the seat named in `action.player`. A spoofed seat is rejected
(`seat-spoof`) and **never enters the append-only log**. This stops a player
from acting as their opponent even with a valid session.

### Layer B — the reducer is the legality oracle

The pure reducer is *reject-soft*: an illegal action returns the **original
state reference unchanged** plus a single `REJECTED` event (see
`reducer.ts applyAction`). Examples it rejects: acting out of turn
(`not-your-turn`), playing a card you can't afford (`not-enough-energy`), an
out-of-bounds hand index (`hand-index-out-of-bounds`), attacking with an
exhausted unit, acting while a choice is pending (`choice-pending`), or acting
after the match is decided (`match-over`).

Critically, card identity is taken from `player.hand[handIndex]` — **index
based, never a client-sent cardId** — so a client cannot "play" a card it does
not hold by naming it.

`submit()` detects a reject (unchanged-reference OR a `REJECTED` event) and
**refuses to append it to the log**. Therefore:

> The append-only action log is, by construction, a sequence of **only legal**
> actions. An impossible action is a no-op that leaves no trace.

### Replay-based audit (the deep check)

Independently of live play, an auditor can take the durable `{seed, actionLog}`
and run `replayMatch()` from scratch. Because the engine is deterministic:

- The replayed final state **must** hash-equal the live/reported final state. A
  mismatch means the live state was tampered with out-of-band (a server bug or a
  compromised node) — `reconcileFromLog()` throws on exactly this.
- Re-submitting each logged action in order **must** be accepted by the reducer
  at that point. If any logged action would now reject, the log is corrupt. (In
  normal operation this can't happen, since `submit()` only logs accepted
  actions — so a failing replay is a tamper/serialization-bug signal, not a
  gameplay event.)

This gives a cheap, offline, byte-exact verification of any match from its seed
and log alone. No trust in any client, and no trust in the live node beyond the
durable log.

---

## 3. Fog of war (information-leak defense) — IMPLEMENTED

The authoritative `MatchState` is COMPLETE server-side (both hands, both deck
orders) — that completeness is required for determinism and replay. But nothing
hidden ever crosses the wire. Before any state leaves the server it is projected
to a per-seat **redacted view** (`server/view.ts` → `projectViewForSeat`, wired
through `AuthoritativeMatch.getViewForSeat(seat)` and the `*Authed` server
methods):

| Zone | Your own side | Opponent's side |
|---|---|---|
| Hand | full card ids (visible) | `handCount` only — the `hand` field is **omitted entirely** |
| Deck | `deckCount` only (ORDER never sent) | `deckCount` only (ORDER never sent) |
| Board / artifacts | full (public) | full (public) |
| Nexus / energy | full | full |

Key property: **redaction is a pure VIEW transform** over a clone. It reads the
authoritative state and returns a fresh object; it never mutates the state the
reducer folds or persists. Determinism and replay are untouched — a fresh
`replayMatch(seed, actionLog)` still reproduces the COMPLETE state byte-for-byte.
A spectator (authenticated non-participant) gets a view with BOTH hands redacted.
Proven by `src/dev/runFogOfWarProof.ts`.

## 3a. Session auth (identity proof) — IMPLEMENTED

The scaffold's trust-the-header (`x-account-id`) stub is replaced by an
HMAC-SHA-256 signed session token (`server/auth.ts`, Node built-in `crypto`, no
new dependency). A token carries `{ sub: accountId, exp: epochMs }` and a
signature over exactly those bytes, signed with a server secret from
`CRYPT_SESSION_SECRET` (a clearly-marked dev default exists so in-process proofs
need no env). Every request verifies signature (constant-time `timingSafeEqual`)
**and** expiry BEFORE resolving a seat; a tampered, forged, or expired token is
rejected (401). Seat ownership is still enforced after identity resolves, so a
valid token for A can never act for B's seat (`seat-spoof`). Proven by
`src/dev/runAuthProof.ts`.

**What the real IdP handshake replaces:** `issueToken(accountId)` is the "mint a
session bearer for an already-authenticated account" half of a real flow. In
production the account is authenticated FIRST by an external identity proof — the
SIWE wallet signature flow in `src/nft/gameSession.ts` (`/api/auth/nonce` →
`personal_sign` → `/api/auth/verify`) or an OIDC/JWT IdP — and only then does the
gateway call `issueToken`. The per-request `verifyToken` step (signature +
expiry) stays exactly as-is; only the upstream "how we first decided this is
account A" changes. The token itself grants ZERO economy authority (PERSISTENCE.md
§4): at worst a stolen, unexpired token lets someone play your PvP turns.

## 5. What this design does NOT cover (scope honesty)

- **Timing / rate abuse:** add per-seat action-rate limits and turn timers at
  the gateway. The reducer is timing-agnostic by design (no `Date.now()`), so
  timers live outside it.
- **Collusion / bot detection:** behavioral, out of scope for the engine layer.
- **RNG grinding:** the seed is server-chosen and not revealed pre-match;
  clients cannot pick favorable seeds.

---

## 6. Summary

| Cheat attempt | Defense |
|---|---|
| Submit a fake winning state | Impossible — clients submit actions, not state. |
| Act as the opponent | Layer A seat guard (`seat-spoof`), not logged. |
| Play a card you don't hold | Index-based identity; reducer rejects, not logged. |
| Act out of turn / illegally | Reducer reject-soft; not logged. |
| Tamper with the live board | Replay audit (`reconcileFromLog`) detects hash mismatch. |
| Claim a different RNG outcome | RNG is server-derived from the secret seed; clients have no say. |

Authoritative outcomes + a deterministic, replayable, append-only log = every
match is independently verifiable from `{seed, actionLog}` alone.
