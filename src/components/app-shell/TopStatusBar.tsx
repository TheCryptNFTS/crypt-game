import React from "react";
import { formatNumber } from "../../economy/progression";

type Props = {
  accountLevel: number;
  cryptBalance: number;
  rank: string;
  dailyStreak: number;
  weeklyLoginProgress: number;
  walletConnected: boolean;
  onWalletClick: () => void;
};

export function TopStatusBar(props: Props) {
  return (
    <header className="app-topbar app-topbar--ritual">
      <div className="app-topbar__left">
        <div className="app-topbar__crest">
          <img
            src="/brand/crypt-logo-emboss.png"
            alt="Crypt crest"
            className="app-topbar__crest-img"
          />
        </div>

        <div className="app-status-pill app-status-pill--primary">
          <span className="app-status-pill__k">Account</span>
          <strong className="app-status-pill__v">Lv {props.accountLevel}</strong>
        </div>

        <div className="app-status-pill">
          <span className="app-status-pill__k">$CRYPT</span>
          <strong className="app-status-pill__v">{formatNumber(props.cryptBalance)}</strong>
        </div>

        <div className="app-status-pill">
          <span className="app-status-pill__k">Rank</span>
          <strong className="app-status-pill__v">{props.rank}</strong>
        </div>

        <div className="app-status-pill">
          <span className="app-status-pill__k">Daily Streak</span>
          <strong className="app-status-pill__v">{props.dailyStreak}/7</strong>
        </div>

        <div className="app-status-pill app-status-pill--reward">
          <span className="app-status-pill__k">Weekly NFT</span>
          <strong className="app-status-pill__v">{props.weeklyLoginProgress}/7</strong>
        </div>
      </div>

      <div className="app-topbar__right">
        <div className="app-live-indicator">
          <span className="app-live-indicator__dot" />
          <span>Live Vault</span>
        </div>

        <button className="app-wallet-button app-wallet-button--ritual" onClick={props.onWalletClick}>
          {props.walletConnected ? "Wallet Connected" : "Connect Wallet"}
        </button>
      </div>
    </header>
  );
}
