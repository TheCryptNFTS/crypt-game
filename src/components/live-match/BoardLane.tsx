import React from "react";
import { BoardCard } from "../crypt/BoardCard";
import { PlayCardVM } from "../../ui/cryptTypes";
import type { DyingUnit, UnitMotion } from "../../hooks/useMatchMotion";

type Props = {
  title: string;
  cards: PlayCardVM[];
  onSelect: (card: PlayCardVM) => void;
  /**
   * Affordance highlight driven by the current selection: "deploy" lights the
   * lane as a valid landing spot for the selected hand unit, "target" lights it
   * as a valid attack target for the selected attacker. Presentation-only.
   */
  highlight?: "deploy" | "target" | null;
  /** Short call-to-action shown in the header when the lane is highlighted. */
  hint?: string;
  /**
   * Small side caption rendered on the LEFT of the lane row ("BACK / ENEMY").
   * Defaults to `title` when absent. Presentation-only — `title` is still used
   * for the aria-label so screen-reader output is unchanged.
   */
  sideLabel?: string;
  /** Presentation-only motion state from useMatchMotion (all optional). */
  unitMotion?: Record<string, UnitMotion>;
  floats?: { key: number; unitId: string; amount: number }[];
  dying?: DyingUnit[];
};

/** Visual slot count per lane (the board's design grid). Occupied slots render
 *  a BoardCard; the remainder render as designed empty hex cells. This is purely
 *  a layout target — the reducer still enforces the real per-lane cap. */
const LANE_SLOTS = 5;

export function BoardLane({
  title,
  cards,
  onSelect,
  highlight,
  hint,
  sideLabel,
  unitMotion,
  floats,
  dying,
}: Props) {
  const laneDying = dying ?? [];

  const unitCount = cards.length;
  const laneLabel = `${title}, ${unitCount} unit${unitCount === 1 ? "" : "s"}`;

  // Occupied cells = the live cards followed by the lingering death-ghosts. The
  // remaining cells (up to LANE_SLOTS, more if a lane somehow overfills) render
  // as designed empty slots so the row always reads as a deliberate grid.
  const occupied = cards.length + laneDying.length;
  const emptyCount = Math.max(0, LANE_SLOTS - occupied);

  return (
    <section
      className={`live-lane${highlight ? ` live-lane--${highlight}` : ""}`}
      role="region"
      aria-label={laneLabel}
    >
      <span className="live-lane__side" aria-hidden="true">
        {sideLabel ?? title}
      </span>

      {highlight && hint ? (
        <span className="live-lane__hint" aria-hidden="true">
          {"\u25B8"} {hint}
        </span>
      ) : null}

      <div className="live-lane__cards">
        {cards.map((card) => {
          const cardFloats = (floats ?? []).filter((f) => f.unitId === card.id);
          return (
            <div className="live-lane__slot live-lane__slot--filled" key={card.id}>
              <BoardCard
                card={card}
                onInspect={onSelect}
                motion={unitMotion?.[card.id]}
              />
              {cardFloats.map((f) => (
                <span className="mm-float-dmg" key={f.key}>
                  {f.amount}
                </span>
              ))}
            </div>
          );
        })}

        {/* Dying units linger one beat as a fading ghost (presentation only). */}
        {laneDying.map((d) => (
          <div
            className="live-lane__slot live-lane__slot--filled mm-death-wrap"
            key={`dead-${d.id}`}
            aria-hidden="true"
          >
            <BoardCard card={d.vm} />
          </div>
        ))}

        {/* Designed empty slots: a faint hexagon cell on a dark hex-grid texture
            so an unoccupied lane reads as an intentional grid, not barren. */}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <div
            className="live-lane__slot live-lane__slot--empty"
            key={`empty-${i}`}
            aria-hidden="true"
          >
            <span className="live-lane__hex" />
          </div>
        ))}
      </div>
    </section>
  );
}
