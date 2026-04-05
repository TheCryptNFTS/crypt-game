import { mockOwnedTokens } from "../lib/mockOwnedTokens";
import { getOwnedNftCards } from "../lib/getOwnedNftCards";

const ownedCards = getOwnedNftCards(mockOwnedTokens);

export default function NftDeckScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a12",
        color: "white",
        padding: "32px",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "40px", marginBottom: "12px" }}>Crypt NFT Deck</h1>

        <div style={{ color: "#9aa0ff", marginBottom: "24px", fontSize: "18px" }}>
          Wallet tokens: {mockOwnedTokens.join(", ")}
        </div>

        <div style={{ color: "#b8b8c7", marginBottom: "32px", fontSize: "16px" }}>
          Owned playable NFT cards: {ownedCards.length}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "20px"
          }}
        >
          {ownedCards.map((card) => {
            return (
              <div
                key={card.id}
                style={{
                  background: "#151522",
                  border: "1px solid #2a2a3a",
                  borderRadius: "16px",
                  padding: "16px",
                  boxShadow: "0 0 20px rgba(0,0,0,0.25)"
                }}
              >
                <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
                  {card.name}
                </div>

                <div style={{ marginBottom: "8px", color: "#9aa0ff" }}>
                  {card.id}
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <strong>Faction:</strong> {card.faction}
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <strong>Rarity:</strong> {card.rarity}
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <strong>Cost:</strong> {card.cost}
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <strong>Attack:</strong> {card.stats.attack}
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <strong>Health:</strong> {card.stats.health}
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <strong>Armor:</strong> {card.stats.armor}
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <strong>Speed:</strong> {card.stats.speed}
                </div>

                <div>
                  <strong>Keywords:</strong>{" "}
                  {card.keywords.length > 0 ? card.keywords.join(", ") : "None"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
