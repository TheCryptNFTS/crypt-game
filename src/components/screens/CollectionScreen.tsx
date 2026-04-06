import { useState, useMemo } from "react";
import type { DisplayCard, CardRarity } from "../../types/ui";
import type { Faction } from "../../types/faction";
import { 
  getAllPlayableDisplayCards, 
  getAllCommanderDisplayCards,
  filterCardsByFaction,
  filterCardsByType,
  filterCardsByRarity,
  searchCards,
  sortCards
} from "../../lib/cardAdapter";
import { Card } from "../ui/Card";
import { CommanderCard } from "../ui/CommanderCard";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

interface CollectionScreenProps {
  onSelectCard: (cardId: string) => void;
}

const FACTION_OPTIONS = [
  { value: "ALL", label: "All Factions" },
  { value: "STONE", label: "Stone" },
  { value: "IRON", label: "Iron" },
  { value: "BRONZE", label: "Bronze" },
  { value: "SILVER", label: "Silver" },
  { value: "GOLD", label: "Gold" },
  { value: "GOD", label: "God" },
];

const TYPE_OPTIONS = [
  { value: "ALL", label: "All Types" },
  { value: "unit", label: "Units" },
  { value: "equipment", label: "Equipment" },
  { value: "artifact", label: "Artifacts" },
];

const RARITY_OPTIONS = [
  { value: "ALL", label: "All Rarities" },
  { value: "common", label: "Common" },
  { value: "rare", label: "Rare" },
  { value: "epic", label: "Epic" },
  { value: "legendary", label: "Legendary" },
];

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "cost", label: "Cost" },
  { value: "attack", label: "Attack" },
  { value: "health", label: "Health" },
  { value: "faction", label: "Faction" },
];

type ViewMode = "playable" | "commanders";

export function CollectionScreen({ onSelectCard }: CollectionScreenProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("playable");
  const [searchQuery, setSearchQuery] = useState("");
  const [factionFilter, setFactionFilter] = useState<Faction | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [rarityFilter, setRarityFilter] = useState<CardRarity | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"name" | "cost" | "attack" | "health" | "faction">("name");

  const allPlayable = useMemo(() => getAllPlayableDisplayCards(), []);
  const allCommanders = useMemo(() => getAllCommanderDisplayCards(), []);

  const filteredCards = useMemo(() => {
    let cards = viewMode === "playable" ? allPlayable : allCommanders;
    cards = filterCardsByFaction(cards, factionFilter);
    if (viewMode === "playable") {
      cards = filterCardsByType(cards, typeFilter);
      cards = filterCardsByRarity(cards, rarityFilter);
    }
    cards = searchCards(cards, searchQuery);
    cards = sortCards(cards, sortBy);
    return cards;
  }, [allPlayable, allCommanders, viewMode, factionFilter, typeFilter, rarityFilter, searchQuery, sortBy]);

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl text-crypt-text mb-2">Collection</h1>
          <p className="text-crypt-muted">
            Browse your complete card collection - {allPlayable.length} playable cards and {allCommanders.length} commanders
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setViewMode("playable")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === "playable"
                ? "bg-crypt-accent text-black"
                : "bg-crypt-card text-crypt-muted hover:text-crypt-text"
            }`}
          >
            Playable Cards ({allPlayable.length})
          </button>
          <button
            onClick={() => setViewMode("commanders")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === "commanders"
                ? "bg-crypt-accent text-black"
                : "bg-crypt-card text-crypt-muted hover:text-crypt-text"
            }`}
          >
            Commanders ({allCommanders.length})
          </button>
        </div>

        {/* Filters */}
        <div className="bg-crypt-card border border-crypt-border rounded-xl p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Input
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            <Select
              options={FACTION_OPTIONS}
              value={factionFilter}
              onChange={(e) => setFactionFilter(e.target.value as Faction | "ALL")}
            />
            {viewMode === "playable" && (
              <>
                <Select
                  options={TYPE_OPTIONS}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                />
                <Select
                  options={RARITY_OPTIONS}
                  value={rarityFilter}
                  onChange={(e) => setRarityFilter(e.target.value as CardRarity | "ALL")}
                />
              </>
            )}
            <Select
              options={SORT_OPTIONS}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            />
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-crypt-muted mb-4">
          Showing {filteredCards.length} {viewMode === "commanders" ? "commanders" : "cards"}
        </div>

        {/* Card Grid */}
        {viewMode === "commanders" ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredCards.map((commander) => (
              <CommanderCard
                key={commander.id}
                commander={commander}
                onClick={() => onSelectCard(commander.id)}
                size="md"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
            {filteredCards.map((card) => (
              <Card
                key={card.id}
                card={card}
                size="md"
                onClick={() => onSelectCard(card.id)}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredCards.length === 0 && (
          <div className="text-center py-20">
            <svg className="w-16 h-16 mx-auto text-crypt-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-crypt-muted">No cards match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
