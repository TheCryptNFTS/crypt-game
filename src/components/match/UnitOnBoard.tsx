import type { UnitInPlay } from "../../engine/state";
import { getDisplayCardById } from "../../lib/cardAdapter";

interface UnitOnBoardProps {
  unit: UnitInPlay;
  isOwn: boolean;
  isSelected: boolean;
  isValidTarget: boolean;
  onClick: () => void;
}

export function UnitOnBoard({ unit, isOwn, isSelected, isValidTarget, onClick }: UnitOnBoardProps) {
  const cardData = getDisplayCardById(unit.cardId);
  
  return (
    <div
      onClick={onClick}
      className={`
        relative w-24 h-32 rounded-lg overflow-hidden cursor-pointer
        transition-all duration-200 ease-out
        ${isOwn ? "bg-gradient-to-b from-blue-900/50 to-blue-950" : "bg-gradient-to-b from-red-900/50 to-red-950"}
        ${isSelected ? "ring-2 ring-crypt-accent scale-105 shadow-lg shadow-crypt-accent/30" : ""}
        ${isValidTarget ? "ring-2 ring-green-500 animate-pulse" : ""}
        ${unit.exhausted ? "opacity-60 grayscale-[30%]" : ""}
        border ${isOwn ? "border-blue-500/50" : "border-red-500/50"}
        hover:scale-105 hover:shadow-lg
        group
      `}
    >
      {/* Card Image */}
      <div className="h-1/2 overflow-hidden">
        {cardData?.imageUrl ? (
          <img 
            src={cardData.imageUrl} 
            alt={cardData?.name || unit.cardId}
            className="w-full h-full object-cover transition-transform group-hover:scale-110"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-crypt-surface">
            <span className="text-crypt-muted text-[10px]">UNIT</span>
          </div>
        )}
      </div>

      {/* Unit Info */}
      <div className="h-1/2 p-1.5 flex flex-col">
        <p className="text-[10px] text-crypt-text font-medium truncate leading-tight">
          {cardData?.name || unit.cardId}
        </p>
        
        {/* Stats Row */}
        <div className="mt-auto flex items-center justify-between gap-1">
          {/* Attack */}
          <div className="flex items-center gap-0.5 px-1 py-0.5 bg-red-500/30 rounded">
            <svg className="w-2.5 h-2.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] font-bold text-red-400">{unit.attack}</span>
          </div>
          
          {/* Health */}
          <div className="flex items-center gap-0.5 px-1 py-0.5 bg-green-500/30 rounded">
            <svg className="w-2.5 h-2.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] font-bold text-green-400">{unit.health}</span>
          </div>
        </div>

        {/* Armor/Speed */}
        {(unit.armor > 0 || unit.speed > 0) && (
          <div className="flex items-center justify-center gap-2 mt-0.5">
            {unit.armor > 0 && (
              <span className="text-[9px] text-yellow-400">ARM {unit.armor}</span>
            )}
            {unit.speed > 0 && (
              <span className="text-[9px] text-blue-400">SPD {unit.speed}</span>
            )}
          </div>
        )}
      </div>

      {/* Keywords */}
      {unit.keywords.length > 0 && (
        <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5">
          {unit.keywords.slice(0, 2).map((kw) => (
            <span 
              key={kw}
              className="px-1 py-0.5 text-[8px] bg-purple-500/80 rounded text-white"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Exhausted Indicator */}
      {unit.exhausted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="text-[10px] text-crypt-muted font-medium">EXHAUSTED</span>
        </div>
      )}

      {/* Summoning Sick */}
      {unit.summoningSick && !unit.exhausted && (
        <div className="absolute top-0.5 left-0.5 px-1 py-0.5 bg-orange-500/80 rounded">
          <span className="text-[8px] text-white">SICK</span>
        </div>
      )}
    </div>
  );
}
