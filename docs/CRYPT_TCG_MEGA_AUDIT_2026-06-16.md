# CRYPT TCG — END-TO-END AUDIT + COMPETITIVE RATING
**2026-06-16 · Live product audit (visual → code → game-ready) + rating vs the field.**
**Method: real gate runs (tsc/vitest/build/e2e/300-match playtest), live browser play-through (desktop + mobile), full-session code knowledge, competitive web research. The game is LIVE at https://play.freeloncity.com (HTTP 200, deployed today).**

> Note on method: a 22-agent specialist workflow was attempted first and was killed by a transient platform rate-limit (concurrent-spawn throttle, not a usage cap). This audit was then done single-threaded against hard evidence — every score below is backed by a gate result, a code cite, a screen I drove, or a competitor fact, not vibes.

---

## 1. THE ONE-LINE VERDICT

**A real, live, stable, deterministic SOLO card game with a genuinely sound engine and a now-coherent first-five-minutes — held back from "launchable game" by a non-existent retention loop, broken faction balance, a shallow real meta, a 12 MB bundle, and an NFT value-prop that does nothing in-play. It is an excellent closed-alpha (which is exactly how it's labeled) and NOT yet a competitive NFT-TCG.**

**Composite game-ready score: 5.2 / 10** — where 8–10 = a shipped, polished commercial game; 4–6 = a real playable prototype; 0–3 = broken/confusing. Crypt sits in the upper-prototype band: the *moment-to-moment* game works and the engine is better than most of the field's; the *day-over-day* game and the *competitive* game don't exist yet.

---

## 2. SCORECARD (13 lenses)

| Lens | Score | One-line |
|---|---|---|
| Systems / Rules / Combat | **7.5** | Genuinely sound deterministic engine; trust bugs fixed + test-pinned; own-the-race is coherent design, not a gap |
| QA / Does-it-actually-work | **7.0** | Solo loop verified e2e (browser + headless), 125/125 vitest, 300/300 playtest, zero console errors; PvP unproven |
| Engineering / Build | **6.5** | tsc/tests/build green, deterministic engine — but a **12 MB JS bundle** (7.5 MB deck data shipped to client) |
| Security / Trust | **6.5** | Device-HEX invariant HOLDS, no XSS, honest "no checkout" disclaimers — but a live OpenSea key sits in git history, unrotated |
| UX / Onboarding | **6.0** | Splash→onboarding→tutorial spine is good and the tutorial now teaches the loop; deck builder + naming still rough |
| Legal / Compliance | **6.0** | "device ⬡ HEX", "preview-only—no checkout", "closed alpha" framing is right; needs a real ToS/privacy pass before a hard push |
| Visual / Art | **5.5** | Collection/results pages are an 8; the match board was a 4 (void + 7px labels) and is now ~5.5 after today's fixes — small cards, cyan remnants remain |
| Game Feel / Juice | **5.0** | Strong procedural audio + improved board feel; spells/equip have zero feedback, AI-attack feedback thin |
| Growth / Funnel | **4.0** | FTUE funnel events instrumented + share card works — but no analytics surface, ownership does nothing, virality unproven |
| Balance | **3.5** | **GOLD 63.5% / BRONZE 27.1% win-rate, both out of band** (300-match playtest); tooling partly measures a stale catalog |
| Narrative / Identity | **3.5** | Confident FREELON shell over ~4k generic dark-fantasy card names; in-game names diverge from the holder's OpenSea card |
| Meta / Competitive Depth | **3.0** | One midrange goodstuff deck; ~60 of 4,129 cards ever played in 300 sims; real strategic choices are few |
| Retention / Economy | **2.5** | **No tomorrow** — quest page dead, zero currency sinks, device-HEX is cosmetic-only, daily vault is placeholder |

---

## 3. HARD NUMBERS (the gates, run today)

- `tsc --noEmit`: **0 errors**
- `vitest`: **125 / 125** (9 files)
- `vite build`: **green (2.5s)** — bundle: `buildCuratedDeck` **7.52 MB** (gz 694 KB) + `data-tcg-cards` **3.17 MB** (gz 384 KB) + `cryptTheme` 1.02 MB + vendor-react 283 KB ≈ **~12 MB raw / ~1.2 MB gzipped JS**
- `dev:e2e`: **PASS** (full match resolved, P1 win, 7 turns)
- `dev:playtest` (300 matches, live catalog): **300/300 decided**, first-player **47%**, **98.7% nexus-kill, 0 timeouts** (format bones healthy) — BUT **GOLD 63.5%** and **BRONZE 27.1%** out of the sane 40–60% band; DEATHKNELL decks 36.5%
- Live: **play.freeloncity.com → HTTP 200**, serves the SPA, main bundle 200

**Read:** technically the game is in good shape (clean gates, deterministic, terminates) — the red flags are *bundle weight* and *faction balance*, both long-standing and both fixable without touching the engine.

---

## 4. PER-LENS FINDINGS

### Systems / Rules — 7.5 (the strongest lens)
**Live & strong.** The reducer is S-tier discipline: deterministic, seedable, reject-soft with reasons, canonical trigger ordering, bounded cascades, 300/300 sims terminate. The five trust bugs (heal-clamp, discounted-play crash, END_TURN death pipeline, stealth lock, + crash containment) are fixed and **pinned by real vitest tests** (`src/engine/__tests__/engineTrust.test.ts`). Artifacts are cut (the self-harm class is gone), the god cap is enforced, and "own-the-race / no response stack" is a *coherent locked design*, not a missing feature. **Weakness:** equipment still prints keyword text the engine doesn't grant (display-honesty gap, P1 leftover); ~25 distinct mechanics is more than a newcomer holds.

### QA / Does-it-work — 7.0
Solo path verified end-to-end this session (browser: splash→tutorial→match→ceremony→rewards, zero console errors) and headless (e2e + 300-match playtest + 125 vitest). **The gap that keeps it off 9:** PvP has never been proven end-to-end (it routes to the city API, sign-in-gated, unexercised), and the deck builder's validation UX is untested at scale.

### Engineering — 6.5
Clean architecture for the engine, green gates, a real test suite. **The two real liabilities:** (1) the **12 MB bundle** — `buildCuratedDeck` pulls the full card master (7.5 MB) into the client to build decks at runtime; this should be precomputed at build time. (2) Card data (3.2 MB) ships as JS. Neither breaks the game but both hurt first-load on the mobile devices most holders use.

### Security / Trust — 6.5
The core invariant — **no client path sources or implies real spendable HEX** — holds across the shipped client (`localProgress.ts` guarantees device-local only). No XSS, parameterized SQL (in the now-deleted server), honest copy ("device ⬡ HEX", "Reliquary is preview-only—no checkout"). **The one real item:** the OpenSea API key is recoverable from git history (`a005023`) and that history is now on origin (private repo = team-only, but **rotate it**). Share-card "(device)" qualifier was added.

### UX / Onboarding — 6.0
The 3-tap spine (splash → pick-a-style → coached duel) is genuinely good, and after today's work the **tutorial actually teaches the loop** (attack verb included), the **battlefield renders** (was a 24px void), and **card labels are legible**. **Still rough:** the deck builder is a 4,064-card pool whose search/UX I couldn't fully re-verify (flaky preview) but which the teardown flagged as unsearchable; naming is still incoherent in places (deck name vs commander name); the "what do I do after the tutorial" path is solid (solo featured, guest PvP hidden).

### Legal / Compliance — 6.0
The framing is right for a closed alpha: device-currency language, "no checkout," "closed alpha · guest saves on device." **Before a hard public push:** a real ToS + privacy policy, an explicit "this is a game, ⬡ HEX is not money / not an investment" line, and a compliance read on any NFT-ownership wording.

### Visual / Art — 5.5 (most-improved this session)
Collection and match-results pages are genuinely premium (7–8): art-forward, searchable, on-brand gold/black. The **match board** was the weak point (tiny cards in a black void, 7px labels) and is materially better today — labels readable, battlefield un-collapsed, mobile HUD compact. **Still:** board cards are small relative to the lane, some cyan remnants persist against the locked gold palette, and the battlefield art sits under heavy plates. This is the highest-ROI visual area left and it's almost all CSS.

### Game Feel — 5.0
Procedural audio is a real strength; the board now has impact and the attack reads. **Missing juice:** spells, equip, and artifact plays have zero animation/sound; AI-attack feedback is thin; the win/loss beat is functional but not climactic.

### Growth — 4.0
A 5-event FTUE funnel is instrumented (`src/lib/funnel.ts`) and the result share card works (real holders are already posting wins — "Signal Restored, won in 17 turns"). **But:** there's no surface where Billy can *see* the funnel; **owning the NFT changes nothing in play** (guests get all 4k cards), so the collection has no pull; virality is one share card, untested.

### Balance — 3.5 (a real weakness)
The 300-match playtest is unambiguous: **GOLD wins 63.5%, BRONZE 27.1%** — both well outside the healthy 40–60% band, unchanged since the teardown. Cause is mechanical (Gold's raw statlines + uncounterable burst; Bronze's redundant identity). The balance *tooling* partly measures a stale/fictional catalog. ~60 of 4,129 cards see play in 300 games — the "real" game is a few hundred cards, fine for a 4k collection but it means tuning the *curated core*, not the whole set.

### Narrative — 3.5
The shell (tutorial, HUD, Archive/Reliquary nouns, "Command the dead, duel for the Hex") is confident FREELON signal-civilization. Underneath, ~4k card names are generic dark-fantasy filler ("Bastion of Erosion", "Menhir of Forgotten…"), and crucially **the in-game name often differs from the card the holder owns on OpenSea** — the NFT-identity bridge is broken. Two days of a display-layer word pass fixes most of it.

### Meta / Depth — 3.0
With own-the-race + a curated core, the real game today is one midrange trade-fest; strategic choices are few and the deck space is shallow in practice. This is expected at this stage but it's the ceiling on "why would a competitive player stay."

### Retention / Economy — 2.5 (the biggest hole)
**There is no reason to return tomorrow.** The `/rewards` quest engine is wired but inert, there are zero sinks for device-⬡, the daily vault is a placeholder, and ownership grants nothing. This is the single largest gap between Crypt and every live game in the field — and it's mostly *wiring already-proven systems*, not new design (P5 of the teardown).

---

## 5. COMPETITIVE RATING — Crypt vs the field

**The 2026 field** (web-researched today): Splinterlands ~141k active wallets/30d; Gods Unchained NFT volume +507% to $27.2M post-Immutable-migration; Parallel $300K–1M/mo secondary; leading TCG tokens $50–300M mcap. The macro trend favors **gameplay-first + abstracted wallet friction**, and quality blockchain games now hit **35–45% retention** (approaching mainstream 40–50%). Indie studios reportedly took 70% of web3 players in 2026's "great reset."

| Dimension | Crypt | Field leader | Honest read |
|---|---|---|---|
| Rules engine soundness | **7.5** | Gods Unchained | Crypt's engine is genuinely competitive — better than much of the field |
| Visual polish | 5.5 | Parallel (collector-grade art) | Mid; collection page competes, board doesn't yet |
| Onboarding / friction | 6.0 | Skyweaver (free, no-wallet) | Crypt's **solo-playable-without-a-wallet** is on-trend and a real edge over wallet-gated rivals |
| Competitive depth / PvP | 3.0 | Gods Unchained / Splinterlands | Far behind — their PvP economies + tournaments are years deep; Crypt's PvP is unproven |
| Retention loop | 2.5 | Splinterlands (daily quests/ranked/land) | Far behind — Crypt has no tomorrow yet |
| Economy maturity | n/a (device-local by design) | Splinterlands / Sorare | Crypt deliberately has no real-money loop in-client; not comparable yet |
| NFT-in-game utility | 2.5 | Gods Unchained (cards ARE the game) | Crypt's NFTs currently do nothing in play — its weakest competitive axis |
| AI-agent differentiator | unique | (the FREELON ecosystem) | Genuinely novel, but confusing to holders and unproven as a draw |

**Where Crypt honestly sits: bottom tier vs the *mature shipped* games (Gods Unchained, Splinterlands, Parallel) — but ahead of the large vaporware/rug cohort, because it has a real working engine, a live deploy, and a no-wallet-needed solo mode.** It is a *credible early prototype in a serious genre*, not a contender. The good news: the gap to the field is concentrated in **three fixable areas** (retention loop, balance, NFT-utility), not in the engine — which is the expensive thing to get right and the thing Crypt already has.

**Biggest edge:** a sound, honest, deterministic engine + solo-without-wallet onboarding (rides the 2026 abstraction trend).
**Biggest gap:** no retention loop and no in-game NFT utility — exactly what every retained player in the field comes back for.

---

## 6. IS IT GAME-READY?

**For what it's labeled — a closed alpha — YES.** It's live, stable, a new player can complete a coherent first match on desktop or phone, and nothing lies or breaks. Real holders are already playing and posting wins.

**For a hard "go play this" push to a cold audience — NO, three blockers:**
1. **No tomorrow** (retention loop inert) — a cold player has zero reason to return after one match.
2. **Balance** (Gold 63.5% / Bronze 27.1%) — the moment anyone plays seriously, it feels unfair.
3. **NFT utility is zero in-game** — the whole pitch ("your cards") is undercut because owning them changes nothing in play.

None of these touch the engine. All three are in the teardown's P4/P5 and are mostly tuning + wiring.

---

## 7. THE ROADMAP TO LAUNCH-WORTHY (prioritized)

**Do these three, in order, and Crypt crosses from "good alpha" to "launchable game":**

1. **Build a tomorrow (P5 — highest ROI, mostly wiring).** Activate the dead quest engine (`useMatchRewards`), add one device-⬡ cosmetic sink + a first-win daily bonus, show the MMR/rank delta at match end, fix the daily vault. This is the single biggest gap to the entire field and it's *already-proven systems left unplugged*.
2. **Fix faction balance (P4).** Retarget the balance tooling at the live catalog, rescue Bronze (re-axis its identity), shave Gold's over-statted vanillas, tune the curated core. Re-run the 300-match playtest to a no-faction-outside-42–58% bar.
3. **Make ownership matter (the NFT bridge).** At minimum: reconcile in-game names to the holder's chain card, and give owned cards a visible mark + the owned commander as default. This is what makes "your cards" true.

**Then the polish tier (parallel, lower-stakes):** board card scale-up + cyan purge (visual, CSS-only); spell/equip feedback (feel); the 12 MB bundle diet (precompute decks at build); the equipment display-honesty strip; a real ToS/privacy pass before any paid surface goes live.

**And one thing only Billy can do, today:** rotate the OpenSea key.

---

## 8. BOTTOM LINE

Crypt TCG is **further along than most NFT card games ever get** — a real, live, honest, deterministic game with a sound engine and a coherent first five minutes — and **further from "launchable" than the founder optimism suggests**, because the day-over-day game and the competitive game don't exist yet and the NFTs do nothing in play. The expensive thing (the engine) is done and good. The remaining gap is three weeks of tuning and wiring, not a rebuild. Ship the retention loop next; it's the lever that turns one good match into a reason to come back — which is the only thing the entire field is actually competing on.

*Companion docs: CRYPT_TCG_TEARDOWN_2026-06-10.md (the full studio teardown + P0–P5 plan), CRYPT_TCG_QA_STATUS.md, GO_LIVE_RUNBOOK.md.*
