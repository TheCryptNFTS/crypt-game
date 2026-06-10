import React from "react";
import { PlayCardVM } from "../../ui/cryptTypes";
import { factionTheme } from "../../ui/cryptTheme";
import { SyncBadge } from "./MatchBadges";
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

  const { cost, attack, health, armor, speed } = card.liveStats;

  return (
    <button
      type="button"
      className={`crypt-card crypt-card--hand ${card.selected ? "is-selected" : ""}`}
      onClick={() => onSelect?.(card)}
      aria-pressed={card.selected ?? false}
      aria-label={`Play ${card.name}, ${card.kind}, cost ${cost ?? 0}, ${attack} attack, ${health} health, ${armor} armor, ${speed} speed`}
      style={{ "--cf-edge": theme.edge, "--cf-glow": theme.glow } as React.CSSProperties}
    >
      {/* ART — clean square. Cost orb is the only thing on it (top-left), the
          universal TCG convention; everything else lives in the sill below. */}
      <div className="crypt-card__art">
        <img src={card.imageUrl} alt={card.name} className="crypt-card__image" />
        <span className="crypt-card__cost-orb">{cost ?? 0}</span>
        {card.syncLabel ? (
          <span className="crypt-card__sync-corner">
            <SyncBadge level={card.syncLevel} label={card.syncLabel} />
          </span>
        ) : null}
      </div>

      {/* SILL — name + stats below the art, never over it. */}
      <div className="crypt-card__sill">
        <div className="crypt-card__name" title={card.name}>{card.name}</div>
        <div className="crypt-card__statline">
          <span className="crypt-cs crypt-cs--atk" title="Attack">{attack}</span>
          <span className="crypt-cs crypt-cs--hp" title="Health">{health}</span>
          {armor > 0 && <span className="crypt-pip crypt-pip--arm" title="Armor">{armor} ARM</span>}
          {speed > 0 && <span className="crypt-pip crypt-pip--spd" title="Speed">{speed} SPD</span>}
        </div>
      </div>
    </button>
  );
}
