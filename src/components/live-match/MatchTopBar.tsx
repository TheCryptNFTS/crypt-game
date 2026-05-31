import React from "react";

type Props = {
  turn: number;
  activePlayer: string;
  p1Health: number;
  p2Health: number;
  energy: number;
  maxEnergy: number;
  deckSource: "owned" | "demo";
  canRecalibrate: boolean;
  onRecalibrate: () => void;
  onEndTurn: () => void;
  onReset: () => void;
};

export function MatchTopBar({
  turn,
  activePlayer,
  p1Health,
  p2Health,
  energy,
  maxEnergy,
  deckSource,
  canRecalibrate,
  onRecalibrate,
  onEndTurn,
  onReset
}: Props) {
  const youActive = activePlayer === "P1";
  return (
    <header className="live-topbar">
      <div className="live-topbar__cluster">
        <div className="live-topbar__pill">
          <span className="live-topbar__label">Turn</span>
          <strong>{turn}</strong>
        </div>

        <div className="live-topbar__pill live-topbar__pill--active">
          <span className="live-topbar__label">Active</span>
          <strong>{youActive ? "You" : "Opponent"}</strong>
        </div>

        <div className="live-topbar__pill">
          <span className="live-topbar__label">Your Nexus</span>
          <strong>{p1Health}</strong>
        </div>

        <div className="live-topbar__pill">
          <span className="live-topbar__label">Enemy Nexus</span>
          <strong>{p2Health}</strong>
        </div>

        <div className="live-topbar__pill live-topbar__pill--active">
          <span className="live-topbar__label">Energy</span>
          <strong>{energy} / {maxEnergy}</strong>
        </div>

        <div className={`live-topbar__pill ${deckSource === "owned" ? "live-topbar__pill--active" : ""}`}>
          <span className="live-topbar__label">Deck</span>
          <strong>{deckSource === "owned" ? "Your Archives" : "Demo"}</strong>
        </div>
      </div>

      <div className="live-topbar__meta">
        <div className="live-phase">
          <span className="live-phase__dot" />
          <span>Live Match</span>
        </div>

        <div className="live-topbar__actions">
          {canRecalibrate ? (
            <button className="live-btn live-btn--secondary" onClick={onRecalibrate}>
              Recalibrate Hand
            </button>
          ) : null}
          <button className="live-btn live-btn--ghost" onClick={onReset}>
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
