import type { DisplayCard } from "../../types/ui";
import type { Faction } from "../../types/faction";
import { FACTION_COLORS, RARITY_COLORS, getFactionGradient } from "../../lib/factionColors";

interface CardDetailModalProps {
  card: DisplayCard | null;
  onClose: () => void;
  onAddToDeck?: (card: DisplayCard) => void;
}

export function CardDetailModal({ card, onClose, onAddToDeck }: CardDetailModalProps) {
  if (!card) return null;

  const factionStyle = FACTION_COLORS[card.faction as Faction] || FACTION_COLORS.GOD;
  const rarityColor = RARITY_COLORS[card.rarity] || RARITY_COLORS.unknown;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-crypt-surface rounded-2xl overflow-hidden border border-crypt-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-crypt-bg/80 border border-crypt-border flex items-center justify-center text-crypt-muted hover:text-crypt-text hover:bg-crypt-card transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col md:flex-row">
          {/* Card Image Section */}
          <div className={`relative w-full md:w-1/2 h-80 md:h-auto bg-gradient-to-b ${getFactionGradient(card.faction as Faction)}`}>
            {card.imageUrl ? (
              <img 
                src={card.imageUrl} 
                alt={card.name}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-crypt-muted">No Image Available</span>
              </div>
            )}
            
            {/* Cost Badge */}
            {card.cost !== undefined && (
              <div className="absolute top-4 left-4 w-12 h-12 rounded-full bg-crypt-accent flex items-center justify-center shadow-lg">
                <span className="text-black font-bold text-xl">{card.cost}</span>
              </div>
            )}
          </div>

          {/* Card Details Section */}
          <div className="w-full md:w-1/2 p-6 flex flex-col">
            {/* Header */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${factionStyle.bg} ${factionStyle.text} border ${factionStyle.border}`}>
                  {card.faction}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium bg-crypt-card ${rarityColor} capitalize`}>
                  {card.rarity}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-crypt-card text-crypt-muted capitalize">
                  {card.type}
                </span>
              </div>
              <h2 className="text-2xl font-display font-bold text-crypt-text">{card.name}</h2>
              <p className="text-sm text-crypt-muted mt-1">ID: {card.id}</p>
            </div>

            {/* Stats */}
            {card.stats && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-crypt-muted mb-2 uppercase tracking-wider">Stats</h3>
                <div className="grid grid-cols-2 gap-3">
                  <StatBlock label="Attack" value={card.stats.attack} color="text-red-400" icon="M13 10V3L4 14h7v7l9-11h-7z" />
                  <StatBlock label="Health" value={card.stats.health} color="text-green-400" icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  <StatBlock label="Speed" value={card.stats.speed} color="text-blue-400" icon="M13 10V3L4 14h7v7l9-11h-7z" />
                  <StatBlock label="Armor" value={card.stats.armor} color="text-yellow-400" icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </div>
              </div>
            )}

            {/* Keywords */}
            {card.keywords && card.keywords.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-crypt-muted mb-2 uppercase tracking-wider">Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {card.keywords.map((kw) => (
                    <span 
                      key={kw} 
                      className="px-3 py-1 text-sm bg-crypt-card border border-crypt-border rounded-lg text-crypt-text font-medium"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {card.description && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-crypt-muted mb-2 uppercase tracking-wider">Description</h3>
                <p className="text-crypt-text">{card.description}</p>
              </div>
            )}

            {/* Actions */}
            {onAddToDeck && card.type !== "commander" && (
              <div className="mt-auto pt-4 border-t border-crypt-border">
                <button
                  onClick={() => onAddToDeck(card)}
                  className="w-full py-3 rounded-lg bg-crypt-accent text-black font-semibold hover:bg-crypt-gold transition-colors"
                >
                  Add to Deck
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-crypt-card rounded-lg border border-crypt-border">
      <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      <div>
        <p className="text-xs text-crypt-muted">{label}</p>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
