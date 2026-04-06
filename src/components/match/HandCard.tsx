import { getDisplayCardById } from "../../lib/cardAdapter";
import { FACTION_COLORS, getFactionGradient } from "../../lib/factionColors";
import type { Faction } from "../../types/faction";

interface HandCardProps {
  cardId: string;
  canPlay: boolean;
  isSelected: boolean;
  onClick: () => void;
}

export function HandCard({ cardId, canPlay, isSelected, onClick }: HandCardProps) {
  const card = getDisplayCardById(cardId);
  if (!card) return null;

  const factionStyle = FACTION_COLORS[card.faction as Faction] || FACTION_COLORS.GOD;

  return (
    <div
      onClick={onClick}
      className={`
        relative w-28 h-40 rounded-lg overflow-hidden cursor-pointer
        transition-all duration-200 ease-out
        ${factionStyle.bg} border ${factionStyle.border}
        ${isSelected ? "ring-2 ring-crypt-accent -translate-y-4 scale-110 z-10" : "hover:-translate-y-2 hover:scale-105"}
        ${!canPlay ? "opacity-50 grayscale-[50%]" : ""}
        group
      `}
    >
      {/* Background */}
      <div className={`absolute inset-0 bg-gradient-to-b ${getFactionGradient(card.faction as Faction)} opacity-60`} />

      {/* Card Image */}
      <div className="relative h-1/2 overflow-hidden">
        {card.imageUrl ? (
          <img 
            src={card.imageUrl} 
            alt={card.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-110"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-crypt-surface">
            <span className="text-crypt-muted text-xs">{card.type.toUpperCase()}</span>
          </div>
        )}
        
        {/* Cost */}
        <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-crypt-accent flex items-center justify-center">
          <span className="text-black font-bold text-xs">{card.cost ?? 0}</span>
        </div>
      </div>

      {/* Card Info */}
      <div className="relative p-1.5 h-1/2 flex flex-col">
        <p className="text-[10px] font-semibold text-crypt-text truncate leading-tight">
          {card.name}
        </p>
        <p className="text-[9px] text-crypt-muted capitalize">{card.type}</p>

        {/* Stats for units */}
        {card.stats && (
          <div className="mt-auto flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              <span className="text-[9px] text-red-400 font-bold">{card.stats.attack}</span>
              <span className="text-[8px] text-crypt-muted">/</span>
              <span className="text-[9px] text-green-400 font-bold">{card.stats.health}</span>
            </div>
            {card.keywords && card.keywords.length > 0 && (
              <span className="text-[8px] text-purple-400">{card.keywords.length} KW</span>
            )}
          </div>
        )}
      </div>

      {/* Playable indicator */}
      {canPlay && !isSelected && (
        <div className="absolute inset-0 border-2 border-green-500/0 group-hover:border-green-500/50 rounded-lg transition-colors" />
      )}
    </div>
  );
}
