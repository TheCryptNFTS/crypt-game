import type { DisplayCard } from "../../types/ui";
import type { Faction } from "../../types/faction";
import { FACTION_COLORS, RARITY_COLORS, getFactionGradient } from "../../lib/factionColors";

interface CardProps {
  card: DisplayCard;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  selected?: boolean;
  showStats?: boolean;
  count?: number;
}

export function Card({ card, size = "md", onClick, selected, showStats = true, count }: CardProps) {
  const factionStyle = FACTION_COLORS[card.faction as Faction] || FACTION_COLORS.GOD;
  const rarityColor = RARITY_COLORS[card.rarity] || RARITY_COLORS.unknown;

  const sizeClasses = {
    sm: "w-32 h-44",
    md: "w-48 h-64",
    lg: "w-64 h-80",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative ${sizeClasses[size]} rounded-lg overflow-hidden cursor-pointer
        transition-all duration-200 ease-out
        ${factionStyle.bg} border ${factionStyle.border}
        ${selected ? `ring-2 ring-crypt-accent shadow-lg ${factionStyle.glow}` : ""}
        hover:scale-105 hover:shadow-xl hover:${factionStyle.glow}
        group
      `}
    >
      {/* Card Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-b ${getFactionGradient(card.faction as Faction)} opacity-60`} />
      
      {/* Card Image */}
      <div className="relative h-1/2 overflow-hidden">
        {card.imageUrl ? (
          <img 
            src={card.imageUrl} 
            alt={card.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-crypt-surface">
            <span className="text-crypt-muted text-xs">No Image</span>
          </div>
        )}
        
        {/* Cost Badge */}
        {card.cost !== undefined && (
          <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-crypt-accent flex items-center justify-center">
            <span className="text-black font-bold text-xs">{card.cost}</span>
          </div>
        )}
        
        {/* Count Badge */}
        {count !== undefined && count > 1 && (
          <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-crypt-bg/90 border border-crypt-border flex items-center justify-center">
            <span className="text-crypt-text font-bold text-xs">x{count}</span>
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="relative p-2 flex flex-col h-1/2">
        <h3 className={`font-semibold ${textSizes[size]} text-crypt-text truncate leading-tight`}>
          {card.name}
        </h3>
        
        <div className="flex items-center gap-1 mt-0.5">
          <span className={`${textSizes[size]} ${rarityColor} capitalize`}>
            {card.rarity}
          </span>
          <span className="text-crypt-muted">·</span>
          <span className={`${textSizes[size]} ${factionStyle.text}`}>
            {card.faction}
          </span>
        </div>

        {/* Stats */}
        {showStats && card.stats && (
          <div className="mt-auto grid grid-cols-2 gap-1">
            <StatBadge label="ATK" value={card.stats.attack} color="text-red-400" size={size} />
            <StatBadge label="HP" value={card.stats.health} color="text-green-400" size={size} />
            <StatBadge label="SPD" value={card.stats.speed} color="text-blue-400" size={size} />
            <StatBadge label="ARM" value={card.stats.armor} color="text-yellow-400" size={size} />
          </div>
        )}

        {/* Keywords */}
        {card.keywords && card.keywords.length > 0 && size !== "sm" && (
          <div className="mt-1 flex flex-wrap gap-0.5">
            {card.keywords.slice(0, 3).map((kw) => (
              <span key={kw} className="px-1 py-0.5 text-[10px] bg-crypt-border/50 rounded text-crypt-muted">
                {kw}
              </span>
            ))}
          </div>
        )}

        {/* Card Type Badge */}
        <div className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] ${factionStyle.bg} border ${factionStyle.border}`}>
          {card.type}
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, value, color, size }: { label: string; value: number; color: string; size: string }) {
  const textSize = size === "sm" ? "text-[9px]" : "text-[10px]";
  return (
    <div className={`flex items-center gap-0.5 ${textSize}`}>
      <span className="text-crypt-muted">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}
