import React from "react";
import { PlayCardVM } from "../../ui/cryptTypes";
import { factionTheme } from "../../ui/cryptTheme";
import { SyncBadge } from "./MatchBadges";
import { FxVideo } from "./FxVideo";

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
 * learnable, not cryptic.
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
        card.damaged ? "is-damaged" : "",
        card.exhausted ? "is-exhausted" : "",
        card.equipped ? "is-equipped" : "",
        motion ? `mm-${motion}` : "",
      ].join(" ")}
      onClick={() => onInspect?.(card)}
      aria-label={`${card.name}, ${attack} attack, ${health} health, ${armor} armor, ${speed} speed${kwText}${stateText}`}
      style={{ "--cf-edge": theme.edge, "--cf-glow": theme.glow } as React.CSSProperties}
    >
      {/* ART — clean square, no text over it. The NFT render is the card. */}
      <div className="crypt-card__art">
        <img src={card.imageUrl} alt={card.name} className="crypt-card__image" />
        {/* Commissioned combat-FX overlays (black-keyed via blend mode) — the
            spark/burst light plays OVER the art on the motion beat. */}
        {motion === "damage" ? <FxVideo src="/crypt-assets/fx-impact.mp4" ttlMs={1100} /> : null}
        {motion === "enter" ? <FxVideo src="/crypt-assets/fx-deploy.mp4" ttlMs={1300} /> : null}
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
