import React from "react";
import { formatNumber } from "../../economy/progression";
import { YourDeckPreview } from "../../components/app-shell/YourDeckPreview";

type Props = {
  accountLevel: number;
  rank: string;
  cryptBalance: number;
  titles: string[];
  nftRewardsEarned: number;
  walletConnected: boolean;
  walletAddress: string | null;
  combatArchives: number | null;
  topCommanderName: string;
  topCardName: string;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
};

export function ProfilePage(props: Props) {
  return (
    <div className="app-page">
      <section className="hero-panel">
        <div>
          <span className="hero-panel__eyebrow">Profile</span>
          <h1>Identity. Ownership. Status.</h1>
          <p>
            This should feel like a flex page:
            level, rank, wallet proof, rare rewards, titles,
            and your strongest commander/card progression.
          </p>

          <div className="hero-panel__actions">
            {!props.walletConnected ? (
              <button onClick={props.onConnectWallet}>Connect Wallet</button>
            ) : (
              <button onClick={props.onDisconnectWallet}>Disconnect Wallet</button>
            )}
          </div>
        </div>

        <div className="hero-panel__stats">
          <div className="hero-stat">
            <span>Account</span>
            <strong>Lv {props.accountLevel}</strong>
          </div>
          <div className="hero-stat">
            <span>Rank</span>
            <strong>{props.rank}</strong>
          </div>
          <div className="hero-stat">
            <span>$CRYPT</span>
            <strong>{formatNumber(props.cryptBalance)}</strong>
          </div>
          <div className="hero-stat">
            <span>NFT Rewards</span>
            <strong>{props.nftRewardsEarned}</strong>
          </div>
        </div>
      </section>

      <div className="app-grid app-grid--two">
        <section className="app-panel">
          <div className="app-panel__header">
            <h2>Wallet</h2>
            <span>Ownership and claim proof</span>
          </div>
          <p className="muted">
            Status: {props.walletConnected ? "Connected" : "Not Connected"}
          </p>
          <p className="muted">
            {props.walletAddress ?? "Connect wallet to claim NFT rewards and prove ownership."}
          </p>
          {props.walletConnected ? (
            <p className="muted">
              Combat Archives:{" "}
              {props.combatArchives === null
                ? "Unverified — switch to Ethereum mainnet to verify on-chain"
                : `${props.combatArchives} held (verified on-chain)`}
            </p>
          ) : null}
        </section>

        <section className="app-panel">
          <div className="app-panel__header">
            <h2>Flex</h2>
            <span>Strongest identity markers</span>
          </div>
          <p className="muted">Top Commander: {props.topCommanderName}</p>
          <p className="muted">Top Card: {props.topCardName}</p>
          <div className="quest-card__rewards">
            {props.titles.map((title) => (
              <span key={title}>{title}</span>
            ))}
          </div>
        </section>
      </div>

      <YourDeckPreview />
    </div>
  );
}
