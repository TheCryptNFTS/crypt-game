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

## 8. Mid-resolution player CHOICE (`pendingChoice` pause/resume)

The no-stack model resolves everything **within one action** — with exactly ONE
sanctioned exception: an effect that must ask the controller to **pick one of
several options** (Hearthstone "Discover", future "choose one"). Such an effect
cannot complete inside its raising action because the decision is the player's, so
it **pauses** and resumes on a later action. This is still no-stack / no-priority:
there is no frozen call stack and no response window — only a single, explicit
continuation recorded as **plain data**.

**The pause record.** `MatchState.pendingChoice` (`src/engine/state.ts`) is set to a
`PendingChoice { kind, controller, options[], resume }` when an op raises a choice.
Unlike `triggerQueue` (transient, reset to `[]` every action), `pendingChoice`
**crosses exactly one action boundary** by design. It holds ONLY plain data (no
closures / Maps / Sets), so `structuredClone` at the reducer entry preserves it and
it is absent (`undefined`) from every committed fixture — the reducer-equivalence
golden JSON is unmoved.

**Raising a choice.** A choice-raising op (today `DISCOVER`, in `effectResolver.ts`)
is compiled **last** in `CompiledAbility.specs`, so it fires at a clean,
queue-empty boundary. It generates its option list **deterministically** from
`makeRng(state.seed)` fast-forwarded `state.rngCursor` steps (the same stream as
`rngAt`), then advances `rngCursor` by **exactly** the draws consumed. Edge cases:
an **empty option pool is a clean no-op** (never pauses); a **single option
auto-resolves inline** (identical to opening a 1-option choice and immediately
picking). Otherwise it sets `pendingChoice` and the raising action (`PLAY_UNIT` /
`PLAY_SPELL`) **short-circuits** — it emits its normal played-event plus
`CHOICE_OPENED` and returns WITHOUT reaping deaths or checking the win; that
finalization is deferred to the resume tail.

**The global gate.** While `pendingChoice` is non-null the model is
single-threaded: the reducer accepts ONLY a matching `RESOLVE_CHOICE`. EVERY other
action type **reject-softs** `choice-pending` (state returned unchanged). This is
the single global gate that keeps the model tractable. Conversely a
`RESOLVE_CHOICE` arriving with **no** pending choice reject-softs
`no-pending-choice`.

**Resuming.** `RESOLVE_CHOICE { player, optionId }` is a normal **logged** action.
Legality order: `no-pending-choice` → `not-your-choice` (only the controller may
resolve) → `illegal-option` (the id must be one offered). On a valid pick the
reducer runs the `resume` tail (move the chosen card deck→hand, or mint pool→hand),
clears `pendingChoice`, then runs the **deferred** death reap + win check, and emits
`CHOICE_RESOLVED`. No RNG is consumed on resume — the options were already drawn
when the choice opened.

**Determinism.** The chosen `optionId` enters the action log, so a replay of
`(seed, actions)` regenerates the identical option list (same seed+cursor) AND
resolves the identical pick — byte-identical, never regenerated. Harnesses that run
without a human (`playAiMatch`, `replay` in `src/dev/reducerHarness.ts`) drain a
raised choice via the pure `autoPickOption(state)` (fixed `options[0]`), appending
the `RESOLVE_CHOICE` to the action log so the replay stays faithful and nothing
deadlocks.

- Enforced: `pendingChoice` in `src/engine/state.ts`; the global gate +
  `RESOLVE_CHOICE` branch + `autoPickOption` in `src/engine/reducer.ts`; the
  `DISCOVER` op + `seededDistinctPick` / `moveCardDeckToHand` in
  `src/engine/effectResolver.ts`; the `DISCOVER` regex in
  `src/engine/abilityCompiler.ts`.
- Proven: `npm run dev:choice` (`src/dev/runChoiceProof.ts`) drives the full
  lifecycle (compiler parse, resolver raise/empty-pool/single-option,
  gate reject-soft, legality order, valid resume, same-seed option determinism,
  logged-optionId replay equality, auto-pick drain). `npm run dev:determinism`
  remains byte-identical.

> NOTE re §1: this is the ONLY pause in the engine and it is still no-stack /
> no-priority. It is a *continuation* (one data record + one logged action), not a
> response window. Do not generalize it into a stack.

## 9. Opt-in LIFO response stack (`rules.responseStack`)

§1 declares the vanilla engine **no-stack / no-priority**: a slow action (a unit
attack / face swing) resolves **immediately** inside its own action. §9 layers a
**genuine reactive priority system** on top — but **entirely behind the
`rules.responseStack` flag**. With the flag **absent / false** (the default and
every committed fixture) **none of this code runs**: attacks resolve inline exactly
as before, the 21 reducer-equivalence scenarios stay **byte-identical**, and the
golden JSON is never regenerated. The flag is the single switch between the two
worlds.

**The two crossing-the-boundary records.** Both live on `MatchState`
(`src/engine/state.ts`) as plain data (no closures), so `structuredClone` at the
reducer entry preserves them and they are absent from every vanilla fixture:

- `responseStack: ResponseStackEntry[]` — the LIFO stack of deferred slow actions
  and the fast responses layered on them. Each entry is
  `{ id, controller, kind: "ATTACK" | "EFFECT" | "COUNTER", … }`. An `ATTACK` entry
  carries `attackerInstanceId` / `defenderInstanceId` / `face`; an `EFFECT` entry
  carries a `ResponseEffectSpec` + optional `targetInstanceId`; a `COUNTER` carries
  nothing but its intent. A `fizzled` flag marks an entry a counter has neutralized.
- `pendingResponse: { priority, passes }` — the open window: **whose** priority it
  is and how many **consecutive** passes have been seen.

**Opening the window.** When `rules.responseStack` is on, a validated `ATTACK_UNIT`
/ `ATTACK_FACE` does **not** resolve combat inline. It calls `openResponseWindow`:
push a base `ATTACK` entry (id = `resp_${seed}_${counter}`, advancing `idCounter`),
set `pendingResponse.priority` to the **opponent** of the attacker (the defender
reacts first), `passes = 0`, and emit `RESPONSE_OPENED`. The combat is now
**deferred** — it will be replayed at the bottom of the stack when the window
closes.

**The global response gate.** While `pendingResponse` is non-null the model is
single-threaded (mirroring §8's choice gate): the reducer accepts **only**
`CAST_RESPONSE` / `PASS_RESPONSE`. Every other action type reject-softs
`response-pending` (state unchanged). A `CAST_RESPONSE` / `PASS_RESPONSE` arriving
from the **wrong** player reject-softs `not-your-priority`; one arriving with **no**
open window reject-softs `no-response-window`. The gate keeps the reactive layer as
tractable as the rest of the engine.

**Casting a response.** `CAST_RESPONSE { player, response }` pushes a new entry
**on top** of the stack — a `COUNTER`, or an `EFFECT` carrying a
`ResponseEffectSpec` (`PUMP_ALLY` / `SHIELD_ALLY` / `DAMAGE_UNIT` / `HEAL_NEXUS`)
plus an optional `targetInstanceId`. It **resets `passes` to 0** and hands priority
back to the **opponent** (a fresh response always reopens the window), emitting
`RESPONSE_CAST`. Because each cast flips priority, players alternate; the player who
just spoke cannot immediately speak again.

**Closing + LIFO resolution.** `PASS_RESPONSE` increments `passes` and flips
priority. **Two consecutive passes** (`passes >= 2`) close the window and call
`resolveResponseStack`, which pops the stack **top-down (LIFO)**:

- a `fizzled` entry is **skipped** (a counter already neutralized it);
- a `COUNTER` marks the entry **now beneath it** `fizzled` and emits
  `RESPONSE_FIZZLED` — so a counter-the-counter resolves first and re-enables the
  original, exactly LIFO;
- an `EFFECT` **re-locates** its target from live state (`DAMAGE_UNIT` searches the
  **opponent's** board, every other op the **controller's** board), runs
  `resolveResponseEffect` (`src/engine/effectResolver.ts`), then `resolveDeaths`;
- the base `ATTACK` replays the **deferred** combat via the same
  `resolveAttackUnitCombat` / `resolveAttackFaceCombat` helpers the inline path
  uses — so a `PUMP_ALLY` / `SHIELD_ALLY` resolved earlier in the pop **changes the
  combat outcome**, and a `COUNTER` on the attack **fizzles the swing entirely**.

When the stack is drained it clears `responseStack` + `pendingResponse`, emits
`RESPONSE_RESOLVED`, and the normal `finalizeWin` runs.

**Determinism & no-burn.** No response op consumes RNG and every action is logged,
so a `(seed, actions)` replay is byte-identical. **NO-BURN is structural**:
`DAMAGE_UNIT` resolves only against the opponent's **board** and there is no
response op that targets the enemy **face** — the nexus is unreachable by
construction (`HEAL_NEXUS` only restores the controller's own nexus, capped at the
starting total).

- Enforced: `responseStack` / `pendingResponse` / `ResponseStackEntry` /
  `ResponseEffectSpec` + the `rules.responseStack` flag in `src/engine/state.ts`;
  the response gate, `openResponseWindow` / `castResponse` / `passResponse` /
  `resolveResponseStack` + the combat-extraction helpers in
  `src/engine/reducer.ts`; `resolveResponseEffect` in `src/engine/effectResolver.ts`.
- Proven: `npm run dev:response-stack`
  (`src/dev/runResponseStackProof.ts`) — flag-OFF inline equivalence, window
  open + PASS/PASS resolve, counter-fizzle, pump/shield changing the combat
  outcome, counter-the-counter LIFO, determinism (byte-identical state), no-burn,
  and the three reject-softs (`no-response-window`, `not-your-priority`,
  `response-pending`). `npm run dev:reducer-equivalence` stays **21/21**.

> NOTE re §1: §9 does **not** weaken the vanilla guarantee — it is dead code until a
> ruleset opts in. The §8 choice pause is still the only pause in a vanilla match.

## 10. Opt-in alternate win conditions

The vanilla victory path (`detectWinner` + `finalizeWin` in `src/engine/reducer.ts`)
is **nexus depletion** (a nexus at ≤ 0 loses) and **deck-out fatigue** (drawing from
an empty deck loses). §10 adds two **opt-in** alternate win axes, each behind its own
`MatchRules` flag, both **no-burn-compatible** (neither touches the enemy face).
Absent flags survive `structuredClone` as `undefined`, so a vanilla match is
unaffected and the golden fixture is unmoved.

**Precedence (asserted).** `detectWinner` checks the axes in a fixed order so the
result is deterministic and lethal always wins first:

> **lethal-nexus → deckout → ascendancy (§prior) → assemble**

A position that is already decided at action **entry** is reject-softed `match-over`
by the global guard (§8 opening lines) — so a player can never be awarded an
alternate win from an already-lost position (e.g. a dead-nexus player who also holds
an assemble hand does **not** assemble-win; lethal decided it first).

**10a. DECKOUT (`rules.deckoutLoss`).** Drawing from an **empty** deck loses you the
game (fatigue). The **vanilla engine already does this**, so `deckoutLoss` defaults
to the proven behavior — it exists to let a ruleset **explicitly disable** it
(`deckoutLoss: false`) for a no-fatigue variant. In `drawForPlayer`, an empty draw
sets `winner = opponent` **unless** `deckoutLoss === false` (only an explicit `false`
opts out; absent / `true` = the historical loss, byte-identical). The `DECK_OUT`
event is emitted **either way** (informational), so a disabled ruleset still reports
the empty draw while keeping the drawing player alive.

**10b. ASSEMBLE / LIBRARY (`rules.assembleToWin: N`).** Holding **≥ N** cards in
hand wins by **card advantage** — an INDIRECT, no-burn victory that never touches the
enemy face. `detectWinner` consults `players[P].hand.length` (P1 first for a
deterministic tie-break, mirroring ascendancy) **after** the lethal / deckout axes.
The win is **scored when an action carries a player across the threshold** — most
naturally the **start-of-turn draw** ("drawing into the library win"): `END_TURN`
re-runs `finalizeWin` after the next player's draw when the flag is set. A hand that
is **already at/above N at action entry** is a decided position and reject-softs
`match-over` (the guard fires before the body) — it is not silently dropped, it is
simply already over.

- Enforced: the `assemble` block in `detectWinner`, the `deckoutLoss` gate in
  `drawForPlayer`, and the post-draw assemble re-score in the `END_TURN` handler, all
  in `src/engine/reducer.ts`; the `deckoutLoss` / `assembleToWin` flags in
  `src/engine/state.ts`.
- Proven: `npm run dev:alt-wincon` (`src/dev/runAltWinConProof.ts`) — deckout loses
  by default / when `true` / stays alive when `false`; assemble wins by drawing into
  the threshold (no-burn, P2 nexus untouched, `WIN` emitted), does not win below
  threshold, is OFF by default; lethal-nexus precedence (`match-over` beats an
  assemble hand); determinism. `npm run dev:reducer-equivalence` stays **21/21**.

> NOTE re §1: §10 is gated identically to §9 — dead code in a vanilla match. The
> default deckout behavior is unchanged, so no fixture moves.
