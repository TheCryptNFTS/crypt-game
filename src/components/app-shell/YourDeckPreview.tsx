import React, { useMemo } from "react";
import { usePersistentAppState } from "../../store/usePersistentAppState";
import { getOwnedNftCardIds } from "../../nft/getOwnedNftCardIds";
import { buildPlayerDeck } from "../../nft/buildOwnedDeck";
import { allPlayableCards, PlayableCard } from "../../engine/cards";

const CARD_BY_ID: Map<string, PlayableCard> = new Map(
  allPlayableCards.map((card) => [card.id, card]),
);

const TYPE_LABEL: Record<string, string> = {
  unit: "Unit",
  equipment: "Equipment",
  artifact: "Artifact",
};

export function YourDeckPreview() {
  const data = usePersistentAppState();

  const { deck, source, cards } = useMemo(() => {
    const ownedTokenIds = data.state.profile.wallet.ownedCardTokenIds ?? [];
    const ownedCardIds = getOwnedNftCardIds(ownedTokenIds);
    const built = buildPlayerDeck(ownedCardIds);
    const resolved = built.deck
      .map((id) => CARD_BY_ID.get(id))
      .filter((c): c is PlayableCard => !!c);
    return { deck: built.deck, source: built.source, cards: resolved };
  }, [data.state.profile.wallet.ownedCardTokenIds]);

  if (source === "demo") {
    return (
      <section className="app-panel">
        <div className="app-panel__header">
          <h2>Your Deck</h2>
          <span>Built from owned Combat Archives</span>
        </div>
        <p className="muted">
          No owned deck yet — connect a wallet holding Combat Archives to see
          your playable cards. You'll play the demo deck until then.
        </p>
      </section>
    );
  }

  const counts = cards.reduce(
    (acc, card) => {
      if (card.type === "unit") acc.unit += 1;
      else if (card.type === "equipment") acc.equipment += 1;
      else if (card.type === "artifact") acc.artifact += 1;
      return acc;
    },
    { unit: 0, equipment: 0, artifact: 0 },
  );

  return (
    <section className="app-panel">
      <div className="app-panel__header">
        <h2>Your Deck · {deck.length} cards</h2>
        <span>Built from owned Combat Archives</span>
      </div>

      <div className="quest-card__rewards">
        <span>{counts.unit} Units</span>
        <span>{counts.equipment} Equipment</span>
        <span>{counts.artifact} Artifacts</span>
      </div>

      <div className="collection-grid" style={{ marginTop: 14 }}>
        {cards.map((card) => (
          <div className="collection-card" key={card.id}>
            <strong>{card.name}</strong>
            <span>{TYPE_LABEL[card.type] ?? card.type}</span>
            <span>Cost {card.cost}</span>
            <span>
              {card.stats.attack} ATK / {card.stats.health} HP
            </span>
            <span>
              {card.stats.speed} SPD / {card.stats.armor} ARM
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
