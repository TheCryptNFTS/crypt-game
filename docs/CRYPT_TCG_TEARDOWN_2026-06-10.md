# CRYPT TCG — FULL TEARDOWN + REBUILD PLAN
**2026-06-10 · Full-studio audit: 12 specialists (playtest-QA, browser QA, systems, balance, meta, narrative, UX, art, game-feel, economy/liveops, engineering, security) + game-director synthesis.**
**Method: live browser play-through, 5 scripted engine repros, 300-match real-engine playtest, full import tracing, git-history scan. Scope: this repo only. No files were modified by the audit.**

Locked constraints honored throughout (not re-opened): NO response stack (own-the-race); HEX ⬡ never "Nexus" in display; rewards are device-local only (client wins never credit real HEX); on-chain rarity frozen; no emojis in UI.

---

## 1. PRODUCT VERDICT

**What it is:** a real, stable, deterministic solo card battler — splash → pick-a-style onboarding → coached tutorial → full match vs a sequenced AI → win/loss ceremony → device-local rewards — wearing the costume of a much bigger live-service TCG (PvP, spectate, leaderboards, seasons, marketplace, replay) that does not actually exist in production.

**What it's trying to be:** the playable layer of the Crypt NFT collection — your on-chain cards as a fast, no-interruption ("own the race") dueling game inside the FREELON CITY world.

**Why a player would care:** matches are fast (~5 min, median 13–15 turns), the engine is honest about legality (every blocked action gives a reason), the art is genuinely good when the UI lets it be, the audio is a real procedural soundscape, and the first three taps (splash → archetype pick → coached duel) are best-in-class shape.

**Why a player bounces:** the rules lie (cards whose printed text does nothing or hurts you), the match board hides the one keyword that decides every combat, the first post-tutorial click errors for 100% of guests, the win moment is a three-overlay pileup, and there is **no reason whatsoever to return tomorrow** — no quest that can progress, no sink for the currency, no rank delta shown, a collection that's complete at minute zero.

**Is the loop strong enough?** The *minute-to-minute* loop is fun-shaped and nearly there. The *day-to-day* loop does not exist. The *trust* loop — card says X, game does X — fails on roughly a third of the catalog.

**Does the NFT integration help or confuse?** Currently confuses. Stats are canon-true to chain (4,058/4,058 verified), but 2,223 of 4,129 in-game names differ from what the holder sees on OpenSea — and the deck builder and the match screen show *different names for the same card*. Ownership changes nothing in play (guests get all 4k cards), "one-of-ones" don't exist as playable cards, and the gods are stat-vanillas while no-name mythics got the bespoke treatment.

**Honest fraction:** ~70% of the shipped surface is real; ~30% is theater (UIs pointed at a server that never deploys). ~40–50% of the *repo* serves ambitions, not the game.

---

## 2. CORE GAME LOOP — step by step

| Step | Exists? | Fun? | Clear? | What breaks | Rebuild? |
|---|---|---|---|---|---|
| Collect cards | NO | — | — | No ownership concept anywhere; everyone has all 4,129 cards at minute zero; nothing earned ever grants/marks a card | Add owned-card ⬡ stamp (display-only) + commander mastery counters; never fake scarcity |
| Build deck | YES (live) | NO | PARTIAL | 4,064-card pool with **no search/filter/sort**; silent no-op at the 30 cap; god cap displayed but **not enforced** (a 20-god deck is legal today, `DeckBuilderPage.tsx:200` → `validateDeck`); ownership invisible; raw `<select>` commander picker | Port CollectionPage's filter bar; toast on cap; enforce deckRules; stack duplicates ×2 |
| Choose commander | YES | PARTIAL | NO | Onboarding passive text describes a **removed mechanic** (`commanderSpecs.ts:51` "Raid — deal 1 damage" vs actual RUSH grant); deck name vs commander name incoherent ("Tor of Stone's Grasp" vs "Stone Warden"); generated `cmd_6xxx` commanders have no passive and **silently disable the faction-identity layer** | Fix the text lie; one name per thing; curated-5 only for V1 |
| Play match | YES — live-verified in browser today | NEARLY | PARTIAL | Keywords invisible on board; impact effects fire ~165 ms before the attack lands; AI attacks with an invisible arm; spells/equip have zero feedback; energy display switches to opponent's pool on their turn; Reset next to End Turn with no confirm | The P2+P3 board-legibility and feel workstreams below |
| Win/lose | YES | PARTIAL | YES | Solo mounts **both** ceremonies at once (`MatchCeremony` z-70 under `WinCeremony` z-1200); no beat between lethal blow and overlay; tutorial win = 3 stacked end screens | One ceremony, 500 ms lethal beat |
| Earn/progress | PARTIAL | NO | NO | +⬡/+XP only if you click "View rewards" (Run It Back forfeits rewards and the AI-difficulty counter); `/rewards` quests permanently frozen at 0 (`useMatchRewards(null)`); MMR delta never shown to guests; currency has **zero sinks** | The P5 retention kit — mostly *wiring that already passes its proofs* |
| Return tomorrow | NO | — | — | Daily vault pays 50⬡ into a void and reveals 3 placeholder slots; no first-win bonus, no streak, no quest that tracks play | First-win bonus + activated quests + one cosmetic sink |

**Classification of every routed surface** (from the truth pass): LIVE: `/`, `/onboarding`, `/tutorial`, `/home`, `/match` (solo), `/draft`, `/deck`, `/collection`, `/help`, `/ladder`, `/match-results`, `/rewards` (shell), `/profile`, `/friends` (local), `/d`. PARTIAL: `/play` (PvP queue errors for guests), `/daily-pack` (refresh dead-end, fake card slots), `/market` (honest stub). THEATER (point at a server that never deploys): `/spectate`, `/leaderboard`, home "server quests". ORPHAN: `/replay` (viewer with no producer), `/puzzles` (reveal-only, not playable, says "nexus"). DEAD CODE: v0 app shell (4 dirs), second match board (`src/components/crypt/` — the gitignore-trap dir is itself dead), `CryptMatchShowcase.tsx`.

---

## 3. FIRST-TIME PLAYER EXPERIENCE — every confusion point, in order

The spine (splash → 3-archetype pick → coached duel) is genuinely excellent. Then:

1. **Three decoy doors on the front step** — Sign in / Create account / Link wallet all print "not live yet" (`SplashLoginPage.tsx`).
2. **The first interactive screen of the game is the mulligan** — a redraw decision before the player has ever seen a card. Tutorial should auto-resolve it (`TutorialPage.tsx`, `useLocalCryptMatch.ts:161`).
3. **The coach's first rules sentence is wrong** — "Each side guards a Hex at 20 health" while the board shows YOU at 25 (`NEWCOMER_PLAYER_NEXUS`, `useLocalCryptMatch.ts:76`) and the enemy at 8 (`TUTORIAL_OPPONENT_NEXUS`, `TutorialPage.tsx:18`).
4. **Tutorial steps 2 and 4 are unreachable** (`TutorialCoach.tsx:75-85` can only return 0,1,3,5,6) — **lanes and GUARD/RUSH are never taught**, and the step counter visibly skips 1→2→4→6→7.
5. **Attacking is never taught.** The coach jumps past it; select-unit → ATTACK is discovered by poking.
6. **Turn-1 dead-end**: coach demands "get a body on the board" when the hand has no playable unit; every button disabled; nothing says "END TURN is your move." Reads as *game is broken*.
7. **First win = three stacked end-screens** (MatchCeremony + TutorialCoach card + "THE CRYPT IS OPEN" dialog, two at z-70, backdrop bleed). The most important FTUE moment is a pileup (`CryptMatchBoard.tsx:820`).
8. **Tutorial pays nothing** — WinCeremony (the only path to the reward beat) is suppressed in tutorial mode.
9. **The featured post-tutorial button errors for 100% of new players** — `/play` leads with Find Match, which requires the wallet sign-in the splash just said isn't live (`PlayHubPage.tsx:119`). The mode that works (solo) is a small tertiary link.
10. **First real match: the player cannot read their own cards** — no keyword chips on board/hand cards, no mid-match inspect. GUARD is taught by rejection text that names no unit ("clear the Guard first" — *which one?*), against a faction literally named BRONZE GUARDIANS.
11. Deck builder: silent failures + unsearchable 4k pool (above).
12. Identity soup: "Vault" means 5 different things across the app, "Archive" 4; deck/commander/dealt-by names don't line up; `CatalogLoader.tsx` shows **npm commands** to players in its loading/error states; a summoned token renders as raw id `token_revenant` (`effectResolver.ts:175`).

---

## 4. GAME RULES + BALANCE

**The actual rules** (reconstructed from the reducer, not the docs): 30-card deck, max 2 copies, commander outside the deck; 6-card opening hand, selective mulligan (human only); both start 3/3 energy — but only because the UI hook overwrites the engine's own 1/1 seed (`useLocalCryptMatch.ts:130-134` vs `setup.ts:79`); +1 max energy/turn, cap 10; HEX 20 — except live solo where P1 secretly starts at 25; two lanes × 7 units, lanes have **no defensive meaning** (placement only matters for adjacency/sweeps); no phases — play and attack in any order then END TURN; defender counterattacks in unit combat, face attacks are free; win = enemy HEX ≤ 0, or opponent deck-out; simultaneous kill → attacker wins. Response stack and all alt win-cons OFF (correct per lock — but the code is still wired, see §8).

**What works:** the reducer is genuinely S-tier discipline — deterministic, seedable, reject-soft with reasons, canonical trigger ordering, bounded cascades, 300/300 sim matches terminate. Energy/lane/sickness/keyword guards all verified at code level. 106/106 vitest, tsc 0, build green.

**What is broken — five reproduced engine bugs (repros in /tmp, each ready to become a proof):**

| # | Bug | Severity | Mechanism |
|---|---|---|---|
| D1 | **Heals/LIFESTEAL damage the live player** | CRITICAL | `healNexus` clamps to `min(20, cur+amount)` while live P1 starts at 25 → first lifesteal proc = −5 HEX. Scattered `?? 20` literals (`reducer.ts:382-383,547-548,1294`; `effectResolver.ts:495-503,1104`). Fix = `maxHexHealth` on player state + sweep every literal, not one patch |
| D2 | **Engine throws on a legal discounted play** | CRITICAL | Reducer legality uses aura-discounted cost (`reducer.ts:1497`) but delegates to `setup.ts:350` which throws against printed cost. Uncaught exception out of `applyAction` — a crash a player can click into (King Tomb tcg_3370) |
| D3 | **Artifacts are a self-harm button** | CRITICAL | All 71 artifacts have empty `effectTags` + a lowercase/UPPERCASE rarity mismatch (`effectSystem.ts:73-103`) → playing one does nothing for 2–5 energy. Worse: every artifact play calls `resetUnitToBase` (`effectSystem.ts:104-122`) — **erases equipment buffs, PATIENT growth, resonance, commander buffs** on your own front lane. The AI plays artifacts, hurting itself. `dev:artifact` passes green — node-gates-lie exhibit A |
| D4 | **Deaths at END_TURN skip the entire death ruleset** | HIGH | END_TURN damage (DECAY etc.) kills via silent `removeDead` — no graveyard entry, no deathrattle, no death watchers (`reducer.ts:1735-1872` never calls `resolveDeaths`). Same death by spell fires everything. Fix = ONE unified death pipeline, all paths through `resolveDeaths` |
| D6 | **STEALTH+GUARD hard lock** | HIGH | 8 real cards print both. Stealth never expires unless it attacks; Guard redirects all attacks into it; spells can't target it → opponent can legally attack **nothing** forever. Fix: stealth expires at controller's next turn start |

Plus: **100% of equipment text is cosmetic** — 1,243 cards, 1,020 with printed keywords, zero reach the wearer (`setup.ts:431-438` transfers only the four stat numbers). The single biggest betrayal-of-mental-model surface in the game.

**Balance state (real-engine playtest, 300 matches — directional, structural findings only):**
- **The entire balance toolchain measures a fictional catalog.** `report:outliers`, `sim:curated`, `report:coreset:v2`, and the `check:alpha` gate all read stale `generatedPlayableTcgUnits.json` (`tcg_unit_*` id space, invented rarity-template stats, never rebuilt after the re-reveal). The live game doesn't use it. `sim:curated` isn't even a simulation — it's a stat dice-off with a baked-in side-A bias. **First balance fix is pointing the instruments at the game players actually play.**
- **BRONZE_GUARDIANS 26% win rate** — structurally dead. Cause is mechanical: a wall faction (GUARD 41% + REGROW 50% of its pool) whose commander passive and faction identity both grant RUSH (fully redundant) — walls told to charge. **And `DEMO_FACTION = BRONZE_GUARDIANS` (`buildOwnedDeck.ts:105`) — the newcomer deck is the broken deck.**
- **GOLDEN_SOVEREIGNS 63.5%** — dominance from raw statlines (zero commons on chain, all-rare pool) + RUSH density + DEATHRATTLE = 2 uncounterable face burn per death in a no-stack game. Its actual identity hooks key off cost≥5 — which Gold has TWO units of (inert).
- **Silver 1-drop wall cluster** — our own 2026-06-02 override patch overshot: five 1-cost dual-keyword walls (tcg_331/1286/3294/2201/1747) at 3-drop value. Walk back to 1/3, 1/2.
- Stat budgets are otherwise flat and fair (2.2 stats per energy everywhere) — **stats are not the differentiator, keywords are**, and ~45–50% of the pool is functionally interchangeable (44% exact mechanical reprints, 28% strictly dominated, 71.6% behaviorally inert beyond one keyword). Fine for a 4k NFT collection; it means the "real" game is ~1,900 cards.
- **Gods are trophy-tame** — 10 identical-shape big bodies with one generic keyword each, outclassed by faction mythics; no-name mythics (Lucifer, I Am Death, King Tomb, T2) got the bespoke treatment the gods deserve. 1-per-deck cap makes them safe to be splashy — but the cap **isn't enforced** (above).
- First-player WR 46.3%, avg match 15.7 turns, 98.3% decisive by HEX kill. The format bones are healthy.

**What to simplify:** ~25 distinct mechanics in the engine; a new player can hold 5–7. The V1 cut list is §6/§11.
**What to rebalance first:** instruments → Bronze rescue → Gold shave → Silver walk-back → DEATHRATTLE 2→1 → make gods marquee. In that order.

---

## 5. FACTIONS + CARD IDENTITY

Roster confirmed: STONE_KEEPERS, IRON_DEFENDERS, BRONZE_GUARDIANS, SILVER_SENTINELS, GOLDEN_SOVEREIGNS + GODS. **"One-of-ones" do not exist as playable cards** — 3 commander lore entries only, none selectable.

| Faction | Fantasy (is → should be) | Mechanical identity | Weakness | Current problem | The ONE fix |
|---|---|---|---|---|---|
| STONE | Geology flashcards → **the civilization's memory** ("Stone remembers.") | GUARD walls + deathrattle; identity fires on 100% of summons — the only coherent faction | None designed; it's the default goodstuff | 5 of the top-8 most-played cards are Stone | Leave it. It's the anchor |
| IRON | Rust/forge/the-held-line — best mortal-faction voice | Bible says aggro; data says defensive equipment-midrange (lowest attack, most GUARD in curated set) | Accidental: needs unit+equipment in hand | Bible and stat budget contradict; bottom-of-band 45.8% | Accept equipment-midrange, rewrite the bible line; move some armor budget → attack on cheap units |
| BRONZE | **Three fantasies stapled together** (aggro hooks + grove-druid names + graveyard spells) → "the grove that overruns you" | GUARD 41% + REGROW 50% walls, told to charge by two redundant RUSH grants | Designed self-sabotage | **26% WR; the demo faction; the worst faction break in the set** | Re-axis commander passive onto its actual pool (e.g. "your Regrow/Guard summons enter +0/+1"); rename identity "Onslaught"→"Overgrowth" |
| SILVER | Mirrors, cold, watching — real motif, matches the kit | Ward/Stealth/Scry tempo wearing control flavor; best stat ratio | None — it took Bronze's tempo identity | 59.4% and just got buffed; its real control tools (removal spells) aren't legal in human decks | Walk back the five 1-drop walls; don't touch otherwise until humans play |
| GOLD | Dusk-gold court, leaning on a borrowed god (a mortal "Zeus" while the real Zeus is a God) | 67% vanilla stat-sticks; identity keys off cost≥5 with 2 qualifying units | None — power without design space | **63.5% WR from raw statlines; identity inert** | Shave the over-statted vanilla bodies (the identity-axis shave changed nothing); de-god the mortal Zeus via display rename |
| GODS | Genuinely mythic — named, epitheted, individually voiced. The proof the bar is reachable | One generic keyword each on identical statline shapes | — | Trophy vanillas; cap unenforced; god names leak onto mortal cards | Bespoke override abilities (the Lucifer treatment), enforce the cap |

**Card identity / narrative:** the shell (tutorial, HUD, Archive/Vault/Reliquary nouns) is confidently FREELON signal-civilization; the 4,129 cards underneath are a generic dark-fantasy asset dump — ~80% slot-formula names ("X of the Y Z" with ~10 recombined phrases; "Oath of Veiled Oaths", "Bong of Eternal Vigil", a card literally named "Evergreen Nexus"), a ~30–40-line flavor pool stretched 100×, Hearthstone vocabulary printed on the cards themselves (Taunt/Charge/Deathrattle/Divine Shield — on the gods). Two games wearing one logo. The fix is a **two-day word pass, zero mechanics, zero chain changes** (§11 P5): nexus purge, hero→Hex, ~15 display renames via the proven `cardOverrides.ts` name field, Bronze=Overgrowth, five faction creeds promoted from existing best lines.

---

## 6. KEYWORDS

Inventory from compiling all 4,203 cards through the engine's own `compileAbility`. "Dead" = chip shows, engine fires nothing.

| Keyword | Cards | Enforced? | Clear? | Verdict |
|---|---|---|---|---|
| GUARD | 924 | YES | Yes | **KEEP** — but 1/3 of all units having it deadens it (balance lever) |
| RUSH | 362 | YES | Yes | **KEEP** |
| DEATHRATTLE | 275 | YES — except END_TURN deaths (D4) | No (promises "an effect", delivers fixed 2 face burn) | **CHANGE**: fix D4, tune 2→1, rename ("Last Word") |
| REGROW | 259 | YES | Yes | **KEEP** |
| WARD / SHIELD / DIVINE_SHIELD | 218 | YES | Three names, one mechanic | **CHANGE**: collapse display to WARD |
| LIFESTEAL | 121 | YES — but harms you above 20 HP (D1) | Yes | **KEEP** after D1 |
| PATIENT | 107 | PARTIAL (16 dead chips; enforced only when text compiles) | No | **CHANGE**: enforce from the keyword itself |
| ARMORED | 80 | YES | Yes | **KEEP** |
| SCRY | 79 | YES (auto-sort) | No — zero player decisions, invisible | **KILL** as a keyword; keep deck-smoothing as Silver's commander passive |
| FLYING | 72 | YES | Yes | **KEEP — but RANGED exists on ZERO cards.** Seed RANGED onto ~20–30 cards via overrides, or Flying's only answer is other flyers |
| STEALTH | 68 | YES | Yes | **CHANGE**: expires at controller's next turn start (kills the D6 lock) |
| EXECUTE | 63 | YES | Threshold invisible | **KEEP**, document |
| CRUSH | 41 | YES | Yes | **KEEP** |
| DECAY | 36 | YES — deaths skip rules (D4) | Yes | **CHANGE** (fix D4) |
| JUDGMENT / FEAR / SUMMON / RALLY | 22–41 | YES | Mostly no | JUDGMENT **KILL**; FEAR **CHANGE** (visible threshold); SUMMON/RALLY fold into ability text |
| OATH | 12 | **NOT ENFORCED** (read-model consumed only by a proof) | No | **KILL or wire** |
| Ten ≤5-card keywords (VOW, MARTYR, BLESS, MIRE, RECALL, DEATHKNELL, DEPLOY, RELIC, RITUAL, WINDFURY) | ~25 total | Mixed | No | **KILL all ten** for V1 (re-text ~25 cards) |
| QUICKSTEP / MYTHIC / COMMAND / TAUNT / EXECUTE_PRESSURE / DEATH_BLAST / BATTLECRY_HERO_HIT / ARMOR_GAIN | **0 cards** | Dead hooks | — | **DELETE** — the Help glossary teaches 9 keywords that don't exist while ~18 real ones fall through to "No description available" (`keywordDescriptions.ts:125-133`) |

**Clean V1 keyword system (8 + 2 text patterns):** GUARD, RUSH, WARD, FLYING, RANGED, LIFESTEAL, CRUSH, STEALTH(+expiry) as keywords; "battlecry" and "last word" as plain ability-text patterns. Glossary rebuilt to list exactly these, each with one line, in world voice ("your Hex", never "your hero" — currently 6 hero hits in `keywordDescriptions.ts`).

---

## 7. UI / UX SCREEN AUDIT

| Screen | What players need | What's wrong | Verdict |
|---|---|---|---|
| Splash `/` | One way in | 3 decoy auth buttons | CAN-WAIT (one "coming soon" line) |
| Onboarding | Pick & go | Raw engine-speak passive text — and the Bronze passive description is a lie (removed mechanic) | FIX TEXT NOW |
| Tutorial | Verbs + goal + a win | The 5 FTUE breaks in §3 | REDESIGN-NOW (all small, surgical) |
| Home | Play + one next thing | "Vault" tile → `/deck` while nav "Vault" → `/collection`; meaningless headline; 6 progression systems on day 0 | FIX naming collision |
| Play hub | The working mode first | Find Match (guaranteed guest error) featured; solo demoted to tertiary link | REDESIGN-NOW (reorder + hide guest PvP) |
| Match screen | Whose turn / what I afford / what threatens / how to win | **Keywords invisible on board cards; units uninspectable mid-match** (the #1 interface defect); energy display switches to opponent's pool on their turn (`useLocalCryptMatch.ts:661-663`); Reset next to End Turn, no confirm, instant (`MatchTopBar.tsx:145`); 5 always-visible mostly-disabled play buttons; `token_revenant` raw id; ⬢ vs ⬡ glyph drift | REDESIGN-NOW (board legibility workstream) |
| Match end | One verdict + payoff | Both ceremonies mount simultaneously; no lethal beat; PvP can never reach `/match-results` | FIX (one ceremony, parameterized) |
| `/match-results` | What I earned, next action | Solid; refresh-safe; "(device)" honest; lore-salad momentLine | CAN-WAIT |
| Collection | Browse/search/read | Best page in the app — search, filters, art-forward, detail modal. Proves the ceiling | KEEP (it's the pattern to port) |
| Deck builder | Find cards, build legally | No search on 4,064 buttons; silent cap/format failures; ownership invisible; god cap not enforced; `<select>` commander | REDESIGN-NOW |
| Help | Rules in plain words | Clearest writing in the product; but glossary teaches dead keywords and duplicates GUARD/TAUNT, WARD/SHIELD | FIX with keyword pass |
| Loading/error | Reassurance | `CatalogLoader.tsx` ships npm commands to players | FIX copy |
| Shop/Market/Rewards | Honest stubs | Honest but riddle-voiced; `/rewards` quests frozen at 0 forever = a broken promise on screen | WIRE quests (P5) |
| Mobile | Playable match | 10 fixed nav tabs during match (mis-tap exits match, ~35px targets); HUD chip stack fills first screen; combat log renders between board and hand | Hide dock in match + 4-5 tabs; rest CAN-WAIT |

---

## 8. TECHNICAL DEBUG AUDIT

**Checks at HEAD:** `tsc --noEmit` 0 errors · `vite build` green (1.23s) · vitest 106/106 (7 files — the "1,706 tests" figure counts proof-script assertions, several of which test code this plan deletes; update the canon) · **`npm run health` / `check:alpha` RED** — `dev:combat-parity` fails on a stale fixture (harness pins P1 active, case 9 attacks as P2 → correct `not-your-turn` reject before the fear check; committed red in 7e406c0). Engine verified fine; fix the fixture (`runCombatParityProof.ts:159`) or every future real regression hides behind an already-red gate.

**CRITICAL — the name-wipe loaded gun:** shipped `generatedTcgCards.json` contains 2,223 hand/agent-edited names diverging from its canonical source, but its `.meta.json` still documents regeneration via `buildCanonicalTcgData.mjs` — **running the documented regen silently wipes all 2,223 edits.** Second gun: `importTcgCards.cjs` reads pre-reveal `tcg_metadata/` and would overwrite canonical data if ever run. (Director ruling on the names themselves: **chain names win in-game** — holders must find the card they own; archive the 2,223 edits as a candidate future metadata upgrade.)

**HIGH — bundle:** 12.4 MB JS (~1.2 MB gz). `buildCuratedDeck.ts` imports the full 11 MB `cardMaster.json` into the client to build decks at runtime (7.5 MB chunk); 3.2 MB of card flavor text ships as JS; a 1.34 MB generated TS file for commander specs. Fix: precompute decks at build time, ship the slim V1 catalog, lazy-load flavor.

**HIGH — dead-in-prod services:** `ladderApi/socialApi/spectateApi` fetch same-origin `""` on a static deploy → JSON parse throws → null → permanent "offline" UI for /spectate, /leaderboard, home server-quests.

**Dead code (all verified by import trace):** v0 app shell (`src/app-shell/`, `src/pages/app/`, `src/components/app-shell/`, `src/app-state/` — ~14 files, includes the "NFT reward granted" strings); `src/components/crypt/` second match board (only importer is unrouted `CryptMatchShowcase.tsx`); `src/index.ts` pseudo-entry; ~10 dead generated datasets + their dead generator scripts; `openseaAssets.json` (22.6 MB) sitting inside `src/data/` one import away from the bundle; vetoed-but-wired engine subsystems (response stack ~400 lines through the hottest file, secrets with no producer, 3 flag-off alt win-cons, zero-caller legacy keyword hooks).

**Repo junk:** two embedded Unity projects (136 MB: `Crypt/`, `crypt tcg/`), `asset-review/` 204 MB **tracked AND gitignored** (every playtest run dirties the tree), `refactor_dump/`, `backup_faction_fix/`, root audit artifacts, `.bak` litter in `src/engine/` and `scripts/`, zero-byte tracked `commanders` file, duplicated `.gitignore` stanzas — and `Crypt/` still over-matches `src/components/crypt/` (tighten to `/Crypt/`).

**server/ verdict (director: DELETE):** proof-tested scaffold, unreachable in prod (vercel = static SPA; live PvP goes through `freeloncity.com/api/match/*`), carries latent CRITICAL dev-secret auth fallback + no rate limiting, drags `better-sqlite3`/`ts-node`/`typescript` in prod dependencies. One backend (the city) — port ladder/social later if wanted; git remembers.

**Fragility:** three overlapping progression stores (`crypt.progress.*`, `crypt_meta_*_v1`, `crypt_game_app_state_v1`) — three places XP/currency can drift; `https://freeloncity.com` hardcoded in 6 files; 4 storage-key naming conventions; `.env.example` documents none of the live VITE_* vars; **no crash containment around the reducer** — D2 proves `applyAction` can throw mid-match and nothing catches it (fix: keep last-good state, catch at dispatch, toast + rollback, ~20 lines).

**Other state bugs:** AI difficulty ramp reads `matchesTotal`, written only on `/match-results` visit → Run-It-Back players face the easy bot forever (`cryptMatchAI.ts:201`, `localProgress.ts:116`); DailyPackPage refresh dead-ends to /home (missing the sessionStorage rehydrate `MatchResultsPage` already has); WinCeremony reward nonce = `Date.now()` → re-clickable (device-local, LOW).

---

## 9. SECURITY / TRUST AUDIT

| Finding | Severity | Status |
|---|---|---|
| **Live OpenSea API key recoverable from git history** (`git show a005023:.env.local`; the removal commit didn't rewrite history). Not in the bundle (Node-script env only) | **HIGH** | **Rotate the key at OpenSea now; scrub history (filter-repo/BFG)** |
| Share-card image omits "(device)": `+N ⬡ HEX` leaves the device onto social with no qualifier — the one asset designed to be screenshotted (`MatchResultShareCard.tsx:47`) | MED | One-line fix |
| Dead-code "NFT reward granted" / "Claim Weekly Chest" / fake 18,750 balance tree (`src/pages/app/`, `rewardService.ts:121`) — not shipped (tree-shaken, verified absent from dist) but one re-route away from a regulator screenshot | MED (latent) | Delete with the dead shell |
| `server/` if ever deployed: dev-secret fallback = "log in as anyone" (`server/auth.ts:42-47`); zero rate limiting | CRITICAL/HIGH (latent) | Moot if server/ is deleted per director |
| Replay viewer main-thread DoS via crafted share link (unbounded action loop, `ReplayPage.tsx:96-127`) | LOW | Moot — /replay deleted per director |
| localStorage self-grant of currency/XP | LOW (by design) | Verified: **no downstream consumer trusts it** — shares display-only, ladder/quests server-gated, entitlements on-chain. Keep the invariant |
| XSS | NONE | Zero `dangerouslySetInnerHTML`; all metadata renders as JSX text; forged ids render escaped |
| SQL injection (server/) | NONE | Fully parameterized |
| Marketplace value movement | NONE | Every mutating call throws `OwnerDecisionRequiredError`; prices labeled device-local. Exemplary |
| **Core invariant: no game path sources or implies real spendable HEX** | — | **HOLDS** across the shipped client. Routed copy discipline ("⬡ HEX (device)", "not on-chain in this build") is exactly right |

Trust copy nits: `en.ts:142` "Real SKUs priced in ⬡ HEX or fiat" → reword ("device ⬡ HEX is not a payment method"); marketplace listing rows missing the "(device)" qualifier the header has; brand icon hotlinked from OpenSea's CDN (`AppShell.tsx:30`) — ship it locally.

---

## 10. FUN FACTOR — honest ratings /10

| Axis | Score | One line |
|---|---|---|
| First impression | **7** | Splash/onboarding/home are confident and art-led; nothing about the entry says amateur |
| Clarity | **5** | Loop is learnable, every action logs a reason — but attack never taught, GUARD invisible, names incoherent, key failures silent |
| Fun (moment-to-moment) | **5** | Fast and fun-shaped; mistimed impacts, invisible AI attacks, silent spells, and rules that lie drag it |
| Replayability | **3** | One midrange trade-fest in five colors; solved goodstuff deck; 60 of 4,129 cards ever played in 300 sim matches |
| Faction identity | **3** | Stone coherent, Iron contradicts its bible, Bronze is three fantasies stapled together at 26% WR, Gold is statlines |
| Deck-building depth | **3** | ~3 real decisions; no search; rules 90% theater (20-god deck legal) |
| Visual impact | **4** | At full desktop width the match board is a void: ~104px cards in ~1000px lanes, 34px commander, battlefield art buried under 80% plates, cyan bleeding through the chrome. Collection/results prove the ceiling (7–8) |
| Onboarding | **6** | The 3-tap spine is excellent; the cliffs (tutorial holes, ceremony pileup, Find-Match trap) are all small fixes |
| NFT integration | **3** | Stats canon-true (good) but 2,223 names diverge from OpenSea, ownership changes nothing, one-of-ones absent, gods under-served |
| Retention | **2** | No tomorrow: dead quest page, sink-less currency, invisible rank progress, placeholder daily reveal |
| Technical stability | **9** | Zero console errors across a full played session; deterministic engine; clean tsc/build/tests. (Red health gate and the name-wipe gun keep it off 10) |

**Fastest path to 8/10 overall:** (1) the engine-trust quad D1/D2/D4/D6 + god cap — the game stops lying; (2) board legibility + scale (keyword chips at the new card size, un-darkened battlefield, cyan purge — almost all CSS); (3) impact-at-apex + AI attacker lunge (two small changes that make every fight feel right); (4) the P5 retention kit (a day of wiring that activates already-proven systems). None of these are new features. The game underneath is already fast, legible in design, and worth racing in.

---

## 11. REBUILD STRATEGY — smallest V1 that is playable, understandable, honest

Director-approved phase order. Trust before polish; nothing gets tuned until P2 starts measuring.

**P0 — SAFETY (same day, hours):**
1. Rotate the OpenSea key + scrub git history (A1).
2. Fix the red health gate (`runCombatParityProof.ts:159` — set `activePlayer="P2"` before the cross-check; audit case 10).
3. Share-card "(device)" qualifier (`MatchResultShareCard.tsx:47`).
4. Guard the 2,223 names from regen wipe: extract the diff into a tracked overlay file consumed by `buildCanonicalTcgData.mjs`; neutralize `importTcgCards.cjs` (delete or hard-guard).

**P1 — ENGINE TRUST (the contract between card text and reality):**
5. D1: `maxHexHealth` on player state; sweep every `?? 20` / `min(STARTING_NEXUS_HEALTH, …)` literal. Vitest test with cur > 20.
6. D2: legality and execution must use the same discounted cost; `applyAction` must never throw — add the ~20-line dispatch-level crash containment (last-good state + toast rollback) regardless.
7. D4: unified death pipeline — ALL death sources route through `resolveDeaths`.
8. D6: STEALTH expires at controller's next turn start.
9. **CUT artifacts from V1** (director): remove from builder pool, AI deck gen, and curated decks; collection shows them as "dormant relics." Kills both D3 bugs with zero resolver work.
10. **STRIP equipment to honest stat gear** (director): display only the real stat deltas; remove dead keyword chips/ability text from every equipment surface. Never reprint dead rules text.
11. Enforce deck rules: god cap + commanderSpecs deckRules in `validateDeck` (the validator already computes godCount).
12. DELETE: response stack, secrets, alt win-cons, legacy keyword hooks, dead v0 shell, dead second board + showcase, dead datasets + generator scripts, `server/` (+ move `better-sqlite3`/`ts-node`/`typescript` out of prod deps), `/replay`, repo junk (Unity projects out, `asset-review` un-tracked, `.bak` purge, `/Crypt/` gitignore tighten). Prune the proof scripts of deleted systems from package.json and **re-baseline `npm run health` green**.

**P2 — FIRST FIVE MINUTES + MEASUREMENT:**
13. Tutorial: auto-resolve mulligan; fix step indices so lanes + GUARD/RUSH are actually taught; teach the attack verb; coach numbers match the board; suppress MatchCeremony in tutorial (single end dialog); grant the first reward beat.
14. `/play`: solo first; **hide guest PvP entirely behind the PvP flag** (director) — a button that errors for 100% of users is a dead door, not honest copy.
15. Fix the onboarding passive text lie (`commanderSpecs.ts:51` — describe the RUSH grant that actually exists).
16. `DEMO_FACTION` → IRON_DEFENDERS (one line, `buildOwnedDeck.ts:105`; run one directional playtest, accept 42–58%, fallback STONE).
17. Reset-match confirm + relocation; energy display always shows MY pool; End Turn disabled on enemy turn; naming coherence (one meaning each for Vault/Archive; one name per deck/commander); CatalogLoader player-facing copy; `token_revenant` display name.
18. **Telemetry funnel (director — before any retention tuning):** 5 events — splash_view, tutorial_start, tutorial_complete, first_match_result, d1_return — through the existing `analytics.ts`.

**P3 — BOARD LEGIBILITY + LOOK + FEEL (one workstream — chips laid out at final card size):**
19. Scale: slots `clamp(108px, 9vw, 170px)`, kill the 108px cap, `LANE_SLOTS = 5`, table max-width 1640px, hand 150–170px, real `CommanderCard` (~160px) replaces the 34px chip.
20. Keyword chips on `BoardCard`/`HandCard` + tap/long-press inspect for any unit in match (wire `setInspectId`); visible GUARD marker.
21. Un-darken: zone plates 0.72/0.82 → 0.30/0.45 alpha (battlefield art exists and is good); visible empty-slot hex sockets.
22. Cyan purge: 66 literals in `index.css`, epic/rare gem colors, Silver/Iron tints in `cardVisuals.ts`, delete the cyan `crypt-target-pulse` keyframe collision. ⬡ glyph unification. Local brand icon.
23. Feel: delay attack dispatch ~160ms to lunge apex (one setTimeout — re-times knockback/number/sound to the moment of contact); AI attacker lunge via transient `aiActorId` (the authored enemy-lunge CSS already exists, currently unreachable); spell-cast sound + target flash; mirror `mm-unit-damage` direction for enemy side; remove double `playAttack` on face hits; skippable VersusIntro; single ceremony + 500ms lethal beat.

**P4 — BALANCE PASS 1 (instruments first):**
24. Retarget `report:outliers` / `sim:curated` / `buildCuratedCoreSetV2` / `checkCuratedAlphaBalance` at the LIVE catalog (`allPlayableCards`); retire the fictional `generatedPlayableTcg*` trio; rebuild curated set against canonical data.
25. Bronze rescue (re-axis commander passive onto Regrow/Guard payoffs); Gold vanilla-statline shave; Silver 1-drop walk-back (tcg_331/1286/3294/2201 → 1/3, tcg_1747 → 1/2); `DEATHRATTLE_NEXUS_DAMAGE` 2→1. Re-run `dev:playtest` for the structural read only (±10% is noise).
26. Seed RANGED onto ~20–30 cards via overrides (Flying needs an answer); make the 10 gods marquee (bespoke override abilities, Lucifer treatment); mercy-fix the 4 dead trophy mythics.
27. Codify the **face-damage budget** (director): one page — max uncounterable face damage per energy at each cost — so no-stack burn problems stop recurring card by card.
28. Name reconciliation: chain names in-game everywhere (one source through `cardMaster`); the ~30 deliberate authored renames stay as the explicit override list; archive the 2,223 edits.

**P5 — A TOMORROW (all device-local, no real-value claims):**
29. MMR delta + rank progress in WinCeremony for guests ("+12 MMR · Silver II · 38 to Gold" — already computed, pure display).
30. Activate the quest engine: `useMatchRewards(winner, matchKey)` in LiveCryptMatchPage (one hook call; math already proven by `dev:rewards`); surface daily rites progress on Home.
31. One currency, one sink: price the 5 existing cosmetics in device-⬡ (kill the Sigil currency before anyone sees it); daily first-win bonus (+50⬡).
32. Fix `matchesTotal` increment at match-decide (AI ramp + rewards no longer forfeited by Run It Back); reward nonce = match seed (idempotent); DailyPack refresh rehydrate; vault reveal shows 3 real catalog cards (display-only, no grant).
33. Word pass (~2 days, display-layer only): nexus purge in live spell text + paired compiler regex (`spellCards.ts:99,160,286,340` + `:45`), puzzles objective, hero→Hex ×6 in glossary; glossary lists exactly the V1 keywords; ~15 worst display renames; Bronze "Onslaught"→"Overgrowth"; five faction creeds from existing lines.
34. **Ownership visible** (director): gold ⬡ stamp on owned cards in collection/builder; owned commander as profile default. Display-only, zero economy risk.

**DEFER / HIDE (mark clearly, don't delete unless listed):** PvP (works against city API, unproven e2e — keep behind flag); /spectate + /leaderboard + home server-quests (hide nav entries; revisit after a city-side ladder decision); /puzzles (hide route from nav, keep the 12 authored board states for V1.1 teaching puzzles; purge its "nexus" string now); marketplace (honest stub stays); seasons rotation engine (inert by design, leave flag-off); bundle diet to ~1MB (precomputed decks + slim catalog — schedule after V1); mobile redesign beyond hiding the dock in match + 4–5 tabs.

---

## 12. CARD DATA CLEANUP PLAN

Current shipped type: `PlayableCard` (`src/engine/cards.ts:12-44`); raw JSON shape `{id, tokenId, name, description, imageUrl, externalUrl, faction, rarity, cardClass, subtype, keywords, rawTraits}`. Four parallel catalogs exist; the game runs on `runtimeMatchPlayableCards.json` + `generatedTcgCards.json` + overrides.

**V1 schema — one generated file, one id space, build-time validated:**

```ts
type CardV1 = {
  id: string;                 // "tcg_<tokenId>", UNPADDED — matches canonical ids
  tokenId: string;
  name: string;               // chain name (canonical); authored renames live in cardOverrides
  faction: Faction;           // SCREAMING_SNAKE enum, normalized ONCE at build
  type: "unit" | "equipment" | "spell";   // artifacts cut from V1
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";  // one casing
  cost: number;
  attack: number; health: number;
  speed: number; armor: number;           // engine-load-bearing; keep
  keywords: Keyword[];        // validated against the V1 keyword registry at build
  abilityText: string;        // ← rawTraits.Ability (only if it compiles to a real effect)
  flavourText: string;        // ← description quote
  image: string;              // ← imageUrl
  commanderEligible: boolean;
  tags: string[];             // ← Set + grade bucket + subtype
  disabled?: boolean;         // soft-ban layer (keep)
  balanceNotes?: string;      // ← promote from cardOverrides.ts comments
};
```

**Field migration:** `description`→RENAME `flavourText` · `imageUrl`→RENAME `image` · `cardClass`→RENAME `type` · `externalUrl`→DELETE (derivable) · `subtype`→fold into `tags` · `rawTraits`→DELETE from runtime (build input only) · `effectTags`/`enrichmentSpecs`→DERIVE, not authored · `sourceCardClass`/`sourceSubtype`→DELETE · NEW: `commanderEligible`, `tags`, `balanceNotes`.

**Normalization steps:** one faction enum at build (delete runtime `normalizeFaction` calls); one rarity casing; keyword registry validation at build (fails the build on unknown keyword — kills dead-chip drift); unify on `tcg_<token>` (kill the `tcg_unit_*` second id space — `sourceCardId` already bridges); **no zero-padding anywhere**; the name-edit pass becomes a tracked overlay input to the builder, never post-hoc edits to generated output.

**Delete/retire:** `generatedPlayableTcg{Units,Equipment,Artifacts}.json` (fictional), `curatedCoreSet.json` (V1), `runtimePlayableCards/runtimeUnits/runtimeMatchUnits/cardMarketValues/defaultDecks/commanderImageMap/generatedNftCards`.json, `openseaImageIndex.ts`, `openseaLookup.ts`; move `openseaAssets.json` (22.6MB) out of `src/data/`; dead generator scripts (`buildCardMaster/buildRuntime*/buildCardMarketValues/buildCuratedCoreSet(V1)/importTcgCards` + .baks). `nexusHealth` is match-state, not card schema — 233 refs; display already says HEX; internal rename = separate mechanical refactor, not V1.

---

## 13. V1 RULESET (player-friendly — the 90-second read)

**CRYPT — own the race.**
Two players. Your Commander leads a deck of exactly 30 cards (max 2 copies of any card, max 1 God). Your HEX ⬡ has 20 health. **Drop the enemy HEX to 0 and you win.** Run out of cards to draw and you lose.

**Your turn:** gain an energy crystal (up to 10), refill them all, draw a card. Spend energy to play units to your front or back row (5 slots each), strap gear onto a unit, or cast a spell. Attack with any ready units — each strikes once per turn, and units can't attack the turn they arrive (unless they have Rush). Attack an enemy unit and it strikes back; attack the HEX and it can't. Then end your turn. **No interruptions — when it's your turn, it's YOUR turn.**

**Your Commander** shapes your deck and grants one passive power, printed on their card.

**The 8 keywords:**
- **GUARD** — enemies must kill this unit before attacking anything else.
- **RUSH** — can attack immediately.
- **WARD** — absorbs the first hit completely, then breaks.
- **FLYING** — only Flying or Ranged enemies can hit it.
- **RANGED** — can shoot Flying units.
- **LIFESTEAL** — damage it deals heals your HEX.
- **CRUSH** — leftover kill damage hits the enemy HEX.
- **STEALTH** — can't be attacked or targeted until it attacks, or until your next turn starts.

Some cards have a **battlecry** (when played) or a **last word** (when they die) — written on the card, and it always does exactly what it says.

**After the match:** win or lose, you earn ⬡ HEX (device) and XP, your rank moves, and your daily rites tick. ⬡ HEX (device) buys cosmetics in the Reliquary. It is game progress on this device — not money, not on-chain, not the FREELON CITY HEX balance.

---

## 14. CLAUDE CODE REBUILD PLAN — implementation order

Each step: files → change → don't touch → acceptance.

**Step 0 — Inspect + baseline.** Run `npx tsc --noEmit`, `npm run build`, `npm test`, `npm run health`. Read `src/router.tsx`, `src/engine/{reducer,setup,state,cards,cardOverrides}.ts`, `src/game-ui/useLocalCryptMatch.ts`, this doc. Don't touch anything yet. *Accept: you can name every route and which catalog file the engine imports.*

**Step 1 — P0 safety.** Files: OpenSea dashboard (key), git history (filter-repo), `src/dev/runCombatParityProof.ts:159`, `src/components/share/MatchResultShareCard.tsx:47`, `scripts/buildCanonicalTcgData.mjs` (+ new tracked name-overlay file), `scripts/importTcgCards.cjs` (delete/guard). Don't touch: engine. *Accept: `npm run health` green; key rotated; regen is idempotent (run it, git diff clean).*

**Step 2 — Engine trust (P1).** Files: `src/engine/reducer.ts` (D1 sweep via `maxHexHealth`, D4 unified deaths, D6 stealth expiry, delete response-stack/secrets/alt-wincon blocks), `src/engine/setup.ts` (D2 discounted cost), `src/engine/effectResolver.ts` (heal clamps), `src/engine/deckRules.ts` (god cap + spec rules), `src/game-ui/useLocalCryptMatch.ts` (dispatch crash containment), builder/AI deck sources (artifact cut), equipment display components (text strip), `package.json` (prune dead proofs). Don't touch: combat math that passes proofs, the energy/lane/sickness guards, anything UI-visual. *Accept: new vitest tests for D1 (heal at 25 stays 25), D2 (discounted play succeeds, never throws), D4 (END_TURN death fills graveyard + fires last-word), D6 (stealth expires); 20-god deck fails validation; `npm run health` green; full solo match still completes in browser.*

**Step 3 — FTUE + measurement (P2).** Files: `src/components/tutorial/TutorialCoach.tsx`, `src/pages/TutorialPage.tsx`, `src/components/live-match/CryptMatchBoard.tsx` (ceremony suppress prop), `src/pages/PlayHubPage.tsx`, `src/design/commanderSpecs.ts:51`, `src/nft/buildOwnedDeck.ts:105`, `src/components/live-match/MatchTopBar.tsx` (reset confirm), `useLocalCryptMatch.ts:661` (my-energy), nav/i18n files (Vault/Archive), `src/components/CatalogLoader.tsx`, `src/lib/analytics.ts` + 5 call sites. Don't touch: engine, reward math. *Accept: tutorial teaches play→attack→guard→end-turn with correct numbers and ONE end dialog + reward beat; a guest's first /play click starts a solo match; funnel events visible in the telemetry sink.*

**Step 4 — Board legibility + look + feel (P3).** Files: `src/styles/live-crypt-match.css` (scale + plates + sockets), `src/components/live-match/BoardLane.tsx` (5 slots), `BoardCard.tsx`/`HandCard.tsx` (keyword chips, info affordance), `CryptMatchBoard.tsx` (inspect wiring, apex timing, aiActorId), `useLocalCryptMatch.ts` (AI actor expose), `src/index.css` + `polish-cards.css` + `src/design/cardVisuals.ts` (cyan purge), `match-motion.css` (enemy damage mirror), `cryptSfx.ts` (spell sound), `LiveCryptMatchPage.tsx` (single ceremony, lethal beat, skippable intro), `AppShell.tsx` (local icon). Don't touch: reducer. *Accept: full-width screenshot turn 5+ shows art-dominant board, every keyword visible, zero cyan; AI turn narratable without the log; tsc/build green; browser play-through clean console.*

**Step 5 — Balance instruments + pass 1 (P4).** Files: `scripts/{reportCardOutliers,simulateCuratedMatchups,buildCuratedCoreSetV2,checkCuratedAlphaBalance}.cjs` (retarget at live catalog), `src/engine/cardOverrides.ts` (Bronze payoffs, Gold shave, Silver walk-back, RANGED seeding, god abilities, ~15 display renames), `src/engine/keywordEngine.ts:243` (deathrattle 1), `src/engine/commanderPassives.ts` (Bronze re-axis), one-page face-damage budget doc. Don't touch: on-chain data, rarity. *Accept: `check:alpha` measures the live catalog; playtest shows no faction <40% or >60% (structural read); deck builder and match show the same name for every card.*

**Step 6 — Retention wiring (P5).** Files: `src/pages/LiveCryptMatchPage.tsx` (`useMatchRewards` activation, matchesTotal at decide), `src/components/live-match/WinCeremony.tsx` (MMR delta, seed nonce), `src/meta/rewards.ts` + `ShopPage` (cosmetic sink in device-⬡, kill Sigil), `src/lib/localProgress.ts` (first-win bonus), `src/pages/DailyPackPage.tsx` (rehydrate + real card display), word-pass files (`spellCards.ts` + compiler regex, `keywordDescriptions.ts`, `puzzles.ts`, `factionIdentity.ts`, `HelpPage.tsx`), collection/builder owned-stamp. Don't touch: anything implying real value — every new string carries the device framing. *Accept: play a match → see rank move + quest tick; buy one cosmetic; tomorrow's first win pays a bonus; zero "nexus"/"hero" in display text; quests progress from actual matches.*

**Step 7 — QA gate.** Re-run everything from Step 0 + one full browser play-through (desktop 1440+ AND 390px) + `npm run dev:playtest`. *Accept: all green, console clean, this doc's §10 scores re-rated honestly.*

---

## 15. FINAL CLAUDE CODE PROMPT

See the copy-paste prompt at the end of the session summary (also reproduced here):

```
You are Claude Code working in /Users/billy/crypt-game. FOCUS: Crypt TCG V1 rebuild ONLY.

Ground truth: docs/CRYPT_TCG_TEARDOWN_2026-06-10.md (the full-studio teardown). Read it first — it contains the verified bug mechanisms, exact file:line cites, director rulings, and acceptance criteria. Execute its Section 14 plan in order (P0→P5).

HARD RULES:
- Do NOT touch the FREELON City site repo, agents, homepage, or HEX economy. This repo only.
- Inspect before editing: run `npx tsc --noEmit`, `npm run build`, `npm test`, `npm run health` and read src/router.tsx + the engine files BEFORE changing anything. Fix the red health gate (stale combat-parity fixture) before trusting any gate.
- LOCKED design decisions — do not re-open: no response stack (DELETE its code), HEX ⬡ never "Nexus" in display, rewards device-local only (client wins must NEVER credit real spendable HEX), on-chain rarity frozen, no emojis in UI.
- Preserve everything that works: the deterministic reducer's verified guards, the splash→onboarding→tutorial spine, the collection page, the procedural audio, the card art manifest. Rebuild only what the teardown marks broken.
- Director rulings to implement as written: CUT artifacts from V1 decks (don't fix the resolver), STRIP equipment to honest stat-gear display (don't wire 1,243 keyword texts), DELETE server/ + /replay + dead v0 shell + dead second board, HIDE /puzzles and guest PvP, chain names win in-game, DEMO_FACTION → IRON_DEFENDERS.
- Every engine fix ships with a real vitest test (D1 heal-above-20, D2 discounted-play, D4 END_TURN death pipeline, D6 stealth expiry, god-cap validation).
- Honesty: never print rules text the engine doesn't enforce; mark every planned/stubbed feature clearly in UI copy; no fake rewards, no on-chain claims, "(device)" framing on every reward surface including the share card.
- Verify in the BROWSER after each phase (node proofs pass even when the app is dead): full solo match splash→tutorial→match→ceremony→View rewards→/match-results at 1440px AND 390px, console clean.
- gitignore trap: `Crypt/` over-matches src/components/crypt/ — you are deleting that dir anyway; tighten the pattern to `/Crypt/`.

P0 includes one action outside the repo: the OpenSea API key in git history (commit a005023) must be rotated by Billy — flag it, don't skip it.

When done: summarize every changed file grouped by phase, list the new tests, re-run all gates, and end with REMAINING RISKS (unproven PvP e2e, deferred mobile redesign, balance items needing human playtest, the name-overlay decision archive).
```

---

*Companion docs: CRYPT_TCG_QA_STATUS.md (live-verification history), FACTION_DESIGN_BIBLE.md (update Iron + Bronze lines per §5), GO_LIVE_RUNBOOK.md. Repro scripts for D1–D4 left in /tmp by the systems audit, ready to harden into vitest.*
