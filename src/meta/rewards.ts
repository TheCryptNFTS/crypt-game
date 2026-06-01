/**
 * REWARDS — daily/weekly quests, a season reward track, and an in-game soft
 * currency ("Sigil") spent on COSMETIC unlocks. Retention loop scaffold.
 *
 * *** HARD RULE (non-negotiable) ***
 * The game uses a real on-chain currency ("hex"). NOTHING in this module mints,
 * grants, credits, or sources hex or any on-chain / wallet / token asset. The
 * ONLY economy here is "Sigil", a non-real, in-game-only soft currency, plus
 * boolean cosmetic-unlock flags. Game ledgers may sink real hex but never
 * source it; this module sources NOTHING real. Any reward that would pay real
 * value is intentionally absent — see the owner stub at the bottom.
 *
 * Everything is pure + deterministic. Quests are evaluated from a plain
 * MatchResult summary fed by the match-end path (NOT the reducer). A thin
 * local-only persistence layer mirrors progression.ts. No randomness, no
 * network, no node globals at import time.
 */

// ---------------------------------------------------------------------------
// MATCH SUMMARY — the (reducer-free) signal quests read from
// ---------------------------------------------------------------------------

/**
 * Minimal, view-layer-derived summary of one decided match. Produced OUTSIDE
 * the reducer (mirrors how progression consumes a winner seat). Carries only
 * in-game-only facts: did we win, and how many of each faction we fielded.
 */
export type MatchResult = {
  /** True if THIS player won the decided match. */
  won: boolean;
  /**
   * Count of units the player fielded this match, keyed by faction id
   * (e.g. "Stone": 5). Used by "play N <faction> units" quests. Optional /
   * partial — missing factions count as 0.
   */
  factionUnitsPlayed?: Record<string, number>;
};

// ---------------------------------------------------------------------------
// SIGIL — in-game soft currency (NOT hex, NOT on-chain, NOT spendable for real)
// ---------------------------------------------------------------------------

/** Sigil awarded per match outcome, before quest bonuses. Pure constants. */
export const SIGIL_REWARDS = {
  win: 30,
  loss: 10,
} as const;

// ---------------------------------------------------------------------------
// QUEST DEFINITIONS
// ---------------------------------------------------------------------------

export type QuestPeriod = "daily" | "weekly";

/** A quest's progress is driven by counting "events" derived from a match. */
export type QuestMetric =
  | { kind: "wins" }
  | { kind: "matches" }
  | { kind: "factionUnits"; faction: string };

export type QuestDef = {
  id: string;
  period: QuestPeriod;
  title: string;
  description: string;
  metric: QuestMetric;
  /** Target count to complete the quest. */
  goal: number;
  /** Sigil paid out once on completion. In-game-only. */
  sigilReward: number;
  /** Season XP paid out once on completion (drives the season track). */
  seasonXpReward: number;
};

/**
 * The canonical quest catalog. Deterministic + static so the active set is
 * reproducible. Daily quests rotate fast; weekly quests are chunkier.
 */
export const QUEST_CATALOG: readonly QuestDef[] = [
  {
    id: "daily_win_3",
    period: "daily",
    title: "Triple Verdict",
    description: "Win 3 duels today.",
    metric: { kind: "wins" },
    goal: 3,
    sigilReward: 40,
    seasonXpReward: 60,
  },
  {
    id: "daily_play_5",
    period: "daily",
    title: "Keep the Signal",
    description: "Play 5 duels today.",
    metric: { kind: "matches" },
    goal: 5,
    sigilReward: 25,
    seasonXpReward: 40,
  },
  {
    id: "daily_stone_5",
    period: "daily",
    title: "Bedrock Drills",
    description: "Field 5 Stone units across your duels today.",
    metric: { kind: "factionUnits", faction: "Stone" },
    goal: 5,
    sigilReward: 35,
    seasonXpReward: 50,
  },
  {
    id: "weekly_win_15",
    period: "weekly",
    title: "Seasoned Campaigner",
    description: "Win 15 duels this week.",
    metric: { kind: "wins" },
    goal: 15,
    sigilReward: 150,
    seasonXpReward: 300,
  },
  {
    id: "weekly_play_25",
    period: "weekly",
    title: "Relentless",
    description: "Play 25 duels this week.",
    metric: { kind: "matches" },
    goal: 25,
    sigilReward: 100,
    seasonXpReward: 200,
  },
] as const;

/** Lookup a quest definition by id. */
export function questDefById(id: string): QuestDef | undefined {
  return QUEST_CATALOG.find((q) => q.id === id);
}

/** Progress count a single match contributes toward a given metric. Pure. */
export function metricDelta(metric: QuestMetric, result: MatchResult): number {
  switch (metric.kind) {
    case "wins":
      return result.won ? 1 : 0;
    case "matches":
      return 1;
    case "factionUnits":
      return Math.max(0, Math.floor(result.factionUnitsPlayed?.[metric.faction] ?? 0));
  }
}

// ---------------------------------------------------------------------------
// SEASON REWARD TRACK
// ---------------------------------------------------------------------------

export type SeasonTier = {
  /** 1-based tier index. */
  tier: number;
  /** Cumulative season XP required to UNLOCK this tier. */
  xpThreshold: number;
  /** Sigil granted when this tier unlocks. In-game-only. */
  sigilReward: number;
  /** Optional cosmetic id granted when this tier unlocks. */
  cosmetic?: string;
  label: string;
};

/**
 * The season track. Tiers unlock as cumulative season XP crosses each
 * threshold. Rewards are in-game-only (Sigil + cosmetic flags). Deterministic.
 */
export const SEASON_TRACK: readonly SeasonTier[] = [
  { tier: 1, xpThreshold: 0, sigilReward: 0, label: "Initiate" },
  { tier: 2, xpThreshold: 100, sigilReward: 50, label: "Signal Bearer" },
  { tier: 3, xpThreshold: 300, sigilReward: 75, cosmetic: "frame_signal", label: "Transmitter" },
  { tier: 4, xpThreshold: 600, sigilReward: 100, label: "Synthesist" },
  { tier: 5, xpThreshold: 1000, sigilReward: 150, cosmetic: "frame_oracle", label: "Oracle" },
  { tier: 6, xpThreshold: 1500, sigilReward: 200, cosmetic: "frame_void", label: "Void-Touched" },
] as const;

/** Highest tier whose threshold is <= the given season XP. Pure. 1-based. */
export function seasonTierForXp(seasonXp: number): number {
  const xp = Math.max(0, Math.floor(seasonXp));
  let unlocked = 1;
  for (const t of SEASON_TRACK) {
    if (xp >= t.xpThreshold) unlocked = t.tier;
    else break;
  }
  return unlocked;
}

// ---------------------------------------------------------------------------
// COSMETICS
// ---------------------------------------------------------------------------

export type CosmeticDef = {
  id: string;
  label: string;
  /** Sigil price when bought from the shop. 0 = track-only (not purchasable). */
  price: number;
};

/** Purchasable + track-unlockable cosmetics. Vanity only — no stat effect. */
export const COSMETIC_CATALOG: readonly CosmeticDef[] = [
  { id: "frame_signal", label: "Signal frame", price: 200 },
  { id: "frame_oracle", label: "Oracle frame", price: 400 },
  { id: "frame_void", label: "Void frame", price: 600 },
  { id: "sleeve_hex", label: "Hex card sleeve", price: 150 },
  { id: "sleeve_static", label: "Static card sleeve", price: 250 },
] as const;

export function cosmeticDefById(id: string): CosmeticDef | undefined {
  return COSMETIC_CATALOG.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// REWARDS STATE
// ---------------------------------------------------------------------------

export type QuestProgress = {
  questId: string;
  /** Accumulated count toward the quest goal. */
  progress: number;
  /** True once the reward has been paid out (idempotent guard). */
  claimed: boolean;
};

/**
 * The full local rewards ledger. Carries ONLY in-game-only state: a Sigil
 * balance, quest progress, season XP, and owned cosmetic ids. NO hex / wallet /
 * token / on-chain field exists here, by design and by test.
 */
export type RewardsState = {
  /** In-game soft currency balance (Sigil). Never hex. */
  sigil: number;
  /** Cumulative season XP (drives the season track). In-game-only. */
  seasonXp: number;
  /** Highest season tier already paid out (idempotent unlock guard). */
  seasonTierClaimed: number;
  /** Per-quest progress, keyed by quest id. */
  quests: Record<string, QuestProgress>;
  /** Owned cosmetic ids (unlock flags). */
  cosmetics: string[];
  /** Day bucket (epoch days) the daily quests were last seeded for. */
  dailyBucket: number;
  /** Week bucket (epoch weeks) the weekly quests were last seeded for. */
  weeklyBucket: number;
};

const MS_PER_DAY = 86_400_000;

/** Epoch-day bucket for a timestamp (UTC). Deterministic given `now`. */
export function dayBucket(now: number): number {
  return Math.floor(now / MS_PER_DAY);
}

/** Epoch-week bucket for a timestamp (UTC). Deterministic given `now`. */
export function weekBucket(now: number): number {
  return Math.floor(now / (MS_PER_DAY * 7));
}

function freshQuestProgress(questId: string): QuestProgress {
  return { questId, progress: 0, claimed: false };
}

/** Build a fresh quest map seeded with every quest of the given period. */
function seedQuests(
  base: Record<string, QuestProgress>,
  period: QuestPeriod
): Record<string, QuestProgress> {
  const next = { ...base };
  for (const def of QUEST_CATALOG) {
    if (def.period !== period) continue;
    next[def.id] = freshQuestProgress(def.id);
  }
  return next;
}

export function createRewardsState(now = 0): RewardsState {
  let quests: Record<string, QuestProgress> = {};
  quests = seedQuests(quests, "daily");
  quests = seedQuests(quests, "weekly");
  return {
    sigil: 0,
    seasonXp: 0,
    seasonTierClaimed: 1,
    quests,
    cosmetics: [],
    dailyBucket: dayBucket(now),
    weeklyBucket: weekBucket(now),
  };
}

/**
 * Roll over daily/weekly quests when their time bucket changes. Returns a NEW
 * state (immutable). Re-seeds the relevant quests' progress + claimed flags.
 * Pure given `now`.
 */
export function rolloverQuests(state: RewardsState, now: number): RewardsState {
  let next = state;
  const d = dayBucket(now);
  const w = weekBucket(now);

  if (d !== state.dailyBucket) {
    next = {
      ...next,
      quests: seedQuests(next.quests, "daily"),
      dailyBucket: d,
    };
  }
  if (w !== state.weeklyBucket) {
    next = {
      ...next,
      quests: seedQuests(next.quests, "weekly"),
      weeklyBucket: w,
    };
  }
  return next;
}

// ---------------------------------------------------------------------------
// CORE MUTATIONS (pure)
// ---------------------------------------------------------------------------

/**
 * Apply a decided match to the rewards ledger. Awards base Sigil, advances all
 * active quests, pays out newly completed quests (Sigil + season XP), then
 * unlocks any newly crossed season tiers (Sigil + cosmetic). Returns a NEW
 * state. Sources nothing real. Pure given (state, result, now).
 */
export function applyMatchToRewards(
  state: RewardsState,
  result: MatchResult,
  now: number
): RewardsState {
  // Roll quests forward first so a match on a new day counts against fresh ones.
  let next = rolloverQuests(state, now);

  // Base Sigil for playing/winning.
  let sigil = next.sigil + (result.won ? SIGIL_REWARDS.win : SIGIL_REWARDS.loss);
  let seasonXp = next.seasonXp;

  // Advance + settle quests.
  const quests: Record<string, QuestProgress> = { ...next.quests };
  for (const def of QUEST_CATALOG) {
    const cur = quests[def.id] ?? freshQuestProgress(def.id);
    if (cur.claimed) continue;
    const delta = metricDelta(def.metric, result);
    const progress = Math.min(def.goal, cur.progress + delta);
    const completed = progress >= def.goal;
    if (completed && !cur.claimed) {
      sigil += def.sigilReward;
      seasonXp += def.seasonXpReward;
    }
    quests[def.id] = { questId: def.id, progress, claimed: completed };
  }

  next = { ...next, sigil, seasonXp, quests };

  // Unlock any newly crossed season tiers.
  return settleSeasonTiers(next);
}

/**
 * Pay out every season tier between the last-claimed tier and the tier the
 * current season XP unlocks. Idempotent: claimed tiers are never re-paid.
 * Returns a NEW state. Pure.
 */
export function settleSeasonTiers(state: RewardsState): RewardsState {
  const unlocked = seasonTierForXp(state.seasonXp);
  if (unlocked <= state.seasonTierClaimed) return state;

  let sigil = state.sigil;
  const cosmetics = [...state.cosmetics];
  for (const t of SEASON_TRACK) {
    if (t.tier <= state.seasonTierClaimed) continue;
    if (t.tier > unlocked) break;
    sigil += t.sigilReward;
    if (t.cosmetic && !cosmetics.includes(t.cosmetic)) cosmetics.push(t.cosmetic);
  }
  return { ...state, sigil, cosmetics, seasonTierClaimed: unlocked };
}

export type PurchaseResult =
  | { ok: true; state: RewardsState }
  | { ok: false; reason: "unknown" | "owned" | "insufficient" };

/**
 * Spend Sigil to unlock a cosmetic. In-game-only sink: Sigil is debited and a
 * boolean unlock flag is added. NEVER touches hex / wallet / on-chain assets.
 * Returns a NEW state on success. Pure.
 */
export function purchaseCosmetic(state: RewardsState, cosmeticId: string): PurchaseResult {
  const def = cosmeticDefById(cosmeticId);
  if (!def) return { ok: false, reason: "unknown" };
  if (state.cosmetics.includes(cosmeticId)) return { ok: false, reason: "owned" };
  if (def.price <= 0) return { ok: false, reason: "unknown" };
  if (state.sigil < def.price) return { ok: false, reason: "insufficient" };
  return {
    ok: true,
    state: {
      ...state,
      sigil: state.sigil - def.price,
      cosmetics: [...state.cosmetics, cosmeticId],
    },
  };
}

// ---------------------------------------------------------------------------
// VIEW HELPERS
// ---------------------------------------------------------------------------

export type QuestView = QuestDef & {
  progress: number;
  claimed: boolean;
};

/** Resolve the active quests of a period into display rows. Pure. */
export function activeQuests(state: RewardsState, period: QuestPeriod): QuestView[] {
  return QUEST_CATALOG.filter((d) => d.period === period).map((def) => {
    const p = state.quests[def.id] ?? freshQuestProgress(def.id);
    return { ...def, progress: p.progress, claimed: p.claimed };
  });
}

// ---------------------------------------------------------------------------
// LOCAL-ONLY PERSISTENCE (no network, no wallet, no on-chain writes)
// ---------------------------------------------------------------------------

/** Distinct key; never collides with the profile or app-state keys. */
const REWARDS_STORAGE_KEY = "crypt_meta_rewards_v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Load the local rewards ledger, rolling quests forward to `now`. */
export function loadRewards(now = Date.now()): RewardsState {
  if (!canUseStorage()) return createRewardsState(now);
  try {
    const raw = window.localStorage.getItem(REWARDS_STORAGE_KEY);
    if (!raw) return createRewardsState(now);
    const parsed = JSON.parse(raw) as Partial<RewardsState>;
    // Merge onto a fresh state so legacy/partial blobs stay consistent, then
    // re-derive season unlocks + roll quests forward.
    const merged: RewardsState = {
      ...createRewardsState(now),
      ...parsed,
      quests: { ...createRewardsState(now).quests, ...(parsed.quests ?? {}) },
      cosmetics: parsed.cosmetics ?? [],
    };
    return rolloverQuests(settleSeasonTiers(merged), now);
  } catch {
    return createRewardsState(now);
  }
}

/** Persist the rewards ledger locally. Never leaves the device. */
export function saveRewards(state: RewardsState): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(REWARDS_STORAGE_KEY, JSON.stringify(state));
}

/** Wipe the local rewards ledger (e.g. for a fresh test run). Local only. */
export function resetRewards(now = Date.now()): RewardsState {
  const fresh = createRewardsState(now);
  saveRewards(fresh);
  return fresh;
}

// TODO(owner): Any reward that would grant real hex / on-chain assets / wallet
// credit is intentionally NOT implemented. Sigil is a closed in-game soft
// currency with no exit to real value, and cosmetics are vanity flags. A
// "convert Sigil to hex" or "season hex payout" path would source real value
// and requires an explicit owner decision plus a mint/transfer path this module
// deliberately does not provide:
//
//   export function redeemSigilForHex(): never {
//     throw new Error("owner-decision-required");
//   }
