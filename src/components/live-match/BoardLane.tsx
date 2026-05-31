import React from "react";
import { BoardCard } from "../crypt/BoardCard";
import { PlayCardVM } from "../../ui/cryptTypes";

type Props = {
  title: string;
  cards: PlayCardVM[];
  onSelect: (card: PlayCardVM) => void;
};

export function BoardLane({ title, cards, onSelect }: Props) {
  return (
    <section className="live-lane">
      <div className="live-lane__header">
        <h2>{title}</h2>
        <span>{cards.length} in lane</span>
      </div>

      {cards.length ? (
        <div className="live-lane__cards">
          {cards.map((card) => (
            <BoardCard key={card.id} card={card} onInspect={onSelect} />
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
