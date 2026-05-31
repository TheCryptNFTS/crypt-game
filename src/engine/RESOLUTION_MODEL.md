# Crypt Engine — Resolution Model (no-stack, immediate, deterministic)

This is the **canonical reference** for how effects, triggers, deaths, and auras
resolve in the Crypt TCG reducer (`src/engine/reducer.ts`). Read this before
touching any trigger-firing or death-reaping code. Ordering bugs here are desync
bugs in multiplayer/replay.

## 1. No stack. No priority. No responses.

Crypt resolves effects **immediately and depth-first** the instant they trigger —
the same model as Hearthstone and Marvel Snap. There is deliberately **no stack,
no priority window, and no responses/counterspells**. When an effect causes a
death that causes another trigger, that inner trigger resolves fully right then,
before control returns to the outer effect.

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

## 5. Death reaping (`resolveDeaths`)

After each trigger batch the reducer scans both boards in the canonical order
above. For each newly-dead unit (`health <= 0`):

1. fire its DEATHRATTLE keyword burst (fixed nexus damage to the dead unit's
   owner's enemy);
2. fire its compiled `ON_DEATH` specs **while the corpse is still on the board**,
   so an on-death summon enters the dead unit's lane;
3. record a non-token corpse into its owner's graveyard (most-recent last),
   stripping live aura bonuses back to base;
4. clear all dead units from the lane (`removeDead`).

The per-lane `dying` snapshot is captured **before** any on-death summon mutates
the array, so a token minted by an earlier corpse is never double-counted, and a
token minted during this pass (not itself dead) survives it.

Deathrattle face damage cannot kill a unit, so death resolution does not infinitely
chain. An on-death summon that itself dies later does so on the **next** action's
resolution, not recursively within this pass.

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
— aura-loss is NOT a combat death, so it fires **no deathrattle/ON_DEATH**. This
silent-aura-loss-death behavior is intentional and must be preserved.

## 7. Where this is enforced / proven

- Enforced: `resolveDeaths`, `recomputeAuras`, and the `applyAction` chokepoint in
  `src/engine/reducer.ts`; `mintToken` / `SUMMON_TOKEN` in
  `src/engine/effectResolver.ts`.
- Proven: `npm run dev:trigger-order` (`src/dev/runTriggerOrderProof.ts`) locks in
  the canonical order via observable side effects (graveyard insertion order,
  token instanceId order) and asserts byte-identical results across two runs of
  the same trigger storm. `npm run dev:determinism` proves the global
  `(seed, actions)` guarantee.
