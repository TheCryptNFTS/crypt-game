import { useMemo, useState } from "react";
import { ECONOMY, deriveLevelFromXp } from "../economy/progression";

export type AppSection =
  | "home"
  | "play"
  | "collection"
  | "shop"
  | "progression"
  | "profile";

type CardProgress = {
  id: string;
  name: string;
  level: number;
  xp: number;
  mastery: string;
  sealedTier: string;
};

type CommanderProgress = {
  id: string;
  name: string;
  level: number;
  xp: number;
  mastery: string;
  title: string;
};

type QuestItem = {
  id: string;
  title: string;
  xp: number;
  crypt: number;
  progress: number;
  goal: number;
  claimed: boolean;
};

type WalletState = {
  connected: boolean;
  address: string | null;
};

export function useGameAppState() {
  const [section, setSection] = useState<AppSection>("home");
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
  });
  const [showWalletModal, setShowWalletModal] = useState(false);

  const [accountXp] = useState(486_250);
  const [cryptBalance] = useState(18_750);
  const [rank] = useState("Silver II");
  const [seasonLevel] = useState(31);
  const [seasonXp] = useState(92_400);
  const [dailyStreak] = useState(5);
  const [weeklyLoginProgress] = useState(5);
  const [titles] = useState(["Ashbound Duelist", "Smoke-Blessed", "Vault Initiate"]);
  const [nftRewardsEarned] = useState(3);

  const [dailyQuests] = useState<QuestItem[]>([
    {
      id: "dq_1",
      title: "Play 3 Matches",
      xp: 2_000,
      crypt: 300,
      progress: 2,
      goal: 3,
      claimed: false,
    },
    {
      id: "dq_2",
      title: "Win 2 Matches",
      xp: 2_500,
      crypt: 350,
      progress: 1,
      goal: 2,
      claimed: false,
    },
    {
      id: "dq_3",
      title: "Trigger 3 Exact Matches",
      xp: 3_000,
      crypt: 500,
      progress: 3,
      goal: 3,
      claimed: true,
    },
  ]);

  const [weeklyQuests] = useState<QuestItem[]>([
    {
      id: "wq_1",
      title: "Log in 7 Days",
      xp: 6_000,
      crypt: 900,
      progress: 5,
      goal: 7,
      claimed: false,
    },
    {
      id: "wq_2",
      title: "Win 10 Battles",
      xp: 8_000,
      crypt: 1_200,
      progress: 6,
      goal: 10,
      claimed: false,
    },
    {
      id: "wq_3",
      title: "Play 25 Faction Cards",
      xp: 7_000,
      crypt: 1_000,
      progress: 19,
      goal: 25,
      claimed: false,
    },
  ]);

  const [topCards] = useState<CardProgress[]>([
    {
      id: "tcg_1",
      name: "Crypt - Digital Trading Card #1",
      level: 28,
      xp: 46_200,
      mastery: "Ascendant",
      sealedTier: "Sealed Evolution III",
    },
    {
      id: "tcg_90",
      name: "Crypt - Digital Trading Card #90",
      level: 42,
      xp: 73_850,
      mastery: "Sovereign Track",
      sealedTier: "Sealed Evolution III",
    },
    {
      id: "tcg_311",
      name: "Crypt - Digital Trading Card #311",
      level: 12,
      xp: 18_240,
      mastery: "Awakened",
      sealedTier: "Sealed Evolution II",
    },
  ]);

  const [topCommanders] = useState<CommanderProgress[]>([
    {
      id: "cmd_6600",
      name: "Crypt #6600",
      level: 34,
      xp: 84_500,
      mastery: "Legendary Mastery II",
      title: "The Smoke Sovereign",
    },
    {
      id: "cmd_1",
      name: "Crypt #1",
      level: 19,
      xp: 36_200,
      mastery: "Myth Initiate",
      title: "Ash Reader",
    },
  ]);

  const accountProgress = useMemo(() => deriveLevelFromXp(accountXp), [accountXp]);
  const seasonProgress = useMemo(() => deriveLevelFromXp(seasonXp), [seasonXp]);

  const navItems: { id: AppSection; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "play", label: "Play" },
    { id: "collection", label: "Collection" },
    { id: "shop", label: "Shop" },
    { id: "progression", label: "Progression" },
    { id: "profile", label: "Profile" },
  ];

  return {
    section,
    setSection,
    wallet,
    setWallet,
    showWalletModal,
    setShowWalletModal,
    navItems,
    accountProgress,
    seasonProgress,
    cryptBalance,
    rank,
    seasonLevel,
    dailyStreak,
    weeklyLoginProgress,
    titles,
    nftRewardsEarned,
    dailyQuests,
    weeklyQuests,
    topCards,
    topCommanders,
    economy: ECONOMY,
  };
}
