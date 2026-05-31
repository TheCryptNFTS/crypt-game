# Crypt Engine — Resolution Model (no-stack, immediate, deterministic)

This is the **canonical reference** for how effects, triggers, deaths, and auras
resolve in the Crypt TCG reducer (`src/engine/reducer.ts`). Read this before
touching any trigger-firing or death-reaping code. Ordering bugs here are desync
bugs in multiplayer/replay.

## 1. No stack. No priority. No responses.

Crypt resolves effects **immediately and depth-first** the instant they trigger —
the same model as Hearthstone and Marvel Snap. There is deliberately **no stack,
no priority window, and no responses/counterspells**. When an effect causes a
death that causes another trigger, that inner trigger resolves fully **within the
same action**, never silently deferred to the next one.

Death triggers specifically are routed through a small **FIFO trigger queue**
(`state.triggerQueue`) that is **drained to completion** before the action
returns — see §5. This is still no-stack / immediate in spirit: the queue exists
only to make a *chain* of deaths ("X dies → its ON_DEATH kills Y → Y's ON_DEATH
fires → Y's death-watchers mint") resolve correctly and deterministically, rather
than dropping the chained deaths until the next action's reap.

This is an intentional design choice, NOT a missing feature. Do **not** add a
stack/priority system. The job is to keep this model deterministic and
documented, not to replace it.

## 2. Determinism contract

`(seed, actionList)` fully determines the resulting state and event stream on
both client and server. Game-affecting logic therefore:

- never reads `Date.now()` / `Math.random()` (all randomness is rebuilt from
  `state.seed` + `state.rngCursor`);
- never depends on `Object.keys` / `Map` / `Set` iteration order. The only Maps
  in the reducer (`cardMetaById`, `compiledAbilityCache`) are static lookups,
  never iterated for game-affecting ordering;
- iterates boards using **fixed literal arrays** (`["P1","P2"]`, `["front","back"]`)
  and ascending array indices.

## 3. Canonical simultaneous-resolution order

When a single action makes several units die or several triggers fire at once
(AoE/cleave, adjacency splash, aura-loss combined with combat, a multi-token
summon), they resolve in this **stable board order**:

1. **By owner** — `P1` before `P2`. This is an **absolute** order (fixed literal
   array), NOT active-player-relative. A replay produces the identical order no
   matter whose action caused the storm.
2. **By lane** — `front` before `back`.
3. **By array index** — ascending. `Array.prototype.filter` preserves index
   order, so the dying-units snapshot is already index-ascending.

So a death storm reaps in this sweep:
`P1.front[asc] → P1.back[asc] → P2.front[asc] → P2.back[asc]`.

ON_DEATH effects fire, and graveyard records are appended, in exactly that order.

## 4. Multi-token summons

`SUMMON_TOKEN count=N` mints tokens in a fixed left-to-right loop
(`for i in 0..N`). Each token takes the next `state.idCounter` value, so
instanceIds (`unit_${seed}_${counter}`) are strictly ascending and deterministic
for a given (seed, action order).

## 5. Death reaping (`resolveDeaths` + the FIFO trigger queue)

`resolveDeaths` is a thin wrapper around two steps: **seed** the trigger queue
from the units that are currently dead, then **drain** it to completion.

### 5a. Data structure

`MatchState.triggerQueue?: TriggerQueueEntry[]` — a typed FIFO array (defined in
`state.ts`). Each entry is one pending death trigger:

```
{ kind: "ON_DEATH" | "SUMMON_ON_ANY_DEATH"; controller: PlayerId;
  source: UnitInPlay; dead?: UnitInPlay }
```

It is **transient within a single action**: `applyAction` resets it to `[]` at
entry, and `drainTriggerQueue` always empties it before returning, so it is
**always `[]` between actions**. That keeps it neutral for `structuredClone`
stability and `(seed, actions)` determinism — it never carries state across
actions.

### 5b. Seeding (`sweepNewDeaths` → `reapAndEnqueue`)

The reducer scans both boards in the canonical order of §3 for newly-dead units
(`health <= 0` not yet reaped). For each one, in that sweep order:

1. apply the ONCEDEATH_REVIVE gate — a revived unit **did not die**, so it fires
   no deathrattle / ON_DEATH / graveyard / watcher and is **not** enqueued;
2. fire its DEATHRATTLE keyword burst (fixed nexus damage to the dead unit's
   owner's enemy);
3. record a non-token corpse into its owner's graveyard (most-recent last),
   stripping live aura bonuses back to base;
4. mark the corpse reaped (a transient `_reaped` flag, stripped before return)
   and **enqueue** two entries: its `ON_DEATH` then its `SUMMON_ON_ANY_DEATH`
   (this is the **exact** relative order the old inline pass fired them in).

The corpse is **left on the board** at this point so a queued on-death summon can
enter the dead unit's own lane when the queue drains.

### 5c. Draining (`drainTriggerQueue`)

The queue is drained **FIFO** (`shift()`): for each entry, fire its `ON_DEATH`
specs (corpse still on board) or its death-watcher mints. **After each entry
resolves**, re-scan both boards (canonical order) for units that effect just
killed, reaping + enqueuing **their** triggers onto the tail. Loop until the
queue is empty, then splice every reaped corpse off the board.

This makes simultaneous deaths resolve in **exactly** the old
`P1-front-asc → P1-back-asc → P2-front-asc → P2-back-asc` order (the queue is
seeded in that sweep and drained FIFO), while **chained** deaths — a death caused
by a drained trigger — are appended after the current batch and resolve **later
in the same drain** instead of being silently dropped to the next action. A
nexus / board-empty **win** caused by a chained kill is therefore detected within
the same action.

The per-lane `dying` snapshot is captured **before** any on-death summon mutates
the array, so a token minted by an earlier corpse is never double-counted, and a
token minted during the drain (not itself dead) survives it.

### 5d. Termination cap

Deathrattle face damage cannot kill a unit, and token mints are bounded by the
`MAX_LANE_UNITS` lane cap, so a legitimate chain always terminates. As an
**absolute backstop** against a pathological mutual-death cycle, `drainTriggerQueue`
bails after `DRAIN_ITERATION_CAP` (**1000**) drains: it clears the remaining
queue and stops **cleanly** (never throws, never loops forever). 1000 is far
above any reachable chain depth (a full board is 28 units), so the cap can only
fire on a true cycle, and stopping there is deterministic (state-only).

## 6. Aura recompute (`recomputeAuras`)

Continuous "while in play" effects are **recomputed from scratch** at the single
`applyAction` chokepoint after every successful action:

1. strip every unit's previously-applied `auraAtk`/`auraHp`/`auraKeywords` back to
   base;
2. derive active sources from compiled specs;
3. re-apply each grant.

Because step 1 removes exactly what step 3 last added, recompute is **idempotent**
and **order-independent** (each beneficiary set is recomputed fresh from the live
board). A unit reduced to `<=0` by losing a `+health` aura is reaped **silently**
by `recomputeAuras`'s own `removeDead` — aura-loss is NOT a combat death, so it
does **not** go through the trigger queue and fires **no deathrattle / ON_DEATH /
death-watcher**. This silent-aura-loss-death behavior is intentional and must be
preserved. (Only `health<=0`-from-damage/effect deaths, swept by `resolveDeaths`,
enqueue and fire triggers.)

## 7. Where this is enforced / proven

- Enforced: `resolveDeaths` / `drainTriggerQueue`, `recomputeAuras`, and the
  `applyAction` chokepoint in `src/engine/reducer.ts`; the `triggerQueue` field in
  `src/engine/state.ts`; `mintToken` / `SUMMON_TOKEN` in
  `src/engine/effectResolver.ts`.
- Proven: `npm run dev:trigger-order` (`src/dev/runTriggerOrderProof.ts`) locks in
  the canonical order via observable side effects (graveyard insertion order,
  token instanceId order) and asserts byte-identical results across two runs of
  the same trigger storm. `npm run dev:determinism` proves the global
  `(seed, actions)` guarantee.
