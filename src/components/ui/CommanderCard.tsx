import type { DisplayCard } from "../../types/ui";
import type { Faction } from "../../types/faction";
import { FACTION_COLORS, getFactionGradient } from "../../lib/factionColors";

interface CommanderCardProps {
  commander: DisplayCard;
  onClick?: () => void;
  selected?: boolean;
  size?: "sm" | "md" | "lg";
}

export function CommanderCard({ commander, onClick, selected, size = "md" }: CommanderCardProps) {
  const factionStyle = FACTION_COLORS[commander.faction as Faction] || FACTION_COLORS.GOD;

  const sizeClasses = {
    sm: "w-28 h-36",
    md: "w-40 h-52",
    lg: "w-56 h-72",
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative ${sizeClasses[size]} rounded-xl overflow-hidden cursor-pointer
        transition-all duration-300 ease-out
        border-2 ${selected ? "border-crypt-accent" : factionStyle.border}
        ${selected ? "ring-4 ring-crypt-accent/40 scale-105" : ""}
        hover:scale-105 hover:shadow-2xl
        group
      `}
    >
      {/* Animated Border Glow */}
      <div className={`absolute inset-0 bg-gradient-to-b ${getFactionGradient(commander.faction as Faction)} opacity-80`} />
      
      {/* Commander Image */}
      <div className="relative h-2/3 overflow-hidden">
        {commander.imageUrl ? (
          <img 
            src={commander.imageUrl} 
            alt={commander.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-crypt-surface">
            <svg className="w-12 h-12 text-crypt-muted" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
        )}
        
        {/* Commander Crown Badge */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2">
          <div className="px-2 py-0.5 bg-crypt-accent/90 rounded-full">
            <span className="text-[10px] font-bold text-black uppercase tracking-wider">Commander</span>
          </div>
        </div>
      </div>

      {/* Commander Info */}
      <div className="relative p-3 h-1/3 flex flex-col justify-center bg-gradient-to-t from-crypt-bg/95 to-transparent">
        <h3 className={`font-display font-bold text-center text-crypt-text ${size === "lg" ? "text-lg" : "text-sm"}`}>
          {commander.name}
        </h3>
        <p className={`text-center ${factionStyle.text} text-xs mt-0.5`}>
          {commander.faction}
        </p>
      </div>

      {/* Selection Indicator */}
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-crypt-accent flex items-center justify-center">
          <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
}
