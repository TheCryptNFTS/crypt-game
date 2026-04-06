import { useMemo } from "react";
import type { Screen } from "../../types/ui";
import { getAllPlayableDisplayCards, getAllCommanderDisplayCards } from "../../lib/cardAdapter";
import { Card } from "../ui/Card";
import { CommanderCard } from "../ui/CommanderCard";
import { Button } from "../ui/Button";

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectCard: (cardId: string) => void;
}

export function HomeScreen({ onNavigate, onSelectCard }: HomeScreenProps) {
  const allCards = useMemo(() => getAllPlayableDisplayCards(), []);
  const commanders = useMemo(() => getAllCommanderDisplayCards(), []);
  
  const featuredCards = useMemo(() => {
    return allCards
      .filter((c) => c.rarity === "rare" || c.rarity === "legendary")
      .slice(0, 6);
  }, [allCards]);

  const stats = useMemo(() => ({
    totalCards: allCards.length,
    commanders: commanders.length,
    factions: 6,
  }), [allCards, commanders]);

  return (
    <div className="min-h-screen pt-20 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-crypt-accent/10 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-crypt-accent/5 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h1 className="font-display font-black text-5xl md:text-7xl text-transparent bg-clip-text bg-gradient-to-r from-crypt-accent via-crypt-gold to-crypt-accent mb-4">
              THE CRYPT
            </h1>
            <p className="text-xl text-crypt-muted max-w-2xl mx-auto leading-relaxed">
              Enter the arena. Command your forces. Dominate the battlefield with your NFT-powered trading card collection.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <Button size="lg" onClick={() => onNavigate("match")}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Start Battle
            </Button>
            <Button size="lg" variant="secondary" onClick={() => onNavigate("deck-builder")}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Build Deck
            </Button>
            <Button size="lg" variant="secondary" onClick={() => onNavigate("collection")}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              View Collection
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto">
            <StatCard label="Total Cards" value={stats.totalCards.toLocaleString()} />
            <StatCard label="Commanders" value={stats.commanders.toString()} />
            <StatCard label="Factions" value={stats.factions.toString()} />
          </div>
        </div>
      </section>

      {/* Commanders Section */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display font-bold text-2xl text-crypt-text">Commanders</h2>
            <p className="text-crypt-muted mt-1">Lead your forces to victory</p>
          </div>
          <Button variant="ghost" onClick={() => onNavigate("collection")}>
            View All
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
        
        <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-thin">
          {commanders.slice(0, 6).map((commander) => (
            <CommanderCard 
              key={commander.id} 
              commander={commander}
              onClick={() => onSelectCard(commander.id)}
            />
          ))}
        </div>
      </section>

      {/* Featured Cards Section */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display font-bold text-2xl text-crypt-text">Featured Cards</h2>
            <p className="text-crypt-muted mt-1">Powerful units from across the realms</p>
          </div>
          <Button variant="ghost" onClick={() => onNavigate("collection")}>
            Browse Collection
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {featuredCards.map((card) => (
            <Card 
              key={card.id} 
              card={card}
              size="md"
              onClick={() => onSelectCard(card.id)}
            />
          ))}
        </div>
      </section>

      {/* Factions Overview */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="font-display font-bold text-2xl text-crypt-text">Factions</h2>
          <p className="text-crypt-muted mt-1">Choose your allegiance</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <FactionCard faction="STONE" description="Defensive masters" color="from-slate-600 to-slate-800" />
          <FactionCard faction="IRON" description="Weapon specialists" color="from-zinc-500 to-zinc-800" />
          <FactionCard faction="BRONZE" description="Rush tactics" color="from-amber-600 to-amber-900" />
          <FactionCard faction="SILVER" description="Arcane power" color="from-gray-400 to-gray-700" />
          <FactionCard faction="GOLD" description="Elite scaling" color="from-yellow-500 to-yellow-800" />
          <FactionCard faction="GOD" description="Transcendent" color="from-purple-500 to-purple-800" />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-crypt-card border border-crypt-border rounded-xl p-6 text-center">
      <p className="font-display font-bold text-3xl text-crypt-accent mb-1">{value}</p>
      <p className="text-sm text-crypt-muted">{label}</p>
    </div>
  );
}

function FactionCard({ faction, description, color }: { faction: string; description: string; color: string }) {
  return (
    <div className={`bg-gradient-to-b ${color} rounded-xl p-4 text-center hover:scale-105 transition-transform cursor-pointer border border-white/10`}>
      <p className="font-display font-bold text-lg text-white mb-1">{faction}</p>
      <p className="text-xs text-white/70">{description}</p>
    </div>
  );
}
