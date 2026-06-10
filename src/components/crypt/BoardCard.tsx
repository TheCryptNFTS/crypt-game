import React from "react";
import { PlayCardVM } from "../../ui/cryptTypes";
import { factionTheme } from "../../ui/cryptTheme";
import { FactionBadge, SyncBadge } from "./MatchBadges";

type BoardCardProps = {
  card: PlayCardVM;
  onInspect?: (card: PlayCardVM) => void;
  /** Transient presentation-only motion token from useMatchMotion. */
  motion?: "enter" | "damage" | "attack";
};

/**
 * Combat keywords that change how you TARGET or TRADE this turn — the ones a
 * player must read off the board to play correctly. Ordered by decision impact
 * (GUARD first: a taunt you can't see is an unplayable board). `label` is the
 * short on-card token; `full` is the tooltip/aria sentence so the rule is
 * learnable, not cryptic. Stat keywords (ARMORED) are omitted — the ARM pip
 * already shows that number. Keywords not in this map (lore/triggered-only) are
 * surfaced on the full inspect view, not crammed onto the small board card.
 */
const KW_DISPLAY: Record<string, { label: string; full: string; pri: number; guard?: boolean }> = {
  GUARD: { label: "GUARD", full: "Guard — enemies must attack this first", pri: 0, guard: true },
  TAUNT: { label: "GUARD", full: "Guard — enemies must attack this first", pri: 0, guard: true },
  STEALTH: { label: "STEALTH", full: "Stealth — can't be attacked or targeted", pri: 1 },
  FLYING: { label: "FLYING", full: "Flying — only Flying or Ranged units can hit it", pri: 1 },
  DIVINE_SHIELD: { label: "SHIELD", full: "Divine Shield — blocks the first hit", pri: 2 },
  WARD: { label: "WARD", full: "Ward — blocks the first hit", pri: 2 },
  SHIELD: { label: "SHIELD", full: "Shield — blocks the first hit", pri: 2 },
  LIFESTEAL: { label: "LIFE", full: "Lifesteal — heals your Hex when it deals damage", pri: 3 },
  DEATHRATTLE: { label: "RATTLE", full: "Deathrattle — triggers an effect when it dies", pri: 3 },
  EXECUTE: { label: "EXECUTE", full: "Execute — destroys any unit it damages", pri: 3 },
  CRUSH: { label: "CRUSH", full: "Crush — excess damage carries to the Hex", pri: 4 },
  REGROW: { label: "REGROW", full: "Regrow — heals back up each turn", pri: 4 },
  RUSH: { label: "RUSH", full: "Rush — can attack the turn it's played", pri: 4 },
  EXECUTE_ON_KILL: { label: "EXECUTE", full: "Execute — destroys any unit it damages", pri: 3 },
};

const KW_MAX = 3;

function visibleKeywords(keywords: string[]) {
  const seen = new Set<string>();
  const mapped = keywords
    .map((k) => ({ raw: k, d: KW_DISPLAY[k] }))
    .filter((x): x is { raw: string; d: (typeof KW_DISPLAY)[string] } => !!x.d)
    .filter((x) => (seen.has(x.d.label) ? false : (seen.add(x.d.label), true)))
    .sort((a, b) => a.d.pri - b.d.pri);
  return { shown: mapped.slice(0, KW_MAX), overflow: Math.max(0, mapped.length - KW_MAX) };
}

export function BoardCard({ card, onInspect, motion }: BoardCardProps) {
  const theme = factionTheme[card.faction];

  const states = [
    card.exhausted ? "exhausted" : "",
    card.damaged ? "damaged" : "",
    card.equipped ? "equipped" : ""
  ].filter(Boolean);
  const stateText = states.length ? `, ${states.join(", ")}` : "";

  const { shown: kw, overflow: kwOverflow } = visibleKeywords(card.keywords ?? []);
  const kwText = kw.length ? `, ${kw.map((k) => k.d.label.toLowerCase()).join(", ")}` : "";

  return (
    <button
      type="button"
      className={[
        "crypt-card",
        "crypt-card--board",
        card.damaged ? "is-damaged" : "",
        card.exhausted ? "is-exhausted" : "",
        card.equipped ? "is-equipped" : "",
        motion ? `mm-${motion}` : ""
      ].join(" ")}
      onClick={() => onInspect?.(card)}
      aria-label={`${card.name}, ${card.liveStats.attack} attack, ${card.liveStats.health} health, ${card.liveStats.armor} armor, ${card.liveStats.speed} speed${kwText}${stateText}`}
      style={{
        borderColor: theme.edge,
        // Layer the faction outer-glow as the OUTER accent over the inner frame
        // weight (rim-light + dark inner edge + grounding contact shadow) so the
        // board card reads as a physical object catching light, not a flat
        // sticker. Inline style replaces the CSS box-shadow on board cards, so
        // the frame layers are spelled out here to avoid clobbering them.
        boxShadow: `${theme.shadow}, inset 0 1px 0 rgba(245,242,232,0.14), inset 0 0 0 1px rgba(0,0,0,0.6), 0 6px 14px -4px rgba(0,0,0,0.7)`
      }}
    >
      <img src={card.imageUrl} alt={card.name} className="crypt-card__image" />
      <div className="crypt-card__scrim" />

      <div className="crypt-board-top">
        <FactionBadge faction={card.faction} />
        <SyncBadge level={card.syncLevel} label={card.syncLabel} />
      </div>

      <div className="crypt-board-bottom">
        <div className="crypt-card__title">{card.name}</div>

        {/* Combat keywords — read the fight without opening each card. GUARD is
            highlighted because it dictates legal targets this turn. */}
        {kw.length > 0 && (
          <div className="crypt-board-kws">
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
              <span className="crypt-board-kw crypt-board-kw--more" title="More keywords — tap the card to inspect">
                +{kwOverflow}
              </span>
            )}
          </div>
        )}

        {/* Board minions show only the two combat-relevant stats big — ATK/HP —
            with ARM/SPD as small pips ONLY when they matter (>0). CRIT/UTIL are
            almost always 0 and were pure clutter on a 108px card; they live on
            the full inspect view instead. */}
        <div className="crypt-board-gem">
          <span className="crypt-board-gem__atk">{card.liveStats.attack}</span>
          <span className="crypt-board-gem__sep">/</span>
          <span className="crypt-board-gem__hp">{card.liveStats.health}</span>
        </div>
        {(card.liveStats.armor > 0 || card.liveStats.speed > 0) && (
          <div className="crypt-board-pips">
            {card.liveStats.armor > 0 && <span className="crypt-board-pip crypt-board-pip--arm">{card.liveStats.armor} ARM</span>}
            {card.liveStats.speed > 0 && <span className="crypt-board-pip crypt-board-pip--spd">{card.liveStats.speed} SPD</span>}
          </div>
        )}
      </div>
    </button>
  );
}
