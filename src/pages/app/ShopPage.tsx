import React from "react";
import { formatNumber } from "../../economy/progression";

type Props = {
  cryptBalance: number;
  items: {
    id: string;
    name: string;
    tag: string;
    cost: number;
    description: string;
  }[];
  onBuy: (itemId: string) => void;
};

export function ShopPage(props: Props) {
  return (
    <div className="app-page">
      <section className="app-panel">
        <div className="app-panel__header">
          <h1>Shop</h1>
          <span>Big sinks. Controlled economy. No cheap clutter.</span>
        </div>

        <div className="hero-panel__stats">
          <div className="hero-stat">
            <span>Balance</span>
            <strong>{formatNumber(props.cryptBalance)} $CRYPT</strong>
          </div>
        </div>

        <div className="collection-grid">
          {props.items.map((item) => (
            <div className="collection-card" key={item.id}>
              <div className="collection-card__art">{item.tag}</div>
              <strong>{item.name}</strong>
              <span>{item.description}</span>
              <span>{formatNumber(item.cost)} $CRYPT</span>
              <button className="shop-buy" onClick={() => props.onBuy(item.id)}>
                Acquire
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
