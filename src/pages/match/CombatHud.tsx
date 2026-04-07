import { Link } from "react-router-dom";

type TopBarProps = {
  turn: number | undefined;
  phase: string;
  activePlayer: string;
  winner: string | null | undefined;
  onEndTurn: () => void;
  endTurnDisabled: boolean;
};

function MatchTopBar({
  turn,
  phase,
  activePlayer,
  winner,
  onEndTurn,
  endTurnDisabled,
}: TopBarProps) {
  return (
    <div className="crypt-match-hud-thin">
      <div className="crypt-match-hud-left">
        <Link to="/play" className="crypt-match-hub-link">
          Field
        </Link>
        <div className="crypt-match-hud-stats font-mono text-[10px] tabular-nums">
          <span>
            <span className="text-white/40">T</span> {turn ?? "—"}
          </span>
          <span className="text-white/25" aria-hidden>
            ·
          </span>
          <span>
            <span className="text-white/40">Phase</span>{" "}
            <span className="text-[color:var(--color-crypt-text)]">{phase}</span>
          </span>
          <span className="text-white/25" aria-hidden>
            ·
          </span>
          <span>
            <span className="text-white/40">Active</span>{" "}
            <span className="text-[color:var(--color-crypt-accent)]">{activePlayer}</span>
          </span>
          {winner && (
            <>
              <span className="text-white/25" aria-hidden>
                ·
              </span>
              <span className="text-[color:var(--color-crypt-accent)]">Won {String(winner)}</span>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        disabled={endTurnDisabled}
        className="crypt-btn-endturn-match"
        onClick={onEndTurn}
      >
        End turn
      </button>
    </div>
  );
}

type StrikeProps = {
  enemyFrontEmpty: boolean;
  noLegalTargets: boolean;
  onStrikeFace: () => void;
  onCancel: () => void;
};

function StrikeStrip({
  enemyFrontEmpty,
  noLegalTargets,
  onStrikeFace,
  onCancel,
}: StrikeProps) {
  return (
    <div className="crypt-combat-strip" role="status">
      <span className="crypt-combat-strip-label">Attacking</span>
      {enemyFrontEmpty ? (
        <button type="button" className="crypt-combat-strip-action" onClick={onStrikeFace}>
          Strike face
        </button>
      ) : (
        <span className="crypt-combat-strip-hint">
          {noLegalTargets
            ? "No legal targets."
            : "Cyan outline = legal target. Others cannot be hit."}
        </span>
      )}
      <button type="button" className="crypt-combat-strip-cancel ml-auto" onClick={onCancel}>
        Cancel attack
      </button>
    </div>
  );
}

export type CombatHudProps = TopBarProps & {
  attackPick: string | null;
  enemyFrontEmpty: boolean;
  legalTargetCount: number;
  onStrikeFace: () => void;
  onCancelCombat: () => void;
};

/**
 * Minimal match HUD: turn / phase / active / end turn only.
 * Strike flow: thin cyan strip when an attacker is declared.
 */
export function CombatHud({
  turn,
  phase,
  activePlayer,
  winner,
  onEndTurn,
  endTurnDisabled,
  attackPick,
  enemyFrontEmpty,
  legalTargetCount,
  onStrikeFace,
  onCancelCombat,
}: CombatHudProps) {
  const striking = !!attackPick && !winner;

  return (
    <header className="crypt-match-header shrink-0">
      <MatchTopBar
        turn={turn}
        phase={phase}
        activePlayer={activePlayer}
        winner={winner}
        onEndTurn={onEndTurn}
        endTurnDisabled={endTurnDisabled}
      />
      {striking && (
        <StrikeStrip
          enemyFrontEmpty={enemyFrontEmpty}
          noLegalTargets={!enemyFrontEmpty && legalTargetCount === 0}
          onStrikeFace={onStrikeFace}
          onCancel={onCancelCombat}
        />
      )}
    </header>
  );
}
