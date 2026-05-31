import React from "react";
import { AppSidebar } from "../components/app-shell/AppSidebar";
import { TopStatusBar } from "../components/app-shell/TopStatusBar";
import { WalletModal } from "../components/app-shell/WalletModal";
import { useGameAppState } from "../app-state/useGameAppState";
import { usePersistentAppState } from "../store/usePersistentAppState";
import { getOwnedNftCardIds } from "../nft/getOwnedNftCardIds";
import { HomePage } from "../pages/app/HomePage";
import { CollectionPage } from "../pages/app/CollectionPage";
import { ShopPage } from "../pages/app/ShopPage";
import { ProgressionPage } from "../pages/app/ProgressionPage";
import { ProfilePage } from "../pages/app/ProfilePage";
import LiveCryptMatchPage from "../pages/LiveCryptMatchPage";
import "../styles/app-shell.css";

export default function AppShell() {
  const ui = useGameAppState();
  const data = usePersistentAppState();

  // The connected wallet's owned Combat Archives token ids → playable card ids
  // (`tcg_<tokenId>`). Fed to the live match so your NFTs become your deck.
  const ownedTokenIds = data.state.profile.wallet.ownedCardTokenIds ?? [];
  const ownedCardIds = getOwnedNftCardIds(ownedTokenIds);

  return (
    <div className="app-shell">
      <AppSidebar
        current={ui.section}
        items={ui.navItems}
        onNavigate={ui.setSection}
      />

      <div className="app-shell__main">
        <TopStatusBar
          accountLevel={data.accountProgress.level}
          cryptBalance={data.state.profile.cryptBalance}
          rank={data.state.profile.rank}
          dailyStreak={data.state.profile.dailyStreak}
          weeklyLoginProgress={data.state.profile.weeklyLoginProgress}
          walletConnected={data.state.profile.wallet.connected}
          onWalletClick={() => ui.setShowWalletModal(true)}
        />

        <div className="hero-panel__actions" style={{ marginTop: 18 }}>
          <button onClick={data.claimDailyLogin}>Simulate Daily Login</button>
          <button className="is-secondary" onClick={data.applyBattleWin}>Simulate Battle Win</button>
          <button className="is-secondary" onClick={data.applyBattleLoss}>Simulate Battle Loss</button>
          <button className="is-secondary" onClick={data.resetAll}>Reset Local App Data</button>
        </div>

        <div className="app-shell__content">
          {ui.section === "home" ? (
            <HomePage
              accountLevel={data.accountProgress.level}
              currentLevelXp={data.accountProgress.currentLevelXp}
              nextLevelXp={data.accountProgress.nextLevelXp}
              cryptBalance={data.state.profile.cryptBalance}
              dailyStreak={data.state.profile.dailyStreak}
              weeklyLoginProgress={data.state.profile.weeklyLoginProgress}
              nftRewardsEarned={data.state.profile.nftRewardsEarned}
              weeklyChestReady={data.state.profile.weeklyChestReady}
              dailyQuests={data.state.dailyQuests}
              onClaimDailyLogin={data.claimDailyLogin}
              onClaimWeeklyChest={data.claimWeeklyChest}
              onClaimQuest={data.claimQuest}
            />
          ) : null}

          {ui.section === "play" ? (
            <LiveCryptMatchPage
              ownedCardIds={ownedCardIds}
              walletAddress={data.state.profile.wallet.address}
            />
          ) : null}

          {ui.section === "collection" ? (
            <CollectionPage
              cards={data.state.profile.topCards}
              cosmeticTiers={ui.economy.cosmeticTiers}
            />
          ) : null}

          {ui.section === "shop" ? (
            <ShopPage
              cryptBalance={data.state.profile.cryptBalance}
              items={data.state.shopItems}
              onBuy={data.buyItem}
            />
          ) : null}

          {ui.section === "progression" ? (
            <ProgressionPage
              accountLevel={data.accountProgress.level}
              accountXp={data.accountProgress.currentLevelXp}
              nextLevelXp={data.accountProgress.nextLevelXp}
              seasonLevel={ui.seasonLevel}
              seasonXp={data.seasonProgress.currentLevelXp}
              nextSeasonXp={data.seasonProgress.nextLevelXp}
              commanders={data.state.profile.topCommanders}
              cosmeticTiers={ui.economy.cosmeticTiers}
            />
          ) : null}

          {ui.section === "profile" ? (
            <ProfilePage
              accountLevel={data.accountProgress.level}
              rank={data.state.profile.rank}
              cryptBalance={data.state.profile.cryptBalance}
              titles={data.state.profile.titles}
              nftRewardsEarned={data.state.profile.nftRewardsEarned}
              walletConnected={data.state.profile.wallet.connected}
              walletAddress={data.state.profile.wallet.address}
              topCommanderName={data.state.profile.topCommanders[0]?.name ?? "None"}
              topCardName={data.state.profile.topCards[0]?.name ?? "None"}
              combatArchives={data.state.profile.wallet.combatArchives ?? null}
              onConnectWallet={() => data.connectWallet()}
              onDisconnectWallet={() => data.disconnectWallet()}
            />
          ) : null}
        </div>
      </div>

      <WalletModal
        open={ui.showWalletModal}
        connected={data.state.profile.wallet.connected}
        address={data.state.profile.wallet.address}
        combatArchives={data.state.profile.wallet.combatArchives ?? null}
        onClose={() => ui.setShowWalletModal(false)}
        onConnect={() => data.connectWallet()}
        onDisconnect={() => data.disconnectWallet()}
      />
    </div>
  );
}
