# Effect Long-Tail Mapping + Spell / Targeted-Choice Proposal

Research-only. No engine files were modified. A throwaway probe
(`src/dev/_probe_longtail.ts`) enumerated the 37 cards in `allPlayableCards`
whose `compileAbility(...).classified` contains an `op === "UNKNOWN"`, then was
deleted. All proposed specs use ONLY the existing IR shapes from
`abilityCompiler.ts` (`{trigger, op, amount?, attack?, health?, token?,
keyword?, costThreshold?, scaleFaction?, raw}`) unless explicitly flagged
"needs new op".

IR recap of active ops the resolver (`effectResolver.ts`) can run today:
`DEAL_DAMAGE`, `HEAL`, `BUFF_SELF` (supports `scaleFaction` multiplier),
`BUFF_ALLIES`, `DEBUFF_ENEMY`, `SUMMON_TOKEN`, `DRAW`, plus passives
`PIERCE_ARMOR`, `RESTRICT_ATTACK`, `AURA_FACTION_STAT`.

Two structural gaps that recur below:
- **Targeted single-unit ops** (`DEAL_DAMAGE`/`HEAL`/`DEBUFF_ENEMY`) resolve
  only when `ctx.target` is supplied. `fireTrigger` in `reducer.ts` passes no
  target for `ON_SUMMON`/`ON_DAMAGE` battlecries, so these compile cleanly but
  no-op at runtime until targeting (Task 2b) lands. The spec is still the
  correct emission; mark these "spec OK, inert until targeting".
- **Graveyard / revive / copy / bounce** mechanics have no state backing
  (no graveyard zone is read by the resolver) — these need new ops.

---

## TASK 1 — The 37 UNKNOWN long-tail cards

Legend: **[fits]** = emit this spec today; **[fits, inert]** = correct spec but
needs targeting to actually do anything; **[new op]** = no existing op fits.

| # | id | faction | raw ability | proposed spec | status |
|---|----|---------|-------------|---------------|--------|
| 1 | tcg_150 | STONE_KEEPERS | When summoned, heal 1 damage to target Stone Keeper unit. | `{trigger:"ON_SUMMON", op:"HEAL", amount:1}` | [fits, inert] needs target |
| 2 | tcg_209 | STONE_KEEPERS | When dies, summon a 1/1 stonechild with Taunt. | `{trigger:"ON_DEATH", op:"SUMMON_TOKEN", attack:1, health:1, token:"stonechild"}` | [fits]* token keyword not modeled |
| 3 | tcg_241 | STONE_KEEPERS | Summon: gain +1/+1 for each Stone Keeper you control. | `{trigger:"ON_SUMMON", op:"BUFF_SELF", attack:1, health:1, scaleFaction:"Stone Keeper"}` | [fits] |
| 4 | tcg_275 | GOLDEN_SOVEREIGNS | Summon: gain +1/+1 for each Golden Sovereign you control. | `{trigger:"ON_SUMMON", op:"BUFF_SELF", attack:1, health:1, scaleFaction:"Golden Sovereign"}` | [fits] |
| 5 | tcg_293 | IRON_DEFENDERS | Cleave. Deals half its attack to adjacent enemies on attack. | `{trigger:"ON_ATTACK", op:"DEAL_DAMAGE", amount:0}` placeholder | [new op] needs `CLEAVE` (adjacency + half-attack scaling; amount must be derived from source.attack, no IR field for that) |
| 6 | tcg_412 | STONE_KEEPERS | Takes damage: summon a 1/1 frost spirit. | `{trigger:"ON_DAMAGE", op:"SUMMON_TOKEN", attack:1, health:1, token:"frost spirit"}` | [fits] |
| 7 | tcg_494 | IRON_DEFENDERS | Takes damage: gain +1/+1. May spend 2 to summon a 1/1 ironling. | `{trigger:"ON_DAMAGE", op:"BUFF_SELF", attack:1, health:1}` (drop optional paid summon) | [fits] partial; "spend 2 to summon" [new op] (optional resource-gated effect) |
| 8 | tcg_540 | STONE_KEEPERS | Summon: gain +1/+1 for each Stone Keeper you control. | `{trigger:"ON_SUMMON", op:"BUFF_SELF", attack:1, health:1, scaleFaction:"Stone Keeper"}` | [fits] |
| 9 | tcg_938 | STONE_KEEPERS | Summon: gain Ward until end of turn. | `{trigger:"ON_SUMMON", op:"GRANT_KEYWORD", keyword:"WARD"}` (no-op classification) | [fits as no-op]; true "temporary keyword grant" = [new op] if duration matters |
| 10 | tcg_1071 | STONE_KEEPERS | Destroyed: return it to hand and summon a 1/1 stonechild. | summon half: `{trigger:"ON_DEATH", op:"SUMMON_TOKEN", attack:1, health:1, token:"stonechild"}` | [fits] partial; "return to hand" = [new op] `RETURN_SELF_TO_HAND` |
| 11 | tcg_1426 | IRON_DEFENDERS | Summon: gain +1 Attack for each Iron Defender you control. | `{trigger:"ON_SUMMON", op:"BUFF_SELF", attack:1, health:0, scaleFaction:"Iron Defender"}` | [fits] |
| 12 | tcg_1483 | STONE_KEEPERS | Summon: gain 1 life for each Stone Keeper in play. | `{trigger:"ON_SUMMON", op:"BUFF_SELF", attack:0, health:1, scaleFaction:"Stone Keeper"}` | [fits]* (treats "life" as +health on the unit; if "life" = nexus heal, [new op] `HEAL_NEXUS`) |
| 13 | tcg_1639 | BRONZE_GUARDIANS | Summon: restore 2 health to target ally and gain +1/+1 per health restored. | `{trigger:"ON_SUMMON", op:"HEAL", amount:2}` + `{trigger:"ON_SUMMON", op:"BUFF_SELF", attack:1, health:1}` | heal [fits, inert]; "per health restored" scaling = [new op] (dynamic amount) — recommend fixed +1/+1 |
| 14 | tcg_2256 | BRONZE_GUARDIANS | Turn start: draw a spell. Spells cost 1 less while on board. | `{trigger:"ON_TURN_START", op:"DRAW", amount:1}` | draw [fits] (no spells exist yet); "spells cost 1 less" = [new op] cost aura (depends on Task 2 spells) |
| 15 | tcg_2427 | STONE_KEEPERS | Damaged: draw a card. Keyword: Patient. | `{trigger:"ON_DAMAGE", op:"DRAW", amount:1}` (Patient handled by existing keyword path) | [fits] |
| 16 | tcg_2450 | IRON_DEFENDERS | Cleave. Deals 3 damage to an enemy in addition to normal attack. | `{trigger:"ON_ATTACK", op:"DEAL_DAMAGE", amount:3}` | [fits, inert] needs target (extra-enemy pick) |
| 17 | tcg_2529 | BRONZE_GUARDIANS | Deals damage: Regrow 1. If it survives, gain +1/+1. | `{trigger:"ON_DAMAGE", op:"BUFF_SELF", attack:1, health:1}` (Regrow is wired keyword) | [fits]* "if it survives" condition not modeled — fires unconditionally; acceptable approximation |
| 18 | tcg_2616 | STONE_KEEPERS | Takes damage: summon a 1/1 stonechild. | `{trigger:"ON_DAMAGE", op:"SUMMON_TOKEN", attack:1, health:1, token:"stonechild"}` | [fits] |
| 19 | tcg_2629 | IRON_DEFENDERS | Destroyed: summon a 1/1 emberspark with Rush. | `{trigger:"ON_DEATH", op:"SUMMON_TOKEN", attack:1, health:1, token:"emberspark"}` | [fits]* token Rush keyword not modeled |
| 20 | tcg_3044 | STONE_KEEPERS | Takes damage: summon a 1/1 mossling. | `{trigger:"ON_DAMAGE", op:"SUMMON_TOKEN", attack:1, health:1, token:"mossling"}` | [fits] |
| 21 | tcg_3097 | STONE_KEEPERS | Takes damage: summon a 1/1 stonechild. | `{trigger:"ON_DAMAGE", op:"SUMMON_TOKEN", attack:1, health:1, token:"stonechild"}` | [fits] |
| 22 | tcg_3334 | STONE_KEEPERS | Destroyed: summon a 1/1 stonechild with Taunt. | `{trigger:"ON_DEATH", op:"SUMMON_TOKEN", attack:1, health:1, token:"stonechild"}` | [fits]* token Taunt not modeled |
| 23 | tcg_3360 | STONE_KEEPERS | Cannot be targeted by spells. On play: destroy random highest-cost enemy. | — | [new op] `DESTROY_UNIT` (random highest-cost selection) + spell-untargetable flag |
| 24 | tcg_3369 | STONE_KEEPERS | Damage taken: enemy commander takes equal. Healing received: you heal equal. | — | [new op] reflect damage to nexus/commander + reflect heal (dynamic amount, nexus target) |
| 25 | tcg_3375 | STONE_KEEPERS | On play: both reveal top 3. Units ≥5 cost return to deck; others destroyed. | — | [new op] deck-manipulation + conditional destroy |
| 26 | tcg_3380 | IRON_DEFENDERS | Any unit dies: place 1/1 Wraith in graveyard. End of turn: revive one. | — | [new op] graveyard insertion + revive (no graveyard zone in resolver) |
| 27 | tcg_3395 | STONE_KEEPERS | End of turn: raise a random unit from graveyard as a 1/1 Wraith. | — | [new op] graveyard read + revive-as-token |
| 28 | tcg_3400 | STONE_KEEPERS | If you control another Crypt Legend, heal them to full at start of turn. | `{trigger:"ON_TURN_START", op:"HEAL", amount:0}` (0 = "to full" per HEAL_RE convention) | [fits, inert] needs target + "another Crypt Legend" condition [new op gating] |
| 29 | tcg_3415 | STONE_KEEPERS | On play: copy stats and abilities of highest-cost enemy unit. | — | [new op] `COPY_UNIT` |
| 30 | tcg_3425 | IRON_DEFENDERS | Once per match: return last card played by either side to owner's hand. | — | [new op] bounce-last-played + once-per-match tracking |
| 31 | tcg_3446 | STONE_KEEPERS | Summon: gain +1/+1 for each OTHER Stone Keeper you control. | `{trigger:"ON_SUMMON", op:"BUFF_SELF", attack:1, health:1, scaleFaction:"other Stone Keeper"}` | [fits] (`factionScaleCount` excludes source on "other") |
| 32 | tcg_3496 | BRONZE_GUARDIANS | Enters play: regain 1 health for each Bronze Guardian you control. | `{trigger:"ON_SUMMON", op:"BUFF_SELF", attack:0, health:1, scaleFaction:"Bronze Guardian"}` | [fits]* (models as self +health; if nexus heal, [new op] `HEAL_NEXUS`) |
| 33 | tcg_4316 | STONE_KEEPERS | Destroyed: summon a 1/1 stonechild with Taunt. | `{trigger:"ON_DEATH", op:"SUMMON_TOKEN", attack:1, health:1, token:"stonechild"}` | [fits]* token Taunt not modeled |
| 34 | tcg_4433 | STONE_KEEPERS | Summon: gain 2 health for each Stone Keeper you control. | `{trigger:"ON_SUMMON", op:"BUFF_SELF", attack:0, health:2, scaleFaction:"Stone Keeper"}` | [fits] |
| 35 | tcg_4978 | STONE_KEEPERS | Summon: gain +1/+1 for each Stone Keeper you control. | `{trigger:"ON_SUMMON", op:"BUFF_SELF", attack:1, health:1, scaleFaction:"Stone Keeper"}` | [fits] |
| 36 | tcg_5592 | SILVER_SENTINELS | Deals damage: scry 1. You may reveal the top card of your deck. | `{trigger:"ON_DAMAGE", op:"KEYWORD_WIRED", keyword:"SCRY"}` (Scry already wired) | [fits as no-op]; effectively descriptive, no new runtime needed |
| 37 | tcg_6126 | BRONZE_GUARDIANS | Recalls a unit from graveyard with cost 1 or less to your hand. | — | [new op] graveyard recall-to-hand |

### Summary of Task 1 coverage

- **Cleanly emittable today (no targeting needed):** #2, 3, 4, 6, 8, 11, 12, 15,
  17, 18, 19, 20, 21, 22, 31, 32, 33, 34, 35, 36 — mostly faction-scaled
  `BUFF_SELF` (the `scaleFaction` path already exists) and `ON_DEATH`/`ON_DAMAGE`
  `SUMMON_TOKEN`. **These 20 are the immediate wins.** Note: token riders
  (Taunt/Rush) are cosmetic in the IR — `mintToken` always makes a vanilla
  token with empty `keywords`, so the rider is dropped silently. Acceptable.
- **Spec is correct but inert until Task 2b targeting:** #1, 13 (heal half), 16,
  28 — these emit valid `HEAL`/`DEAL_DAMAGE` specs that no-op because
  `fireTrigger` supplies no `ctx.target`.
- **Partial fit (emit the supported half, drop the rest):** #7 (buff yes,
  paid-summon no), #9 (grant-keyword as no-op), #10 (summon yes, return-to-hand
  no), #14 (draw yes, cost-reduction no).
- **Need a NEW op (no IR shape fits):** #5 (CLEAVE/derived-attack damage),
  #23 (DESTROY_UNIT), #24 (reflect damage+heal), #25 (deck reveal/conditional
  destroy), #26/#27/#37 (graveyard zone + revive/recall), #29 (COPY_UNIT),
  #30 (bounce-last-played). These all require new state (graveyard zone,
  destroy/copy/bounce ops, dynamic amounts) and should be deferred.

Caveat on #12/#32 and faction "life/health": where text says "gain N **life**"
the design intent may be nexus healing rather than a self +health buff. The IR
has no nexus-heal op, so I mapped to self `+health`. If nexus is intended,
that's a new `HEAL_NEXUS` op. Flag for Billy's call.

---

## TASK 2 — Spells & targeted choice (design proposal)

The catalog has zero spell cards and zero "choose a target" effects. Today
`cardTypeOf` only returns `unit | equipment | artifact`, and `PLAY_SPELL` is a
hard reject (`reducer.ts` returns `reject(state, "spells-not-in-lived-flow")`).
`PLAY_UNIT` is the model to mirror: validate handIndex, validate type, validate
energy, mint/play via an engine helper, then `fireTrigger(..., "ON_SUMMON")`.

### (a) Minimal conservative SPELL category

Reuse the existing active ops; a spell is just "an `EffectSpec[]` that fires
immediately on play, then the card goes to graveyard/discard instead of the
board." Conservative starter templates (all already resolvable):

| Template | EffectSpec | Targeting |
|----------|-----------|-----------|
| Deal N | `{trigger:"ON_SUMMON", op:"DEAL_DAMAGE", amount:N}` | needs target (enemy) |
| Heal N | `{trigger:"ON_SUMMON", op:"HEAL", amount:N}` | needs target (ally) |
| Draw N | `{trigger:"ON_SUMMON", op:"DRAW", amount:N}` | no target |
| Buff an ally +X/+Y | `{trigger:"ON_SUMMON", op:"BUFF_SELF", attack:X, health:Y}` | needs target (ally) — note BUFF_SELF buffs `ctx.source`; for a spell, treat the chosen target as `source` |
| Weaken an enemy -N atk | `{trigger:"ON_SUMMON", op:"DEBUFF_ENEMY", amount:N}` | needs target (enemy) |

`ON_SUMMON` is reused as the spell's "on cast" trigger so the resolver path is
identical to a battlecry. No new op is required for these five.

**Engine changes for `PLAY_SPELL` (mirror of `PLAY_UNIT`):**
1. Add `"spell"` to `CardType` in `cards.ts` and route it in `normalizeCardType`
   (e.g. `cardClass === "spell"`). (Data change, out of scope here — flag.)
2. In `reducer.ts` `PLAY_SPELL`: replace the blanket reject with the
   `PLAY_UNIT`-style guards — bounds-check `handIndex`, `cardTypeOf(cardId) ===
   "spell"`, energy check `costOf(cardId) <= player.energy`. Deduct energy.
3. Resolve the spell's compiled specs: build an `EffectContext`
   (`{state, controller, target?, factionOf}`) and call `resolveSpecs(
   compiledFor(cardId).specs, ctx)`. The target comes from
   `action.targetInstanceId` (already on the action shape, line 50).
4. Remove the spell from hand and push its cardId onto a discard/graveyard list
   (a new `player.graveyard: string[]` field if none exists). Do NOT put it on
   the board.
5. Emit a `SPELL_PLAYED` event for parity with `UNIT_PLAYED`.

All of step 2-5 reuse existing helpers (`costOf`, `cardTypeOf`, `compiledFor`,
`resolveSpecs`, `findUnitByInstance`). No resolver changes needed for the five
templates.

### (b) Targeted choice modeling

The action already carries `targetInstanceId?: string` (used today by `EQUIP`).
The smallest model:

- The dispatching action supplies `targetInstanceId` (the chosen unit's
  `instanceId`). This is the ONLY new data the player must provide.
- In the reducer, resolve it to a live `UnitInPlay` with the existing
  `findUnitByInstance` helper. Decide ownership scope per op: `HEAL`/buff →
  search the controller's own board; `DEAL_DAMAGE`/`DEBUFF_ENEMY` → search the
  opponent's board (`findUnitByInstance(next, opponentOf(player), id)`).
- Pass it as `ctx.target` (for damage/heal/debuff) or, for the buff-an-ally
  template, as `ctx.source` (since `BUFF_SELF` buffs `ctx.source`).
- Reject cleanly if the target is required but missing/not found
  (`reject(state, "spell-target-not-found")`), mirroring EQUIP's
  `equip-target-not-on-own-board`.

**Resolver change:** none. `resolveEffect` already honors `ctx.target` for
`DEAL_DAMAGE`/`HEAL`/`DEBUFF_ENEMY`. The whole feature is reducer-side: thread
`action.targetInstanceId` → `findUnitByInstance` → `ctx.target`/`ctx.source`.

**Bonus:** wiring targeting also "un-inerts" the targeted battlecries found in
Task 1 (#1, 13, 16, 28). If `PLAY_UNIT` is later extended to accept an optional
`targetInstanceId` and forward it into the `ON_SUMMON` `fireTrigger` call, those
specs would resolve with no further compiler work.

### Balance risks (flagged, conservative posture)

- **Reach/face damage:** `DEAL_DAMAGE` currently only hits units (`ctx.target`
  is a `UnitInPlay`). A "Deal N to nexus" spell would need a new nexus-target
  path — keep spells unit-only at first to avoid burn-to-face degeneracy.
- **Armor bypass:** `damageUnit` ignores armor by design (ability damage is
  spell-like). That's correct for spells but means cheap removal can erase
  high-armor tanks — keep spell `amount` low (≤3) initially.
- **`HEAL` to full:** `amount:0` = "heal to full" by the existing convention.
  Don't author `Heal 0` spells expecting nothing — author explicit `amount`.
- **Buff-via-`BUFF_SELF`:** because the template repurposes `ctx.source` as the
  chosen ally, make sure the reducer sets `source` (not `target`) for that
  template, or the buff silently no-ops.
- **`DRAW` + deck-out:** `drawCards` is bounded by deck length and won't fatigue
  the player itself; fatigue/loss is the reducer's `drawForPlayer`. A pure
  `DRAW N` spell is safe (no deck-out from it).
- **Cost-reduction auras** (cards #14, #2256) interact with spell costs — defer
  until spells exist and costs are real, or they're unbalanceable.

### Recommended sequencing

1. Wire the 20 "immediate win" long-tail specs (faction-scaled buffs + on-death/
   on-damage token summons) — pure compiler emissions, resolver already handles
   them.
2. Add `targetInstanceId` threading to `PLAY_UNIT` `ON_SUMMON` to un-inert the
   four targeted battlecries.
3. Introduce the five-template SPELL category with `PLAY_SPELL` mirroring
   `PLAY_UNIT` + the (b) targeting thread.
4. Defer everything needing a new op (graveyard, destroy, copy, bounce, reflect,
   cleave) to a dedicated Phase D with its own state additions.
