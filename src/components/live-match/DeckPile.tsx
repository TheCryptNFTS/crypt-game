import React from "react";
import { CARD_BACK_SRC } from "../crypt/HandCard";

/**
 * A small presentation-only deck visual: a short stack of card-backs with the
 * remaining-count badge. Purely additive — it reflects a count, never mutates
 * match state and carries no interaction.
 */
type DeckPileProps = {
  /** Cards remaining in this player's deck. */
  count: number;
  /** Short label under the stack (e.g. "Your Deck" / "Enemy Deck"). */
  label: string;
};

export function DeckPile({ count, label }: DeckPileProps) {
  const safeCount = Math.max(0, Math.floor(count ?? 0));
  // Only paint the lower stack layers when there's depth to imply.
  const depth = Math.min(2, safeCount > 1 ? 2 : safeCount > 0 ? 1 : 0);
  const back = `url(${CARD_BACK_SRC})`;

  return (
    <div className="deck-pile" aria-label={`${label}: ${safeCount} cards`}>
      <div className="deck-pile__stack">
        {depth >= 2 ? (
          <div className="deck-pile__stack-card deck-pile__stack-card--2" style={{ backgroundImage: back }} aria-hidden="true" />
        ) : null}
        {depth >= 1 ? (
          <div className="deck-pile__stack-card deck-pile__stack-card--1" style={{ backgroundImage: back }} aria-hidden="true" />
        ) : null}
        <div className="deck-pile__stack-card" style={{ backgroundImage: safeCount > 0 ? back : undefined }} aria-hidden="true" />
        <span className="deck-pile__count">{safeCount}</span>
      </div>
      <span className="deck-pile__label">{label}</span>
    </div>
  );
}
