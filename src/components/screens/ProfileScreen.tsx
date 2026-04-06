import { useMemo } from "react";
import type { Screen } from "../../types/ui";
import { getAllPlayableDisplayCards, getAllCommanderDisplayCards } from "../../lib/cardAdapter";
import { Button } from "../ui/Button";

interface ProfileScreenProps {
  onNavigate: (screen: Screen) => void;
}

// Mock profile data - this would come from your backend/wallet integration
const MOCK_PROFILE = {
  username: "CryptCollector",
  walletAddress: "0x1234...5678",
  rank: "Gold III",
  wins: 127,
  losses: 89,
  winStreak: 3,
  joinDate: "March 2024",
};

export function ProfileScreen({ onNavigate }: ProfileScreenProps) {
  const allCards = useMemo(() => getAllPlayableDisplayCards(), []);
  const commanders = useMemo(() => getAllCommanderDisplayCards(), []);

  const collectionStats = useMemo(() => {
    const byFaction: Record<string, number> = {};
    const byRarity: Record<string, number> = {};
    const byType: Record<string, number> = {};

    allCards.forEach((card) => {
      byFaction[card.faction] = (byFaction[card.faction] || 0) + 1;
      byRarity[card.rarity] = (byRarity[card.rarity] || 0) + 1;
      byType[card.type] = (byType[card.type] || 0) + 1;
    });

    return { byFaction, byRarity, byType };
  }, [allCards]);

  const winRate = Math.round((MOCK_PROFILE.wins / (MOCK_PROFILE.wins + MOCK_PROFILE.losses)) * 100);

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-4">
        {/* Profile Header */}
        <div className="bg-crypt-card border border-crypt-border rounded-2xl overflow-hidden mb-8">
          {/* Banner */}
          <div className="h-32 bg-gradient-to-r from-crypt-accent/20 via-crypt-gold/10 to-crypt-accent/20 relative">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10" />
          </div>

          {/* Profile Info */}
          <div className="px-8 pb-8">
            <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-12">
              {/* Avatar */}
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-crypt-accent to-crypt-gold flex items-center justify-center border-4 border-crypt-card shadow-xl">
                <span className="font-display font-black text-4xl text-black">
                  {MOCK_PROFILE.username.charAt(0)}
                </span>
              </div>

              {/* Name & Info */}
              <div className="flex-1">
                <h1 className="font-display font-bold text-2xl text-crypt-text mb-1">
                  {MOCK_PROFILE.username}
                </h1>
                <p className="text-sm text-crypt-muted font-mono">{MOCK_PROFILE.walletAddress}</p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </Button>
                <Button variant="secondary" size="sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </Button>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <StatBox 
                label="Rank" 
                value={MOCK_PROFILE.rank}
                icon={
                  <svg className="w-5 h-5 text-crypt-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                  </svg>
                }
              />
              <StatBox 
                label="Win Rate" 
                value={`${winRate}%`}
                subValue={`${MOCK_PROFILE.wins}W - ${MOCK_PROFILE.losses}L`}
              />
              <StatBox 
                label="Win Streak" 
                value={MOCK_PROFILE.winStreak.toString()}
                highlight
              />
              <StatBox 
                label="Member Since" 
                value={MOCK_PROFILE.joinDate}
              />
            </div>
          </div>
        </div>

        {/* Collection Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Collection Summary */}
          <div className="bg-crypt-card border border-crypt-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-bold text-lg text-crypt-text">Collection</h2>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("collection")}>
                View All
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-crypt-surface rounded-lg p-4 text-center">
                <p className="text-3xl font-display font-bold text-crypt-accent">{allCards.length}</p>
                <p className="text-sm text-crypt-muted">Total Cards</p>
              </div>
              <div className="bg-crypt-surface rounded-lg p-4 text-center">
                <p className="text-3xl font-display font-bold text-crypt-gold">{commanders.length}</p>
                <p className="text-sm text-crypt-muted">Commanders</p>
              </div>
            </div>

            {/* By Type */}
            <div className="mt-6">
              <p className="text-xs text-crypt-muted uppercase tracking-wider mb-3">By Type</p>
              <div className="space-y-2">
                <ProgressBar label="Units" value={collectionStats.byType.unit || 0} max={allCards.length} color="bg-red-500" />
                <ProgressBar label="Equipment" value={collectionStats.byType.equipment || 0} max={allCards.length} color="bg-blue-500" />
                <ProgressBar label="Artifacts" value={collectionStats.byType.artifact || 0} max={allCards.length} color="bg-purple-500" />
              </div>
            </div>
          </div>

          {/* By Faction */}
          <div className="bg-crypt-card border border-crypt-border rounded-xl p-6">
            <h2 className="font-display font-bold text-lg text-crypt-text mb-6">Cards by Faction</h2>
            
            <div className="space-y-3">
              <FactionBar faction="STONE" count={collectionStats.byFaction.STONE || 0} total={allCards.length} color="from-slate-600 to-slate-700" />
              <FactionBar faction="IRON" count={collectionStats.byFaction.IRON || 0} total={allCards.length} color="from-zinc-500 to-zinc-700" />
              <FactionBar faction="BRONZE" count={collectionStats.byFaction.BRONZE || 0} total={allCards.length} color="from-amber-600 to-amber-800" />
              <FactionBar faction="SILVER" count={collectionStats.byFaction.SILVER || 0} total={allCards.length} color="from-gray-400 to-gray-600" />
              <FactionBar faction="GOLD" count={collectionStats.byFaction.GOLD || 0} total={allCards.length} color="from-yellow-500 to-yellow-700" />
              <FactionBar faction="GOD" count={collectionStats.byFaction.GOD || 0} total={allCards.length} color="from-purple-500 to-purple-700" />
            </div>
          </div>
        </div>

        {/* Rarity Breakdown */}
        <div className="bg-crypt-card border border-crypt-border rounded-xl p-6 mb-8">
          <h2 className="font-display font-bold text-lg text-crypt-text mb-6">Cards by Rarity</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <RarityCard rarity="Common" count={collectionStats.byRarity.common || 0} color="text-gray-400" />
            <RarityCard rarity="Rare" count={collectionStats.byRarity.rare || 0} color="text-blue-400" />
            <RarityCard rarity="Epic" count={collectionStats.byRarity.epic || 0} color="text-purple-400" />
            <RarityCard rarity="Legendary" count={collectionStats.byRarity.legendary || 0} color="text-yellow-400" />
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickLinkCard 
            title="Build a Deck"
            description="Create and customize your battle decks"
            onClick={() => onNavigate("deck-builder")}
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
          <QuickLinkCard 
            title="Start a Battle"
            description="Test your strategies in combat"
            onClick={() => onNavigate("match")}
            icon="M13 10V3L4 14h7v7l9-11h-7z"
          />
          <QuickLinkCard 
            title="Browse Collection"
            description="Explore all available cards"
            onClick={() => onNavigate("collection")}
            icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, subValue, icon, highlight }: { 
  label: string; 
  value: string; 
  subValue?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-crypt-surface rounded-lg p-4 ${highlight ? "border border-crypt-accent/30" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs text-crypt-muted uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-xl font-bold ${highlight ? "text-crypt-accent" : "text-crypt-text"}`}>{value}</p>
      {subValue && <p className="text-xs text-crypt-muted mt-0.5">{subValue}</p>}
    </div>
  );
}

function ProgressBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-crypt-muted w-20">{label}</span>
      <div className="flex-1 h-2 bg-crypt-surface rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-sm text-crypt-text font-medium w-10 text-right">{value}</span>
    </div>
  );
}

function FactionBar({ faction, count, total, color }: { faction: string; count: number; total: number; color: string }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-crypt-text font-medium w-16">{faction}</span>
      <div className="flex-1 h-6 bg-crypt-surface rounded-lg overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-lg flex items-center justify-end pr-2`} style={{ width: `${Math.max(percentage, 10)}%` }}>
          <span className="text-xs text-white font-medium">{count}</span>
        </div>
      </div>
    </div>
  );
}

function RarityCard({ rarity, count, color }: { rarity: string; count: number; color: string }) {
  return (
    <div className="bg-crypt-surface rounded-lg p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{count}</p>
      <p className={`text-sm ${color}`}>{rarity}</p>
    </div>
  );
}

function QuickLinkCard({ title, description, onClick, icon }: { 
  title: string; 
  description: string; 
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-crypt-card border border-crypt-border rounded-xl p-6 text-left hover:border-crypt-accent/50 transition-colors group"
    >
      <svg className="w-8 h-8 text-crypt-accent mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      <h3 className="font-semibold text-crypt-text mb-1">{title}</h3>
      <p className="text-sm text-crypt-muted">{description}</p>
    </button>
  );
}
