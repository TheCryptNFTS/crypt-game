import React from "react";
import { PlayCardVM } from "../../ui/cryptTypes";
import { factionTheme } from "../../ui/cryptTheme";
import { FactionBadge, SyncBadge } from "./MatchBadges";

type BoardCardProps = {
  card: PlayCardVM;
  onInspect?: (card: PlayCardVM) => void;
  /** Transient presentation-only motion token from useMatchMotion. */
  motion?: "enter" | "damage" | "attack";
};

export function BoardCard({ card, onInspect, motion }: BoardCardProps) {
  const theme = factionTheme[card.faction];

  const states = [
    card.exhausted ? "exhausted" : "",
    card.damaged ? "damaged" : "",
    card.equipped ? "equipped" : ""
  ].filter(Boolean);
  const stateText = states.length ? `, ${states.join(", ")}` : "";

  return (
    <button
      type="button"
      className={[
        "crypt-card",
        "crypt-card--board",
        card.damaged ? "is-damaged" : "",
        card.exhausted ? "is-exhausted" : "",
        card.equipped ? "is-equipped" : "",
        motion ? `mm-${motion}` : ""
      ].join(" ")}
      onClick={() => onInspect?.(card)}
      aria-label={`${card.name}, ${card.liveStats.attack} attack, ${card.liveStats.health} health, ${card.liveStats.armor} armor, ${card.liveStats.speed} speed${stateText}`}
      style={{
        borderColor: theme.edge,
        boxShadow: theme.shadow
      }}
    >
      <img src={card.imageUrl} alt={card.name} className="crypt-card__image" />
      <div className="crypt-card__scrim" />

      <div className="crypt-board-top">
        <FactionBadge faction={card.faction} />
        <SyncBadge level={card.syncLevel} label={card.syncLabel} />
      </div>

      <div className="crypt-board-bottom">
        <div className="crypt-card__title">{card.name}</div>

        {/* Board minions show only the two combat-relevant stats big — ATK/HP —
            with ARM/SPD as small pips ONLY when they matter (>0). CRIT/UTIL are
            almost always 0 and were pure clutter on a 108px card; they live on
            the full inspect view instead. */}
        <div className="crypt-board-gem">
          <span className="crypt-board-gem__atk">{card.liveStats.attack}</span>
          <span className="crypt-board-gem__sep">/</span>
          <span className="crypt-board-gem__hp">{card.liveStats.health}</span>
        </div>
        {(card.liveStats.armor > 0 || card.liveStats.speed > 0) && (
          <div className="crypt-board-pips">
            {card.liveStats.armor > 0 && <span className="crypt-board-pip crypt-board-pip--arm">{card.liveStats.armor} ARM</span>}
            {card.liveStats.speed > 0 && <span className="crypt-board-pip crypt-board-pip--spd">{card.liveStats.speed} SPD</span>}
          </div>
        )}
      </div>
    </button>
  );
}
