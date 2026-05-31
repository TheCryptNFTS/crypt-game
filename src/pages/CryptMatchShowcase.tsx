import React, { useMemo, useState } from "react";
import "../styles/crypt-match.css";
import { CommanderHero } from "../components/crypt/CommanderHero";
import { HandCard } from "../components/crypt/HandCard";
import { BoardCard } from "../components/crypt/BoardCard";
import { InspectDrawer } from "../components/crypt/InspectDrawer";
import { CommanderVM, InspectState, PlayCardVM } from "../ui/cryptTypes";

const safeImage = "data:image/svg+xml;utf8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0a0d12"/>
      <stop offset="100%" stop-color="#121826"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1100" fill="url(#g)"/>
  <rect x="24" y="24" width="752" height="1052" rx="34" fill="none" stroke="#8D5CFF" stroke-opacity="0.35" stroke-width="4"/>
  <circle cx="400" cy="360" r="140" fill="#0d1320" stroke="#f0d24f" stroke-opacity="0.45" stroke-width="4"/>
  <text x="400" y="380" text-anchor="middle" fill="#eef2f8" font-size="84" font-family="Arial, sans-serif">CRYPT</text>
  <text x="400" y="510" text-anchor="middle" fill="#93a0b5" font-size="32" font-family="Arial, sans-serif">SAFE PREVIEW ASSET</text>
  <text x="400" y="565" text-anchor="middle" fill="#93a0b5" font-size="24" font-family="Arial, sans-serif">No local screenshots loaded</text>
</svg>
`);

const commander: CommanderVM = {
  id: "cmd_6600",
  name: "Crypt #6600",
  faction: "SILVER",
  imageUrl: safeImage,
  rarityLabel: "Legendary",
  traits: {
    Eyes: "Unimaginable",
    Mouth: "Smoke Bomb",
    Skins: "Ornate",
    Headwears: "Jackson",
    Backgrounds: "Smokey Canary Diamond",
    Legendary: "Legendary"
  },
  headline: "Prestige commander with exact-trait spike pressure and premium battlefield gravity.",
  doctrine: "Legendary lanes should amplify identity, not just inflate numbers.",
  battleCallout: "Silver Sentinels pressure through precision, tempo, and cold visual authority."
};

function makeCard(
  id: string,
  name: string,
  kind: "unit" | "equipment" | "artifact",
  syncLabel: string,
  syncLevel: "exact" | "category" | "legendary",
  cost: number,
  attack: number,
  health: number,
  armor: number,
  speed: number,
  crit: number,
  utility: number
): PlayCardVM {
  return {
    id,
    name,
    faction: "SILVER",
    kind,
    imageUrl: safeImage,
    syncLevel,
    syncLabel,
    traits: {
      Mouth: "Smoke Bomb",
      Faction: "Silver Sentinels"
    },
    baseStats: { attack, health, armor, speed, crit: 0, utility: 0, cost },
    liveStats: { attack, health, armor, speed, crit, utility, cost },
    keywords: kind === "unit" ? ["CRUSH", "GUARD", "COMMAND"] : [],
    commanderTags: ["precision", "silver", "smoke"],
    passives: [
      "Exact Mouth sync: gain tempo and pressure.",
      "Legendary aura reinforces battlefield utility."
    ],
    modifierSources: {
      commander: {
        stats: { attack, speed, crit, utility },
        commanderTags: ["precision", "silver", "smoke"],
        passives: [
          "Exact Mouth sync: gain tempo and pressure.",
          "Legendary aura reinforces battlefield utility."
        ],
        audit: {
          reasons: [
            "Eyes: Unimaginable",
            "Mouth: Smoke Bomb",
            "Skins: Ornate",
            "Headwears: Jackson",
            "Backgrounds: Smokey Canary Diamond",
            "Legendary: legendary_aura"
          ],
          exactTraitMatches: ["Mouth:Smoke Bomb"],
          categoryMatches: ["Eyes", "Mouth"],
          nameMatch: false,
          factionMatch: true
        }
      },
      equipment: [],
      artifact: []
    }
  };
}

const starterHand: PlayCardVM[] = [
  makeCard("tcg_90", "Crypt // Unit Alpha", "unit", "Exact Match", "exact", 2, 1, 1, 0, 1, 1, 8),
  makeCard("tcg_1", "Crypt // Equipment Blade", "equipment", "Category Sync", "category", 1, 2, 0, 0, 2, 1, 8),
  makeCard("tcg_artifact_7", "Crypt // Rift Engine", "artifact", "Legendary Aura", "legendary", 2, 0, 0, 1, 0, 1, 4),
  makeCard("tcg_91", "Crypt // Unit Beta", "unit", "Category Sync", "category", 3, 2, 2, 1, 1, 0, 4)
];

const boardCards: PlayCardVM[] = [
  {
    ...makeCard("board_1", "Crypt // Frontline Prime", "unit", "Exact Match", "exact", 2, 7, 1, 0, 3, 2, 12),
    selected: true,
    equipped: true
  },
  {
    ...makeCard("board_2", "Crypt // Frontline Echo", "unit", "Category Sync", "category", 3, 4, 4, 1, 2, 1, 6)
  },
  {
    ...makeCard("board_3", "Crypt // Frontline Relic", "artifact", "Legendary Aura", "legendary", 2, 0, 0, 2, 0, 1, 4)
  }
];

export default function CryptMatchShowcase() {
  const [selectedCard, setSelectedCard] = useState<PlayCardVM | null>(boardCards[0]);

  const inspectState: InspectState = useMemo(() => {
    if (!selectedCard) return { open: false };
    return {
      open: true,
      commander,
      card: selectedCard
    };
  }, [selectedCard]);

  return (
    <div className="crypt-shell">
      <div className="crypt-shell__bg" />

      <div className="crypt-layout">
        <aside className="crypt-layout__left">
          <CommanderHero
            commander={commander}
            activeSyncText="Safe preview mode. No local screenshots are being used."
          />
        </aside>

        <main className="crypt-layout__center">
          <section className="crypt-zone">
            <div className="crypt-zone__header">
              <h2>Frontline</h2>
              <span>Safe Preview</span>
            </div>

            <div className="crypt-board-grid">
              {boardCards.map((card) => (
                <BoardCard key={card.id} card={card} onInspect={setSelectedCard} />
              ))}
            </div>
          </section>

          <section className="crypt-zone">
            <div className="crypt-zone__header">
              <h2>Hand</h2>
              <span>Placeholder visuals only</span>
            </div>

            <div className="crypt-hand-row">
              {starterHand.map((card) => (
                <HandCard key={card.id} card={card} onSelect={setSelectedCard} />
              ))}
            </div>
          </section>
        </main>

        <aside className="crypt-layout__right">
          <section className="crypt-side-panel">
            <h3>Safety</h3>
            <ul className="crypt-list">
              <li>No local screenshots loaded</li>
              <li>No personal files rendered</li>
              <li>Safe preview asset only</li>
            </ul>
          </section>
        </aside>
      </div>

      <InspectDrawer state={inspectState} onClose={() => setSelectedCard(null)} />
    </div>
  );
}
