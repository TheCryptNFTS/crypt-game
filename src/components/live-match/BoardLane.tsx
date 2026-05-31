import React from "react";
import { BoardCard } from "../crypt/BoardCard";
import { PlayCardVM } from "../../ui/cryptTypes";
import type { DyingUnit, UnitMotion } from "../../hooks/useMatchMotion";

type Props = {
  title: string;
  cards: PlayCardVM[];
  onSelect: (card: PlayCardVM) => void;
  /** Presentation-only motion state from useMatchMotion (all optional). */
  unitMotion?: Record<string, UnitMotion>;
  floats?: { key: number; unitId: string; amount: number }[];
  dying?: DyingUnit[];
};

export function BoardLane({ title, cards, onSelect, unitMotion, floats, dying }: Props) {
  const laneDying = dying ?? [];
  const hasContent = cards.length > 0 || laneDying.length > 0;

  return (
    <section className="live-lane">
      <div className="live-lane__header">
        <h2>{title}</h2>
        <span>{cards.length} in lane</span>
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
