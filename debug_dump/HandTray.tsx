import type { CSSProperties } from "react";
import { getPlayableCardById } from "../../engine/cards";
import PlayableCard from "../../components/cards/PlayableCard";
import type { RenderManifestEntry } from "../../types/renderManifest";
type HandTrayProps = {
  hand: string[];
  winner: string | null | undefined;
  entryById: Map<string, RenderManifestEntry>;
  selectedHandIndex: number | null;
  onSelectHandIndex: (index: number | null) => void;
  equipHandIndex: number | null;
  onCancelEquip: () => void;
  onPlayUnit: (index: number) => void;
  onStartEquip: (index: number) => void;
  onPlayArtifact: (index: number) => void;
};

function handSlotTransform(index: number, total: number): CSSProperties {
  if (total <= 0) return {};
  const mid = (total - 1) / 2;
  const tRaw = mid === 0 ? 0 : (index - mid) / mid;
  const t = Math.max(-1, Math.min(1, tRaw));
  const n = total;
  const baseDeg = n > 9 ? 1.35 : n > 7 ? 1.65 : n > 5 ? 2.05 : n > 3 ? 2.55 : 3.15;
  const rot = t * baseDeg * (0.48 + Math.min(n, 8) * 0.06);
  const absT = Math.abs(t);
  const arcLift = (1 - Math.cos((absT * Math.PI) / 2)) * 16;
  const stackY = Math.abs(index - mid) * 0.85;
  const centerHold = (1 - absT) ** 1.2 * 9;
  const ty = stackY + arcLift - centerHold;
  const tx = t * 3.4 * (n > 6 ? 1.05 : 1);
  const zIndex = Math.round(12 - absT * 4 + (index === Math.round(mid) ? 3 : 0));
  return {
    transform: `translateX(${tx}px) translateY(${ty}px) rotateZ(${rot}deg)`,
    zIndex,
  };
}

export function HandTray({
  hand,
  winner,
  entryById,
  selectedHandIndex,
  onSelectHandIndex,
  equipHandIndex,
  onCancelEquip,
  onPlayUnit,
  onStartEquip,
  onPlayArtifact,
}: HandTrayProps) {
  const total = hand.length;
  const overlap =
    total > 8
      ? "max-sm:-mx-[15px] -mx-[17px] sm:-mx-[19px] md:-mx-[21px]"
      : total > 6
        ? "max-sm:-mx-[13px] -mx-[15px] sm:-mx-[17px] md:-mx-[19px]"
        : "max-sm:-mx-2.5 -mx-3 sm:-mx-3.5 md:-mx-4";

  const selectedIdx = selectedHandIndex;
  const selectedId = selectedIdx !== null ? hand[selectedIdx] : null;
  const selectedDef = selectedId ? getPlayableCardById(selectedId) : null;

  return (
    <section className="crypt-hand-tray" aria-label="Your hand">
      <div className="crypt-hand-tray-head">
        <span className="crypt-hand-tray-wisp" />
        {equipHandIndex !== null && (
          <div className="crypt-equip-banner">
            <span>Choose a unit to equip.</span>
            <button type="button" className="crypt-equip-banner-cancel" onClick={onCancelEquip}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="crypt-hand-held crypt-hand-fan flex min-h-[228px] items-end justify-center pb-4 pt-6">
        {hand.map((cardId: string, index: number) => {
          const def = getPlayableCardById(cardId);
          const entry = entryById.get(cardId);
          const focus = selectedHandIndex === index;
          const slotStyle = handSlotTransform(index, total);

          return (
            <div
              key={`${cardId}-${index}`}
              className={["crypt-hand-slot cursor-pointer", overlap, focus ? "crypt-hand-slot--authority" : ""].join(
                " "
              )}
              style={slotStyle}
              role="button"
              tabIndex={0}
              onClick={() => onSelectHandIndex(focus ? null : index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectHandIndex(focus ? null : index);
                }
              }}
            >
              <PlayableCard
                entry={entry}
                mode="hand"
                chromeState={focus ? "handFocus" : "default"}
              />
            </div>
          );
        })}
      </div>

      {!winner && selectedIdx !== null && selectedDef && (
        <div className="crypt-hand-dock">
          {selectedDef.type === "unit" && (
            <button type="button" className="crypt-dock-btn crypt-dock-btn--primary" onClick={() => onPlayUnit(selectedIdx)}>
              Play unit
            </button>
          )}
          {selectedDef.type === "equipment" && (
            <button type="button" className="crypt-dock-btn crypt-dock-btn--ice" onClick={() => onStartEquip(selectedIdx)}>
              Equip mode
            </button>
          )}
          {selectedDef.type === "artifact" && (
            <button type="button" className="crypt-dock-btn crypt-dock-btn--gold" onClick={() => onPlayArtifact(selectedIdx)}>
              Play relic
            </button>
          )}
          <button type="button" className="crypt-dock-btn crypt-dock-btn--ghost" onClick={() => onSelectHandIndex(null)}>
            Clear selection
          </button>
        </div>
      )}
    </section>
  );
}
