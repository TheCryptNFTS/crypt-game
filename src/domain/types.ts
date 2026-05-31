export type AppSection =
  | "home"
  | "play"
  | "collection"
  | "shop"
  | "progression"
  | "profile";

export type WalletState = {
  connected: boolean;
  address: string | null;
  /** On-chain Combat Archives (crypttradingcards) balance, verified through
   *  the player's own wallet. null = unknown/unverified (never a false zero). */
  combatArchives?: number | null;
  /** Owned Combat Archives token ids, resolved via the FREELON CITY backend
   *  (the contract is not enumerable). Used to build the player's real deck.
   *  null/undefined = unverified. */
  ownedCardTokenIds?: string[] | null;
};

export type RewardLedgerEntry = {
  id: string;
  source:
    | "daily_login"
    | "first_win"
    | "battle_win"
    | "battle_loss"
    | "daily_quest"
    | "weekly_quest"
    | "weekly_chest"
    | "shop_purchase";
  xp: number;
  crypt: number;
  timestamp: string;
  note: string;
};

export type QuestKind = "daily" | "weekly";

export type Quest = {
  id: string;
  kind: QuestKind;
  title: string;
  xp: number;
  crypt: number;
  progress: number;
  goal: number;
  claimed: boolean;
};

export type CardProgress = {
  id: string;
  name: string;
  level: number;
  xp: number;
  mastery: string;
  sealedTier: string;
};

export type CommanderProgress = {
  id: string;
  name: string;
  level: number;
  xp: number;
  mastery: string;
  title: string;
};

export type UserProfile = {
  username: string;
  wallet: WalletState;
  accountXp: number;
  seasonXp: number;
  cryptBalance: number;
  rank: string;
  dailyStreak: number;
  weeklyLoginProgress: number;
  weeklyChestReady: boolean;
  nftRewardsEarned: number;
  lastLoginDate: string | null;
  titles: string[];
  topCards: CardProgress[];
  topCommanders: CommanderProgress[];
};

export type ShopItem = {
  id: string;
  name: string;
  tag: string;
  cost: number;
  description: string;
};

export type BattleResult = {
  won: boolean;
  exactMatches: number;
  factionCardsPlayed: number;
  cardsUsed: string[];
  commanderId: string;
};

export type GameAppState = {
  profile: UserProfile;
  dailyQuests: Quest[];
  weeklyQuests: Quest[];
  rewardLedger: RewardLedgerEntry[];
  shopItems: ShopItem[];
};
