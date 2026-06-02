/**
 * en.ts — the DEFAULT ('en') locale string table.
 *
 * Keys are dot-namespaced by surface (e.g. "home.hero.headline"). This is the
 * scaffold's single source of truth for English copy; other locales register a
 * PARTIAL table and fall back to these strings key-by-key (see registry.ts).
 *
 * SCAFFOLD DISCIPLINE: only ONE surface (the Home hero) is extracted here as the
 * demo. The rest of the app keeps its inline copy — this avoids a global churn /
 * mass-translation pass while proving the t()/registry seam end-to-end.
 */

export const en = {
  // --- Home hub hero (the extracted demo surface) ---------------------------
  "home.hero.kicker": "CRYPT · Crypt Legends · closed alpha",
  "home.hero.headline": "Command",
  "home.hero.headlineSub": " the archive",
  "home.hero.deck":
    "Build a deck, lead a commander, and duel on one tactical field. Gods, monsters, and heroes in play.",
  "home.hero.playLabel": "Play",
  "home.hero.playMeta": "Jump into a match",

  // --- Puzzle / solo surface (A9) -------------------------------------------
  "puzzle.eyebrow": "Solo · Puzzles",
  "puzzle.title": "Find the line",
  "puzzle.lead":
    "Hand-built tactical positions with one winning line. Deterministic — the board never lies. Solve them at your own pace.",
  "puzzle.objective": "Objective",
  "puzzle.solveCta": "Reveal the winning line",
  "puzzle.solved": "Solved — lethal found.",
  "puzzle.reset": "Reset board",

  // --- a11y palette toggle label (A6) ---------------------------------------
  "a11y.palette.toggle": "Colorblind-safe palette",

  // --- Profile / dossier surface --------------------------------------------
  "profile.eyebrow": "Dossier · Crypt Legends",
  "profile.title.guest": "Guest legend",
  "profile.title.default": "Dossier",
  "profile.lead.rankPrefix": "Legend rank ",
  "profile.lead.rankSuffix": " from pass XP (device) · ",
  "profile.lead.sealed": "Unranked—ladder sealed",
  "profile.status.aria": "Account status",
  "profile.badge.guest": "Guest · device vault",
  "profile.badge.note": "Accounts and cloud dossiers are not wired—your legend stays on this device.",
  "profile.whisper": "Your legend grows in the dark—progress stays on this device until the vault shares it.",
  "profile.recentDuels.aria": "Recent duels",
  "profile.recentDuels.label": "Recent duels",
  "profile.recentDuels.win": "WIN",
  "profile.recentDuels.loss": "LOSS",
  "profile.recentDuels.empty": "No verdict yet—claim a duel from Play.",
  "profile.ledger.prefix": "Ledger ",
  "profile.ledger.mid": " $CRYPT · ",
  "profile.ledger.suffix": " pass XP (device)",
  "profile.commander.aria": "Commander focus",
  "profile.commander.label": "Commander · loadout",
  "profile.commander.loading": "Vault index loading…",
  "profile.commander.mirroredFrom": "Mirrored from ",
  "profile.commander.forge": "Loadout forge",
  "profile.commander.mirroredSuffix": ". Independent favorite picks arrive when dossiers cloud-save.",
  "profile.cosmeticsRoadmap.aria": "OG Skull cosmetics roadmap",
  "profile.cosmeticsRoadmap.label": "OG Skulls · frames (roadmap)",
  "profile.cosmeticsRoadmap.copyPrefix":
    "Crypt OG Skulls may one day wear vault frames—vanity only, no stat lift per policy (",
  "profile.cosmeticsRoadmap.policyFile": "docs/ENTITLEMENT_POLICY.md",
  "profile.cosmeticsRoadmap.copySuffix": "). This build verifies nothing; the preview is concept art.",
  "profile.cosmeticsRoadmap.art": "Commander art",
  "profile.cosmeticsRoadmap.conceptLabel": "Concept—no entitlement in this build",
  "profile.vault.aria": "Wallet link",
  "profile.vault.label": "Vault link",
  "profile.vault.title": "Sealed",
  "profile.vault.copy":
    "No connect or proof-of-hold flow ships here. If accounts arrive later, optional import might bind Crypt OG Skulls and Crypt Digital Trading Cards to field identity—policy TBD, inactive now.",
  "profile.vault.unavailable": "Unavailable",
  "profile.rank.aria": "Rank",
  "profile.rank.label": "Rank · competitive",
  "profile.rank.mmrSuffix": " MMR",
  "profile.rank.empty": "Play a ranked duel to enter the ladder",
  "profile.rank.viewLadder": "View your ranked ladder →",
  "profile.rank.seasonStandings": "Season standings →",
  "profile.cosmetics.aria": "Cosmetic unlocks",
  "profile.cosmetics.label": "Cosmetics · unlocked",
  "profile.cosmetics.empty": "Badges sync when server progress ships",
  "profile.signout.btn": "Close dossier · return to gate",
  "profile.signout.note": "Clears guest stub on device only—no remote sign-out yet.",

  // --- Leaderboard / season ladder surface ----------------------------------
  "leaderboard.eyebrow": "Tier 2 · The Season",
  "leaderboard.title": "Season ladder",
  "leaderboard.lead.empty": "Climb the ranked ladder and earn the season's rewards.",
  "leaderboard.you.aria": "Your season standing",
  "leaderboard.you.label": "You · this season",
  "leaderboard.you.posPrefix": "You: #",
  "leaderboard.board.aria": "Season leaderboard",
  "leaderboard.board.label": "Standings · top 25",
  "leaderboard.board.you": " · you",
  "leaderboard.board.empty": "Sign in and play ranked to join the season ladder",
  "leaderboard.board.loading": "Reading the ladder…",
  "leaderboard.rewards.aria": "Season reward track",
  "leaderboard.rewards.label": "Reward track",
  "leaderboard.rewards.mmrSuffix": "+ MMR",
  "leaderboard.rewards.frame": " · ⬡ frame",
  "leaderboard.rewards.claimed": "Claimed",
  "leaderboard.rewards.claiming": "Claiming…",
  "leaderboard.rewards.claim": "Claim",
  "leaderboard.rewards.locked": "Locked",
  "leaderboard.rewards.empty": "Rewards unlock once the season ladder opens",
  "leaderboard.rewards.loading": "Reading rewards…",
  "leaderboard.foot.climbFrom": "Climb from the ",
  "leaderboard.foot.playHub": "Play hub",
  "leaderboard.foot.climbSuffix": "—ranked duels move your season rating.",

  // --- Daily pack / vault surface -------------------------------------------
  "dailypack.title": "Daily vault",
  "dailypack.subtitle":
    "Ritual is local-only—no relic mints yet. You still claimed device ledger currency on the last step.",
  "dailypack.slot.label": "Sealed pull",
  "dailypack.slot.rarity": "Alpha",
  "dailypack.summary.aria": "Rewards",
  "dailypack.summary.title": "This claim",
  "dailypack.actions.hub": "Command hub",
  "dailypack.actions.copy": "Copy pull summary",
  "dailypack.share.note":
    "Branded vault-pull shares ship with the live archive—closed alpha is copy-only for now.",

  // --- Shop / reliquary surface ---------------------------------------------
  "shop.eyebrow": "Reliquary · preview",
  "shop.title": "Claim the next relic",
  "shop.lead":
    "No checkout or inventory. $CRYPT matches your field ledger on device—not entitlements, not on-chain in this build.",
  "shop.region.aria": "Reliquary preview",
  "shop.whisper": "Crypt Legends stays skill-first—vanity for mats, backs, passes, never pay-to-win by intent.",
  "shop.banner.tag": "Preview",
  "shop.banner.copy":
    " — counter sealed. Boards, backs, season goods for Crypt Digital Trading Cards arrive with commerce—nothing purchasable today.",
  "shop.balance.aria": "Balance",
  "shop.balance.label": "$CRYPT (device ledger)",
  "shop.balance.note": "Same closed-alpha stub as Home · skill and earn paths stay first",
  "shop.body":
    "Collectible-first, tactical at core: when the Reliquary opens, receipts stay clear for cosmetics, mats, backs, events, passes—prestige without power creep by design.",
  "shop.roadmap.checkout": "Checkout, receipts, and entitlement sync",
  "shop.roadmap.skus": "Real SKUs priced in $CRYPT or fiat",
  "shop.roadmap.drops": "Seasonal drops tuned from the server",
  "shop.foot.aria": "Leave reliquary",
  "shop.foot.hub": "Command hub",
  "shop.foot.field": "Field",
  "shop.foot.dossier": "Dossier",
} as const;

/** The canonical key union — every locale's table is typed against this. */
export type MessageKey = keyof typeof en;
