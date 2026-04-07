# CRYPT — Holder vs non-holder entitlement policy

**Status:** locked for launch planning.  
**Philosophy:** *Non-holders are players first. Holders are players plus owners.*

If holders are “real users” and non-holders are “second-class tourists,” growth dies.  
If everyone can play and holders get deeper identity, evolution, and prestige (not raw power), the product can scale and the NFT story stays credible.

---

## Master rule

| Requirement | Rationale |
|-------------|-----------|
| **Non-holders** must enter, play, progress, earn, and get hooked without owning an NFT. | They are the growth and DAU engine. |
| **Holders** must feel advantaged, special, and economically rewarded **without** blatant pay-to-win or ladder autowin. | They are prestige, identity, and long-term value — not a gate on fun. |
| **NFT ownership** = prestige + evolution + identity + showcase. **Not** a mandatory entry ticket. | Broad funnel + real NFT demand. |

---

## 1. Non-holders (growth engine)

### They get

- Guest login / normal account (see app shell spec: guest first).
- Full tutorial.
- **Starter commanders** and starter decks (commanders are **not** NFT-only at launch).
- Quick battle, ranked ladder.
- Daily quests, battle pass / season XP.
- Free **Crypt Packs** (e.g. 2/day on a timer — product detail).
- Collection building, deck building.
- Social sharing (packs, wins, collection, deck, leaderboard).
- Faction choice.
- Ability to **earn $CRYPT** (off-chain in-app first).

### They do not get

- Import **real OG** commander NFTs as their commander.
- On-chain trait evolution on owned OGs.
- “True ownership” flex tied to token.
- Holder-only cosmetics / events / relics (as defined in product).
- Premium OG identity status surfaces (badge, verified commander import, etc.).

### Why

Daily packs, quests, short matches, battle pass, and social loops are the retention engine. Cutting non-holders off from those kills the funnel.

---

## 2. NFT holders (prestige / economy layer)

### They get

**Everything non-holders get**, plus:

- Wallet connect and **NFT import** (timing: v1 may stub “coming soon” per roadmap; policy is clear).
- **Their Crypt OGs usable as commanders** when imported.
- Holder badge / verified ownership on profile.
- Exclusive commander visuals: frames, animated treatments, alt intros (cosmetic / prestige).
- **Trait evolution** tied to gameplay (tracked in product; on-chain evolution post-launch per roadmap).
- Higher-prestige collection / showcase surfaces.
- Faction leadership visibility (product-defined).
- Eligibility for on-chain prizes / special tournaments **later**.
- Anniversary / OG-holder events.
- Deeper collection flex (deck share with token ID, result cards featuring owned commander, etc.).

### They do not get

- Guaranteed ranked domination or autowin.
- Blatant pay-to-win power.
- Raw stat inflation that makes non-holder matches feel pointless.

### Why

Floor-price flywheel needs: new players want NFTs, holders feel rewarded, active play makes NFTs *feel* more valuable — **without** killing the game for free players.

---

## 3. Product split by layer

### Commanders

| | Non-holders | Holders |
|---|-------------|---------|
| Source | Starter + unlockable **non-NFT** commanders | Same + **imported OG** commander NFTs |
| Profile | Standard | + token identity, holder status, evolution state, prestige visuals |

**Rule:** Do **not** make all commanders NFT-only at launch — that crushes onboarding.

### Playable cards

| | Non-holders | Holders |
|---|-------------|---------|
| Core | Earn, packs, build, climb — **same game system** | Same |
| Extras | — | Holder-linked cosmetics, binder prestige, optional OG-linked variants (cosmetic / showcase) |

Playables stay a **real TCG system for everyone**, not holder-only.

### Currency ($CRYPT)

| | Non-holders | Holders |
|---|-------------|---------|
| Earn | Wins, quests, season, events (off-chain first) | Same + holder-linked prestige/evolution unlocks where designed |
| Spend | Cosmetics, packs, tickets, convenience, backs, boards | Same + **holder sinks**: evolution materials, premium prestige cosmetics, special events |

**Rule:** Off-chain $CRYPT first; wallet/token friction later.

---

## 4. Entitlement matrix (summary)

### Non-holders

**Access:** App, matches, ranked, quick battle, collection, decks, progression, daily packs, quests, battle pass, social.  
**Earn:** $CRYPT, packs, cosmetics, progression, rank rewards.  
**Restricted:** No OG import, no on-chain evolution, no OG prestige-only surfaces.

### Holders

**Access:** Everything above + OG import, holder events, holder cosmetics, prestige profile, evolution path (as shipped).  
**Earn:** Same base + holder-linked evolution/prestige unlocks; later tournament/on-chain rewards.  
**Advantage:** Identity, ownership, status, evolution, showcase, collectible story — **not** guaranteed ladder wins.  
**Restricted:** Must not auto-win for holding.

---

## 5. Non-negotiables for non-holders (funnel dies without these)

1. **Fast matches** (~3–4 min design target).  
2. **Daily packs** (e.g. free packs on a cadence).  
3. **Daily quests** (e.g. faction-scoped).  
4. **Battle pass / season XP** — every match should feel like progress.  
5. **Social / share** — pack open, win, binder, leaderboard, deck.

---

## 6. Exclusives holders should keep (non-holders never fully duplicate)

1. **Real OG commander import** (most important).  
2. **Trait evolution on owned OGs** (gameplay-tied; on-chain when roadmap says).  
3. **Prestige flex** — showcase, badge, share templates with token/commander ownership.  
4. **Anniversary / OG-only events.**  
5. **Special cosmetics / commander intros** — high status, non–P2W.

---

## 7. Launch v1 vs post-launch (policy-level)

### Launch v1 — non-holders

Guest (or account), starter commanders/decks, daily packs, ranked/quick battle, quests, battle pass, $CRYPT earning, social sharing.

### Launch v1 — holders

Same as above **plus**: imported OG commander usage (when feature is wired), holder badge, prestige frames, evolution **progress tracked** (full on-chain evolution may be phased), holder-only events/cosmetics as scoped.

### Post-launch

Wallet connect fully surfaced, on-chain evolution, holder tournaments, alliances, spectator/friend expansion — **without** reversing the rule that non-holders remain full players.

---

## 8. Engineering / design checklist

When adding a feature, ask:

1. Can a **guest** use core progression without an NFT? If no, reconsider or re-scope.  
2. Does this give holders **power** (stats, autowin) or **prestige** (identity, cosmetics, evolution story)? Prefer the latter for exclusives.  
3. Is `$CRYPT` or wallet complexity **required** for the core loop? Should stay off until intentionally shipped.  
4. Are we showing **raw NFT metadata** in UI? Route through the **presentation layer** (`src/presentation/`) — no credibility leaks.

---

## 9. Next document (optional)

Screen-by-screen entitlement table (Home, Play, Collection, Deck, Shop, Profile, Match, Results, Share) can extend this file or live in `docs/ENTITLEMENTS_BY_SCREEN.md` when you want it nailed per route.

---

*This policy is the balance between growth and holder value: everyone plays; holders deepen ownership and status without killing the game.*
