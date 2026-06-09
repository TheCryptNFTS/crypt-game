# Crypt TCG — Verified QA Status

Last verified: 2026-06-09, in-browser against the Vite dev server (port 5173).
Method: live play + DOM inspection via the preview harness; reducer/UI reads for logic.

**Do not call the Crypt "broken."** Its core engine and result/reward screens are
live-verified. Exactly one link remains unproven (a handoff), and it should only be
called broken if it fails in a human play-through (see "Remaining gap").

## Live-verified (actually exercised in the browser, zero console errors)

- App renders (`#root` populated; not a blank-root failure).
- Tutorial duel loads (`/tutorial`).
- Opening-hand mulligan: tap-to-swap + KEEP HAND locks the hand.
- Card selection → PLAY FRONT deploys a unit.
- Energy deducts correctly (played a 3-cost unit: 3/3 → 0/3).
- Hand count updates (6 → 5).
- END TURN advances the turn; the AI opponent takes its turn and deploys (combat log narrates it); play returns to the player with energy scaled (4/4).
- **Win-state fires live:** in `/puzzles` ("FINISH THE LINE"), the engine drove the enemy hex 6 → 0 and rendered "Solved — lethal found" + "Reset board". This exercises the same `detectWinner` (hex ≤ 0) used by ranked.
- **Ranked result + reward screen renders live:** `/match-results` mounted via its own
  `sessionStorage["crypt.lastResultState"]` rehydration path (a built-in F5-survival
  mechanism, not a code change or cheat) with a `winner:"P1"` fixture. It rendered
  `VICTORY` and ran the **real** `applyMatchRewards` → `+25 $CRYPT`, `+40 XP`,
  running totals, and DUEL AGAIN / COMMAND HUB / SHARE / ← FIELD continue routes.
  (2026-06-09 follow-up: the reward currency display was renamed from "$CRYPT" to
  "⬡ HEX (device)" across the UI — display-only, data fields still named `crypt*`.
  It remains device-local and is NOT real spendable FREELON CITY HEX; see the
  "currency" note below.)

## Currency: device-local ⬡ HEX (NOT real HEX)

The Crypt reward currency is displayed as **⬡ HEX (device)** but is **device-local
localStorage only** — `localProgress.ts` guarantees it "never sources real hex." It is
NOT the spendable FREELON CITY HEX balance and does not touch the wallet/Upstash hex
store. The "$CRYPT" label was retired (2026-06-09) to align ecosystem terminology; the
"(device)" qualifier + softened disclaimers keep it from implying spendable HEX.

**Decision on record:** Crypt client-side wins do NOT credit real HEX (would be a
money-printer — solo matches resolve client-side and are unverified). A real HEX faucet
requires server-authoritative match verification + walletProof + anti-replay + daily
caps + finance/security sign-off. Not built. See memory `project_crypt_qa_verified.md`.

## Live-verified — UPDATE 2026-06-09 (full `/match` driven to end-state)

A real `/match` was played to completion in the browser. Two prior assumptions in this
doc were WRONG and are corrected here:

- **Combat is DOM-clickable, NOT canvas-only.** Selecting an own board unit
  (`.crypt-zone--own .live-lane__slot--filled .crypt-card--board`) lights up enemy lanes
  as targets AND reveals ActionBar fallback buttons **"ATTACK SELECTED ENEMY"** and
  **"ATTACK HEX"**. Face attacks were driven via DOM clicks (combat log confirmed:
  "You struck Opponent's Hex for 4"). The earlier "harness can't drive attacks" claim
  was a wrong-element problem, not a real limitation.
- **The in-board ceremony fires live.** Match resolved to a loss (own hex → -2); the
  `MatchCeremony` overlay rendered live: **"TRANSMISSION ENDED · SIGNAL LOST"** with
  turn/hex stats, Share / Save image, **Run It Back** (rematch), and **LEAVE → /home**.

## Architecture finding: `/match-results` is ORPHANED

The live `/match` end-state does NOT navigate to `/match-results`. Code search confirms
**nothing** calls `navigate("/match-results")` anywhere — it's a registered route with
no inbound link. The live post-match flow is entirely the in-board `MatchCeremony`
overlay (→ rematch or `/home`). `/match-results` (the +$CRYPT / +XP reward screen,
verified live earlier via its own `sessionStorage` rehydration) is a separate/parallel
surface only reachable by direct URL.

This means: the in-board ceremony shows match stats but the **$CRYPT/XP reward payout
screen is never reached through normal play.** That is a product decision to make
(intentional? or should the ceremony route to results?), NOT a bug to silently "fix" —
flagging for Billy.

## Code-verified only (still not driven live)

- Ranked rating delta / rank-up tier-crossing beat (the rated-mode reward beat).
- VICTORY (win) ceremony variant — only the DEFEAT variant was hit live; win path is the
  same component, code-verified.

## Post-match reward flow — WIRED 2026-06-09 (P5)

The orphaned `/match-results` is now reached through normal play. Added a "View rewards →"
primary action to the in-board `WinCeremony` (`src/components/live-match/WinCeremony.tsx`) that
writes the result to `sessionStorage["crypt.lastResultState"]` (the page's existing rehydration
path) + `navigate("/match-results", {state})`. Engine/reducer/rewards untouched — the results page
runs the existing `applyMatchRewards`. Device-local ⬡ HEX only. Run-It-Back + Leave preserved.
Also fixed a latent hooks-order violation (the `if(!winner) return null` early-return now sits
AFTER all hooks). Verified live: played `/match` to DEFEAT → ceremony → "View rewards" →
`/match-results` rendered VERDICT RECORDED / commander (Stone Warden) / +8 ⬡ HEX (device) / +15 XP /
Duel Again. tsc 0 errors.

## RESOLVED-AS-HARMLESS — app-wide React dev warning (investigated 2026-06-09)
Warning: `Internal React error: Expected static flag was missing. Please notify the React team.`
ROOT CAUSE PROVEN (read-only investigation):
- Emitted by React itself — `react-dom/cjs/react-dom-client.development.js:7711`, NOT app code.
- **DEV-ONLY:** the string exists ONLY in react-dom's `.development.js` builds; no production
  counterpart. Stripped from `vite build`. Users never see it.
- App-wide (fires on /home, /match, etc.) — not tied to any component; NOT from the P5 ceremony
  change (WinCeremony doesn't render on /home).
- The check lives in React's dev-only hooks-tracking path (`hookTypesUpdateIndexDev`) and triggers
  under `<React.StrictMode>`'s intentional double-invoke + Vite HMR remounting lazy/Suspense
  boundaries. Known React 19 + StrictMode + dev-server interaction.
- NOT caused by duplicate React (single deduped 19.2.4) or conditional hooks in app code.
VERDICT: harmless dev-only artifact. NO code change — removing StrictMode (loses a real safety net)
or suppressing the console would be worse than the warning. Do not re-investigate; do not attribute
real bugs to it. If it ever needs silencing, wait for a React point release. Confirm absence in a
prod build before launch as a formality.

## Resolved gap

The documented "live `/match` → ceremony → results handoff" gap is RESOLVED: the match
plays to an end-state and the ceremony fires live. The only open item is the *product
question* above (ceremony does not hand off to the reward screen), not a verification gap.

## Out of scope (do not do under the banner of "fixing QA")

No balance changes, no combat refactor, no new dev cheat/win button, no UI redesign,
no new ceremony work, no new tests. This doc records status; it is not a license to
modify gameplay.
