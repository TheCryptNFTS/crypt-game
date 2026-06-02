import React from "react";
import { PlayCardVM } from "../../ui/cryptTypes";
import { factionTheme } from "../../ui/cryptTheme";
import { FactionBadge, SyncBadge } from "./MatchBadges";
import "../../styles/polish-facedown.css";

/** Printed card-back art (public/crypt-assets), served from the site root. */
export const CARD_BACK_SRC = "/crypt-assets/card-back.png";

/**
 * A hand card is a spectator face-down placeholder when its id carries the
 * `spectator_facedown_` prefix (minted in CryptMatchBoard from the redacted
 * neutral view, which has no real card ids). Such VMs have no underlying card
 * meta, so showing their fallback face would leak an empty/placeholder card —
 * we render the printed card-back instead.
 */
function isFaceDown(card: PlayCardVM): boolean {
  return typeof card.id === "string" && card.id.startsWith("spectator_facedown_");
}

type HandCardProps = {
  card: PlayCardVM;
  onSelect?: (card: PlayCardVM) => void;
};

export function HandCard({ card, onSelect }: HandCardProps) {
  const theme = factionTheme[card.faction];

  // Face-down placeholder: render the card-back art only. It is non-interactive
  // (spectator fog of war), so it is a plain div, not a selectable button.
  if (isFaceDown(card)) {
    return (
      <div className="crypt-card crypt-card--hand crypt-card--facedown" aria-label="Face-down card">
        <img src={CARD_BACK_SRC} alt="" aria-hidden="true" className="crypt-card__back-img" />
      </div>
    );
  }

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
