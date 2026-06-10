import React from "react";
import { BoardCard } from "../crypt/BoardCard";
import { PlayCardVM } from "../../ui/cryptTypes";
import type { DyingUnit, UnitMotion } from "../../hooks/useMatchMotion";
import { FxVideo } from "../crypt/FxVideo";

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
  /**
   * Deploy-by-click: when set (a hand unit is selected and this is one of YOUR
   * lanes), clicking an empty slot deploys the selected unit into THIS lane —
   * the same result as the ActionBar's Play Front/Back. The empty cells become
   * real buttons and the deploy-ready highlight already lights them gold.
   * Absent on enemy lanes / when nothing deployable is selected, so empty cells
   * stay inert there.
   */
  onDeployToEmpty?: () => void;
};

/** Minimum visible slots per lane (the board's design grid). Occupied slots
 *  render a BoardCard; empty hex cells backfill only up to this minimum so a
 *  1- or 2-unit lane shows BIG centered heroes (not tiny cards marooned in a
 *  rigid 5-column grid). A lane that overfills past this simply shows all its
 *  units. Purely a layout target — the reducer still enforces the real cap. */
const LANE_SLOTS = 3;

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
  onDeployToEmpty,
}: Props) {
  const laneDying = dying ?? [];
  const canDeploy = !!onDeployToEmpty;

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

        {/* Dying units linger one beat as a fading ghost (presentation only).
            The commissioned death-dissolve FX plays over the ghost. */}
        {laneDying.map((d) => (
          <div
            className="live-lane__slot live-lane__slot--filled mm-death-wrap"
            key={`dead-${d.id}`}
            aria-hidden="true"
          >
            <BoardCard card={d.vm} />
            <FxVideo src="/crypt-assets/fx-death.mp4" ttlMs={1500} />
          </div>
        ))}

        {/* Designed empty slots: a faint hexagon cell on a dark hex-grid texture
            so an unoccupied lane reads as an intentional grid, not barren. When a
            hand unit is selected (canDeploy) each empty cell becomes a real
            DEPLOY button — clicking it plays the selected unit into this lane,
            the same path as Play Front/Back. */}
        {Array.from({ length: emptyCount }).map((_, i) =>
          canDeploy ? (
            <button
              type="button"
              className="live-lane__slot live-lane__slot--empty live-lane__slot--deployable"
              key={`empty-${i}`}
              aria-label={`Deploy here — ${title}`}
              onClick={onDeployToEmpty}
            >
              <span className="live-lane__hex" />
            </button>
          ) : (
            <div
              className="live-lane__slot live-lane__slot--empty"
              key={`empty-${i}`}
              aria-hidden="true"
            >
              <span className="live-lane__hex" />
            </div>
          )
        )}
      </div>
    </section>
  );
}
