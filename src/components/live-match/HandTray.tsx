import React from "react";
import { HandCard } from "../crypt/HandCard";
import { PlayCardVM } from "../../ui/cryptTypes";

type Props = {
  cards: PlayCardVM[];
  onSelect: (card: PlayCardVM) => void;
};

export function HandTray({ cards, onSelect }: Props) {
  return (
    <section className="live-hand">
      <div className="live-hand__header">
        <h2>Hand</h2>
        <span>{cards.length} cards</span>
      </div>

      <div className="live-hand__rail">
        {cards.map((card) => (
          <div className="live-hand__item" key={card.id}>
            <HandCard card={card} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </section>
  );
}
