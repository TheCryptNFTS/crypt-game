import React from "react";
import { PlayCardVM } from "../../ui/cryptTypes";
import { factionTheme } from "../../ui/cryptTheme";
import { FactionBadge, SyncBadge } from "./MatchBadges";

type HandCardProps = {
  card: PlayCardVM;
  onSelect?: (card: PlayCardVM) => void;
};

export function HandCard({ card, onSelect }: HandCardProps) {
  const theme = factionTheme[card.faction];

  return (
    <button
      type="button"
      className={`crypt-card crypt-card--hand ${card.selected ? "is-selected" : ""}`}
      onClick={() => onSelect?.(card)}
      style={{
        borderColor: theme.edge,
        boxShadow: theme.shadow
      }}
    >
      <div className="crypt-card__frame">
        <img src={card.imageUrl} alt={card.name} className="crypt-card__image" />
        <div className="crypt-card__scrim" />
      </div>

      <div className="crypt-card__overlay crypt-card__overlay--top">
        <div className="crypt-card__cost">{card.liveStats.cost ?? 0}</div>
        <SyncBadge level={card.syncLevel} label={card.syncLabel} />
      </div>

      <div className="crypt-card__overlay crypt-card__overlay--bottom">
        <div className="crypt-card__meta">
          <FactionBadge faction={card.faction} />
          <span className="crypt-card__kind">{card.kind}</span>
        </div>

        <div className="crypt-card__title">{card.name}</div>

        <div className="crypt-stat-strip">
          <span>ATK {card.liveStats.attack}</span>
          <span>HP {card.liveStats.health}</span>
          <span>ARM {card.liveStats.armor}</span>
          <span>SPD {card.liveStats.speed}</span>
        </div>
      </div>
    </button>
  );
}
