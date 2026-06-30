import React from "react";
import { PlayCardVM } from "../../ui/cryptTypes";
import { factionTheme } from "../../ui/cryptTheme";
import { SyncBadge } from "./MatchBadges";
import { useCardTilt } from "../../hooks/useCardTilt";
import { rarityFrameClassFromTraits } from "../cards/CardFrame";
import { visibleKeywords } from "./keywordChips";
import "../../styles/polish-facedown.css";

/** Printed card-back art (public/crypt-assets), served from the site root. */
export const CARD_BACK_SRC = "/crypt-assets/card-back.png";

/**
 * A hand card is a spectator face-down placeholder when its id carries the
 * `spectator_facedown_` prefix (minted in CryptMatchBoard from the redacted
 * neutral view, which has no real card ids). Such VMs have no underlying card
 * meta, so showing their fallback face would leak an empty/placeholder card —
 * we render the printed card-back instead.
 */
function isFaceDown(card: PlayCardVM): boolean {
  return typeof card.id === "string" && card.id.startsWith("spectator_facedown_");
}

type HandCardProps = {
  card: PlayCardVM;
  onSelect?: (card: PlayCardVM) => void;
  /** Opens the full-card InspectDrawer (stats + passives + keywords). Wired to
   *  a dedicated corner button so the whole-card tap stays "select to play" —
   *  on touch the hand card is 132px and tooltips don't fire, so this is the
   *  only way to READ a card's rules before committing it. */
  onInspect?: (card: PlayCardVM) => void;
};

export function HandCard({ card, onSelect, onInspect }: HandCardProps) {
  const theme = factionTheme[card.faction];
  // Hook must run before the face-down early return (rules of hooks).
  const tilt = useCardTilt(9);

  // Face-down placeholder: render the card-back art only. It is non-interactive
  // (spectator fog of war), so it is a plain div, not a selectable button.
  if (isFaceDown(card)) {
    return (
      <div className="crypt-card crypt-card--hand crypt-card--facedown" aria-label="Face-down card">
        <img src={CARD_BACK_SRC} alt="" aria-hidden="true" className="crypt-card__back-img" />
      </div>
    );
  }

  const { cost, attack, health, armor, speed } = card.liveStats;
  // Holder fix (NikoDaTroof, 2026-06-17): show the card's combat keywords IN HAND so a
  // player can read GUARD/FLYING/etc. before they commit the card — same chip model as
  // the board (keywordChips.ts), so hand and board read identically.
  const { shown: kw, overflow: kwOverflow } = visibleKeywords(card.keywords ?? []);
  const kwAria = kw.length ? `, ${kw.map((k) => k.d.label.toLowerCase()).join(", ")}` : "";
  // ~40px tap target for the touch-to-inspect chips (UX audit FIX 1). Inline so it
  // lives with the interactive logic and needs no new CSS class; the visible chip
  // stays compact, the transparent padding extends the hittable area.
  const kwTapStyle: React.CSSProperties = {
    cursor: "pointer",
    touchAction: "manipulation",
    minHeight: 40,
    display: "inline-flex",
    alignItems: "center",
  };

  return (
    <button
      type="button"
      ref={tilt.ref as React.Ref<HTMLButtonElement>}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className={`crypt-card crypt-card--hand crypt-card--tilt ${rarityFrameClassFromTraits(card.traits)} ${card.selected ? "is-selected" : ""}`}
      onClick={() => onSelect?.(card)}
      aria-pressed={card.selected ?? false}
      aria-label={`Play ${card.name}, ${card.kind}, cost ${cost ?? 0}, ${attack} attack, ${health} health, ${armor} armor, ${speed} speed${kwAria}`}
      style={{ "--cf-edge": theme.edge, "--cf-glow": theme.glow } as React.CSSProperties}
    >
      {/* ART — clean square. Cost orb is the only thing on it (top-left), the
          universal TCG convention; everything else lives in the sill below. */}
      <div className="crypt-card__art">
        <img src={card.imageUrl} alt={card.name} className="crypt-card__image" />
        <span className="crypt-card__glare" aria-hidden="true" />
        <span className="crypt-card__cost-orb">{cost ?? 0}</span>
        {onInspect ? (
          // role="button" span (NOT a <button>) because the card root is itself
          // a <button> and nesting buttons is invalid HTML. Inspect is a SEPARATE
          // action from select — stop the event from bubbling to the card button
          // (which would select/play the card).
          <span
            role="button"
            tabIndex={0}
            className="crypt-card__inspect"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(card);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onInspect(card);
              }
            }}
            aria-label={`Inspect ${card.name} — full stats and abilities`}
            title="Inspect card"
          >
            <span aria-hidden="true">⊕</span>
          </span>
        ) : null}
        {card.syncLabel ? (
          <span className="crypt-card__sync-corner">
            <SyncBadge level={card.syncLevel} label={card.syncLabel} />
          </span>
        ) : null}
      </div>

      {/* SILL — name + stats below the art, never over it. */}
      <div className="crypt-card__sill">
        <div className="crypt-card__name" title={card.name}>{card.name}</div>
        <div className="crypt-card__statline">
          <span className="crypt-cs crypt-cs--atk" title="Attack">{attack}</span>
          <span className="crypt-cs crypt-cs--hp" title="Health">{health}</span>
          {armor > 0 && <span className="crypt-pip crypt-pip--arm" title="Armor">{armor} ARM</span>}
          {speed > 0 && <span className="crypt-pip crypt-pip--spd" title="Speed">{speed} SPD</span>}
        </div>
        {kw.length > 0 && (
          <div className="crypt-card__kws">
            {kw.map((k) => {
              // TOUCH AFFORDANCE (UX audit FIX 1): `title` never fires on touch, so
              // on mobile a chip taught the newcomer nothing. Tapping a chip now
              // opens the InspectDrawer (full keyword text + stats) when onInspect
              // is wired. role="button" span (the card root is itself a <button>;
              // nesting buttons is invalid HTML); stopPropagation so the chip tap
              // doesn't also select/play the card. title kept for desktop hover.
              const interactive = !!onInspect;
              return (
                <span
                  key={k.raw}
                  role={interactive ? "button" : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  className={`crypt-board-kw${k.d.guard ? " crypt-board-kw--guard" : ""}`}
                  style={interactive ? kwTapStyle : undefined}
                  title={k.d.full}
                  aria-label={interactive ? `${k.d.full} — tap to inspect` : undefined}
                  onClick={interactive ? (e) => { e.stopPropagation(); onInspect(card); } : undefined}
                  onPointerDown={interactive ? (e) => e.stopPropagation() : undefined}
                  onKeyDown={interactive ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onInspect(card);
                    }
                  } : undefined}
                >
                  {k.d.label}
                </span>
              );
            })}
            {kwOverflow > 0 && (
              <span
                role={onInspect ? "button" : undefined}
                tabIndex={onInspect ? 0 : undefined}
                className="crypt-board-kw crypt-board-kw--more"
                style={onInspect ? kwTapStyle : undefined}
                title="More keywords — tap to inspect"
                aria-label={onInspect ? `${kwOverflow} more keywords — tap to inspect` : undefined}
                onClick={onInspect ? (e) => { e.stopPropagation(); onInspect(card); } : undefined}
                onPointerDown={onInspect ? (e) => e.stopPropagation() : undefined}
                onKeyDown={onInspect ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onInspect(card);
                  }
                } : undefined}
              >
                +{kwOverflow}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
