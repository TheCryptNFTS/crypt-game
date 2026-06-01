import React, { useMemo, useState } from "react";
import { handToVm } from "../../game-ui/liveMatchAdapter";
import { PlayCardVM } from "../../ui/cryptTypes";

/**
 * OPENING MULLIGAN SCREEN (PART 1, UI). Rendered by the solo match page while the
 * explicit mulligan phase is open (`useLocalCryptMatch().mulliganPhaseActive`).
 *
 * The player taps cards in their opening hand to toggle them for REDRAW, then
 * confirms. Confirming dispatches the phase-aware `MULLIGAN { cards }` action via
 * the hook's `resolveMulligan(indices)`; because the local hook opens the phase
 * for P1 only, the AI opponent is already resolved, so this single confirmation
 * starts the match. Empty selection = "keep all".
 *
 * Self-contained on purpose: it renders lightweight card tiles directly from the
 * `handToVm` view-model (name / cost / faction) rather than the full board
 * `HandCard`, so the screen compiles and behaves independently of the in-match
 * card renderer.
 */
type Props = {
  /** P1's opening-hand card ids, in order (index === redraw index). */
  hand: string[];
  /** Live match object (for `handToVm` to resolve names/costs/factions). */
  match: any;
  /** Resolve the phase: `indices` are the hand slots to redraw (empty = keep). */
  onResolve: (indices: number[]) => void;
};

export function MulliganScreen({ hand, match, onResolve }: Props) {
  // Set of opening-hand INDICES the player has marked for redraw.
  const [redraw, setRedraw] = useState<Set<number>>(new Set());

  const cards: PlayCardVM[] = useMemo(
    () => hand.map((cardId) => handToVm(match, "P1", cardId, false)),
    [hand, match]
  );

  const toggle = (index: number) => {
    setRedraw((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const redrawCount = redraw.size;
  const confirm = () => onResolve([...redraw].sort((a, b) => a - b));

  return (
    <section className="mulligan-screen" role="dialog" aria-label="Opening mulligan">
      <div className="mulligan-screen__head">
        <h2 className="mulligan-screen__title">Opening Signal</h2>
        <p className="mulligan-screen__prompt">
          Tap any cards you want to swap out, then lock in. Selected cards are
          shuffled back and redrawn — keep your hand by selecting none.
        </p>
      </div>

      <div className="mulligan-screen__rail">
        {cards.map((card, index) => {
          const marked = redraw.has(index);
          return (
            <button
              key={`${card.id}-${index}`}
              type="button"
              className={`mulligan-card mulligan-card--${card.faction.toLowerCase()}${
                marked ? " mulligan-card--redraw" : ""
              }`}
              aria-pressed={marked}
              onClick={() => toggle(index)}
            >
              <span className="mulligan-card__cost">{card.baseStats.cost}</span>
              <span className="mulligan-card__name">{card.name}</span>
              <span className="mulligan-card__kind">{card.kind}</span>
              <span className="mulligan-card__flag">{marked ? "Redraw" : "Keep"}</span>
            </button>
          );
        })}
      </div>

      <div className="mulligan-screen__actions">
        <span className="mulligan-screen__count">
          {redrawCount === 0
            ? "Keeping full hand"
            : `Redrawing ${redrawCount} card${redrawCount === 1 ? "" : "s"}`}
        </span>
        <button className="live-btn live-btn--primary" type="button" onClick={confirm}>
          {redrawCount === 0 ? "Keep Hand" : "Confirm Mulligan"}
        </button>
      </div>
    </section>
  );
}
