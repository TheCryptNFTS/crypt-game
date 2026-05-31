import React from "react";
import { CardCosmeticTier, formatNumber } from "../../economy/progression";

type CommanderItem = {
  id: string;
  name: string;
  level: number;
  xp: number;
  mastery: string;
  title: string;
};

type Props = {
  accountLevel: number;
  accountXp: number;
  nextLevelXp: number;
  seasonLevel: number;
  seasonXp: number;
  nextSeasonXp: number;
  commanders: CommanderItem[];
  cosmeticTiers: CardCosmeticTier[];
};

export function ProgressionPage(props: Props) {
  const accountPercent = props.nextLevelXp
    ? Math.min(100, (props.accountXp / props.nextLevelXp) * 100)
    : 100;
  const seasonPercent = props.nextSeasonXp
    ? Math.min(100, (props.seasonXp / props.nextSeasonXp) * 100)
    : 100;

  return (
    <div className="app-page">
      <div className="app-grid app-grid--two">
        <section className="app-panel">
          <div className="app-panel__header">
            <h2>Account Ladder</h2>
            <span>Target: Level 100 in ~90 days</span>
          </div>
          <div className="hero-stat">
            <span>Level</span>
            <strong>{props.accountLevel}</strong>
          </div>
          <div className="progress-meter">
            <div className="progress-meter__fill" style={{ width: `${accountPercent}%` }} />
          </div>
          <p className="muted">
            {formatNumber(props.accountXp)} / {formatNumber(props.nextLevelXp)} XP to next level
          </p>
        </section>

        <section className="app-panel">
          <div className="app-panel__header">
            <h2>Season Track</h2>
            <span>Battle pass style retention without cheapness</span>
          </div>
          <div className="hero-stat">
            <span>Season Level</span>
            <strong>{props.seasonLevel}</strong>
          </div>
          <div className="progress-meter">
            <div className="progress-meter__fill" style={{ width: `${seasonPercent}%` }} />
          </div>
          <p className="muted">
            {formatNumber(props.seasonXp)} / {formatNumber(props.nextSeasonXp)} XP to next season tier
          </p>
        </section>
      </div>

      <section className="app-panel">
        <div className="app-panel__header">
          <h2>Commander Mastery</h2>
          <span>These should feel elite, not generic</span>
        </div>

        <div className="quest-grid">
          {props.commanders.map((commander) => (
            <div className="quest-card" key={commander.id}>
              <div className="quest-card__top">
                <strong>{commander.name}</strong>
                <span>Lv {commander.level}</span>
              </div>
              <p className="muted">{commander.mastery}</p>
              <div className="quest-card__rewards">
                <span>{formatNumber(commander.xp)} XP</span>
                <span>{commander.title}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel">
        <div className="app-panel__header">
          <h2>Locked Cosmetic Roadmap</h2>
          <span>Unknown forms should feel sealed, not unfinished</span>
        </div>

        <div className="quest-grid">
          {props.cosmeticTiers.map((tier) => (
            <div className="quest-card" key={tier.levelRequired}>
              <div className="quest-card__top">
                <strong>{tier.statusLabel}</strong>
                <span>Lv {tier.levelRequired}</span>
              </div>
              <p className="muted">{tier.name}</p>
              <div className="quest-card__rewards">
                <span>{formatNumber(tier.cryptActivationCost)} $CRYPT</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
