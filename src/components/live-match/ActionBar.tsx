import React from "react";

type Props = {
  selectedType: string | null;
  canEquip: boolean;
  canCast: boolean;
  canAttackUnit: boolean;
  canAttackFace: boolean;
  /** Whether the player can pay for the currently selected card. */
  affordable: boolean;
  /** Current energy and the selected card's cost — used for the nudge text. */
  energy: number;
  selectedCost: number | null;
  /** Transient "why nothing happened" message from the last rejected action. */
  rejectMessage: string | null;
  onPlayFront: () => void;
  onPlayBack: () => void;
  onPlayArtifact: () => void;
  onCastSpell: () => void;
  onEquip: () => void;
  onAttackUnit: () => void;
  onAttackFace: () => void;
};

export function ActionBar(props: Props) {
  // A selected unit/artifact you can't pay for is the #1 "why is nothing
  // happening?" trap: the play button used to fire a silent reducer no-op. We
  // surface the reason here (where the player is looking) and disable the
  // play buttons so the dead click can't happen.
  const isPlayable =
    props.selectedType === "unit" ||
    props.selectedType === "artifact" ||
    props.selectedType === "spell";
  const blockedByEnergy = isPlayable && !props.affordable;

  // Combat readiness: a board unit is selected (no hand card). The board passes
  // canAttackUnit/canAttackFace so we can tell the player their next move.
  const combatReady = !props.selectedType && (props.canAttackUnit || props.canAttackFace);

  const selectionText = props.rejectMessage
    ? props.rejectMessage
    : blockedByEnergy
      ? `Not enough energy — needs ${props.selectedCost ?? "?"}, you have ${props.energy}.`
      : props.selectedType === "unit"
        ? "Unit selected. Press Play Front or Play Back to deploy."
        : props.selectedType === "equipment"
          ? "Equipment selected. Choose one of your units."
          : props.selectedType === "artifact"
            ? "Artifact selected. Play it to the relic row."
            : props.selectedType === "spell"
            ? "Spell selected. Pick a target unit if it needs one, then Cast."
            : combatReady
              ? props.canAttackUnit
                ? "Unit ready. Press Attack Selected Enemy, or Attack the enemy Pyre (their life)."
                : "Unit ready. Press Attack Pyre to strike the enemy's life crystal."
              : "Your move — tap a glowing card below to play it, or tap one of your units to attack.";

  // Amber-highlight whenever we're telling the player WHY something is blocked.
  const showWarn = !!props.rejectMessage || blockedByEnergy;

  return (
    <section className="live-actionbar" role="region" aria-label="Match actions">
      <div className="live-actionbar__header">
        <div>
          <h3>Actions</h3>
          <p
            role="status"
            aria-live="polite"
            className={showWarn ? "live-actionbar__warn" : undefined}
          >
            {selectionText}
          </p>
        </div>
      </div>

      <div className="live-actionbar__group">
        <span className="live-actionbar__group-label">Play</span>
        <div className="live-actionbar__buttons">
          <button
            className="live-btn live-btn--secondary"
            disabled={props.selectedType !== "unit" || !props.affordable}
            onClick={props.onPlayFront}
          >
            Play Front
          </button>

          <button
            className="live-btn live-btn--secondary"
            disabled={props.selectedType !== "unit" || !props.affordable}
            onClick={props.onPlayBack}
          >
            Play Back
          </button>

          <button
            className="live-btn live-btn--secondary"
            disabled={props.selectedType !== "artifact" || !props.affordable}
            onClick={props.onPlayArtifact}
          >
            Play Artifact
          </button>

          <button
            className="live-btn live-btn--secondary"
            disabled={!props.canCast || !props.affordable}
            onClick={props.onCastSpell}
          >
            Cast Spell
          </button>

          <button
            className="live-btn live-btn--secondary"
            disabled={!props.canEquip}
            onClick={props.onEquip}
          >
            Equip To Unit
          </button>
        </div>
      </div>

      {/* Combat is a QUIET FALLBACK, not a co-equal primary. Direct-click is the
          taught path: click your unit, then click an enemy unit or the glowing
          Hex pill. We only surface these buttons once a unit is actually
          selected (combatReady), and style them small/muted so they read as
          "or use these" — discoverable for keyboard/accessibility without
          competing with the board. */}
      {combatReady ? (
        <div className="live-actionbar__group live-actionbar__group--fallback">
          <span className="live-actionbar__group-label">
            Or use these — clicking the board does the same
          </span>
          <div className="live-actionbar__buttons live-actionbar__buttons--fallback">
            <button
              className="live-btn live-btn--ghost live-btn--fallback"
              disabled={!props.canAttackUnit}
              onClick={props.onAttackUnit}
            >
              Attack Selected Enemy
            </button>

            <button
              className="live-btn live-btn--ghost live-btn--fallback"
              disabled={!props.canAttackFace}
              onClick={props.onAttackFace}
            >
              Attack Pyre
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
