export type DailyReward = {
  xp: number;
  crypt: number;
};

export type QuestReward = {
  xp: number;
  crypt: number;
};

export type CardCosmeticTier = {
  levelRequired: number;
  name: string;
  cryptActivationCost: number;
  statusLabel: string;
};

export const ECONOMY = {
  account: {
    maxLevel: 100,
    targetTotalXp: 1_350_000,
  },
  rewards: {
    dailyLogin: { xp: 1_500, crypt: 250 } as DailyReward,
    firstWin: { xp: 2_500, crypt: 400 } as DailyReward,
    win: { xp: 1_800, crypt: 220 },
    loss: { xp: 1_000, crypt: 90 },
    weeklyLoginChest: { xp: 12_000, crypt: 2_500, nft: true },
  },
  quests: {
    daily: [
      { id: "dq_1", title: "Play 3 Matches", xp: 2_000, crypt: 300 },
      { id: "dq_2", title: "Win 2 Matches", xp: 2_500, crypt: 350 },
      { id: "dq_3", title: "Trigger 3 Exact Matches", xp: 3_000, crypt: 500 },
    ] as QuestReward[] & { id: string; title: string }[],
    weekly: [
      { id: "wq_1", title: "Log in 7 Days", xp: 6_000, crypt: 900 },
      { id: "wq_2", title: "Win 10 Battles", xp: 8_000, crypt: 1_200 },
      { id: "wq_3", title: "Play 25 Faction Cards", xp: 7_000, crypt: 1_000 },
    ] as QuestReward[] & { id: string; title: string }[],
  },
  cosmeticTiers: [
    { levelRequired: 10, name: "Awakened", cryptActivationCost: 2_000, statusLabel: "Sealed Evolution I" },
    { levelRequired: 25, name: "Ascendant", cryptActivationCost: 5_000, statusLabel: "Sealed Evolution II" },
    { levelRequired: 50, name: "Sovereign", cryptActivationCost: 12_000, statusLabel: "Sealed Evolution III" },
    { levelRequired: 75, name: "Mythic", cryptActivationCost: 25_000, statusLabel: "Sealed Evolution IV" },
    { levelRequired: 100, name: "Relic Form", cryptActivationCost: 50_000, statusLabel: "Final Sealed Form" },
  ] as CardCosmeticTier[],
  sinks: {
    questReroll: 750,
    deckSlot: 5_000,
    commanderAuraUnlock: 12_500,
    profileBannerUnlock: 8_500,
    seasonalRelicSkin: 22_500,
    eventEntry: 3_000,
  },
};

export function xpToNextLevel(level: number) {
  if (level >= ECONOMY.account.maxLevel) return 0;
  return Math.floor(5000 + level * 350 + Math.pow(level, 1.35) * 120);
}

export function cumulativeXpForLevel(level: number) {
  let total = 0;
  for (let i = 1; i < level; i += 1) {
    total += xpToNextLevel(i);
  }
  return total;
}

export function deriveLevelFromXp(totalXp: number) {
  let level = 1;
  let remaining = totalXp;

  while (level < ECONOMY.account.maxLevel) {
    const need = xpToNextLevel(level);
    if (remaining < need) break;
    remaining -= need;
    level += 1;
  }

  return {
    level,
    currentLevelXp: remaining,
    nextLevelXp: xpToNextLevel(level),
    totalXp,
  };
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}
