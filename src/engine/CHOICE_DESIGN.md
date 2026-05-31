# Crypt Engine — Player-CHOICE / Targeting Primitive (design, go/no-go)

Status: PROPOSAL. No engine code changed. Read `RESOLUTION_MODEL.md` first.

This doc designs a `pendingChoice` continuation so cards whose text needs a
mid-resolution player decision (Discover, choose-one, choose-after-seeing) can
resolve while keeping the reducer's determinism contract intact. Real type
names and `file:line` references throughout.

---

## 0. What the engine already does (so we do not reinvent it)

The engine ALREADY has *up-front* targeting: an action carries the target with
it and the reducer resolves synchronously, no pause needed.

- `PLAY_UNIT` / `PLAY_SPELL` carry an optional `targetInstanceId`
  (`reducer.ts:68`, `:71`). For spells the reducer pre-resolves it into `chosen`
  and wires it as `ctx.source` AND `ctx.target` before `resolveSpecs`
  (`reducer.ts:1089-1111`). For battlecries it threads it into the `ON_SUMMON`
  `fireTrigger` (`reducer.ts:753-767`).
- `EQUIP` / `ATTACK_UNIT` carry their target instance id directly.
- `EffectContext.target` (`effectResolver.ts:33`) is consumed by `DEAL_DAMAGE`,
  `HEAL`, `DEBUFF_ENEMY`, `DESTROY_UNIT`, `RETURN_TO_HAND`, `CLEAVE`,
  `COPY_UNIT` (`effectResolver.ts:236-428`).
- Where no human is available, the reducer ALREADY auto-picks deterministically:
  `highestCostEnemyUnit` for `COPY_UNIT` (`reducer.ts:634-647`,`:764-766`), and
  `DESTROY_ENEMY_SELECT` selects by cost gate (`effectResolver.ts:429-461`).

So "deal damage to a unit", "heal a target ally", "destroy an enemy you choose"
that can be decided BEFORE the effect runs are already expressible by setting
`targetInstanceId` on the play action — no new machinery required.

The genuine gap is the **mid-resolution** choice: a decision the player can only
make AFTER part of the effect has run and produced information that did not
exist when the action was submitted. That is what `pendingChoice` adds.

---

## 1. Problem statement & scope

### In scope (v1) — what CHOICE unlocks
1. **Discover** (Hearthstone): generate K options (e.g. 3 cards) and let the
   controller pick 1 to add to hand. The options only exist after generation, so
   they cannot be in the submitted action. **This is the flagship case.**
2. **Choose-one modes** (LoR/Druid): a card prints N mutually-exclusive effect
   modes; controller picks which mode resolves. The chosen mode index cannot be
   pre-supplied through the existing single `targetInstanceId` channel and may
   itself then need a target.
3. **Tutor-with-choice**: "look at the top 3, draw one" — reveal then pick (the
   deterministic `TUTOR_FROM_DECK` at `effectResolver.ts:541` auto-selects today;
   choice upgrades it to a real pick).

### Explicitly OUT of scope (v1)
- Targeted single-target ops that are decidable up front ("deal 3 to a unit",
  "heal a target ally"). These keep using `targetInstanceId` (Section 0). CHOICE
  is NOT required for them and we will NOT route them through `pendingChoice`.
- Opponent-made choices ("your opponent discards a card") — only the *active*
  player chooses in v1.
- Multi-pick / ordering choices (pick 2, arrange) — single pick only in v1.
- Any choice during the opponent's turn, or nested choices stacked >1 deep
  (a choice whose resolution immediately raises a second choice). v1 forbids a
  second `pendingChoice` while one is open (see Section 2).

---

## 2. State machine — the `pendingChoice` continuation

### 2.1 Why a continuation at all

The reducer is depth-first and synchronous: an effect chain runs to completion
inside one `applyActionCore` call. A mid-resolution choice means we must STOP at
the choice point, return to the caller for input, and later RESUME exactly where
we stopped. JS has no cheap way to freeze a half-run synchronous call stack
deterministically, and we MUST NOT introduce async (it breaks the determinism
proof and the `structuredClone`-once contract). So instead of freezing a stack,
we **split the effect at the choice point into two reducer entries** and store
the data needed to run the second half in state.

The simplest correct model — and the one recommended — is:

> A choice **terminates the current action** with `state.pendingChoice` set.
> While `pendingChoice` is non-null the ONLY legal action is `RESOLVE_CHOICE`;
> every other action reject-softs. `RESOLVE_CHOICE` applies the chosen option,
> runs the rest of the effect synchronously, clears `pendingChoice`, and (if
> that tail raises no further choice) returns to normal play.

This means an effect that hits a choice is "deal everything up to the choice,
PAUSE, then on RESOLVE_CHOICE deal everything after". No partial call stack is
ever frozen — the post-choice tail is re-expressed as a small, explicit
continuation record that `RESOLVE_CHOICE` interprets.

### 2.2 Shape (new types in `state.ts`)

```ts
// state.ts — additive, all optional so existing fixtures default to "no choice".
export interface ChoiceOption {
  /** Stable id the client echoes back in RESOLVE_CHOICE. For Discover this is a
   *  catalog cardId; for choose-one a mode index encoded as a string. */
  id: string;
  /** Optional human label / cardId for the UI; never read by game logic. */
  cardId?: string;
}

export type PendingChoiceKind = "DISCOVER" | "CHOOSE_MODE" | "TUTOR_REVEAL";

export interface PendingChoice {
  kind: PendingChoiceKind;
  /** ONLY this player may resolve it (active player in v1). */
  controller: PlayerId;
  /** The K offered options, in a deterministic order (see 2.4). */
  options: ChoiceOption[];
  /** The continuation: enough to run the post-choice tail with NO frozen stack.
   *  `op` is the resolver op to apply once chosen; `controller`/`lane` rebuild a
   *  minimal EffectContext. `sourceInstanceId` (nullable for spells) re-locates
   *  the source on resume; null => spell/already-gone source. */
  resume: {
    op: "ADD_CARD_TO_HAND" | "APPLY_MODE";
    sourceInstanceId?: string;
    lane?: Lane;
    /** For CHOOSE_MODE: the compiled sub-specs keyed by option id, so the
     *  chosen mode's specs run on resume. Kept as data, not closures, so the
     *  field is structuredClone-stable. */
    modeSpecs?: Record<string, EffectSpec[]>;
  };
}
```

Add one optional field to `MatchState` (`state.ts:193`):

```ts
  /** Set when an effect paused for a player choice. While non-null the reducer
   *  accepts ONLY a matching RESOLVE_CHOICE; everything else reject-softs. Always
   *  null between fully-resolved actions. Transient across the pause only — it is
   *  PART of state (unlike triggerQueue) because it must survive between the
   *  action that opened it and the RESOLVE_CHOICE that closes it. */
  pendingChoice?: PendingChoice | null;
```

Note the contrast with `triggerQueue` (`state.ts:204`): the trigger queue is
reset to `[]` every action entry because it never crosses actions. `pendingChoice`
DOES cross exactly one action boundary by design, so it is NOT reset at entry —
it is read at entry to gate legality, and cleared by `RESOLVE_CHOICE`.

### 2.3 Pause/resume vs. the depth-first / triggerQueue model

The hard question: what about the rest of the in-flight effect chain and the
triggerQueue when a choice opens mid-chain?

**Recommended invariant (simplest correct): a choice may only be raised at a
"clean boundary" — i.e. when `state.triggerQueue` is empty and no other spec in
the current `resolveSpecs` fan-out is pending.** Concretely:

- Discover / choose-one are raised by an `ON_SUMMON` / `PLAY_SPELL` op. We make
  the choosing op the LAST (or only) spec the reducer runs in that action. If a
  card has `[buff self][discover]`, the buff runs, then the discover op sets
  `pendingChoice` and the reducer returns. There is no "rest of chain" because
  the chain is authored choice-last. The compiler enforces this by ordering a
  choice spec to the tail of `CompiledAbility.specs` (Section 5).
- `resolveDeaths` / `drainTriggerQueue` must have fully drained (queue empty)
  before a choice is raised. Since choices are raised by summon/spell resolution
  and death resolution happens AFTER (`reducer.ts:775`, `:1118`), we raise the
  choice, set `pendingChoice`, and return BEFORE `resolveDeaths` only if the
  chosen tail cannot itself kill. For DISCOVER (adds a card to hand) and
  CHOOSE_MODE-into-buff this holds. For a mode that deals damage, the post-choice
  tail in `RESOLVE_CHOICE` runs `resolveDeaths` itself (it is a normal action
  path). So: **death resolution belongs to whichever reducer entry actually
  produced the damage** — the opening action if the pre-choice part killed, the
  `RESOLVE_CHOICE` action if the chosen tail killed. Both call `resolveDeaths`
  normally; neither straddles a pause.

This keeps the no-stack model literally unchanged: each reducer entry still runs
depth-first to a clean, queue-empty end before returning. The "pause" is just a
normal action return that happens to leave `pendingChoice` set.

### 2.4 Deterministic option generation

Options must be byte-stable for a given `(seed, actions)`. Generation uses the
seeded RNG only, via the existing cursor discipline:

- Discover-from-pool draws K option ids using `makeRng(state.seed)` fast-
  forwarded `state.rngCursor` steps (mirror `rngAt`, `reducer.ts:1143`), then
  ADVANCES `state.rngCursor` by the number of draws consumed. This is the first
  real consumer of `rngCursor` (today only `MULLIGAN` touches it,
  `reducer.ts:1065`), so the field finally earns its keep.
- Options are stored in draw order; the client renders them but the *order is
  authoritative* so a replay regenerates the identical list.

---

## 3. Action protocol

New action (additive to the union at `reducer.ts:66-74`):

```ts
  | { type: "RESOLVE_CHOICE"; player: PlayerId; optionId: string }
```

New event (additive at `reducer.ts:76-87`):

```ts
  | { type: "CHOICE_OPENED"; player: PlayerId; kind: PendingChoiceKind; optionIds: string[] }
  | { type: "CHOICE_RESOLVED"; player: PlayerId; optionId: string }
```

`CHOICE_OPENED` is emitted by the action that sets `pendingChoice` so the UI
knows to prompt. `optionIds` is the load-bearing, replayable list.

### 3.1 Legality (reject-soft, mirrors existing `reject`, `reducer.ts:649`)
`RESOLVE_CHOICE` validation, in order, each a clean `reject(state, ...)`:
1. `match-over` if `detectWinner` (already first guard, `reducer.ts:692`).
2. `no-pending-choice` if `state.pendingChoice == null`.
3. `not-your-choice` if `action.player !== pendingChoice.controller`
   (independent of `activePlayer`, though in v1 they coincide).
4. `illegal-option` if `optionId` is not in `pendingChoice.options[].id`
   (handles stale/forged ids).

Conversely, while `pendingChoice != null`, EVERY other action type reject-softs
with `choice-pending` (added as a guard right after the `match-over` guard at
`reducer.ts:692`). This is the single global gate that makes the model tractable.

### 3.2 How the chosen index enters the log → deterministic replay
The action log already IS the source of truth (`replay`,
`reducerHarness.ts:51`). `RESOLVE_CHOICE` is a normal logged action carrying
`optionId`. Replaying `(seed, [..., openingAction, RESOLVE_CHOICE{optionId}])`
regenerates the SAME options (seeded RNG + cursor, Section 2.4), then applies
the SAME `optionId`, producing byte-identical state. No hidden input exists: the
human's decision is fully captured by `optionId` in the log.

---

## 4. Determinism & replay (proof in prose)

Claim: `dev:determinism` and `dev:reducer-equivalence` stay byte-identical.

1. **No new nondeterminism source.** Option generation uses only
   `makeRng(state.seed)` + `state.rngCursor`, advancing the cursor by exactly the
   draws consumed (Section 2.4). No `Math.random`/`Date`. Option order is fixed
   draw order. This satisfies `RESOLUTION_MODEL.md §2`.
2. **`pendingChoice` is structuredClone-stable.** It holds only plain data
   (strings, numbers, `EffectSpec[]` which are already cloned through the trigger
   queue today). No closures, Maps, or Sets. So `structuredClone` at entry
   (`reducer.ts:683`) preserves it.
3. **Replay equivalence.** Given identical `(seed, actions)`, the opening action
   produces identical `pendingChoice.options` (point 1) and `RESOLVE_CHOICE`
   carries an explicit `optionId`, so the resumed tail is identical. Two replays
   ⇒ identical state and events. `dev:determinism`'s "byte-identical twice"
   assertion (`runDeterminismProof.ts:59`) holds for any action list that
   contains choices.
4. **Existing proofs unaffected.** No existing card routes through `pendingChoice`
   (Section 8 is purely additive). `pendingChoice` defaults `undefined`/`null`,
   absent from every committed fixture; `structuredClone` of a state without it
   is unchanged, so the reducer-equivalence golden JSON
   (`fixtures/reducerEquivalence.json`) does not move. **No RECORD=1 needed.**

### 4.1 Deterministic AUTO-PICK (no human / sim / proofs)
Harnesses (`playAiMatch`, `reducerHarness.ts:64`) and `planP2Turn` never emit
`RESOLVE_CHOICE`, so a raised choice would DEADLOCK the loop (every other action
reject-softs with `choice-pending`). Fix: a pure, seeded auto-pick the harness
calls whenever `state.pendingChoice` is set:

```ts
// proposed helper, exported from reducer.ts or a small choiceAutoPick.ts
export function autoPickOption(state: MatchState): string {
  const pc = state.pendingChoice!;
  // Deterministic: seeded index into the options. Reuses rngAt-style draw at the
  // CURRENT cursor (does NOT advance it — pure read), modulo option count. A fixed
  // heuristic (always options[0]) is an acceptable simpler alternative and is even
  // more obviously deterministic; RNG variant gives better sim coverage.
  const r = rngAt(state.seed, state.rngCursor);
  return pc.options[Math.floor(r * pc.options.length) % pc.options.length].id;
}
```

Both the e2e drivers and any AI gain a tiny "if `pendingChoice`, emit
`RESOLVE_CHOICE{ autoPickOption(state) }` and continue" branch. Recommended:
**fixed `options[0]`** for proofs (zero RNG-cursor coupling, trivially stable);
keep the seeded variant available for fuzz/sim coverage. Either way it is a pure
function of state ⇒ deterministic ⇒ harnesses never deadlock.

---

## 5. Resolver / compiler changes

### 5.1 New resolver ops (`effectResolver.ts`, `EffectOp` at `abilityCompiler.ts:33`)
- `DISCOVER` — when resolved, generate K option cardIds from a pool (faction /
  type filtered, seeded) and SET `state.pendingChoice` instead of mutating the
  board. This is the one op that returns control rather than completing.
- `CHOOSE_MODE` — compile N sub-effects; on resolve, set `pendingChoice` with
  `resume.modeSpecs` carrying each mode's `EffectSpec[]`.
- The resume side needs no new op in the resolver's main switch beyond a small
  `ADD_CARD_TO_HAND` (push chosen cardId to `controller.hand`) and "fan the
  chosen `modeSpecs[id]` through `resolveSpecs`" — both live in the
  `RESOLVE_CHOICE` reducer branch, not the generic `resolveEffect`, so the
  pure resolver stays choice-agnostic.

Because raising a choice requires writing `state.pendingChoice`, the cleanest
seam is: `resolveEffect` for `DISCOVER`/`CHOOSE_MODE` writes `pendingChoice` on
the ctx.state and the reducer checks `next.pendingChoice` AFTER `resolveSpecs`
to decide whether to short-circuit (skip `resolveDeaths`/win-check and return
with `CHOICE_OPENED`). One new branch at each call site
(`reducer.ts:767`, `:1103`).

### 5.2 Compiler — parse previously-dropped targeted text
Today targeted-discover/choose text falls to `UNKNOWN`
(`abilityCompiler.ts:78`). Add HONEST templates that match only genuine text:
- `/discover (a|an|one) (\w+)/i` → `DISCOVER` with a pool filter (e.g. "discover
  a spell" → type=spell).
- `/choose one: (.+)/i` split on `;`/`or` into mode sub-clauses, each recursively
  compiled → `CHOOSE_MODE` with `modeSpecs`.
Keep the honest-coverage rule (`abilityCompiler.ts:9-21`): only emit `DISCOVER`/
`CHOOSE_MODE` when the regex truly matches; otherwise stay `UNKNOWN`. Order any
choice spec LAST in `CompiledAbility.specs` (Section 2.3 invariant).

---

## 6. Reject-soft & edge cases

- **Empty option set** (pool exhausted / no legal mode): do NOT open a choice.
  `DISCOVER` with 0 generated options is a clean no-op (like `mintToken` at a
  full lane, `effectResolver.ts:120`). Never sets `pendingChoice`, action
  completes normally. This avoids an unresolvable pause.
- **Single option:** v1 may still open a 1-option choice (UI auto-confirms) OR
  auto-resolve it inline. Recommend auto-resolve inline (no pause) to avoid a
  trivial round-trip; behavior is identical either way.
- **Choosing player can't/won't act:** `pendingChoice` simply persists; no timer
  in the engine. The harness/AI auto-picks (Section 4.1); a real client enforces
  a timeout at the app layer that emits `RESOLVE_CHOICE` (engine stays pure).
- **Target died before resume:** v1 choices (Discover→hand, choose-mode→buff/
  damage) re-locate the source via `resume.sourceInstanceId` at resume time
  (`findUnitByInstance`, `reducer.ts:623`). If the source is gone (e.g. a queued
  death between actions — impossible here since the queue is empty at pause, but
  defensively) the tail that needs a live source no-ops; an add-to-hand tail does
  not need the source and still resolves. No throw — reject-soft in spirit.
- **triggerQueue / chained deaths:** guaranteed empty at pause (Section 2.3), so
  no interaction. The chosen tail runs its own `resolveDeaths` in the
  `RESOLVE_CHOICE` branch, identical to a normal action's death resolution and
  fully covered by `RESOLUTION_MODEL.md §5`.
- **MAX_LANE_UNITS for discover-summon:** if a discovered option summons a unit
  and the lane is full, the existing cap makes the mint a clean no-op
  (`effectResolver.ts:120`). v1 Discover targets HAND, sidestepping this entirely.
- **Choice raised while a winner exists:** impossible — the opening action's
  first guard reject-softs on `match-over` (`reducer.ts:692`); and `finalizeWin`
  is checked on the resume branch.

---

## 7. Test / proof plan — `src/dev/runChoiceProof.ts` (`dev:choice`)

Match the house style (`runBattlecryTargetProof.ts`): an `arena()` builder,
`check(name, cond, detail)` accumulator, `process.exit(1)` on failure. Register
in `runRegressionSuite.ts` and add `dev:choice` to `package.json`.

Assertions:
1. **Opens a choice.** A card with `DISCOVER` yields `state.pendingChoice != null`
   with K options and a `CHOICE_OPENED` event; the board is otherwise unchanged.
2. **Gate.** While pending, `PLAY_UNIT`/`ATTACK_*`/`END_TURN` all reject-soft with
   `choice-pending` and leave state byte-identical (`JSON.stringify` equal).
3. **Resolve applies the pick.** `RESOLVE_CHOICE{ options[1].id }` adds exactly
   that cardId to hand and clears `pendingChoice`.
4. **Legality rejects.** `not-your-choice` (wrong player), `illegal-option`
   (forged id), `no-pending-choice` (resolve with none open) each reject-soft.
5. **Choose-one mode.** A `CHOOSE_MODE` card: picking mode A deals damage, mode B
   buffs — assert only the chosen mode's effect landed.
6. **Determinism/replay.** Run `(seed, [open, RESOLVE_CHOICE{id}])` twice via
   `replay`; assert byte-identical `finalState` + `events` (mirrors
   `runDeterminismProof.ts:59`). Also assert the SAME seed regenerates the SAME
   `options` list across two opens.
7. **Auto-pick no-deadlock.** Drive a short match where a unit raises a choice;
   the harness auto-pick branch resolves it and the match advances to a winner /
   turn cap without hanging.
8. **Empty pool no-op.** `DISCOVER` with an exhausted pool sets no `pendingChoice`
   and the action completes normally.
9. **Death tail.** A damage-mode choice that kills a unit fires its deathrattle /
   ON_DEATH within the `RESOLVE_CHOICE` action (assert graveyard + nexus burst).

Plus: re-run `dev:determinism` and `dev:reducer-equivalence` unchanged — both
must pass with NO fixture re-record (Section 4, point 4).

---

## 8. Migration & risk

**Additivity.** The change is additive:
- `Action` / `GameEvent` unions gain members → existing `switch` arms unchanged;
  the new `choice-pending` guard sits before the switch and is inert when
  `pendingChoice` is null.
- `MatchState` / `state.ts` gain one optional field defaulting null → absent from
  every committed fixture → `dev:reducer-equivalence` golden JSON does NOT move.
- No existing card compiles to `DISCOVER`/`CHOOSE_MODE` until Section 5.2 lands,
  and even then only honest matches. **No existing proof needs touching.**

**Risk ranking (high→low):**
1. *Harness deadlock* if an auto-pick branch is forgotten anywhere a choice can
   fire (sim, AI, e2e). Mitigation: the auto-pick helper + a single shared
   "drain pending choice" wrapper in `reducerHarness.ts`. MEDIUM.
2. *Cursor drift* — advancing `rngCursor` during option generation must be the
   ONLY consumer touching it besides MULLIGAN, or replays desync. Mitigation:
   centralize generation, cover with proof #6. MEDIUM.
3. *Compiler over-matching* dropping real cards into a pause that has no UI yet.
   Mitigation: gate behind honest regex + Phase ordering. LOW.
4. *Determinism regression* — bounded by proofs #6 and the unchanged global
   determinism proof. LOW.

**Phased rollout & effort (solo founder, focused days):**
- **Phase 0 (0.5 day): nothing-breaks scaffolding.** Add `pendingChoice` field,
  `RESOLVE_CHOICE` action/events, the global `choice-pending` gate, legality
  checks. No op emits a choice yet. Prove all existing proofs still green.
- **Phase 1 (1–1.5 days): Discover.** `DISCOVER` op + seeded option generation +
  `ADD_CARD_TO_HAND` resume + compiler template + `runChoiceProof.ts` assertions
  1–4,6,8 + harness auto-pick. Highest value, lowest blast radius.
- **Phase 2 (1.5–2 days): choose-one modes + tutor-reveal.** `CHOOSE_MODE` with
  `modeSpecs`, recursive mode compile, death-tail handling, assertions 5,7,9.
- **Phase 3 (1–2 days): UI wiring.** Render `CHOICE_OPENED`, collect the pick,
  emit `RESOLVE_CHOICE`, app-layer timeout. Engine already complete; this is
  client-only and cannot regress determinism.

Total engine work ≈ **3–4 focused days** to Phase 2 (fully tested, replayable),
plus UI.

---

## 9. Recommendation — GO (phased)

**GO**, with the constraint that v1 only adds a choice primitive for the cases
that genuinely need mid-resolution input — **Discover first** — and leaves all
already-expressible up-front targeting on the existing `targetInstanceId` channel
(do NOT rebuild it).

The simplest viable design that preserves determinism is the **"choice ends the
action; `RESOLVE_CHOICE` runs the tail"** model: one optional `MatchState` field,
one new action, one global gate, seeded option generation through the existing
`rngCursor`, and a pure auto-pick so no proof or sim deadlocks. It touches the
no-stack/triggerQueue model **zero** — each reducer entry still runs depth-first
to a queue-empty end; the pause is just a normal return with `pendingChoice` set.

Cost: ~3–4 engine-days to Phase 2, additive (no fixture re-record, no existing
proof edits), with the one real risk being harness/AI deadlock if an auto-pick
branch is missed — fully mitigated by a shared auto-pick wrapper and proof #7.

### Amendments to `RESOLUTION_MODEL.md`
Add a section "§8 Player choices (pause/resume)" stating: (a) a choice ENDS the
current action with `pendingChoice` set, raised only at a queue-empty boundary;
(b) while pending, only `RESOLVE_CHOICE` is legal; (c) options are seeded via
`rngCursor` and the chosen `optionId` is logged, so `(seed, actions)` still fully
determines state; (d) no frozen call stack — the post-choice tail is an explicit
`resume` record, keeping the no-stack guarantee literally intact.
