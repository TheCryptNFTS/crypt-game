import { allPlayableCards, allCommanderCards, getPlayableCardById, getCommanderCardById } from "../engine/cards";
import type { DisplayCard, CardRarity } from "../types/ui";
import type { Faction } from "../types/faction";
import renderManifest from "../data/renderManifest.json";

// Build lookup for render manifest entries (includes image URLs)
const manifestLookup = new Map<string, any>();
for (const entry of renderManifest.commanders) {
  manifestLookup.set(entry.id, entry);
}
for (const entry of renderManifest.playable) {
  manifestLookup.set(entry.id, entry);
}

function normalizeRarity(rarity: string | undefined): CardRarity {
  if (!rarity) return "unknown";
  const r = rarity.toLowerCase();
  if (r === "common") return "common";
  if (r === "rare") return "rare";
  if (r === "epic") return "epic";
  if (r === "legendary") return "legendary";
  if (r === "commander") return "commander";
  return "unknown";
}

export function toDisplayCard(card: any): DisplayCard {
  const manifestEntry = manifestLookup.get(card.id);
  
  return {
    id: card.id,
    name: card.name || card.id,
    type: card.type || "unit",
    faction: (card.faction as Faction) || "GOD",
    rarity: normalizeRarity(card.rarity),
    cost: card.cost,
    stats: card.stats ? {
      attack: card.stats.attack ?? 0,
      health: card.stats.health ?? 0,
      speed: card.stats.speed ?? 0,
      armor: card.stats.armor ?? 0,
    } : undefined,
    keywords: card.keywords || [],
    imageUrl: manifestEntry?.imageUrl || null,
    description: card.description,
  };
}

export function getAllPlayableDisplayCards(): DisplayCard[] {
  return allPlayableCards.map(toDisplayCard);
}

export function getAllCommanderDisplayCards(): DisplayCard[] {
  return allCommanderCards.map((cmd) => {
    const manifestEntry = manifestLookup.get(cmd.id);
    return {
      id: cmd.id,
      name: cmd.name || cmd.id,
      type: "commander" as const,
      faction: (manifestEntry?.faction as Faction) || cmd.faction || "GOD",
      rarity: "commander" as CardRarity,
      imageUrl: manifestEntry?.imageUrl || null,
      keywords: manifestEntry?.keywords || [],
    };
  });
}

export function getDisplayCardById(id: string): DisplayCard | null {
  const playable = getPlayableCardById(id);
  if (playable) return toDisplayCard(playable);
  
  const commander = getCommanderCardById(id);
  if (commander) return toDisplayCard({ ...commander, type: "commander" });
  
  return null;
}

export function filterCardsByFaction(cards: DisplayCard[], faction: Faction | "ALL"): DisplayCard[] {
  if (faction === "ALL") return cards;
  return cards.filter((c) => c.faction === faction || c.faction === "GOD");
}

export function filterCardsByType(cards: DisplayCard[], type: string | "ALL"): DisplayCard[] {
  if (type === "ALL") return cards;
  return cards.filter((c) => c.type === type);
}

export function filterCardsByRarity(cards: DisplayCard[], rarity: CardRarity | "ALL"): DisplayCard[] {
  if (rarity === "ALL") return cards;
  return cards.filter((c) => c.rarity === rarity);
}

export function searchCards(cards: DisplayCard[], query: string): DisplayCard[] {
  if (!query.trim()) return cards;
  const q = query.toLowerCase();
  return cards.filter((c) => 
    c.name.toLowerCase().includes(q) || 
    c.id.toLowerCase().includes(q) ||
    c.keywords?.some((k) => k.toLowerCase().includes(q))
  );
}

export function sortCards(cards: DisplayCard[], sortBy: "name" | "cost" | "attack" | "health" | "faction"): DisplayCard[] {
  return [...cards].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "cost":
        return (a.cost ?? 0) - (b.cost ?? 0);
      case "attack":
        return (b.stats?.attack ?? 0) - (a.stats?.attack ?? 0);
      case "health":
        return (b.stats?.health ?? 0) - (a.stats?.health ?? 0);
      case "faction":
        return a.faction.localeCompare(b.faction);
      default:
        return 0;
    }
  });
}
