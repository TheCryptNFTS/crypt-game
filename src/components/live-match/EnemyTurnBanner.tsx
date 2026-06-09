import React from "react";

/*
 * EnemyTurnBanner — a persistent "OPPONENT PHASE" presence band shown the whole
 * time it's the opponent's turn (solo or PvP). It gives the AI's staggered turn a
 * watchable presence instead of dead air with your controls mysteriously greyed
 * out — the #1 confusion at the most-repeated moment in the match.
 *
 * PURE render-derived + CSS-animated: it mounts only while `active` and runs no
 * rAF / no effect / no timer, so it can't trip the known live-board static-flag
 * instability (same discipline as the cycle-1/3/5 affordances). pointer-events:
 * none so it never blocks a click into the board. Reduced-motion → static band.
 */
export function EnemyTurnBanner({
  active,
  enemyName,
}: {
  active: boolean;
  enemyName: string;
}) {
  if (!active) return null;
  return (
    <div className="enemy-turn-band" aria-hidden="true">
      <span className="enemy-turn-band__glyph">{"\u2B22"}</span>
      <span className="enemy-turn-band__kicker">Opponent Phase</span>
      <span className="enemy-turn-band__name">{enemyName}</span>
      <span className="enemy-turn-band__dots" aria-hidden="true">
        <i /><i /><i />
      </span>
    </div>
  );
}
