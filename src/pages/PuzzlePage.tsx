import { useMemo, useState, useCallback } from "react";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import { PUZZLES, solvePuzzle, type PuzzleDef } from "../engine/puzzles";
import type { MatchState, PlayerId, UnitInPlay } from "../engine/state";
import { t } from "../i18n";
import { isColorblindSafe, toggleColorblindSafe } from "../a11y/palette";

/**
 * PUZZLE / SOLO MODE page (A9). Deterministic single-player tactical scenarios
 * driven by the SHIPPED reducer (`src/engine/puzzles.ts`). Each puzzle has one
 * winning line; "Reveal" replays the intended solution through the reducer and
 * shows the resulting (won) board. No new engine ops, no chain, no RNG.
 *
 * A6 demo lives here too: copy comes through `t()` (i18n scaffold) and the page
 * carries the colorblind-safe palette toggle + aria-labels on key controls.
 */

/** A single board unit chip. Status is conveyed by TEXT + glyph (not color alone)
 *  so it stays legible under any palette — the a11y discipline. */
function UnitChip({ unit, dead }: { unit: UnitInPlay; dead?: boolean }) {
  const guard = unit.keywords?.includes("GUARD");
  return (
    <div
      className="crypt-puzzle-unit"
      data-dead={dead ? "true" : undefined}
      role="img"
      aria-label={`${dead ? "Defeated unit" : "Unit"} ${unit.cardId}, ${unit.attack} attack, ${unit.health} health${
        guard ? ", Guard" : ""
      }`}
    >
      <span className="crypt-puzzle-unit-stat">{unit.attack}</span>
      <span className="crypt-puzzle-unit-sep" aria-hidden>
        /
      </span>
      <span className="crypt-puzzle-unit-stat">{unit.health}</span>
      {guard ? (
        <span className="crypt-puzzle-unit-kw" aria-hidden>
          ⬡
        </span>
      ) : null}
    </div>
  );
}

/** Render one side's lanes from a reducer MatchState (read-only). */
function SideBoard({ state, seat, label }: { state: MatchState; seat: PlayerId; label: string }) {
  const p = state.players[seat];
  const units = [...p.board.front, ...p.board.back];
  return (
    <div className="crypt-puzzle-side" aria-label={`${label}: nexus ${p.nexusHealth} health`}>
      <div className="crypt-puzzle-side-head">
        <span className="crypt-puzzle-side-label">{label}</span>
        <span className="crypt-puzzle-nexus" aria-hidden>
          ⬡ {p.nexusHealth}
        </span>
      </div>
      <div className="crypt-puzzle-lane">
        {units.length === 0 ? (
          <span className="crypt-puzzle-empty">— empty —</span>
        ) : (
          units.map((u) => <UnitChip key={u.instanceId} unit={u} dead={u.health <= 0} />)
        )}
      </div>
    </div>
  );
}

function PuzzleCard({ puzzle }: { puzzle: PuzzleDef }) {
  const initial = useMemo(() => puzzle.build(), [puzzle]);
  const [revealed, setRevealed] = useState(false);

  // The solved board is the reducer's settled state after the intended line.
  const solved = useMemo(() => (revealed ? solvePuzzle(puzzle) : null), [revealed, puzzle]);
  const shown = solved?.finalState ?? initial;
  const won = solved?.solved ?? false;

  return (
    <article className="crypt-puzzle-card" aria-label={`Puzzle: ${puzzle.title}`}>
      <header className="crypt-puzzle-card-head">
        <h3 className="crypt-puzzle-card-title">{puzzle.title}</h3>
        <span className="crypt-puzzle-diff" aria-label={`Difficulty: ${puzzle.difficulty}`}>
          {puzzle.difficulty}
        </span>
      </header>
      <p className="crypt-puzzle-objective">
        <span className="crypt-puzzle-objective-label">{t("puzzle.objective")}:</span> {puzzle.objective}
      </p>

      <div className="crypt-puzzle-board" aria-live="polite">
        <SideBoard state={shown} seat="P2" label="Enemy" />
        <div className="crypt-puzzle-divider" aria-hidden />
        <SideBoard state={shown} seat="P1" label="You" />
      </div>

      {won ? (
        <p className="crypt-puzzle-result" role="status">
          {t("puzzle.solved")}
        </p>
      ) : null}

      <div className="crypt-puzzle-actions">
        {revealed ? (
          <button
            type="button"
            className="crypt-puzzle-btn"
            onClick={() => setRevealed(false)}
            aria-label={`${t("puzzle.reset")}: ${puzzle.title}`}
          >
            {t("puzzle.reset")}
          </button>
        ) : (
          <button
            type="button"
            className="crypt-puzzle-btn crypt-puzzle-btn--primary"
            onClick={() => setRevealed(true)}
            aria-label={`${t("puzzle.solveCta")}: ${puzzle.title}`}
          >
            {t("puzzle.solveCta")}
          </button>
        )}
      </div>
    </article>
  );
}

export default function PuzzlePage() {
  const [cbSafe, setCbSafe] = useState(() => isColorblindSafe());
  const onTogglePalette = useCallback(() => setCbSafe(toggleColorblindSafe()), []);

  return (
    <CryptPageFrame eyebrow={t("puzzle.eyebrow")} title={t("puzzle.title")} lead={t("puzzle.lead")}>
      <div className="crypt-puzzle-toolbar">
        <label className="crypt-a11y-toggle">
          <input
            type="checkbox"
            checked={cbSafe}
            onChange={onTogglePalette}
            aria-label={t("a11y.palette.toggle")}
          />
          <span>{t("a11y.palette.toggle")}</span>
        </label>
      </div>

      <div className="crypt-puzzle-grid">
        {PUZZLES.map((p) => (
          <PuzzleCard key={p.id} puzzle={p} />
        ))}
      </div>
    </CryptPageFrame>
  );
}
