# Crypt TCG — Opening-Hand (Mulligan) Mobile Redesign Audit

Date: 2026-06-09. Visual audit ONLY — no code in this doc. Scope: the `/match` opening-hand
(mulligan) screen on mobile (375px). Honest verdict: **function ~8/10, mobile polish ~4/10.** It is
NOT launch-grade. (Prior QA "PASS" was an overflow check, not a quality check — corrected.)

Component: `src/components/live-match/MulliganScreen.tsx`. Styles: `src/styles/live-crypt-match.css`
(lines ~1221–1420). **There are ZERO mobile `@media` rules for the mulligan** — it renders the
desktop layout shrunk into 375px. That single fact explains most of what's wrong.

---

## 1. What is visually wrong
- **No mobile layout at all.** `.mulligan-slot { width: 140px }` is fixed; `.mulligan-screen__rail` is `flex-wrap` centered. On 375px two 140px cards + gaps barely fit → cramped, edge-tight, small cards.
- **Muddy panel.** `.mulligan-screen` bg = `linear-gradient(180deg, rgba(233,201,132,0.12), rgba(11,11,13,0.6))` — gold-tint over semi-black = the brown wash. Not premium/obsidian.
- **Cards too small + text crushed.** 140px cards make ATK/HP/ARM + names hard to read on a phone.
- **Instruction copy too long.** `max-width: 56ch` paragraph ("Tap any cards you want to swap out, then lock in — selected cards are shuffled back and redrawn. Keep your hand by selecting none.") dominates the top third of a phone screen.
- **Weak primary action.** "Keep Hand" is a normal `live-btn` in a flex row at the bottom, not a strong/sticky CTA; it competes with the cost-curve and count text.
- **Typography overload.** Spaced-caps kicker + display-bold title + soft paragraph + tiny card stats + flag pills + curve labels = 5+ type treatments stacked.
- **Cost-curve bars** add visual noise low on the screen on mobile, pushing the action further down.
- **(Screenshot only) dev banner.** The cyan "VITE DEV · CATALOG: OK" is `DevBuildStamp` — already `import.meta.env.DEV`-gated, so it does NOT ship to players. It ruins dev screenshots, not production. (Its cyan is also the off-brand color the brand system bans — dev-only, moot.)

## 2. What should STAY (don't break these)
- The ritual framing: kicker + "The Opening Signal" title + commander attribution ("Dealt by …"). Good identity — just needs to be tighter on mobile.
- The keep-vs-redraw model: tap to toggle, dim+flag the redraw cards. Logic is sound.
- The gold-edge "kept" treatment + grayscale "redraw" treatment (the distinction exists — just needs to be stronger).
- The cost curve as a concept (consider hiding/compacting on mobile, not deleting).
- All game logic, card data, the `onResolve` contract.

## 3. Exact MOBILE layout rules (add a `@media (max-width: 560px)` block)
- Panel: full-bleed-ish, `padding: 14px 12px`, `margin: 8px`, `border-radius: 16px`.
- Vertical rhythm: kicker → short title → ONE-line prompt → card grid → sticky action. Tighten gaps to 10–12px.
- Cost curve: collapse to a thin single-row strip OR hide below the fold on mobile (it's a nice-to-have, not the action).

## 4. Exact BUTTON rules
- Primary action ("Keep Hand" / "Confirm Mulligan") becomes a **sticky bottom bar** on mobile: full-width, `min-height: 52px`, gold fill, dark text, the redraw-count as a small label above or inline.
- Tap targets: each card slot and the button ≥ 48px touch height.
- Clear states on the action: "Keep Hand" (0 selected) vs "Confirm Mulligan · N" (N selected).

## 5. Exact CARD GRID rules
- Replace the flex-wrap rail with `display: grid; grid-template-columns: 1fr 1fr; gap: 12px;` on mobile.
- Cards size to the column (`width: 100%`, remove the fixed 140px on mobile) → ~165–170px each on a 375px screen, noticeably bigger/readable.
- Equal gutters; `padding: 0 4px` so cards aren't edge-tight.
- Selected (redraw) state must be unmistakable: stronger dim (current grayscale 0.6 is OK) + a clear badge; kept state keeps the gold edge but make it 1.5–2px so it reads on a phone.

## 6. Exact PANEL / BACKGROUND rules
- Kill the brown: panel bg → near-black obsidian, e.g. `linear-gradient(180deg, rgba(20,18,22,0.96), rgba(8,7,9,0.98))`.
- Border: thin bronze/gold hairline `1px solid rgba(233,201,132,0.28)` + a subtle top highlight (`box-shadow: inset 0 1px 0 rgba(233,201,132,0.18)`).
- Drop the heavy gold glow (`box-shadow: 0 0 28px rgba(233,201,132,0.14)`) on mobile — it muddies.

## 7. Exact TYPOGRAPHY rules
- Title: keep display font, drop to `clamp(20px, 6vw, 26px)` on mobile, single line.
- Kicker: keep but smaller letter-spacing (0.2em) so it doesn't wrap.
- Prompt: SHORTEN (see §copy) to one line on mobile; commander attribution moves to a smaller, dimmer subline.
- Card text: ensure ATK/HP/ARM ≥ 11px and names don't truncate mid-word at the larger card size.
- One family for labels, one for display — collapse the treatments.

## 8. Copy (local to this component — safe to change)
- Replace the long prompt with: **"Choose cards to redraw."** as the lead, then a smaller line: **"Tap to swap, then lock your hand."** Commander attribution ("Dealt by Tor of Stone's Grasp") becomes a small dim subline, not part of the instruction.

## 9. Dev/debug UI
- `DevBuildStamp` is ALREADY dev-gated (`if (!import.meta.env.DEV) return null`) — confirmed; it will NOT appear in production. No code change required for launch. (Optional: when verifying screenshots, ignore it — it's not shippable chrome.)

## 10. Smallest safe implementation plan
1. Add a `@media (max-width: 560px)` block to `live-crypt-match.css` (or the existing `live-crypt-match-mobile.css`) covering: panel bg/border (§6), grid 2-col (§5), card width 100% (§5), tightened spacing (§3), sticky full-width action (§4), title clamp + kicker (§7).
2. In `MulliganScreen.tsx` (component-local), shorten the prompt copy (§8) and split commander attribution into a subline. Optionally wrap the cost curve so it can be hidden on mobile via a class.
3. Touch ONLY: `MulliganScreen.tsx` + the match CSS. Do NOT touch reducer, card data, rewards, HEX, routes, attack/AI/turn logic.

## Screenshots required for verification (after implementation)
- Mobile (375px) opening hand: panel dark/clean, 2-col larger cards, short copy, sticky action.
- Mobile with 2 cards marked for redraw: selected state obvious, action reads "Confirm Mulligan · 2".
- Desktop (≥1024px) opening hand: confirm the redesign didn't regress desktop (the `@media` is mobile-scoped).
- After "Keep Hand": confirm the match starts (deploy/turn flow still works) — regression check, not just visuals.

## Verdict
Function 8 · art-direction potential 8 · current mobile polish 4. The art is good; it's trapped in a
desktop layout with a muddy panel and a weak action. The fix is layout + panel + sizing + one sticky
button + shorter copy — NOT new effects, NOT animations, NOT logic.

---

## ✅ IMPLEMENTED 2026-06-09 (verified)
Root cause confirmed: the `@media (max-width:768px)` block had only STALE rules targeting
`.mulligan-card` (a renamed/dead class) — the live component renders `.mulligan-slot` /
`.mulligan-screen__rail`, so nothing applied → desktop layout shrunk into the phone.

Changes (visual only):
- `src/styles/live-crypt-match.css` — replaced the dead mobile rules with a full mulligan mobile
  treatment: obsidian panel (killed the gold-wash brown), `.mulligan-screen__rail` → 2-col grid,
  `.mulligan-slot` → width:100% (was fixed 140px), tightened type (title clamp, kicker), compacted
  cost curve, and a STICKY full-width primary action (`.mulligan-screen__actions` fixed above the
  dock, count + 52px gold button).
- `src/components/live-match/MulliganScreen.tsx` — prompt shortened to "Choose cards to redraw.
  Tap to swap, then lock your hand." + commander attribution demoted to a small dim
  `.mulligan-screen__dealt` subline.

Verified: mobile (375px) before/after screenshots — panel obsidian, cards 158px in a 2-col grid,
sticky gold KEEP HAND. Selection works (2 marked → "CONFIRM MULLIGAN" / "Redrawing 2 cards"). KEEP
HAND → match board live (deploy/turn flow intact). Desktop (1280px) UNCHANGED (rail flex, 140px
slots, static action, original gradient) — `@media` correctly mobile-scoped. tsc 0 errors. Only the
pre-existing dev-only "static flag" warning in console (documented, not from this change).
DevBuildStamp untouched (DEV-gated, not shipped). NOT touched: reducer, card data, rewards, HEX,
routes, AI/attack logic, the in-match board.
