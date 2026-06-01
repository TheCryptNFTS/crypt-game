import React from "react";
import { BoardCard } from "../crypt/BoardCard";
import { PlayCardVM } from "../../ui/cryptTypes";
import type { DyingUnit, UnitMotion } from "../../hooks/useMatchMotion";

type Props = {
  title: string;
  cards: PlayCardVM[];
  onSelect: (card: PlayCardVM) => void;
  /**
   * Affordance highlight driven by the current selection: "deploy" lights the
   * lane as a valid landing spot for the selected hand unit, "target" lights it
   * as a valid attack target for the selected attacker. Presentation-only.
   */
  highlight?: "deploy" | "target" | null;
  /** Short call-to-action shown in the header when the lane is highlighted. */
  hint?: string;
  /** Presentation-only motion state from useMatchMotion (all optional). */
  unitMotion?: Record<string, UnitMotion>;
  floats?: { key: number; unitId: string; amount: number }[];
  dying?: DyingUnit[];
};

export function BoardLane({ title, cards, onSelect, highlight, hint, unitMotion, floats, dying }: Props) {
  const laneDying = dying ?? [];
  const hasContent = cards.length > 0 || laneDying.length > 0;

  return (
    <section className={`live-lane${highlight ? ` live-lane--${highlight}` : ""}`}>
      <div className="live-lane__header">
        <h2>{title}</h2>
        {highlight && hint ? (
          <span className="live-lane__hint" aria-hidden="true">
            {"\u25B8"} {hint}
          </span>
        ) : (
          <span>{cards.length} in lane</span>
        )}
      </div>

      {hasContent ? (
        <div className="live-lane__cards">
          {cards.map((card) => {
            const cardFloats = (floats ?? []).filter((f) => f.unitId === card.id);
            return (
              <div className="live-lane__slot" key={card.id}>
                <BoardCard
                  card={card}
                  onInspect={onSelect}
                  motion={unitMotion?.[card.id]}
                />
                {cardFloats.map((f) => (
                  <span className="mm-float-dmg" key={f.key}>
                    {f.amount}
                  </span>
                ))}
              </div>
            );
          })}

          {/* Dying units linger one beat as a fading ghost (presentation only). */}
          {laneDying.map((d) => (
            <div className="live-lane__slot mm-death-wrap" key={`dead-${d.id}`} aria-hidden="true">
              <BoardCard card={d.vm} />
            </div>
          ))}
        </div>
      ) : (
        <div className="live-lane__empty">
          <span className="live-lane__empty-dot" />
          <span>Lane empty</span>
        </div>
      )}
    </section>
  );
}
