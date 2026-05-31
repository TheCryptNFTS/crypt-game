import { useEffect, useMemo, useState } from "react";
import { GameAppState } from "../domain/types";
import { deriveLevelFromXp } from "../economy/progression";
import { loadAppState, resetAppState, saveAppState } from "./localDb";
import { applyBattleResult, buyShopItem, claimDailyLogin, claimQuest, claimWeeklyChest } from "../services/rewardService";
import { connectAndVerify } from "../nft/walletOwnership";
import { fetchOwnedCardTokenIds } from "../nft/fetchOwnedCards";

export function usePersistentAppState() {
  const [state, setState] = useState<GameAppState>(() => loadAppState());

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  const accountProgress = useMemo(
    () => deriveLevelFromXp(state.profile.accountXp),
    [state.profile.accountXp]
  );

  const seasonProgress = useMemo(
    () => deriveLevelFromXp(state.profile.seasonXp),
    [state.profile.seasonXp]
  );

  return {
    state,
    accountProgress,
    seasonProgress,
    claimDailyLogin: () => setState((prev) => claimDailyLogin(prev)),
    claimQuest: (questId: string) => setState((prev) => claimQuest(prev, questId)),
    claimWeeklyChest: () => setState((prev) => claimWeeklyChest(prev)),
    applyBattleWin: () =>
      setState((prev) =>
        applyBattleResult(prev, {
          won: true,
          exactMatches: 1,
          factionCardsPlayed: 3,
          cardsUsed: ["tcg_1", "tcg_90", "tcg_311"],
          commanderId: "cmd_6600",
        })
      ),
    applyBattleLoss: () =>
      setState((prev) =>
        applyBattleResult(prev, {
          won: false,
          exactMatches: 0,
          factionCardsPlayed: 2,
          cardsUsed: ["tcg_1", "tcg_90"],
          commanderId: "cmd_6600",
        })
      ),
    buyItem: (itemId: string) => setState((prev) => buyShopItem(prev, itemId)),
    resetAll: () => setState(resetAppState()),
    setWalletConnected: (connected: boolean, address: string | null) =>
      setState((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          wallet: { connected, address, combatArchives: null },
        },
      })),
    /** Real connect: prompts the injected wallet and verifies the on-chain
     *  Combat Archives balance. Returns false if no wallet / user rejected. */
    connectWallet: async (): Promise<boolean> => {
      const result = await connectAndVerify();
      if (!result) return false;
      // Resolve the exact owned token ids from the city backend (the contract
      // is not enumerable, so this is the only way to list them). Null on any
      // failure — we store it as-is so the deck builder treats it as unverified.
      const ownedCardTokenIds = await fetchOwnedCardTokenIds(result.address);
      setState((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          wallet: {
            connected: true,
            address: result.address,
            combatArchives: result.combatArchives,
            ownedCardTokenIds,
          },
        },
      }));
      return true;
    },
    disconnectWallet: () =>
      setState((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          wallet: {
            connected: false,
            address: null,
            combatArchives: null,
            ownedCardTokenIds: null,
          },
        },
      })),
  };
}
