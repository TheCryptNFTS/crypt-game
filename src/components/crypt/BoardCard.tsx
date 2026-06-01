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
      style={{
        borderColor: theme.edge,
        boxShadow: theme.shadow
      }}
    >
      <img src={card.imageUrl} alt={card.name} className="crypt-card__image" />

      <div className="crypt-board-top">
        <FactionBadge faction={card.faction} />
        <SyncBadge level={card.syncLevel} label={card.syncLabel} />
      </div>

      <div className="crypt-board-bottom">
        <div className="crypt-card__title">{card.name}</div>

        <div className="crypt-board-stats">
          <div className="crypt-board-stat">
            <span className="crypt-board-stat__k">ATK</span>
            <span className="crypt-board-stat__v">{card.liveStats.attack}</span>
          </div>
          <div className="crypt-board-stat">
            <span className="crypt-board-stat__k">HP</span>
            <span className="crypt-board-stat__v">{card.liveStats.health}</span>
          </div>
          <div className="crypt-board-stat">
            <span className="crypt-board-stat__k">ARM</span>
            <span className="crypt-board-stat__v">{card.liveStats.armor}</span>
          </div>
          <div className="crypt-board-stat">
            <span className="crypt-board-stat__k">SPD</span>
            <span className="crypt-board-stat__v">{card.liveStats.speed}</span>
          </div>
        </div>

        <div className="crypt-board-mods">
          <span>CRIT {card.liveStats.crit}</span>
          <span>UTIL {card.liveStats.utility}</span>
        </div>
      </div>
    </button>
  );
}
