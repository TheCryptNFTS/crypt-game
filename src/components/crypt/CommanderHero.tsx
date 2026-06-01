import React from "react";
import { CommanderVM } from "../../ui/cryptTypes";
import { factionTheme, rarityClassName } from "../../ui/cryptTheme";
import { FactionBadge, RarityBadge } from "./MatchBadges";

type CommanderHeroProps = {
  commander: CommanderVM;
  activeSyncText?: string;
};

export function CommanderHero({ commander, activeSyncText }: CommanderHeroProps) {
  const theme = factionTheme[commander.faction];

  return (
    <section
      className="crypt-commander-hero"
      style={{
        borderColor: theme.edge,
        boxShadow: theme.shadow
      }}
    >
      <div
        className="crypt-commander-hero__glow"
        style={{
          background: `radial-gradient(circle at 50% 20%, ${theme.glow}, transparent 65%)`
        }}
      />

      <div className="crypt-commander-hero__image-wrap">
        <img
          src={commander.imageUrl}
          alt={commander.name}
          className="crypt-commander-hero__image"
        />
        <div className={rarityClassName(commander.rarityLabel)}>{commander.rarityLabel}</div>
      </div>

      <div className="crypt-commander-hero__content">
        <div className="crypt-commander-hero__topline">
          <FactionBadge faction={commander.faction} />
          <RarityBadge label={commander.rarityLabel} />
        </div>

        <h1 className="crypt-commander-hero__title">{commander.name}</h1>
        <p className="crypt-commander-hero__headline">{commander.headline}</p>

        <div className="crypt-commander-hero__callouts">
          <div className="crypt-callout">
            <span className="crypt-callout__label">Doctrine</span>
            <span className="crypt-callout__value">{commander.doctrine}</span>
          </div>

          <div className="crypt-callout">
            <span className="crypt-callout__label">Battlefield</span>
            <span className="crypt-callout__value">{commander.battleCallout}</span>
          </div>

          {activeSyncText ? (
            <div className="crypt-callout crypt-callout--sync">
              <span className="crypt-callout__label">Live Sync</span>
              <span className="crypt-callout__value">{activeSyncText}</span>
            </div>
          ) : null}
        </div>

        <div className="crypt-commander-hero__traits">
          {Object.entries(commander.traits).map(([key, value]) => (
            <div className="crypt-trait-chip" key={`${key}-${value}`}>
              <span className="crypt-trait-chip__k">{key}</span>
              <span className="crypt-trait-chip__v">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
