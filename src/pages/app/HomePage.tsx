import React from "react";
import { formatNumber } from "../../economy/progression";

type Props = {
  accountLevel: number;
  currentLevelXp: number;
  nextLevelXp: number;
  cryptBalance: number;
  dailyStreak: number;
  weeklyLoginProgress: number;
  nftRewardsEarned: number;
  weeklyChestReady: boolean;
  dailyQuests: {
    id: string;
    title: string;
    xp: number;
    crypt: number;
    progress: number;
    goal: number;
    claimed: boolean;
  }[];
  onClaimDailyLogin: () => void;
  onClaimWeeklyChest: () => void;
  onClaimQuest: (questId: string) => void;
};

export function HomePage(props: Props) {
  const xpPercent = props.nextLevelXp
    ? Math.min(100, (props.currentLevelXp / props.nextLevelXp) * 100)
    : 100;

  return (
    <div className="app-page app-page--home">
      <section className="vault-hero vault-hero--branded">
        <div className="vault-hero__bg" />
        <div className="vault-hero__content">
          <div className="vault-hero__eyebrow">Enter the Crypt</div>

          <div className="vault-hero__logo-lockup">
            <img
              src="/brand/crypt-logo-primary.png"
              alt="Crypt"
              className="vault-hero__logo"
            />
          </div>

          <h1 className="vault-hero__title">
            Earn <span>$CRYPT</span>. Climb mastery. Lock the weekly NFT.
          </h1>

          <p className="vault-hero__body">
            A premium collectible war-room:
            daily pressure, weekly relic rewards, sealed evolutions,
            commander prestige, and visible status.
          </p>

          <div className="vault-hero__actions">
            <button className="app-btn app-btn--hero" onClick={props.onClaimDailyLogin}>
              Claim Daily Login
            </button>
            <button
              className="app-btn app-btn--hero-secondary"
              disabled={!props.weeklyChestReady}
              onClick={props.onClaimWeeklyChest}
            >
              {props.weeklyChestReady ? "Claim Weekly Chest" : "Weekly Chest Locked"}
            </button>
          </div>
        </div>

        <div className="vault-hero__right">
          <div className="relic-card relic-card--featured">
            <div className="relic-card__brand">
              <img
                src="/brand/crypt-icon-gold.png"
                alt="Crypt icon"
                className="relic-card__brand-icon"
              />
            </div>

            <span className="relic-card__eyebrow">Weekly Relic Track</span>
            <div className="relic-card__title">
              {props.weeklyChestReady ? "Chest Ready" : "Crypt Relic Chest"}
            </div>
            <div className="relic-card__value">{props.weeklyLoginProgress}/7</div>

            <div className="streak-track streak-track--hero">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={`streak-track__day ${i < props.weeklyLoginProgress ? "is-filled" : ""} ${i === 6 ? "is-nft" : ""}`}
                >
                  {i + 1}
                </div>
              ))}
            </div>

            <p className="relic-card__body">
              Log in every day. On day 7, claim the NFT relic reward chest.
            </p>
          </div>
        </div>
      </section>

      <section className="status-ribbon">
        <div className="status-ribbon__item">
          <span className="status-ribbon__k">Account</span>
          <strong className="status-ribbon__v">Lv {props.accountLevel}</strong>
        </div>
        <div className="status-ribbon__item">
          <span className="status-ribbon__k">$CRYPT</span>
          <strong className="status-ribbon__v">{formatNumber(props.cryptBalance)}</strong>
        </div>
        <div className="status-ribbon__item">
          <span className="status-ribbon__k">Daily Streak</span>
          <strong className="status-ribbon__v">{props.dailyStreak}/7</strong>
        </div>
        <div className="status-ribbon__item">
          <span className="status-ribbon__k">NFT Rewards</span>
          <strong className="status-ribbon__v">{props.nftRewardsEarned}</strong>
        </div>
      </section>

      <div className="app-grid app-grid--home">
        <section className="app-panel app-panel--premium">
          <div className="app-panel__header">
            <h2>Account Progress</h2>
            <span>
              {formatNumber(props.currentLevelXp)} / {formatNumber(props.nextLevelXp)} XP
            </span>
          </div>

          <div className="progress-meter progress-meter--large">
            <div className="progress-meter__fill" style={{ width: `${xpPercent}%` }} />
          </div>

          <div className="premium-copy">
            Big-number progression is deliberate.
            Rewards should feel huge. Costs should feel huge. Pace should still be controlled.
          </div>
        </section>

        <section className="app-panel app-panel--premium">
          <div className="app-panel__header">
            <h2>Daily Objectives</h2>
            <span>Claim real progress</span>
          </div>

          <div className="quest-grid quest-grid--dense">
            {props.dailyQuests.map((quest) => {
              const percent = Math.min(100, (quest.progress / quest.goal) * 100);
              const claimable = quest.progress >= quest.goal && !quest.claimed;

              return (
                <div className="quest-card quest-card--premium" key={quest.id}>
                  <div className="quest-card__top">
                    <strong>{quest.title}</strong>
                    <span>{quest.claimed ? "Claimed" : `${quest.progress}/${quest.goal}`}</span>
                  </div>

                  <div className="progress-meter progress-meter--small">
                    <div className="progress-meter__fill" style={{ width: `${percent}%` }} />
                  </div>

                  <div className="quest-card__rewards">
                    <span>{formatNumber(quest.xp)} XP</span>
                    <span>{formatNumber(quest.crypt)} $CRYPT</span>
                  </div>

                  <button
                    className="app-btn app-btn--claim"
                    disabled={!claimable}
                    onClick={() => props.onClaimQuest(quest.id)}
                  >
                    Claim
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
