import React from "react";

type Props = {
  selectedType: string | null;
  canEquip: boolean;
  canAttackUnit: boolean;
  canAttackFace: boolean;
  onPlayFront: () => void;
  onPlayBack: () => void;
  onPlayArtifact: () => void;
  onEquip: () => void;
  onAttackUnit: () => void;
  onAttackFace: () => void;
};

export function ActionBar(props: Props) {
  const selectionText =
    props.selectedType === "unit"
      ? "Unit selected. Choose a lane."
      : props.selectedType === "equipment"
        ? "Equipment selected. Choose one of your units."
        : props.selectedType === "artifact"
          ? "Artifact selected. Play it to the relic row."
          : "Select a card or unit to act.";

  return (
    <section className="live-actionbar">
      <div className="live-actionbar__header">
        <div>
          <h3>Actions</h3>
          <p>{selectionText}</p>
        </div>
      </div>

      <div className="live-actionbar__group">
        <span className="live-actionbar__group-label">Play</span>
        <div className="live-actionbar__buttons">
          <button
            className="live-btn live-btn--secondary"
            disabled={props.selectedType !== "unit"}
            onClick={props.onPlayFront}
          >
            Play Front
          </button>

          <button
            className="live-btn live-btn--secondary"
            disabled={props.selectedType !== "unit"}
            onClick={props.onPlayBack}
          >
            Play Back
          </button>

          <button
            className="live-btn live-btn--secondary"
            disabled={props.selectedType !== "artifact"}
            onClick={props.onPlayArtifact}
          >
            Play Artifact
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

      <div className="live-actionbar__group">
        <span className="live-actionbar__group-label">Combat</span>
        <div className="live-actionbar__buttons">
          <button
            className="live-btn live-btn--danger"
            disabled={!props.canAttackUnit}
            onClick={props.onAttackUnit}
          >
            Attack Selected Enemy
          </button>

          <button
            className="live-btn live-btn--danger-soft"
            disabled={!props.canAttackFace}
            onClick={props.onAttackFace}
          >
            Attack Face
          </button>
        </div>
      </div>
    </section>
  );
}
