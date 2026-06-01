import { BattleResult, GameAppState, RewardLedgerEntry } from "../domain/types";
import { applyCardXp, applyCommanderXp } from "./progressionService";
import {
  claimServerQuest,
  fetchMyRanking,
  fetchQuestsToday,
  rankLabelForRating,
  DAILY_LOGIN_QUEST_ID,
} from "./ladderApi";

function makeLedgerEntry(
  source: RewardLedgerEntry["source"],
  xp: number,
  crypt: number,
  note: string
): RewardLedgerEntry {
  return {
    id: `${source}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source,
    xp,
    crypt,
    timestamp: new Date().toISOString(),
    note,
  };
}

function sameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function dayDiff(a: Date, b: Date) {
  const utcA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const utcB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((utcA - utcB) / 86400000);
}

export function claimDailyLogin(state: GameAppState) {
  const next = structuredClone(state);
  const now = new Date();
  const lastLogin = next.profile.lastLoginDate ? new Date(next.profile.lastLoginDate) : null;

  if (lastLogin && sameDay(now, lastLogin)) {
    return next;
  }

  if (!lastLogin) {
    next.profile.dailyStreak = 1;
    next.profile.weeklyLoginProgress = 1;
  } else {
    const diff = dayDiff(now, lastLogin);
    if (diff === 1) {
      next.profile.dailyStreak += 1;
      next.profile.weeklyLoginProgress += 1;
    } else {
      next.profile.dailyStreak = 1;
      next.profile.weeklyLoginProgress = 1;
    }
  }

  next.profile.lastLoginDate = now.toISOString();
  next.profile.accountXp += 1_500;
  next.profile.cryptBalance += 250;

  next.rewardLedger.unshift(
    makeLedgerEntry("daily_login", 1_500, 250, "Daily login reward claimed.")
  );

  const weeklyQuest = next.weeklyQuests.find((q) => q.id === "wq_1");
  if (weeklyQuest) {
    weeklyQuest.progress = Math.min(weeklyQuest.goal, next.profile.weeklyLoginProgress);
  }

  if (next.profile.weeklyLoginProgress >= 7) {
    next.profile.weeklyChestReady = true;
  }

  return next;
}

export function claimQuest(state: GameAppState, questId: string) {
  const next = structuredClone(state);
  const quest =
    next.dailyQuests.find((q) => q.id === questId) ??
    next.weeklyQuests.find((q) => q.id === questId);

  if (!quest || quest.claimed || quest.progress < quest.goal) return next;

  quest.claimed = true;
  next.profile.accountXp += quest.xp;
  next.profile.cryptBalance += quest.crypt;

  next.rewardLedger.unshift(
    makeLedgerEntry(
      quest.kind === "daily" ? "daily_quest" : "weekly_quest",
      quest.xp,
      quest.crypt,
      `${quest.title} claimed.`
    )
  );

  return next;
}

export function claimWeeklyChest(state: GameAppState) {
  const next = structuredClone(state);
  if (!next.profile.weeklyChestReady) return next;

  next.profile.accountXp += 12_000;
  next.profile.cryptBalance += 2_500;
  next.profile.nftRewardsEarned += 1;
  next.profile.weeklyChestReady = false;
  next.profile.weeklyLoginProgress = 0;
  next.profile.dailyStreak = 0;

  next.rewardLedger.unshift(
    makeLedgerEntry("weekly_chest", 12_000, 2_500, "Weekly Crypt Relic Chest claimed. NFT reward granted.")
  );

  return next;
}

export function applyBattleResult(state: GameAppState, result: BattleResult) {
  const next = structuredClone(state);

  const baseXp = result.won ? 1_800 : 1_000;
  const baseCrypt = result.won ? 220 : 90;
  const commanderXp = result.won ? 900 : 450;
  const cardXp = result.won ? 320 : 180;

  next.profile.accountXp += baseXp;
  next.profile.cryptBalance += baseCrypt;

  next.profile.topCommanders = applyCommanderXp(
    next.profile.topCommanders,
    result.commanderId,
    result.commanderId,
    commanderXp
  );

  next.profile.topCards = applyCardXp(
    next.profile.topCards,
    result.cardsUsed,
    cardXp
  );

  const playMatches = next.dailyQuests.find((q) => q.id === "dq_1");
  if (playMatches) playMatches.progress = Math.min(playMatches.goal, playMatches.progress + 1);

  const winsQuest = next.dailyQuests.find((q) => q.id === "dq_2");
  if (winsQuest && result.won) winsQuest.progress = Math.min(winsQuest.goal, winsQuest.progress + 1);

  const exactQuest = next.dailyQuests.find((q) => q.id === "dq_3");
  if (exactQuest && result.exactMatches > 0) {
    exactQuest.progress = Math.min(exactQuest.goal, exactQuest.progress + result.exactMatches);
  }

  const weeklyWins = next.weeklyQuests.find((q) => q.id === "wq_2");
  if (weeklyWins && result.won) weeklyWins.progress = Math.min(weeklyWins.goal, weeklyWins.progress + 1);

  const weeklyFaction = next.weeklyQuests.find((q) => q.id === "wq_3");
  if (weeklyFaction) {
    weeklyFaction.progress = Math.min(weeklyFaction.goal, weeklyFaction.progress + result.factionCardsPlayed);
  }

  next.rewardLedger.unshift(
    makeLedgerEntry(
      result.won ? "battle_win" : "battle_loss",
      baseXp,
      baseCrypt,
      result.won ? "Battle victory reward." : "Battle loss consolation reward."
    )
  );

  return next;
}

// ---------------------------------------------------------------------------
// SERVER-AUTHORITATIVE variants. The authoritative server (server/server.ts) is
// now the source of truth for ranked rating and per-UTC-day quest/login claims,
// so progress survives across devices and can't be re-opened by clearing
// localStorage. These async wrappers ask the server FIRST and only apply the
// local grant when the server confirms the claim was actually performed. When
// offline / unauthenticated the server call returns null and we transparently
// fall back to the existing local-only logic, so the prototype still works.
//
// HEX-SAFETY: the grants applied here are game-internal XP + soft currency. No
// path mints or moves real on-chain hex — neither client nor server has one.
// ---------------------------------------------------------------------------

/**
 * Pull the caller's authoritative ladder standing and write it into
 * `profile.rank` (+ accountXp/cryptBalance are NOT overwritten — rating is its
 * own ledger). Returns the next state; a no-op clone when offline.
 */
export async function syncRankFromServer(state: GameAppState): Promise<GameAppState> {
  const ranking = await fetchMyRanking();
  if (!ranking) return state;
  const next = structuredClone(state);
  const label = rankLabelForRating(ranking.rating);
  next.profile.rank =
    ranking.position > 0
      ? `${label} · #${ranking.position} · ${ranking.rating}`
      : `${label} · ${ranking.rating}`;
  return next;
}

/**
 * Daily login, server-authoritative. Asks the server to claim the once-per-UTC-
 * day login bonus; only on a server-confirmed FIRST claim do we apply the local
 * streak/XP/crypt grant. If the server says it was already claimed today, we
 * skip the grant (no double-dip across devices). Falls back to the local-only
 * `claimDailyLogin` when offline.
 */
export async function claimDailyLoginServer(state: GameAppState): Promise<GameAppState> {
  const res = await claimServerQuest(DAILY_LOGIN_QUEST_ID);
  if (res === null) {
    // Offline / unauthenticated — preserve prototype behaviour.
    return claimDailyLogin(state);
  }
  if (!res.claimed) {
    // Server already recorded today's login claim — no local grant.
    return state;
  }
  // Server performed the claim: apply the local-side bookkeeping once.
  return claimDailyLogin(state);
}

/**
 * Claim a daily quest, server-authoritative. The server validates and records
 * the per-UTC-day claim; we apply the local grant only on a confirmed first
 * claim. Falls back to local-only `claimQuest` when offline. Weekly quests have
 * no server claim yet and always go through the local path.
 */
export async function claimQuestServer(
  state: GameAppState,
  questId: string
): Promise<GameAppState> {
  const isDaily = state.dailyQuests.some((q) => q.id === questId);
  if (!isDaily) {
    // Weekly (or unknown) — local-only path, unchanged.
    return claimQuest(state, questId);
  }
  const res = await claimServerQuest(questId);
  if (res === null) {
    // Offline / unauthenticated — preserve prototype behaviour.
    return claimQuest(state, questId);
  }
  if (!res.claimed) {
    // Already claimed today on the server — just mark it claimed locally so the
    // UI reflects authoritative truth, without re-granting XP/crypt.
    const next = structuredClone(state);
    const q = next.dailyQuests.find((x) => x.id === questId);
    if (q) q.claimed = true;
    return next;
  }
  // Server performed the claim — apply the local grant once.
  return claimQuest(state, questId);
}

/**
 * Reconcile the client's daily-quest `claimed` flags with the server's durable
 * per-UTC-day record on load, so a player who claimed on another device sees
 * those quests as claimed here too (and can't re-claim). No grants applied.
 */
export async function syncQuestClaimsFromServer(
  state: GameAppState
): Promise<GameAppState> {
  const today = await fetchQuestsToday();
  if (!today) return state;
  const claimedIds = new Set(today.quests.filter((q) => q.claimed).map((q) => q.id));
  const next = structuredClone(state);
  for (const q of next.dailyQuests) {
    if (claimedIds.has(q.id)) q.claimed = true;
  }
  return next;
}

export function buyShopItem(state: GameAppState, itemId: string) {
  const next = structuredClone(state);
  const item = next.shopItems.find((i) => i.id === itemId);
  if (!item) return next;
  if (next.profile.cryptBalance < item.cost) return next;

  next.profile.cryptBalance -= item.cost;
  next.rewardLedger.unshift(
    makeLedgerEntry("shop_purchase", 0, -item.cost, `Purchased ${item.name}.`)
  );

  return next;
}
