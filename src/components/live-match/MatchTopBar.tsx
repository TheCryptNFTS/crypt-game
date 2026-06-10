import React from "react";
import "../../styles/polish-hud.css";

type NexusHit = { key: number; damage: number } | null;

type Props = {
  turn: number;
  activePlayer: string;
  p1Health: number;
  p2Health: number;
  energy: number;
  maxEnergy: number;
  deckSource: "owned" | "demo";
  onEndTurn: () => void;
  onReset: () => void;
  /** Presentation-only nexus-damage motion tokens from useMatchMotion. */
  ownNexusHit?: NexusHit;
  enemyNexusHit?: NexusHit;
  /** Direct-click combat: when an attacker is selected, the enemy Hex pill
   *  becomes a click target so the player can attack face by clicking it. */
  enemyHexTargetable?: boolean;
  onAttackEnemyHex?: () => void;
};

export function MatchTopBar({
  turn,
  activePlayer,
  p1Health,
  p2Health,
  energy,
  maxEnergy,
  deckSource,
  onEndTurn,
  onReset,
  ownNexusHit,
  enemyNexusHit,
  enemyHexTargetable,
  onAttackEnemyHex
}: Props) {
  const youActive = activePlayer === "P1";
  return (
    <header className="live-topbar">
      <div className="live-topbar__cluster">
        <div className="live-topbar__pill">
          <span className="live-topbar__label">Turn</span>
          <strong>{turn}</strong>
        </div>

        <div className={`live-topbar__pill live-topbar__pill--active ${youActive ? "mm-your-turn" : ""}`}>
          <span className="live-topbar__label">Active</span>
          <strong>{youActive ? "You" : "Opponent"}</strong>
        </div>

        <div
          className={`live-topbar__pill live-topbar__pill--nexus live-topbar__pill--nexus-own ${ownNexusHit ? "mm-nexus-hit" : ""}`}
          key={`own-nexus-${ownNexusHit?.key ?? "idle"}`}
        >
          <span className="live-topbar__label">{"Your Hex \u2B22"}</span>
          <div
            className={`ph-crystal ph-crystal--own${p1Health <= 0 ? " ph-crystal--dead ph-crystal--dead-own" : ""}`}
            role="img"
            aria-label={`Your Hex health ${p1Health}`}
          >
            <div className="ph-crystal__gem" aria-hidden="true">
              <span className="ph-crystal__value">{p1Health}</span>
            </div>
          </div>
          {ownNexusHit ? <span className="mm-float-dmg mm-float-dmg--nexus">{ownNexusHit.damage}</span> : null}
        </div>

        <div
          className={[
            "live-topbar__pill live-topbar__pill--nexus live-topbar__pill--nexus-enemy",
            enemyNexusHit ? "mm-nexus-hit" : "",
            enemyHexTargetable ? "live-topbar__pill--strikeable" : "",
          ].join(" ")}
          key={`enemy-nexus-${enemyNexusHit?.key ?? "idle"}`}
          role="button"
          aria-disabled={!enemyHexTargetable}
          tabIndex={enemyHexTargetable ? 0 : -1}
          aria-label={
            enemyHexTargetable
              ? `Strike the enemy Hex (${p2Health} health)`
              : `Enemy Hex health ${p2Health}`
          }
          onClick={() => {
            if (enemyHexTargetable) onAttackEnemyHex?.();
          }}
          onKeyDown={(e) => {
            if (enemyHexTargetable && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onAttackEnemyHex?.();
            }
          }}
        >
          <span className="live-topbar__label">
            {"Enemy Hex \u2B22"}{enemyHexTargetable ? " · strike" : ""}
          </span>
          <div
            className={`ph-crystal ph-crystal--enemy${p2Health <= 0 ? " ph-crystal--dead ph-crystal--dead-enemy" : ""}`}
            role="img"
            aria-label={`Enemy Hex health ${p2Health}`}
          >
            <div className="ph-crystal__gem" aria-hidden="true">
              <span className="ph-crystal__value">{p2Health}</span>
            </div>
          </div>
          {enemyNexusHit ? <span className="mm-float-dmg mm-float-dmg--nexus">{enemyNexusHit.damage}</span> : null}
        </div>

        <div className="live-topbar__pill live-topbar__pill--energy">
          <span className="live-topbar__label">Energy</span>
          <div
            className="ph-energy"
            role="img"
            aria-label={`Energy ${energy} of ${maxEnergy}`}
          >
            <div className="ph-energy__pips" aria-hidden="true">
              {Array.from({ length: Math.max(0, maxEnergy) }).map((_, i) => (
                <span
                  key={i}
                  className={`ph-pip ${i < energy ? "ph-pip--filled" : ""}`}
                />
              ))}
            </div>
            <span className="ph-energy__count" aria-hidden="true">
              {energy}<small> / {maxEnergy}</small>
            </span>
          </div>
        </div>

        <div className={`live-topbar__pill ${deckSource === "owned" ? "live-topbar__pill--active" : ""}`}>
          <span className="live-topbar__label">Deck</span>
          <strong>{deckSource === "owned" ? "Your Archives" : "Starter Deck"}</strong>
        </div>
      </div>

      <div className="live-topbar__meta">
        <div className="live-phase">
          <span className="live-phase__dot" />
          <span>Live Match</span>
        </div>

        <div className="live-topbar__actions">
          <button
            className="live-btn live-btn--ghost"
            onClick={() => {
              // Teardown §7: Reset sits one slip away from End Turn — the
              // most-pressed button in the game — and used to vaporize the match
              // instantly. PvP's Concede already confirms; solo Reset now matches.
              if (window.confirm("Reset this match? The current duel will be lost.")) {
                onReset();
              }
            }}
          >
            Reset Match
          </button>
          <button className="live-btn live-btn--primary" onClick={onEndTurn}>
            End Turn
          </button>
        </div>
      </div>
    </header>
  );
}
