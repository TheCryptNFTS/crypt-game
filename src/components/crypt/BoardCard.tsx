import React from "react";
import { PlayCardVM } from "../../ui/cryptTypes";
import { factionTheme } from "../../ui/cryptTheme";
import { SyncBadge } from "./MatchBadges";
import { rarityFrameClassFromTraits } from "../cards/CardFrame";
import { visibleKeywords } from "./keywordChips";

type BoardCardProps = {
  card: PlayCardVM;
  onInspect?: (card: PlayCardVM) => void;
  /** Transient presentation-only motion token from useMatchMotion. */
  motion?: "enter" | "damage" | "attack";
};

export function BoardCard({ card, onInspect, motion }: BoardCardProps) {
  const theme = factionTheme[card.faction];

  const states = [
    card.exhausted ? "exhausted" : "",
    card.damaged ? "damaged" : "",
    card.equipped ? "equipped" : "",
  ].filter(Boolean);
  const stateText = states.length ? `, ${states.join(", ")}` : "";

  const { shown: kw, overflow: kwOverflow } = visibleKeywords(card.keywords ?? []);
  const kwText = kw.length ? `, ${kw.map((k) => k.d.label.toLowerCase()).join(", ")}` : "";
  const { attack, health, armor, speed } = card.liveStats;

  return (
    <button
      type="button"
      className={[
        "crypt-card",
        "crypt-card--board",
        // Punch #23 — rarity frame escalation (rare/epic/legendary/mythic).
        rarityFrameClassFromTraits(card.traits),
        card.damaged ? "is-damaged" : "",
        card.exhausted ? "is-exhausted" : "",
        card.equipped ? "is-equipped" : "",
        motion ? `mm-${motion}` : "",
      ].join(" ")}
      onClick={() => onInspect?.(card)}
      aria-label={`${card.name}, ${attack} attack, ${health} health, ${armor} armor, ${speed} speed${kwText}${stateText}`}
      // Stable hook so positioned FX (spell/equip cast bloom) can land on this
      // exact unit; the board queries `[data-unit-id="<instanceId>"]`.
      data-unit-id={card.id}
      style={{ "--cf-edge": theme.edge, "--cf-glow": theme.glow } as React.CSSProperties}
    >
      {/* ART — clean square, no text over it. The NFT render is the card. */}
      <div className="crypt-card__art">
        <img src={card.imageUrl} alt={card.name} className="crypt-card__image" />
        {card.syncLabel ? (
          <span className="crypt-card__sync-corner">
            <SyncBadge level={card.syncLevel} label={card.syncLabel} />
          </span>
        ) : null}
      </div>

      {/* SILL — the frame band below the art holds the name + stats + keywords,
          like every real TCG, so nothing covers the art. */}
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
            {kw.map((k) => (
              <span
                key={k.raw}
                className={`crypt-board-kw${k.d.guard ? " crypt-board-kw--guard" : ""}`}
                title={k.d.full}
              >
                {k.d.label}
              </span>
            ))}
            {kwOverflow > 0 && (
              <span className="crypt-board-kw crypt-board-kw--more" title="More keywords — tap to inspect">
                +{kwOverflow}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
