# Persistence & Identity — Crypt Authoritative Server

This document describes how the authoritative server (`server/`) persists
matches and identifies players. The guiding invariant, inherited from the pure
engine, is:

> **`live MatchState === replay(seed, actionLog)`, byte-for-byte, always.**

Everything below is designed so that the only things we *must* durably store are
the **seed** and the **append-only action log**. The live state is always a
derivable cache.

---

## 1. Account / identity model

The reducer speaks only in seats: `P1` / `P2`. The server maps **accounts** to
seats, fixed at match creation.

| Concept | Where it lives | Notes |
|---|---|---|
| `AccountId` | external identity provider | opaque string; e.g. a wallet address or an auth-service subject claim. |
| `MatchRecord.seats` | per-match | immutable `{ P1: AccountId, P2: AccountId }` binding, set at creation. |
| Session token | edge / gateway | short-lived bearer the client presents per request. Resolves to an `AccountId`. |

The scaffold stubs auth with an `x-account-id` header (`server/server.ts`). In
production this header is replaced by a verified session: the gateway
authenticates the request, resolves the `AccountId`, and the match layer
enforces **seat ownership** — `AuthoritativeMatch.submit()` rejects any action
whose `player` seat is not the one owned by the submitting account
(`seat-spoof`). A client therefore cannot act for its opponent even with a valid
session.

For a wallet-native deployment, `AccountId = checksummed address`, and the
session token is a signed SIWE-style message. No private keys ever touch the
server.

---

## 2. What gets persisted (and what does NOT)

**Durable, authoritative record — `MatchRecord`:**

```
matchId      string   (PK)
seed         number   (immutable; drives ALL randomness via makeRng)
seats        { P1, P2 } -> AccountId
actionLog    APPEND-ONLY [{ seq, action, by, receivedAt }]
createdAt    number
```

**Derived / cache — NOT a source of truth:**

- `MatchState` (the live board). Rebuilt at any time via
  `replayMatch({ seed, actionLog })`. We may *snapshot* it for speed, but a
  snapshot is always disposable and re-verifiable.

### Why this is enough

The engine is pure and seeded: no `Date.now()`, no `Math.random()` — all RNG is
rebuilt from `state.seed` + `state.rngCursor` (see `src/engine/rng.ts`,
`src/engine/reducer.ts`). Therefore `(seed, actionLog)` **fully determines** the
match. Storing the log + seed is storing the entire match, losslessly, in a
form that is tiny compared to full board snapshots.

### Storage shape

- **Action log:** an append-only table keyed `(matchId, seq)` with a UNIQUE
  constraint on `(matchId, seq)`. `seq` is dense and 0-based; index === seq.
  Appends are the only writes — never updates, never deletes. This maps cleanly
  onto an event-store, a Postgres table with a serial-per-match `seq`, or a
  Kafka-style log partitioned by `matchId`.
- **Match header:** one row per match for `seed`, `seats`, `createdAt`.
- **Optional snapshot cache:** `(matchId, seq, stateBlob)` written every N
  actions to bound replay cost (replay from nearest snapshot ≤ seq, then fold
  the tail). The snapshot is *advisory*; it is validated by hashing against a
  full replay during audits.

### Write path (commit discipline)

`AuthoritativeMatch.submit()` only appends to the log **after** the pure reducer
has *advanced* state (fresh clone, no `REJECTED` event). A rejected/illegal/
impossible action never enters the durable log. So the log is, by construction,
a sequence of **only legal** actions — which is exactly what makes a clean
replay possible. To persist: in the same step that pushes to `actionLog`,
durably append the row; ack the client only after the append is fsync'd
(at-least-once). On replay, the `seq` UNIQUE constraint makes a duplicated
append idempotent.

---

## 3. Reconnection via replay

A dropped client reconnects by asking the server for a fresh snapshot:

1. `MatchRegistry.snapshotForReconnect(matchId)` calls
   `AuthoritativeMatch.reconcileFromLog()`.
2. That runs `replayMatch({ seed, actionLog })` from scratch and **asserts** the
   replayed state hashes equal to the live cache (throws on divergence — a
   determinism bug, never a normal condition).
3. The client receives `{ state, seq }` and resumes listening to the broadcast
   stream from `seq` onward.

Because replay is authoritative, a reconnecting client needs to trust nothing it
held locally; it discards its stale view and adopts the server-derived one.

---

## 4. Economy boundary (project rule)

A broader project rule applies: **game ledgers may SINK real hex currency but
never SOURCE (mint) it.** This server is authoritative over match *outcomes*
only. Any reward/settlement layer reads finalized, replay-verified match results
and may *debit/burn* on entry or *escrow* stakes, but the authoritative server
itself never credits currency. Outcome authority lives here; minting authority
lives nowhere in this path.
