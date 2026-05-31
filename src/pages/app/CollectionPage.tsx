import React from "react";
import { CardCosmeticTier, formatNumber } from "../../economy/progression";
import { YourDeckPreview } from "../../components/app-shell/YourDeckPreview";

type CardItem = {
  id: string;
  name: string;
  level: number;
  xp: number;
  mastery: string;
  sealedTier: string;
};

type Props = {
  cards: CardItem[];
  cosmeticTiers: CardCosmeticTier[];
};

export function CollectionPage(props: Props) {
  return (
    <div className="app-page">
      <YourDeckPreview />

      <section className="app-panel">
        <div className="app-panel__header">
          <h1>Collection</h1>
          <span>Cards should level up. Ranked stats should stay fair.</span>
        </div>

        <div className="collection-grid">
          {props.cards.map((card) => (
            <div className="collection-card" key={card.id}>
              <div className="collection-card__art">CRYPT</div>
              <strong>{card.name}</strong>
              <span>Level {card.level}</span>
              <span>{formatNumber(card.xp)} XP</span>
              <span>{card.mastery}</span>
              <span>{card.sealedTier}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel">
        <div className="app-panel__header">
          <h2>Sealed Cosmetic Evolution Path</h2>
          <span>Mystery first. Visual flex later.</span>
        </div>

        <div className="quest-grid">
          {props.cosmeticTiers.map((tier) => (
            <div className="quest-card" key={tier.levelRequired}>
              <div className="quest-card__top">
                <strong>{tier.name}</strong>
                <span>Lv {tier.levelRequired}</span>
              </div>
              <p className="muted">{tier.statusLabel}</p>
              <div className="quest-card__rewards">
                <span>{formatNumber(tier.cryptActivationCost)} $CRYPT</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
