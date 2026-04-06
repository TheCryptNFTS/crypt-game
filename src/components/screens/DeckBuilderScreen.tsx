import { useState, useMemo } from "react";
import type { DisplayCard, DeckSlot, CardRarity } from "../../types/ui";
import type { Faction } from "../../types/faction";
import { 
  getAllPlayableDisplayCards, 
  getAllCommanderDisplayCards,
  getDisplayCardById,
  filterCardsByFaction,
  filterCardsByType,
  searchCards
} from "../../lib/cardAdapter";
import { COMMANDER_SPECS } from "../../design/commanderSpecs";
import { Card } from "../ui/Card";
import { CommanderCard } from "../ui/CommanderCard";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

interface DeckBuilderScreenProps {
  onSelectCard: (cardId: string) => void;
}

const DECK_SIZE = 30;
const MAX_COPIES = 2;

export function DeckBuilderScreen({ onSelectCard }: DeckBuilderScreenProps) {
  const [selectedCommander, setSelectedCommander] = useState<DisplayCard | null>(null);
  const [deckCards, setDeckCards] = useState<DeckSlot[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [deckName, setDeckName] = useState("New Deck");

  const allPlayable = useMemo(() => getAllPlayableDisplayCards(), []);
  const allCommanders = useMemo(() => getAllCommanderDisplayCards(), []);

  const commanderFaction = useMemo((): Faction | null => {
    if (!selectedCommander) return null;
    const spec = COMMANDER_SPECS[selectedCommander.id];
    return spec?.faction || null;
  }, [selectedCommander]);

  const filteredCards = useMemo(() => {
    let cards = allPlayable;
    
    // Filter by commander faction (allow same faction + GOD)
    if (commanderFaction) {
      cards = cards.filter((c) => c.faction === commanderFaction || c.faction === "GOD");
    }
    
    cards = filterCardsByType(cards, typeFilter);
    cards = searchCards(cards, searchQuery);
    
    return cards;
  }, [allPlayable, commanderFaction, typeFilter, searchQuery]);

  const deckStats = useMemo(() => {
    const totalCards = deckCards.reduce((sum, slot) => sum + slot.count, 0);
    const cardsByType = { unit: 0, equipment: 0, artifact: 0 };
    
    deckCards.forEach((slot) => {
      const card = getDisplayCardById(slot.cardId);
      if (card && card.type in cardsByType) {
        cardsByType[card.type as keyof typeof cardsByType] += slot.count;
      }
    });

    return { totalCards, ...cardsByType };
  }, [deckCards]);

  const addToDeck = (card: DisplayCard) => {
    const existingSlot = deckCards.find((s) => s.cardId === card.id);
    
    if (existingSlot) {
      if (existingSlot.count >= MAX_COPIES) return;
      setDeckCards(deckCards.map((s) => 
        s.cardId === card.id ? { ...s, count: s.count + 1 } : s
      ));
    } else {
      if (deckStats.totalCards >= DECK_SIZE) return;
      setDeckCards([...deckCards, { cardId: card.id, count: 1 }]);
    }
  };

  const removeFromDeck = (cardId: string) => {
    const existingSlot = deckCards.find((s) => s.cardId === cardId);
    if (!existingSlot) return;

    if (existingSlot.count > 1) {
      setDeckCards(deckCards.map((s) => 
        s.cardId === cardId ? { ...s, count: s.count - 1 } : s
      ));
    } else {
      setDeckCards(deckCards.filter((s) => s.cardId !== cardId));
    }
  };

  const getCardCount = (cardId: string) => {
    return deckCards.find((s) => s.cardId === cardId)?.count || 0;
  };

  const clearDeck = () => {
    setDeckCards([]);
    setSelectedCommander(null);
    setDeckName("New Deck");
  };

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content - Card Browser */}
          <div className="flex-1">
            {/* Header */}
            <div className="mb-6">
              <h1 className="font-display font-bold text-3xl text-crypt-text mb-2">Deck Builder</h1>
              <p className="text-crypt-muted">
                {selectedCommander 
                  ? `Building for ${selectedCommander.name} (${commanderFaction})` 
                  : "Select a commander to start building"
                }
              </p>
            </div>

            {/* Commander Selection */}
            {!selectedCommander && (
              <div className="bg-crypt-card border border-crypt-border rounded-xl p-6 mb-6">
                <h2 className="font-semibold text-lg text-crypt-text mb-4">Choose Your Commander</h2>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {allCommanders.map((commander) => (
                    <CommanderCard
                      key={commander.id}
                      commander={commander}
                      size="sm"
                      onClick={() => setSelectedCommander(commander)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Card Browser */}
            {selectedCommander && (
              <>
                {/* Filters */}
                <div className="bg-crypt-card border border-crypt-border rounded-xl p-4 mb-6">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
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
                    </div>
                    <Select
                      options={[
                        { value: "ALL", label: "All Types" },
                        { value: "unit", label: "Units" },
                        { value: "equipment", label: "Equipment" },
                        { value: "artifact", label: "Artifacts" },
                      ]}
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                    />
                  </div>
                </div>

                {/* Card Grid */}
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredCards.map((card) => {
                    const count = getCardCount(card.id);
                    const isMaxed = count >= MAX_COPIES;
                    const isDeckFull = deckStats.totalCards >= DECK_SIZE;
                    
                    return (
                      <div key={card.id} className="relative">
                        <Card
                          card={card}
                          size="sm"
                          onClick={() => addToDeck(card)}
                          selected={count > 0}
                          count={count > 0 ? count : undefined}
                        />
                        {(isMaxed || isDeckFull) && count === 0 && (
                          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                            <span className="text-xs text-crypt-muted">
                              {isDeckFull ? "Deck Full" : "Max Copies"}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Deck Panel */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="sticky top-24 bg-crypt-card border border-crypt-border rounded-xl overflow-hidden">
              {/* Deck Header */}
              <div className="p-4 border-b border-crypt-border">
                <input
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="w-full bg-transparent text-lg font-semibold text-crypt-text focus:outline-none"
                />
                <div className="flex items-center gap-4 mt-2 text-sm text-crypt-muted">
                  <span>{deckStats.totalCards}/{DECK_SIZE} cards</span>
                </div>
              </div>

              {/* Commander Slot */}
              <div className="p-4 border-b border-crypt-border">
                <p className="text-xs text-crypt-muted mb-2 uppercase tracking-wider">Commander</p>
                {selectedCommander ? (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-crypt-surface">
                      {selectedCommander.imageUrl ? (
                        <img 
                          src={selectedCommander.imageUrl} 
                          alt={selectedCommander.name}
                          className="w-full h-full object-cover"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-crypt-muted text-xs">
                          CMD
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-crypt-text text-sm">{selectedCommander.name}</p>
                      <p className="text-xs text-crypt-muted">{commanderFaction}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedCommander(null)}
                      className="text-crypt-muted hover:text-red-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="h-12 rounded-lg border-2 border-dashed border-crypt-border flex items-center justify-center text-crypt-muted text-sm">
                    Select a commander
                  </div>
                )}
              </div>

              {/* Deck Stats */}
              <div className="p-4 border-b border-crypt-border">
                <p className="text-xs text-crypt-muted mb-2 uppercase tracking-wider">Composition</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-crypt-surface rounded-lg p-2">
                    <p className="text-lg font-bold text-red-400">{deckStats.unit}</p>
                    <p className="text-xs text-crypt-muted">Units</p>
                  </div>
                  <div className="bg-crypt-surface rounded-lg p-2">
                    <p className="text-lg font-bold text-blue-400">{deckStats.equipment}</p>
                    <p className="text-xs text-crypt-muted">Equip</p>
                  </div>
                  <div className="bg-crypt-surface rounded-lg p-2">
                    <p className="text-lg font-bold text-purple-400">{deckStats.artifact}</p>
                    <p className="text-xs text-crypt-muted">Artifacts</p>
                  </div>
                </div>
              </div>

              {/* Deck Cards List */}
              <div className="p-4 max-h-[400px] overflow-y-auto">
                <p className="text-xs text-crypt-muted mb-2 uppercase tracking-wider">Cards</p>
                {deckCards.length === 0 ? (
                  <p className="text-sm text-crypt-muted text-center py-8">
                    No cards added yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {deckCards.map((slot) => {
                      const card = getDisplayCardById(slot.cardId);
                      if (!card) return null;
                      
                      return (
                        <div 
                          key={slot.cardId}
                          className="flex items-center gap-2 bg-crypt-surface rounded-lg p-2"
                        >
                          <span className="text-xs text-crypt-accent font-bold w-6 text-center">
                            {card.cost ?? "-"}
                          </span>
                          <span className="flex-1 text-sm text-crypt-text truncate">
                            {card.name}
                          </span>
                          <span className="text-xs text-crypt-muted">x{slot.count}</span>
                          <button
                            onClick={() => removeFromDeck(slot.cardId)}
                            className="text-crypt-muted hover:text-red-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-crypt-border space-y-2">
                <Button 
                  className="w-full" 
                  disabled={deckStats.totalCards < DECK_SIZE || !selectedCommander}
                >
                  Save Deck
                </Button>
                <Button variant="ghost" className="w-full" onClick={clearDeck}>
                  Clear All
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
