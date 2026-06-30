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
  // ~40px tap target for the touch-to-inspect chips (UX audit FIX 1). Inline so it
  // lives with the interactive logic and needs no new CSS class.
  const kwTapStyle: React.CSSProperties = {
    cursor: "pointer",
    touchAction: "manipulation",
    minHeight: 40,
    display: "inline-flex",
    alignItems: "center",
  };
  const { attack, health, armor, speed } = card.liveStats;

  // STAT-MODIFICATION SIGNAL (predictability fix): the live game ships faction
  // identities + the 3+/4+ archetype snowball + trait resonance + auras (all ON
  // in CORE_RULESET), which silently raise a unit's stats above its printed base.
  // A player who can't see that a 3/2 is now a 5/4 — or WHY — can't read the
  // board. We compare liveStats to baseStats and tint a stat green when it's
  // buffed above base / red when debuffed below, with a title that shows the
  // base, matching the universal TCG convention. HEALTH is only tinted UP: a
  // live health BELOW base is combat damage (already shown via `is-damaged`),
  // not a debuff, so tinting it red would be a false signal. Armor/Speed only
  // ever render when > 0 and are tinted up only, for the same reason.
  const base = card.baseStats;
  const BUFF = "#6EE7A8";
  const NERF = "#F2777A";
  const atkColor = attack > base.attack ? BUFF : attack < base.attack ? NERF : undefined;
  const hpColor = health > base.health ? BUFF : undefined;
  const armColor = armor > base.armor ? BUFF : undefined;
  const spdColor = speed > base.speed ? BUFF : undefined;
  const modTitle = (label: string, live: number, baseVal: number) =>
    live === baseVal ? label : `${label} ${live} (base ${baseVal})`;

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
          <span
            className="crypt-cs crypt-cs--atk"
            title={modTitle("Attack", attack, base.attack)}
            style={atkColor ? { color: atkColor } : undefined}
          >
            {attack}
          </span>
          <span
            className="crypt-cs crypt-cs--hp"
            title={modTitle("Health", health, base.health)}
            style={hpColor ? { color: hpColor } : undefined}
          >
            {health}
          </span>
          {armor > 0 && (
            <span
              className="crypt-pip crypt-pip--arm"
              title={modTitle("Armor", armor, base.armor)}
              style={armColor ? { color: armColor } : undefined}
            >
              {armor} ARM
            </span>
          )}
          {speed > 0 && (
            <span
              className="crypt-pip crypt-pip--spd"
              title={modTitle("Speed", speed, base.speed)}
              style={spdColor ? { color: spdColor } : undefined}
            >
              {speed} SPD
            </span>
          )}
        </div>
        {kw.length > 0 && (
          <div className="crypt-card__kws">
            {kw.map((k) => {
              // TOUCH AFFORDANCE (UX audit FIX 1): `title` never fires on touch.
              // The card root already opens Inspect on tap, but a bare <span> chip
              // gave no a11y target and no obvious "I can tap this for the rule".
              // Make each chip a real button that opens Inspect; stopPropagation so
              // it's a single, deliberate action (no double-fire with the root).
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
