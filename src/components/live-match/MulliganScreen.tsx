import React, { useMemo, useState } from "react";
import { handToVm, getCommanderVmForPlayer } from "../../game-ui/liveMatchAdapter";
import { PlayCardVM } from "../../ui/cryptTypes";
import { HandCard } from "../crypt/HandCard";

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

  // The commander deals the opening hand — name it so the ritual is led by YOUR
  // collectible hero, matching the VersusIntro / WinCeremony framing.
  const commanderName = useMemo(() => {
    try {
      return getCommanderVmForPlayer(match.players.P1)?.name ?? null;
    } catch {
      return null;
    }
  }, [match]);

  // Opening-hand cost curve — count of cards at each energy cost, so "is this a
  // good keep?" is legible at a glance without any rules text. Bars are scaled to
  // the tallest column; a clamped 0..7 range covers the curve cleanly.
  const curve = useMemo(() => {
    const max = 7;
    const counts = Array.from({ length: max + 1 }, () => 0);
    for (const c of cards) {
      const cost = Math.max(0, Math.min(max, c.baseStats.cost ?? 0));
      counts[cost] += 1;
    }
    const peak = Math.max(1, ...counts);
    return { counts, peak };
  }, [cards]);

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
        <span className="mulligan-screen__kicker">
          <span className="mulligan-screen__glyph">{"\u2B22"}</span> Opening Hand
        </span>
        <h2 className="mulligan-screen__title">The Opening Signal</h2>
        <p className="mulligan-screen__prompt">
          {commanderName ? (
            <>Dealt by <strong>{commanderName}</strong>. </>
          ) : null}
          Tap any cards you want to swap out, then lock in — selected cards are
          shuffled back and redrawn. Keep your hand by selecting none.
        </p>
      </div>

      <div className="mulligan-screen__rail" role="group" aria-label="Opening hand">
        {cards.map((card, index) => {
          const marked = redraw.has(index);
          return (
            <div
              key={`${card.id}-${index}`}
              className={`mulligan-slot${marked ? " mulligan-slot--redraw" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={marked}
              aria-label={`${card.name}, ${card.kind}, cost ${card.baseStats.cost}. ${
                marked ? "Marked for redraw" : "Keeping"
              }. Activate to toggle.`}
              onClick={() => toggle(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(index);
                }
              }}
            >
              {/* Real card with art + faction frame. onSelect is a no-op here —
                  the wrapping slot owns the redraw toggle. */}
              <HandCard card={card} />
              <span className="mulligan-slot__flag">{marked ? "↺ Redraw" : "Keep"}</span>
            </div>
          );
        })}
      </div>

      {/* Cost curve — opening-hand shape at a glance (count of cards per energy
          cost), so a newcomer can read "do I have early plays?" without rules. */}
      <div className="mulligan-curve" aria-hidden="true">
        {curve.counts.map((n, cost) => (
          <div className="mulligan-curve__col" key={cost} title={`${n} card${n === 1 ? "" : "s"} at cost ${cost}`}>
            <div className="mulligan-curve__bar-wrap">
              <div
                className={`mulligan-curve__bar${n === 0 ? " mulligan-curve__bar--empty" : ""}`}
                style={{ height: `${(n / curve.peak) * 100}%` }}
              />
            </div>
            <span className="mulligan-curve__n">{n || ""}</span>
            <span className="mulligan-curve__cost">{cost}</span>
          </div>
        ))}
      </div>

      <div className="mulligan-screen__actions">
        <span className="mulligan-screen__count" role="status" aria-live="polite">
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
