import React from "react";
import "../../styles/polish-hud.css";
import { ConfirmDialog } from "../ConfirmDialog";

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
  /** True when the local player can't act — match over OR it isn't their turn
   *  (the AI is animating). Disables End Turn so a press can't dispatch END_TURN
   *  on the opponent's behalf and corrupt the turn order. */
  actionsLocked?: boolean;
  /** Presentation-only nexus-damage motion tokens from useMatchMotion. */
  ownNexusHit?: NexusHit;
  enemyNexusHit?: NexusHit;
  /** Direct-click combat: when an attacker is selected, the enemy Hex pill
   *  becomes a click target so the player can attack face by clicking it. */
  enemyHexTargetable?: boolean;
  onAttackEnemyHex?: () => void;
  /** THE SURGE (#4 — the "Snap" beat). `canSurge` gates the once-per-match all-in
   *  button; `onSurge` fires it. Both absent for spectators / when the ruleset is off. */
  canSurge?: boolean;
  onSurge?: () => void;
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
  actionsLocked,
  ownNexusHit,
  enemyNexusHit,
  enemyHexTargetable,
  onAttackEnemyHex,
  canSurge,
  onSurge
}: Props) {
  const youActive = activePlayer === "P1";

  // Punch #19 — presentation-only turn/energy feel, derived from props so the
  // engine stays untouched. When the turn BECOMES yours, a one-shot ready
  // ripple cascades Active pill → Energy pill → End Turn (~120ms apart, see
  // polish-hud.css). When energy DROPS (a cost was paid), the readout pops.
  const [readyPulse, setReadyPulse] = React.useState(0);
  const [spendPulse, setSpendPulse] = React.useState(0);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const prevActive = React.useRef(youActive);
  const prevEnergy = React.useRef(energy);
  React.useEffect(() => {
    if (youActive && !prevActive.current) setReadyPulse((k) => k + 1);
    prevActive.current = youActive;
  }, [youActive]);
  React.useEffect(() => {
    if (energy < prevEnergy.current) setSpendPulse((k) => k + 1);
    prevEnergy.current = energy;
  }, [energy]);

  // SURGE OVER-MAX (presentation-only): the Surge spikes energy ABOVE the turn's
  // ramped max (e.g. 7 with a max of 5), which made the readout show "7 / 5" — a
  // value over its own denominator that reads as a broken stat. When energy
  // exceeds maxEnergy, label the excess as a Surge bonus instead of an
  // impossible-looking fraction. The engine value is untouched; this only
  // changes how it is shown. `surgeBonus` also drives the extra pip row below.
  const surgeBonus = Math.max(0, energy - maxEnergy);
  const pipCount = Math.max(maxEnergy, energy);

  // Keyed so every new turn restarts the one-shot animation; rendered only
  // after the first hand-off so nothing flashes on mount.
  const readyRipple = (seq?: 2 | 3) =>
    readyPulse > 0 ? (
      <span
        key={`ready-${readyPulse}`}
        className={`ph-ready${seq ? ` ph-ready--${seq}` : ""}`}
        aria-hidden="true"
      />
    ) : null;

  return (
    <>
    <header className="live-topbar">
      <div className="live-topbar__cluster">
        <div className="live-topbar__pill">
          <span className="live-topbar__label">Turn</span>
          <strong>{turn}</strong>
        </div>

        <div className={`live-topbar__pill live-topbar__pill--active ${youActive ? "mm-your-turn" : ""}`}>
          <span className="live-topbar__label">Active</span>
          <strong>{youActive ? "You" : "Opponent"}</strong>
          {readyRipple()}
        </div>

        <div
          className={`live-topbar__pill live-topbar__pill--nexus live-topbar__pill--nexus-own ${ownNexusHit ? "mm-nexus-hit" : ""}`}
          key={`own-nexus-${ownNexusHit?.key ?? "idle"}`}
        >
          <span className="live-topbar__label">{"Your Pyre \u2B22"}</span>
          <div
            className={`ph-crystal ph-crystal--own${p1Health <= 0 ? " ph-crystal--dead ph-crystal--dead-own" : ""}`}
            role="img"
            aria-label={`Your Pyre health ${p1Health}`}
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
              ? `Strike the enemy Pyre (${p2Health} health)`
              : `Enemy Pyre health ${p2Health}`
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
            {"Enemy Pyre \u2B22"}{enemyHexTargetable ? " · strike" : ""}
          </span>
          <div
            className={`ph-crystal ph-crystal--enemy${p2Health <= 0 ? " ph-crystal--dead ph-crystal--dead-enemy" : ""}`}
            role="img"
            aria-label={`Enemy Pyre health ${p2Health}`}
          >
            <div className="ph-crystal__gem" aria-hidden="true">
              <span className="ph-crystal__value">{p2Health}</span>
            </div>
          </div>
          {enemyNexusHit ? <span className="mm-float-dmg mm-float-dmg--nexus">{enemyNexusHit.damage}</span> : null}
        </div>

        <div className="live-topbar__pill live-topbar__pill--energy">
          <span className="live-topbar__label">Energy</span>
          {readyRipple(2)}
          <div
            key={`spend-${spendPulse}`}
            className={`ph-energy${spendPulse > 0 ? " ph-energy--spend" : ""}`}
            role="img"
            aria-label={
              surgeBonus > 0
                ? `Energy ${energy} (${maxEnergy} base plus ${surgeBonus} Surge bonus)`
                : `Energy ${energy} of ${maxEnergy}`
            }
          >
            <div className="ph-energy__pips" aria-hidden="true">
              {Array.from({ length: Math.max(0, pipCount) }).map((_, i) => (
                <span
                  key={i}
                  className={`ph-pip ${i < energy ? "ph-pip--filled" : ""}${
                    i >= maxEnergy && i < energy ? " ph-pip--surge" : ""
                  }`}
                />
              ))}
            </div>
            <span className="ph-energy__count" aria-hidden="true">
              {energy}<small> / {maxEnergy}</small>
              {surgeBonus > 0 ? <em className="ph-energy__surge"> +{surgeBonus} Surge</em> : null}
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
              // 2026-06-29: native confirm() → in-app ConfirmDialog (non-blocking,
              // on-brand, mobile-friendly).
              setConfirmReset(true);
            }}
          >
            Reset Match
          </button>
          {canSurge && onSurge ? (
            <button
              className="live-btn live-btn--surge"
              onClick={onSurge}
              title="SURGE — once per match: +2 energy now and ready your whole side for an all-in attack this turn."
              aria-label="Surge — once per match: gain 2 energy now and ready your whole side for an all-in attack this turn."
            >
              ⟡ Surge
            </button>
          ) : null}
          <button
            className="live-btn live-btn--primary"
            onClick={onEndTurn}
            disabled={actionsLocked}
            aria-disabled={actionsLocked}
            title={actionsLocked ? "Not your turn yet" : undefined}
          >
            End Turn
            {readyRipple(3)}
          </button>
        </div>
      </div>
    </header>
    <ConfirmDialog
      open={confirmReset}
      title="Reset this match?"
      body="The current duel will be lost and a fresh match dealt."
      confirmLabel="Reset Match"
      cancelLabel="Keep Playing"
      tone="danger"
      onConfirm={() => {
        setConfirmReset(false);
        onReset();
      }}
      onCancel={() => setConfirmReset(false)}
    />
    </>
  );
}
